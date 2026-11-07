import 'package:flutter/material.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../../core/network/api_client.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/role_utils.dart';
import '../../../auth/presentation/providers/auth_provider.dart';

class AuditHistoryScreen extends ConsumerStatefulWidget {
  const AuditHistoryScreen({super.key});

  @override
  ConsumerState<AuditHistoryScreen> createState() => _AuditHistoryScreenState();
}

class _AuditHistoryScreenState extends ConsumerState<AuditHistoryScreen> {
  bool _loading = true;
  int _page = 1;
  int _request = 0;
  Map<String, dynamic>? _metadata;
  String? _error;
  List<dynamic> _items = [];
  Future<void>? _inFlightLoad;

  @override
  void initState() {
    super.initState();
    Future.microtask(_load);
  }

  Future<void> _load() {
    if (!mounted) return Future.value();
    if (_inFlightLoad != null) return _inFlightLoad!;
    final load = _performLoad();
    _inFlightLoad = load;
    load.whenComplete(() {
      if (identical(_inFlightLoad, load)) _inFlightLoad = null;
    });
    return load;
  }

  void _goToPage(int page) {
    if (!mounted || _loading || _error != null) return;
    _page = page;
    _load();
  }

  Future<void> _performLoad() async {
    final request = ++_request;
    setState(() {
      _loading = true;
    });

    try {
      final role = ref.read(authStateProvider).role;
      final isAdmin = isAdminRole(role);
      final path = isAdmin ? '/audit/admin/page' : '/audit/me/page';
      final response = await ref
          .read(apiClientProvider)
          .dio
          .get(
            path,
            queryParameters: {
              'page': _page,
              'page_size': 20,
              'include_self': true,
            },
          );
      if (!mounted || request != _request) return;
      setState(() {
        _metadata = response.data as Map<String, dynamic>;
        _items = _metadata!['items'] as List<dynamic>;
        _error = null;
        _loading = false;
      });
    } catch (e) {
      if (!mounted || request != _request) return;
      setState(() {
        final status = e is DioException ? e.response?.statusCode : null;
        _error = switch (status) {
          401 => 'Tu sesión expiró. Inicia sesión nuevamente.',
          403 => 'No tienes permiso para consultar esta información.',
          404 => 'No se encontró la información solicitada.',
          429 => 'Demasiadas solicitudes. Espera antes de reintentar.',
          500 => 'Ocurrió un error en el servidor. Intenta nuevamente.',
          503 => 'El servicio no está disponible temporalmente.',
          _ => 'No se pudo cargar el historial',
        };
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final isAdmin = isAdminRole(ref.watch(authStateProvider).role);

    return Scaffold(
      appBar: AppBar(
        title: Text(isAdmin ? 'Historial general' : 'Mi historial'),
      ),
      bottomNavigationBar: _error != null || _metadata == null
          ? null
          : SafeArea(
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  TextButton(
                    onPressed: !_loading && _metadata?['has_previous'] == true
                        ? () => _goToPage(_page - 1)
                        : null,
                    child: const Text('Anterior'),
                  ),
                  Text('Página $_page de ${_metadata?['total_pages'] ?? 0}'),
                  TextButton(
                    onPressed: !_loading && _metadata?['has_next'] == true
                        ? () => _goToPage(_page + 1)
                        : null,
                    child: const Text('Siguiente'),
                  ),
                ],
              ),
            ),
      body: _error != null
          ? Center(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Semantics(
                      liveRegion: true,
                      child: Text(
                        _error!,
                        textAlign: TextAlign.center,
                        style: const TextStyle(color: AppColors.error),
                      ),
                    ),
                    const SizedBox(height: 8),
                    TextButton(
                      onPressed: _loading ? null : _load,
                      child: const Text('Reintentar'),
                    ),
                  ],
                ),
              ),
            )
          : _loading
          ? const Center(child: CircularProgressIndicator())
          : _items.isEmpty
          ? const Center(
              child: Text(
                'No hay cambios registrados',
                style: TextStyle(color: AppColors.textSecondary),
              ),
            )
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView.separated(
                padding: const EdgeInsets.all(16),
                itemCount: _items.length,
                separatorBuilder: (context, index) => const SizedBox(height: 8),
                itemBuilder: (context, index) {
                  final item = _items[index];
                  return _AuditTile(
                    item: item,
                    isAdmin: isAdmin,
                    onTap: _destinationFor(item, isAdmin) == null
                        ? null
                        : () => context.push(_destinationFor(item, isAdmin)!),
                  );
                },
              ),
            ),
    );
  }

  String? _destinationFor(dynamic item, bool isAdmin) {
    final action = item['action']?.toString() ?? '';
    final details = item['details'] as Map<String, dynamic>?;

    if (isAdmin) {
      if (action.startsWith('password.')) return '/admin/change-password';

      final studentId = details?['student_id']?.toString();
      if (studentId == null || studentId.isEmpty) return null;

      if (action.contains('dose') || action.contains('scheme')) {
        return '/admin/students/$studentId?tab=scheme';
      }
      if (action.contains('evidence')) {
        return '/admin/students/$studentId?tab=evidence';
      }
      return '/admin/students/$studentId';
    }

    if (action.contains('dose') || action.contains('scheme')) {
      return '/student/scheme';
    }
    if (action.contains('evidence')) return '/student/evidence';
    if (action.contains('profile') || action.contains('sex')) {
      return '/student/profile';
    }
    if (action.startsWith('password.')) return '/student/change-password';
    return null;
  }
}

class _AuditTile extends StatelessWidget {
  final dynamic item;
  final bool isAdmin;
  final VoidCallback? onTap;

  const _AuditTile({
    required this.item,
    required this.isAdmin,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final action = item['action']?.toString() ?? '';
    final actor = item['actor'] as Map<String, dynamic>?;
    final details = item['details'] as Map<String, dynamic>?;
    final createdAt = DateTime.tryParse(item['created_at']?.toString() ?? '');
    final dateText = createdAt == null
        ? ''
        : DateFormat('dd/MM/yyyy HH:mm').format(createdAt.toLocal());

    return Card(
      child: ListTile(
        onTap: onTap,
        leading: CircleAvatar(
          backgroundColor: _actionColor(action).withValues(alpha: 0.12),
          child: Icon(_actionIcon(action), color: _actionColor(action)),
        ),
        title: Text(
          _actionTitle(action),
          style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
        ),
        subtitle: Padding(
          padding: const EdgeInsets.only(top: 4),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Por: ${_actorName(actor)}',
                style: const TextStyle(fontSize: 12),
              ),
              if (dateText.isNotEmpty)
                Text(
                  dateText,
                  style: const TextStyle(
                    fontSize: 12,
                    color: AppColors.textSecondary,
                  ),
                ),
              if (isAdmin && details?['student_id'] != null)
                Text(
                  'Estudiante: ${_studentLabel(details!)}',
                  style: const TextStyle(
                    fontSize: 12,
                    color: AppColors.textSecondary,
                  ),
                ),
              ..._detailLines(details).map(
                (line) => Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: Text(line, style: const TextStyle(fontSize: 12)),
                ),
              ),
            ],
          ),
        ),
        trailing: onTap == null
            ? null
            : const Icon(Icons.chevron_right, color: AppColors.textHint),
      ),
    );
  }

  String _actorName(Map<String, dynamic>? actor) {
    if (actor == null) return 'Sistema';
    final name = actor['name']?.toString();
    if (name != null && name.trim().isNotEmpty) return name;
    return actor['email']?.toString() ?? 'Usuario';
  }

  String _studentLabel(Map<String, dynamic> details) {
    final name = details['student_name']?.toString();
    final email = details['student_email']?.toString();
    if (name != null &&
        name.trim().isNotEmpty &&
        email != null &&
        email.isNotEmpty) {
      return '$name <$email>';
    }
    if (email != null && email.isNotEmpty) return email;
    if (name != null && name.trim().isNotEmpty) return name;
    return details['student_id']?.toString() ?? 'Sin estudiante';
  }

  List<String> _detailLines(Map<String, dynamic>? details) {
    if (details == null) return [];

    final lines = <String>[];
    final vaccine = details['vaccine']?.toString();
    final dose = details['dose']?.toString();
    if (vaccine != null && vaccine.isNotEmpty) {
      lines.add(dose == null || dose.isEmpty ? vaccine : '$vaccine - $dose');
    }

    final oldStatus = details['old_status']?.toString();
    final newStatus = details['new_status']?.toString();
    if (newStatus != null && newStatus.isNotEmpty) {
      lines.add(
        oldStatus == null || oldStatus.isEmpty
            ? 'Estado: ${_statusLabel(newStatus)}'
            : 'Estado: ${_statusLabel(oldStatus)} -> ${_statusLabel(newStatus)}',
      );
    }

    final notes = details['notes']?.toString();
    if (notes != null && notes.trim().isNotEmpty) {
      lines.add('Comentario: $notes');
    }

    final files = details['files'];
    if (files is List && files.isNotEmpty) {
      lines.add('Archivos: ${files.join(', ')}');
    }

    final changes = details['changes'];
    if (changes is Map) {
      for (final entry in changes.entries.take(4)) {
        final field = _fieldLabel(entry.key.toString());
        final change = entry.value;
        if (change is Map) {
          lines.add(
            '$field: ${_value(change['old'])} -> ${_value(change['new'])}',
          );
        }
      }
      if (changes.length > 4) {
        lines.add('${changes.length - 4} cambio(s) adicional(es)');
      }
    }

    return lines;
  }

  String _value(dynamic value) {
    if (value == null || value.toString().isEmpty) return 'Sin dato';
    return value.toString();
  }

  String _fieldLabel(String field) {
    return switch (field) {
      'first_name' => 'Nombre',
      'last_name' => 'Apellido',
      'job_title' => 'Cargo',
      'document_number' => 'Documento',
      'student_id' => 'ID estudiantil',
      'birth_date' => 'Fecha de nacimiento',
      'sex' => 'Sexo',
      'phone' => 'Teléfono',
      'eps_affiliation' => 'EPS',
      'emergency_contact_name' => 'Contacto de emergencia',
      'emergency_contact_phone' => 'Teléfono emergencia',
      'program' => 'Programa',
      'semester' => 'Semestre',
      'applied_date' => 'Fecha',
      'titer_value' => 'Valor de titulación',
      _ => field,
    };
  }

  String _statusLabel(String status) {
    return switch (status) {
      'approved' => 'Aprobada',
      'denied' => 'Denegada',
      'in_review' => 'En revisión',
      'pending' => 'Pendiente',
      _ => status,
    };
  }

  String _actionTitle(String action) {
    return switch (action) {
      'student.created' => 'Estudiante creado',
      'student.deactivated' => 'Estudiante desactivado',
      'student.reactivated' => 'Estudiante reactivado',
      'profile.updated' => 'Perfil actualizado',
      'sex.changed' => 'Sexo actualizado',
      'scheme.regenerated' => 'Esquema regenerado',
      'dose.updated' => 'Dosis actualizada',
      'dose.reviewed' => 'Dosis revisada',
      'evidence.uploaded' => 'Documentos subidos',
      'evidence.deleted' => 'Documentos eliminados',
      'password.changed' => 'Contraseña cambiada',
      'password.reset' => 'Contraseña restablecida',
      _ => action,
    };
  }

  IconData _actionIcon(String action) {
    if (action.contains('dose')) return Icons.vaccines_outlined;
    if (action.contains('evidence')) return Icons.picture_as_pdf_outlined;
    if (action.contains('profile') || action.contains('student')) {
      return Icons.person_outline;
    }
    if (action.contains('password')) return Icons.lock_outline;
    return Icons.history;
  }

  Color _actionColor(String action) {
    if (action.contains('deleted') || action.contains('deactivated')) {
      return AppColors.error;
    }
    if (action.contains('reviewed')) return AppColors.statusInReview;
    if (action.contains('uploaded') || action.contains('created')) {
      return AppColors.success;
    }
    return AppColors.primary;
  }
}
