import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../shared/data/datasources/communication_remote_ds.dart';
import '../../data/datasources/admin_remote_ds.dart';
import '../providers/admin_provider.dart';

class AdminManagementScreen extends ConsumerStatefulWidget {
  const AdminManagementScreen({super.key});

  @override
  ConsumerState<AdminManagementScreen> createState() => _State();
}

class _State extends ConsumerState<AdminManagementScreen> {
  var _formKey = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _firstName = TextEditingController();
  final _lastName = TextEditingController();
  final _jobTitle = TextEditingController();
  String? _program;
  String? _campus;
  bool _loading = true;
  bool _saving = false;
  bool _deleting = false;
  bool _hasLoaded = false;
  String? _readError;
  String? _writeError;
  String? _confirmedChange;
  Future<void>? _inFlightLoad;
  bool get _busy => _loading || _saving || _deleting;
  List<dynamic> _admins = [];

  @override
  void initState() {
    super.initState();
    Future.microtask(_load);
  }

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    _firstName.dispose();
    _lastName.dispose();
    _jobTitle.dispose();
    super.dispose();
  }

  Future<void> _load({bool afterWrite = false}) {
    if (!mounted || (!afterWrite && (_saving || _deleting))) {
      return Future.value();
    }
    if (_inFlightLoad != null) return _inFlightLoad!;
    final load = _performLoad();
    _inFlightLoad = load;
    load.whenComplete(() {
      if (identical(_inFlightLoad, load)) _inFlightLoad = null;
    });
    return load;
  }

  Future<void> _performLoad() async {
    setState(() => _loading = true);
    try {
      final admins = await ref.read(adminRemoteDataSourceProvider).listAdmins();
      if (!mounted) return;
      setState(() {
        _admins = admins;
        _hasLoaded = true;
        _readError = null;
        _confirmedChange = null;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      final status = e is DioException ? e.response?.statusCode : null;
      setState(() {
        _readError = switch (status) {
          401 => 'Tu sesión expiró. Inicia sesión nuevamente.',
          403 => 'No tienes permiso para consultar esta información.',
          404 => 'No se encontró la información solicitada.',
          429 => 'Demasiadas solicitudes. Espera antes de reintentar.',
          500 => 'Ocurrió un error en el servidor. Intenta nuevamente.',
          503 => 'El servicio no está disponible temporalmente.',
          _ =>
            'No se pudo cargar la información. Comprueba la conexión y reintenta.',
        };
        _loading = false;
      });
    }
  }

  Future<void> _create() async {
    if (_busy ||
        _readError != null ||
        _formKey.currentState?.validate() != true) {
      return;
    }
    final payload = <String, dynamic>{
      'email': _email.text.trim(),
      'password': _password.text,
      'first_name': _firstName.text.trim(),
      'last_name': _lastName.text.trim(),
      'job_title': _jobTitle.text.trim().isEmpty ? null : _jobTitle.text.trim(),
      'program': _program,
      'campus': _campus,
    };
    setState(() {
      _saving = true;
      _writeError = null;
      _confirmedChange = null;
    });
    try {
      await ref.read(adminRemoteDataSourceProvider).createAdmin(payload);
      if (!mounted) return;
      _email.clear();
      _password.clear();
      _firstName.clear();
      _lastName.clear();
      _jobTitle.clear();
      setState(() {
        _program = null;
        _campus = null;
        _formKey = GlobalKey<FormState>();
        _confirmedChange =
            'El administrador se creó, pero no se pudo actualizar la lista.';
      });
      await _load(afterWrite: true);
    } catch (_) {
      if (mounted) {
        setState(() => _writeError = 'No se pudo crear el administrador.');
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _deleteAdmin(String adminId) async {
    if (_busy || _readError != null || adminId.isEmpty) return;
    setState(() => _deleting = true);
    try {
      final confirm = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('Eliminar administrador'),
          content: const Text('Esta cuenta de administrador sera eliminada.'),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Cancelar'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(ctx, true),
              style: FilledButton.styleFrom(backgroundColor: AppColors.error),
              child: const Text('Eliminar'),
            ),
          ],
        ),
      );
      if (!mounted || confirm != true) return;
      setState(() {
        _writeError = null;
        _confirmedChange = null;
      });
      await ref.read(adminRemoteDataSourceProvider).deleteAdmin(adminId);
      if (!mounted) return;
      setState(() {
        _confirmedChange =
            'El administrador se eliminó, pero no se pudo actualizar la lista.';
      });
      await _load(afterWrite: true);
    } catch (_) {
      if (mounted) {
        setState(() => _writeError = 'No se pudo eliminar el administrador.');
      }
    } finally {
      if (mounted) setState(() => _deleting = false);
    }
  }

  Future<void> _messageAdmin(String adminId, String adminName) async {
    if (_busy || _readError != null) return;
    final subject = TextEditingController();
    final message = TextEditingController();
    String? formError;
    bool sending = false;

    final threadId = await showDialog<String?>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          title: Text('Mensaje a $adminName'),
          content: SizedBox(
            width: 460,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: subject,
                  decoration: const InputDecoration(labelText: 'Asunto'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: message,
                  decoration: const InputDecoration(labelText: 'Mensaje'),
                  minLines: 4,
                  maxLines: 6,
                ),
                if (formError != null) ...[
                  const SizedBox(height: 12),
                  Align(
                    alignment: Alignment.centerLeft,
                    child: Text(
                      formError!,
                      style: const TextStyle(
                        color: AppColors.error,
                        fontSize: 12,
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: sending ? null : () => Navigator.pop(ctx),
              child: const Text('Cancelar'),
            ),
            FilledButton(
              onPressed: sending
                  ? null
                  : () async {
                      final cleanSubject = subject.text.trim();
                      final cleanMessage = message.text.trim();
                      if (cleanSubject.length < 3 || cleanMessage.isEmpty) {
                        setDialogState(() {
                          formError = 'Escribe un asunto y un mensaje.';
                        });
                        return;
                      }
                      setDialogState(() {
                        sending = true;
                        formError = null;
                      });
                      try {
                        final thread = await ref
                            .read(communicationRemoteDataSourceProvider)
                            .createThread(
                              subject: cleanSubject,
                              message: cleanMessage,
                              category: 'admin',
                              adminId: adminId,
                            );
                        if (ctx.mounted) {
                          Navigator.pop(ctx, thread['id']?.toString());
                        }
                      } catch (_) {
                        if (!ctx.mounted) return;
                        setDialogState(() {
                          sending = false;
                          formError = 'No se pudo enviar el mensaje.';
                        });
                      }
                    },
              child: sending
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Text('Enviar'),
            ),
          ],
        ),
      ),
    );

    await Future<void>.delayed(const Duration(milliseconds: 250));
    subject.dispose();
    message.dispose();

    if (threadId != null && mounted) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) context.push('/admin/communications/$threadId');
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final academicOptions = ref.watch(academicOptionsProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Administradores')),
      body: _readError != null
          ? Center(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (_confirmedChange != null)
                      Semantics(
                        liveRegion: true,
                        child: Text(_confirmedChange!),
                      ),
                    if (_writeError != null)
                      Semantics(liveRegion: true, child: Text(_writeError!)),
                    Semantics(liveRegion: true, child: Text(_readError!)),
                    TextButton(
                      style: TextButton.styleFrom(
                        foregroundColor: colorScheme.onSurface,
                      ),
                      onPressed: _loading ? null : () => _load(),
                      child: const Text('Reintentar'),
                    ),
                  ],
                ),
              ),
            )
          : _loading && !_hasLoaded
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(16),
                children: [
                  Form(
                    key: _formKey,
                    child: Card(
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            Text(
                              'Nuevo administrador',
                              style: Theme.of(context).textTheme.titleMedium
                                  ?.copyWith(fontWeight: FontWeight.w700),
                            ),
                            const SizedBox(height: 12),
                            TextFormField(
                              enabled: !_busy,
                              controller: _email,
                              decoration: const InputDecoration(
                                labelText: 'Correo',
                              ),
                              validator: (v) => v == null || !v.contains('@')
                                  ? 'Correo inválido'
                                  : null,
                            ),
                            if (academicOptions.isLoading)
                              Semantics(
                                liveRegion: true,
                                child: const Padding(
                                  padding: EdgeInsets.only(top: 8),
                                  child: Text('Cargando opciones académicas…'),
                                ),
                              ),
                            if (academicOptions.hasError)
                              Row(
                                children: [
                                  const Expanded(
                                    child: Text(
                                      'No se pudieron cargar las opciones académicas.',
                                    ),
                                  ),
                                  TextButton(
                                    onPressed: () =>
                                        ref.invalidate(academicOptionsProvider),
                                    child: const Text('Reintentar'),
                                  ),
                                ],
                              ),
                            const SizedBox(height: 12),
                            TextFormField(
                              enabled: !_busy,
                              controller: _password,
                              obscureText: true,
                              decoration: const InputDecoration(
                                labelText: 'Contraseña',
                              ),
                              validator: (v) => v == null || v.length < 8
                                  ? 'Minimo 8 caracteres'
                                  : null,
                            ),
                            const SizedBox(height: 12),
                            Row(
                              children: [
                                Expanded(
                                  child: TextFormField(
                                    enabled: !_busy,
                                    controller: _firstName,
                                    decoration: const InputDecoration(
                                      labelText: 'Nombre',
                                    ),
                                    validator: (v) => v == null || v.isEmpty
                                        ? 'Requerido'
                                        : null,
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: TextFormField(
                                    enabled: !_busy,
                                    controller: _lastName,
                                    decoration: const InputDecoration(
                                      labelText: 'Apellido',
                                    ),
                                    validator: (v) => v == null || v.isEmpty
                                        ? 'Requerido'
                                        : null,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 12),
                            TextFormField(
                              enabled: !_busy,
                              controller: _jobTitle,
                              decoration: const InputDecoration(
                                labelText: 'Cargo',
                              ),
                            ),
                            const SizedBox(height: 12),
                            DropdownButtonFormField<String>(
                              initialValue: _program,
                              decoration: const InputDecoration(
                                labelText: 'Programa',
                              ),
                              items:
                                  (academicOptions.valueOrNull?.programs ??
                                          const <String>[])
                                      .map(
                                        (value) => DropdownMenuItem(
                                          value: value,
                                          child: Text(value),
                                        ),
                                      )
                                      .toList(),
                              onChanged: _busy || !academicOptions.hasValue
                                  ? null
                                  : (value) => setState(() => _program = value),
                              validator: (v) =>
                                  v == null ? 'Selecciona un programa' : null,
                            ),
                            const SizedBox(height: 12),
                            DropdownButtonFormField<String>(
                              initialValue: _campus,
                              decoration: const InputDecoration(
                                labelText: 'Campus',
                              ),
                              items:
                                  (academicOptions.valueOrNull?.campuses ??
                                          const <String>[])
                                      .map(
                                        (value) => DropdownMenuItem(
                                          value: value,
                                          child: Text(value),
                                        ),
                                      )
                                      .toList(),
                              onChanged: _busy || !academicOptions.hasValue
                                  ? null
                                  : (value) => setState(() => _campus = value),
                              validator: (v) =>
                                  v == null ? 'Selecciona un campus' : null,
                            ),
                            if (_writeError != null) ...[
                              const SizedBox(height: 12),
                              Text(
                                _writeError!,
                                style: const TextStyle(color: AppColors.error),
                              ),
                            ],
                            const SizedBox(height: 16),
                            FilledButton.icon(
                              onPressed: _busy ? null : _create,
                              icon: _saving
                                  ? const SizedBox(
                                      width: 18,
                                      height: 18,
                                      child: CircularProgressIndicator(
                                        strokeWidth: 2,
                                      ),
                                    )
                                  : const Icon(Icons.admin_panel_settings),
                              label: Text(
                                _saving ? 'Creando...' : 'Crear administrador',
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    'Administradores normales',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 8),
                  if (_admins.isEmpty)
                    const Center(child: Text('No hay administradores creados'))
                  else
                    ..._admins.map((admin) {
                      final profile = admin['profile'] as Map<String, dynamic>?;
                      final adminId = admin['id']?.toString() ?? '';
                      final name = profile == null
                          ? admin['email']?.toString() ?? ''
                          : '${profile['first_name']} ${profile['last_name']}';
                      final program = profile?['program']?.toString() ?? '';
                      final campus = profile?['campus']?.toString() ?? '';
                      final jobTitle = profile?['job_title']?.toString() ?? '';
                      final scope = [
                        if (jobTitle.isNotEmpty) jobTitle,
                        if (program.isNotEmpty) program,
                        if (campus.isNotEmpty) campus,
                      ].join(' - ');
                      return Card(
                        child: ListTile(
                          leading: CircleAvatar(
                            backgroundColor: AppColors.primary.withValues(
                              alpha: 0.12,
                            ),
                            child: const Icon(
                              Icons.manage_accounts_outlined,
                              color: AppColors.primary,
                            ),
                          ),
                          title: Text(
                            name,
                            style: const TextStyle(fontWeight: FontWeight.w700),
                          ),
                          subtitle: Text(
                            '${admin['email'] ?? ''}\n$scope',
                            style: TextStyle(
                              color: colorScheme.onSurfaceVariant,
                            ),
                          ),
                          isThreeLine: true,
                          trailing: Wrap(
                            spacing: 4,
                            children: [
                              IconButton(
                                icon: const Icon(Icons.forum_outlined),
                                tooltip: 'Enviar mensaje',
                                onPressed: _busy || adminId.isEmpty
                                    ? null
                                    : () => _messageAdmin(adminId, name),
                              ),
                              IconButton(
                                icon: const Icon(
                                  Icons.delete_outline,
                                  color: AppColors.error,
                                ),
                                tooltip: 'Eliminar',
                                onPressed: _busy || adminId.isEmpty
                                    ? null
                                    : () => _deleteAdmin(adminId),
                              ),
                            ],
                          ),
                        ),
                      );
                    }),
                ],
              ),
            ),
    );
  }
}
