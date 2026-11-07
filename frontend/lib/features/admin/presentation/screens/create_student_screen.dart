import 'package:dio/dio.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/role_utils.dart';
import '../../../auth/presentation/providers/auth_provider.dart';
import '../../../shared/presentation/widgets/local_paged_list.dart';
import '../../data/datasources/admin_remote_ds.dart';
import '../providers/admin_provider.dart';

class CreateStudentScreen extends ConsumerStatefulWidget {
  const CreateStudentScreen({super.key});

  @override
  ConsumerState<CreateStudentScreen> createState() => _State();
}

class _State extends ConsumerState<CreateStudentScreen> {
  final _formKey = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _fname = TextEditingController();
  final _lname = TextEditingController();
  final _doc = TextEditingController();
  final _studentId = TextEditingController();
  final _birthDate = TextEditingController();
  final _phone = TextEditingController();
  final _eps = TextEditingController();
  final _emergencyName = TextEditingController();
  final _emergencyPhone = TextEditingController();
  final _sem = TextEditingController();
  String? _program;
  String? _campus;
  String _sex = 'male';
  bool _loading = false;
  bool _isImporting = false;
  String? _err;

  bool get _busy => _loading || _isImporting;

  void _invalidateAdminStatistics() {
    ref.invalidate(adminStatisticsProvider(null));
    for (var semester = 1; semester <= 10; semester++) {
      ref.invalidate(adminStatisticsProvider(semester));
    }
  }

  @override
  void dispose() {
    for (final c in [
      _email,
      _fname,
      _lname,
      _doc,
      _studentId,
      _birthDate,
      _phone,
      _eps,
      _emergencyName,
      _emergencyPhone,
      _sem,
    ]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _pickBirthDate() async {
    if (_busy) return;
    final initialDate =
        DateTime.tryParse(_birthDate.text) ?? DateTime(2000, 1, 1);
    final picked = await showDatePicker(
      context: context,
      initialDate: initialDate,
      firstDate: DateTime(1950, 1, 1),
      lastDate: DateTime.now(),
    );
    if (mounted && !_busy && picked != null) {
      _birthDate.text = DateFormat('yyyy-MM-dd').format(picked);
    }
  }

  Future<void> _submit() async {
    if (_busy || !_formKey.currentState!.validate()) return;
    final canChooseScope = isAppAdminRole(ref.read(authStateProvider).role);
    setState(() {
      _loading = true;
      _err = null;
    });
    try {
      final data = {
        'email': _email.text.trim(),
        'first_name': _fname.text.trim(),
        'last_name': _lname.text.trim(),
        'document_number': _doc.text.trim(),
        'student_id': _studentId.text.trim().isEmpty
            ? null
            : _studentId.text.trim(),
        'birth_date': _birthDate.text.trim().isEmpty
            ? null
            : _birthDate.text.trim(),
        'sex': _sex,
        'phone': _phone.text.trim().isEmpty ? null : _phone.text.trim(),
        'eps_affiliation': _eps.text.trim().isEmpty ? null : _eps.text.trim(),
        'emergency_contact_name': _emergencyName.text.trim().isEmpty
            ? null
            : _emergencyName.text.trim(),
        'emergency_contact_phone': _emergencyPhone.text.trim().isEmpty
            ? null
            : _emergencyPhone.text.trim(),
        'semester': _sem.text.trim().isEmpty ? null : int.tryParse(_sem.text),
      };
      if (canChooseScope) {
        data['program'] = _program;
        data['campus'] = _campus;
      }
      await ref.read(adminRemoteDataSourceProvider).createStudent(data);
      if (mounted) {
        _invalidateAdminStatistics();
        Navigator.pop(context, true);
      }
    } catch (error) {
      if (!mounted) return;
      setState(() => _err = _safeError(error));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  String _safeError(Object error) {
    final status = error is DioException ? error.response?.statusCode : null;
    return switch (status) {
      401 => 'Tu sesión expiró. Vuelve a iniciar sesión.',
      403 => 'No tienes permiso para esta operación.',
      409 =>
        'Hay un conflicto con los datos. Revisa la lista antes de reintentar.',
      422 => 'Revisa los datos o el formato del archivo.',
      429 => 'Demasiados intentos. Espera antes de reintentar.',
      _ =>
        'No se pudo confirmar la operación. Revisa la lista antes de reintentar.',
    };
  }

  Future<void> _importExcel() async {
    if (_busy) return;
    setState(() {
      _isImporting = true;
      _err = null;
    });
    try {
      final picked = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: ['xlsx', 'csv'],
        withData: true,
      );
      if (!mounted || picked == null || picked.files.isEmpty) return;
      final file = picked.files.single;
      final bytes = file.bytes;
      if (bytes == null) {
        _showImportError('No se pudo leer el archivo seleccionado');
        return;
      }
      // Step 1: preview
      final preview = await ref
          .read(adminRemoteDataSourceProvider)
          .previewImportStudentsExcel(fileName: file.name, bytes: bytes);
      if (!mounted) return;
      final confirmed = await _showImportPreview(preview);
      if (!mounted || confirmed != true) return;

      // Step 2: actual import
      final result = await ref
          .read(adminRemoteDataSourceProvider)
          .importStudentsExcel(fileName: file.name, bytes: bytes);
      if (!mounted) return;
      final created = result['created'];
      if (created is int && created > 0) {
        _invalidateAdminStatistics();
      }
      await _showImportResult(result);
    } catch (error) {
      if (!mounted) return;
      _showImportError(_safeError(error));
    } finally {
      if (mounted) setState(() => _isImporting = false);
    }
  }

  void _showImportError(String message) {
    setState(() => _err = message);
    final messenger = ScaffoldMessenger.of(context);
    messenger.hideCurrentSnackBar();
    messenger.showSnackBar(SnackBar(content: Text(message)));
  }

  Future<bool?> _showImportPreview(Map<String, dynamic> preview) async {
    final willCreate = preview['will_create'] as int? ?? 0;
    final willSkip = preview['will_skip'] as int? ?? 0;
    final errors = preview['errors'] as int? ?? 0;
    final rows = preview['rows'] as List<dynamic>? ?? [];

    return showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Vista previa de importación'),
        content: SizedBox(
          width: 520,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Wrap(
                spacing: 16,
                children: [
                  _previewChip(
                    Icons.person_add,
                    AppColors.success,
                    '$willCreate a crear',
                  ),
                  _previewChip(
                    Icons.skip_next,
                    AppColors.warning,
                    '$willSkip a omitir',
                  ),
                  _previewChip(
                    Icons.error_outline,
                    AppColors.error,
                    '$errors con error',
                  ),
                ],
              ),
              if (rows.isNotEmpty) ...[
                const SizedBox(height: 12),
                const Text(
                  'Detalle de filas',
                  style: TextStyle(fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 8),
                LocalPagedList(
                  maxHeight: 260,
                  itemCount: rows.length,
                  itemBuilder: (_, index) {
                    final row = rows[index] as Map<String, dynamic>;
                    final status = row['predicted_status']?.toString() ?? '';
                    final color = switch (status) {
                      'will_create' => AppColors.success,
                      'will_skip' => AppColors.warning,
                      _ => AppColors.error,
                    };
                    final icon = switch (status) {
                      'will_create' => Icons.check_circle_outline,
                      'will_skip' => Icons.info_outline,
                      _ => Icons.error_outline,
                    };
                    return Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Icon(icon, size: 16, color: color),
                        const SizedBox(width: 6),
                        Expanded(
                          child: Text(
                            'Fila ${row['row']}: '
                            '${row['email'] ?? ''}  '
                            '${row['message'] ?? ''}',
                            style: TextStyle(fontSize: 12, color: color),
                          ),
                        ),
                      ],
                    );
                  },
                ),
              ],
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancelar'),
          ),
          ElevatedButton(
            onPressed: willCreate == 0 ? null : () => Navigator.pop(ctx, true),
            child: Text('Importar $willCreate estudiante(s)'),
          ),
        ],
      ),
    );
  }

  Widget _previewChip(IconData icon, Color color, String label) => Row(
    mainAxisSize: MainAxisSize.min,
    children: [
      Icon(icon, size: 16, color: color),
      const SizedBox(width: 4),
      Text(
        label,
        style: TextStyle(color: color, fontWeight: FontWeight.w600),
      ),
    ],
  );

  Future<void> _showImportResult(Map<String, dynamic> result) async {
    final rows = (result['results'] as List<dynamic>? ?? [])
        .where((row) => row['status'] != 'created')
        .toList();

    await showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Importación finalizada'),
        content: SizedBox(
          width: 520,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Creados: ${result['created'] ?? 0}'),
              Text('Omitidos: ${result['skipped'] ?? 0}'),
              Text('Errores: ${result['errors'] ?? 0}'),
              if (rows.isNotEmpty) ...[
                const SizedBox(height: 12),
                const Text(
                  'Filas por revisar',
                  style: TextStyle(fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 8),
                LocalPagedList(
                  itemCount: rows.length,
                  itemBuilder: (context, index) {
                    final row = rows[index];
                    return Text(
                      'Fila ${row['row']}: ${row['message']}',
                      style: const TextStyle(fontSize: 12),
                    );
                  },
                ),
              ],
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cerrar'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final academicOptions = ref.watch(academicOptionsProvider);
    final canChooseScope = isAppAdminRole(ref.watch(authStateProvider).role);

    return Scaffold(
      appBar: AppBar(title: const Text('Crear Estudiante')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Form(
          key: _formKey,
          child: Column(
            children: [
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  icon: _isImporting
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.upload_file_outlined),
                  label: Text(
                    _isImporting
                        ? 'Importando archivo...'
                        : 'Importar estudiantes desde Excel o CSV',
                  ),
                  onPressed: _isImporting || _loading ? null : _importExcel,
                ),
              ),
              const SizedBox(height: 16),
              const Divider(),
              const SizedBox(height: 16),
              TextFormField(
                enabled: !_busy,
                controller: _email,
                decoration: const InputDecoration(labelText: 'Correo *'),
                validator: (v) =>
                    v == null || !v.contains('@') ? 'Inválido' : null,
              ),
              const SizedBox(height: 12),
              TextFormField(
                enabled: !_busy,
                controller: _doc,
                decoration: const InputDecoration(
                  labelText: 'Documento / cédula *',
                  helperText:
                      'Las instrucciones de acceso se envían por correo; deberá cambiar la contraseña temporal.',
                ),
                validator: (v) =>
                    v == null || v.trim().isEmpty ? 'Requerido' : null,
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: TextFormField(
                      enabled: !_busy,
                      controller: _fname,
                      decoration: const InputDecoration(labelText: 'Nombre *'),
                      validator: (v) =>
                          v == null || v.isEmpty ? 'Requerido' : null,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: TextFormField(
                      enabled: !_busy,
                      controller: _lname,
                      decoration: const InputDecoration(
                        labelText: 'Apellido *',
                      ),
                      validator: (v) =>
                          v == null || v.isEmpty ? 'Requerido' : null,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              TextFormField(
                enabled: !_busy,
                controller: _studentId,
                decoration: const InputDecoration(labelText: 'ID estudiantil'),
              ),
              const SizedBox(height: 12),
              TextFormField(
                enabled: !_busy,
                controller: _birthDate,
                readOnly: true,
                decoration: const InputDecoration(
                  labelText: 'Fecha de nacimiento',
                  suffixIcon: Icon(Icons.calendar_today_outlined),
                ),
                onTap: _pickBirthDate,
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                initialValue: _sex,
                decoration: const InputDecoration(labelText: 'Sexo *'),
                items: const [
                  DropdownMenuItem(value: 'male', child: Text('Masculino')),
                  DropdownMenuItem(value: 'female', child: Text('Femenino')),
                ],
                onChanged: _busy ? null : (v) => setState(() => _sex = v!),
              ),
              const SizedBox(height: 12),
              TextFormField(
                enabled: !_busy,
                controller: _phone,
                decoration: const InputDecoration(labelText: 'Teléfono'),
              ),
              const SizedBox(height: 12),
              TextFormField(
                enabled: !_busy,
                controller: _eps,
                decoration: const InputDecoration(labelText: 'EPS afiliado'),
              ),
              const SizedBox(height: 12),
              TextFormField(
                enabled: !_busy,
                controller: _emergencyName,
                decoration: const InputDecoration(
                  labelText: 'Nombre contacto de emergencia',
                ),
              ),
              const SizedBox(height: 12),
              TextFormField(
                enabled: !_busy,
                controller: _emergencyPhone,
                decoration: const InputDecoration(
                  labelText: 'Teléfono contacto de emergencia',
                ),
              ),
              if (canChooseScope) ...[
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
                DropdownButtonFormField<String>(
                  initialValue: _program,
                  decoration: const InputDecoration(labelText: 'Programa'),
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
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  initialValue: _campus,
                  decoration: const InputDecoration(labelText: 'Campus'),
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
                ),
              ],
              const SizedBox(height: 12),
              TextFormField(
                enabled: !_busy,
                controller: _sem,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Semestre'),
              ),
              if (_err != null)
                Padding(
                  padding: const EdgeInsets.only(top: 12),
                  child: Text(
                    _err!,
                    style: TextStyle(
                      color: Theme.of(context).brightness == Brightness.dark
                          ? AppColors.darkTextPrimary
                          : AppColors.error,
                    ),
                  ),
                ),
              const SizedBox(height: 24),
              SizedBox(
                width: double.infinity,
                height: 50,
                child: ElevatedButton(
                  onPressed: _busy ? null : _submit,
                  child: Text(_loading ? 'Creando...' : 'Crear Estudiante'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
