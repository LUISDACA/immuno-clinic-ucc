import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/file_download.dart';
import '../../../../core/utils/role_utils.dart';
import '../../../auth/presentation/providers/auth_provider.dart';
import '../../data/datasources/admin_remote_ds.dart';
import '../../data/models/admin_models.dart';
import '../providers/admin_provider.dart';

class AdminStudentDetailScreen extends ConsumerStatefulWidget {
  final String studentId;
  final int initialTab;

  const AdminStudentDetailScreen({
    super.key,
    required this.studentId,
    this.initialTab = 0,
  });

  @override
  ConsumerState<AdminStudentDetailScreen> createState() => _State();
}

class _State extends ConsumerState<AdminStudentDetailScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabs;
  Map<String, dynamic>? _student;
  List<dynamic> _scheme = [];
  List<dynamic> _evidence = [];
  bool _loading = true;
  bool _loadFailed = false;
  int _request = 0;
  int _evidencePage = 1;
  Map<String, dynamic>? _evidenceMetadata;

  @override
  void initState() {
    super.initState();
    _tabs = TabController(
      length: 3,
      vsync: this,
      initialIndex: widget.initialTab.clamp(0, 2),
    );
    _load();
  }

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final request = ++_request;
    setState(() {
      _loading = true;
      _loadFailed = false;
    });
    final ds = ref.read(adminRemoteDataSourceProvider);
    try {
      final futures = await Future.wait([
        ds.getStudentDetail(widget.studentId),
        ds.getStudentScheme(widget.studentId),
        ds.getStudentEvidencePage(widget.studentId, page: _evidencePage),
      ]);
      if (!mounted || request != _request) return;
      final evidence = futures[2] as Map<String, dynamic>;
      if (_evidencePage > 1 && (evidence['items'] as List).isEmpty) {
        _evidencePage = (evidence['total_pages'] as int).clamp(1, 10000);
        await _load();
        return;
      }
      setState(() {
        _student = futures[0] as Map<String, dynamic>;
        _scheme = futures[1] as List<dynamic>;
        _evidenceMetadata = evidence;
        _evidence = evidence["items"] as List<dynamic>;
        _loading = false;
      });
    } catch (_) {
      if (mounted && request == _request) {
        setState(() {
          _loading = false;
          _loadFailed = true;
          _student = null;
          _scheme = [];
          _evidence = [];
          _evidenceMetadata = null;
        });
      }
    }
  }

  Future<void> _deleteEvidenceBatch(String batchId) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Eliminar documentos'),
        content: const Text(
          'Esta accion eliminara los PDF de este estudiante de forma permanente.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancelar'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.error),
            child: const Text('Eliminar'),
          ),
        ],
      ),
    );

    if (confirm != true) return;

    try {
      await ref
          .read(adminRemoteDataSourceProvider)
          .deleteStudentEvidence(widget.studentId, batchId);
      if (!mounted) return;
      setState(() {
        _evidence = _evidence
            .where((batch) => batch['id']?.toString() != batchId)
            .toList();
      });
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Documentos eliminados')));
      await _load();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('No se pudieron eliminar los documentos: $e')),
      );
    }
  }

  Future<void> _downloadEvidenceFile(String fileId, String fileName) async {
    try {
      final bytes = await ref
          .read(adminRemoteDataSourceProvider)
          .downloadEvidenceFile(fileId);
      await saveAndOpenFile(bytes, fileName);
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No se pudo descargar el documento')),
      );
    }
  }

  Future<void> _downloadCertificate() async {
    const filename = 'certificado_vacunacion.pdf';
    try {
      final bytes = await ref
          .read(adminRemoteDataSourceProvider)
          .downloadStudentCertificate(widget.studentId);
      await saveAndOpenFile(bytes, filename);
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'No se pudo descargar el certificado. '
            'Verifica que el esquema esté completamente aprobado.',
          ),
        ),
      );
    }
  }

  Color _statusColor(String s) => switch (s) {
    'approved' => AppColors.statusApproved,
    'denied' => AppColors.statusDenied,
    'in_review' => AppColors.statusInReview,
    _ => AppColors.statusPending,
  };

  String _statusLabel(String s) => switch (s) {
    'approved' => 'Aprobada',
    'denied' => 'Denegada',
    'in_review' => 'En revisión',
    _ => 'Pendiente',
  };

  String _formatDate(dynamic value) {
    if (value == null || value.toString().isEmpty) return 'N/A';
    final parsed = DateTime.tryParse(value.toString());
    if (parsed == null) return value.toString();
    return DateFormat('dd/MM/yyyy').format(parsed);
  }

  String? _optionOrNull(String? value, List<String> options) {
    if (value == null || value.isEmpty) return null;
    return options.contains(value) ? value : null;
  }

  Future<void> _reviewDose(
    String doseId,
    String status, {
    String? initialNotes,
    String? title,
  }) async {
    final notes = TextEditingController(text: initialNotes ?? '');
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(
          title ?? (status == 'approved' ? 'Aprobar dosis' : 'Denegar dosis'),
        ),
        content: TextField(
          controller: notes,
          decoration: const InputDecoration(
            labelText: 'Comentario para el estudiante',
          ),
          maxLines: 3,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancelar'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Confirmar'),
          ),
        ],
      ),
    );
    if (confirm == true) {
      final cleanNotes = notes.text.trim().isEmpty ? null : notes.text.trim();
      try {
        await ref
            .read(adminRemoteDataSourceProvider)
            .reviewDose(doseId, status, notes: cleanNotes);
        await _load();
      } catch (e) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('No se pudo revisar la dosis: $e')),
        );
      }
    }
  }

  Future<void> _editDoseComment(String doseId, String? initialNotes) async {
    final notes = TextEditingController(text: initialNotes ?? '');
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Editar comentario'),
        content: TextField(
          controller: notes,
          decoration: const InputDecoration(
            labelText: 'Comentario para el estudiante',
          ),
          maxLines: 3,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancelar'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Guardar'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      await ref
          .read(adminRemoteDataSourceProvider)
          .updateDoseComment(
            doseId,
            notes.text.trim().isEmpty ? null : notes.text.trim(),
          );
      await _load();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('No se pudo actualizar el comentario: $e')),
      );
    }
  }

  Future<void> _deleteDoseComment(String doseId) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Eliminar comentario'),
        content: const Text('El estudiante ya no verá este comentario.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancelar'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Eliminar'),
          ),
        ],
      ),
    );

    if (confirm == true) {
      try {
        await ref
            .read(adminRemoteDataSourceProvider)
            .updateDoseComment(doseId, null);
        await _load();
      } catch (e) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('No se pudo eliminar el comentario: $e')),
        );
      }
    }
  }

  Future<void> _editProfile() async {
    final p = _student?['profile'] as Map<String, dynamic>?;
    if (p == null) return;
    final canChooseScope = isAppAdminRole(ref.read(authStateProvider).role);
    AcademicOptions? academicOptions;
    if (canChooseScope) {
      try {
        academicOptions = await ref.read(academicOptionsProvider.future);
      } catch (_) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('No se pudieron cargar las opciones académicas.'),
          ),
        );
        return;
      }
    }
    if (!mounted) return;

    final firstName = TextEditingController(
      text: p['first_name']?.toString() ?? '',
    );
    final lastName = TextEditingController(
      text: p['last_name']?.toString() ?? '',
    );
    final documentNumber = TextEditingController(
      text: p['document_number']?.toString() ?? '',
    );
    final studentId = TextEditingController(
      text: p['student_id']?.toString() ?? '',
    );
    final birthDate = TextEditingController(
      text: p['birth_date']?.toString() ?? '',
    );
    final phone = TextEditingController(text: p['phone']?.toString() ?? '');
    final eps = TextEditingController(
      text: p['eps_affiliation']?.toString() ?? '',
    );
    final emergencyName = TextEditingController(
      text: p['emergency_contact_name']?.toString() ?? '',
    );
    final emergencyPhone = TextEditingController(
      text: p['emergency_contact_phone']?.toString() ?? '',
    );
    String? program = _optionOrNull(
      p['program']?.toString(),
      academicOptions?.programs ?? const <String>[],
    );
    String? campus = _optionOrNull(
      p['campus']?.toString(),
      academicOptions?.campuses ?? const <String>[],
    );
    final semester = TextEditingController(
      text: p['semester']?.toString() ?? '',
    );
    String sex = p['sex']?.toString() ?? 'male';
    bool saving = false;

    String? clean(TextEditingController controller) {
      final value = controller.text.trim();
      return value.isEmpty ? null : value;
    }

    await showDialog<void>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          title: const Text('Editar estudiante'),
          content: SingleChildScrollView(
            child: SizedBox(
              width: 420,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  TextField(
                    controller: firstName,
                    decoration: const InputDecoration(labelText: 'Nombre'),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: lastName,
                    decoration: const InputDecoration(labelText: 'Apellido'),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: documentNumber,
                    decoration: const InputDecoration(labelText: 'Documento'),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: studentId,
                    decoration: const InputDecoration(
                      labelText: 'ID estudiantil',
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: birthDate,
                    readOnly: true,
                    decoration: const InputDecoration(
                      labelText: 'Fecha de nacimiento',
                      suffixIcon: Icon(Icons.calendar_today_outlined),
                    ),
                    onTap: () async {
                      final initialDate =
                          DateTime.tryParse(birthDate.text) ??
                          DateTime(2000, 1, 1);
                      final picked = await showDatePicker(
                        context: ctx,
                        initialDate: initialDate,
                        firstDate: DateTime(1950, 1, 1),
                        lastDate: DateTime.now(),
                      );
                      if (picked != null) {
                        birthDate.text = DateFormat(
                          'yyyy-MM-dd',
                        ).format(picked);
                        setDialogState(() {});
                      }
                    },
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    initialValue: sex,
                    decoration: const InputDecoration(labelText: 'Sexo'),
                    items: const [
                      DropdownMenuItem(value: 'male', child: Text('Masculino')),
                      DropdownMenuItem(
                        value: 'female',
                        child: Text('Femenino'),
                      ),
                    ],
                    onChanged: (value) =>
                        setDialogState(() => sex = value ?? sex),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: phone,
                    decoration: const InputDecoration(labelText: 'Teléfono'),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: eps,
                    decoration: const InputDecoration(
                      labelText: 'EPS afiliado',
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: emergencyName,
                    decoration: const InputDecoration(
                      labelText: 'Nombre contacto de emergencia',
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: emergencyPhone,
                    decoration: const InputDecoration(
                      labelText: 'Teléfono contacto de emergencia',
                    ),
                  ),
                  if (canChooseScope) ...[
                    const SizedBox(height: 12),
                    DropdownButtonFormField<String>(
                      initialValue: program,
                      decoration: const InputDecoration(labelText: 'Programa'),
                      items: (academicOptions?.programs ?? const <String>[])
                          .map(
                            (value) => DropdownMenuItem(
                              value: value,
                              child: Text(value),
                            ),
                          )
                          .toList(),
                      onChanged: (value) =>
                          setDialogState(() => program = value),
                    ),
                    const SizedBox(height: 12),
                    DropdownButtonFormField<String>(
                      initialValue: campus,
                      decoration: const InputDecoration(labelText: 'Campus'),
                      items: (academicOptions?.campuses ?? const <String>[])
                          .map(
                            (value) => DropdownMenuItem(
                              value: value,
                              child: Text(value),
                            ),
                          )
                          .toList(),
                      onChanged: (value) =>
                          setDialogState(() => campus = value),
                    ),
                  ],
                  const SizedBox(height: 12),
                  TextField(
                    controller: semester,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(labelText: 'Semestre'),
                  ),
                ],
              ),
            ),
          ),
          actions: [
            TextButton(
              onPressed: saving ? null : () => Navigator.pop(ctx),
              child: const Text('Cancelar'),
            ),
            ElevatedButton(
              onPressed: saving
                  ? null
                  : () async {
                      setDialogState(() => saving = true);
                      try {
                        final firstNameValue = firstName.text.trim();
                        final lastNameValue = lastName.text.trim();
                        if (firstNameValue.isEmpty || lastNameValue.isEmpty) {
                          if (ctx.mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                content: Text(
                                  'Nombre y apellido son obligatorios',
                                ),
                              ),
                            );
                          }
                          return;
                        }
                        final data = <String, dynamic>{
                          'first_name': firstNameValue,
                          'last_name': lastNameValue,
                          'document_number': clean(documentNumber),
                          'student_id': clean(studentId),
                          'birth_date': clean(birthDate),
                          'sex': sex,
                          'phone': clean(phone),
                          'eps_affiliation': clean(eps),
                          'emergency_contact_name': clean(emergencyName),
                          'emergency_contact_phone': clean(emergencyPhone),
                          'semester': int.tryParse(semester.text.trim()),
                        };
                        if (canChooseScope) {
                          data['program'] = program;
                          data['campus'] = campus;
                        }
                        await ref
                            .read(adminRemoteDataSourceProvider)
                            .updateStudentProfile(widget.studentId, data);
                        if (ctx.mounted) Navigator.pop(ctx);
                        await _load();
                      } finally {
                        if (ctx.mounted) {
                          setDialogState(() => saving = false);
                        }
                      }
                    },
              child: saving
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Text('Guardar'),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final p = _student?['profile'];
    final name = p != null
        ? '${p['first_name']} ${p['last_name']}'
        : _student?['email'] ?? '';

    return Scaffold(
      appBar: AppBar(
        title: Text(name),
        actions: [
          if (!_loading && !_loadFailed && _student != null)
            IconButton(
              onPressed: _downloadCertificate,
              icon: const Icon(Icons.workspace_premium_outlined),
              tooltip: 'Descargar certificado',
            ),
          if (!_loading && !_loadFailed && _student != null)
            IconButton(
              onPressed: _editProfile,
              icon: const Icon(Icons.edit_outlined),
              tooltip: 'Editar perfil',
            ),
          if (!_loading && !_loadFailed && _student != null)
            IconButton(
              onPressed: _openStudentCommunication,
              icon: const Icon(Icons.forum_outlined),
              tooltip: 'Enviar mensaje',
            ),
        ],
        bottom: TabBar(
          controller: _tabs,
          tabs: const [
            Tab(text: 'Perfil'),
            Tab(text: 'Esquema'),
            Tab(text: 'Evidencia'),
          ],
        ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _loadFailed
          ? Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Text(
                      'No se pudo cargar la información del estudiante.',
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 12),
                    OutlinedButton.icon(
                      onPressed: _load,
                      icon: const Icon(Icons.refresh),
                      label: const Text('Reintentar'),
                    ),
                  ],
                ),
              ),
            )
          : TabBarView(
              controller: _tabs,
              children: [_profileTab(), _schemeTab(), _evidenceTab()],
            ),
    );
  }

  void _openStudentCommunication() {
    final uri = Uri(
      path: '/admin/communications',
      queryParameters: {'studentId': widget.studentId},
    );
    context.push(uri.toString());
  }

  Widget _profileTab() {
    final p = _student?['profile'];
    if (p == null) return const Center(child: Text('Sin perfil'));
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _infoRow('Nombre', '${p['first_name']} ${p['last_name']}'),
        _infoRow('Correo', _student?['email'] ?? ''),
        _infoRow('Documento', p['document_number'] ?? 'N/A'),
        _infoRow('ID estudiantil', p['student_id'] ?? 'N/A'),
        _infoRow('Fecha nacimiento', _formatDate(p['birth_date'])),
        _infoRow('Sexo', p['sex'] == 'female' ? 'Femenino' : 'Masculino'),
        _infoRow('Teléfono', p['phone'] ?? 'N/A'),
        _infoRow('EPS afiliado', p['eps_affiliation'] ?? 'N/A'),
        _infoRow('Contacto emergencia', p['emergency_contact_name'] ?? 'N/A'),
        _infoRow('Teléfono emergencia', p['emergency_contact_phone'] ?? 'N/A'),
        _infoRow('Programa', p['program'] ?? 'N/A'),
        _infoRow('Campus', p['campus'] ?? 'N/A'),
        _infoRow('Semestre', p['semester']?.toString() ?? 'N/A'),
        _infoRow(
          'Estado',
          _student?['is_active'] == true ? 'Activo' : 'Inactivo',
        ),
      ],
    );
  }

  Widget _infoRow(String label, String value) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 6),
    child: Row(
      children: [
        SizedBox(
          width: 160,
          child: Text(
            label,
            style: const TextStyle(
              fontWeight: FontWeight.w600,
              color: AppColors.textSecondary,
            ),
          ),
        ),
        Expanded(child: Text(value)),
      ],
    ),
  );

  Widget _schemeTab() {
    return ListView(
      padding: const EdgeInsets.all(12),
      children: _scheme.map((sv) {
        final vaccineName = sv['vaccine']?['name'] ?? 'Vacuna';
        final status = (sv as Map)['status']?.toString() ?? 'in_review';
        final doses = (sv['doses'] as List?) ?? [];
        return Card(
          margin: const EdgeInsets.only(bottom: 8),
          child: ExpansionTile(
            leading: Container(
              width: 8,
              height: 40,
              decoration: BoxDecoration(
                color: _statusColor(status),
                borderRadius: BorderRadius.circular(4),
              ),
            ),
            title: Text(
              vaccineName,
              style: const TextStyle(fontWeight: FontWeight.w600),
            ),
            subtitle: Text(
              _statusLabel(status),
              style: TextStyle(fontSize: 12, color: _statusColor(status)),
            ),
            children: doses.map<Widget>((d) {
              final doseStatus = d['status'] ?? 'pending';
              final label =
                  d['dose_config']?['label'] ?? 'Dosis ${d['dose_number']}';
              final doseId = d['id'] ?? '';
              return _buildDoseReviewTile(d, doseId, label, doseStatus);
            }).toList(),
          ),
        );
      }).toList(),
    );
  }

  Widget _dueDateChip(
    String dueDate,
    int daysUntilDue, {
    required bool? isOverdue,
    required bool? isDueToday,
  }) {
    final color = isOverdue == true
        ? AppColors.error
        : daysUntilDue >= 0 && daysUntilDue <= 7
        ? AppColors.warning
        : AppColors.info;
    final text = isDueToday == true
        ? 'Vence hoy'
        : isOverdue == true
        ? 'Vencio hace ${daysUntilDue.abs()} dias'
        : daysUntilDue > 0
        ? 'Vence en $daysUntilDue dias'
        : 'Vence $dueDate';

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: color.withValues(alpha: 0.28)),
      ),
      child: Text(
        '$text ($dueDate)',
        style: TextStyle(
          color: color,
          fontSize: 11,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }

  Widget _buildDoseReviewTile(
    dynamic dose,
    String doseId,
    String label,
    String doseStatus,
  ) {
    final auth = ref.watch(authStateProvider);
    final adminNotes = dose['admin_notes']?.toString().trim() ?? '';
    final reviewedBy = dose['reviewed_by']?.toString();
    final titerValue = dose['titer_value']?.toString();
    final isTiterDose = dose['dose_config']?['dose_type'] == 'titer';
    final canManageComment =
        adminNotes.isNotEmpty &&
        reviewedBy != null &&
        reviewedBy == auth.userId;
    final dueDateRaw = dose['due_date']?.toString();
    final daysUntilDueRaw = dose['days_until_due'];
    final daysUntilDue = daysUntilDueRaw is int
        ? daysUntilDueRaw
        : int.tryParse(daysUntilDueRaw?.toString() ?? '');

    return ListTile(
      title: Text(label, style: const TextStyle(fontSize: 14)),
      subtitle: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(
            spacing: 8,
            runSpacing: 4,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              Icon(Icons.circle, size: 8, color: _statusColor(doseStatus)),
              Text(
                _statusLabel(doseStatus),
                style: TextStyle(fontSize: 12, color: _statusColor(doseStatus)),
              ),
              if (dose['applied_date'] != null) ...[
                const Icon(
                  Icons.calendar_today,
                  size: 12,
                  color: AppColors.textSecondary,
                ),
                Text(
                  dose['applied_date'].toString(),
                  style: const TextStyle(
                    fontSize: 12,
                    color: AppColors.textSecondary,
                  ),
                ),
              ],
              if (isTiterDose &&
                  titerValue != null &&
                  titerValue.isNotEmpty) ...[
                const Icon(
                  Icons.science_outlined,
                  size: 13,
                  color: AppColors.textSecondary,
                ),
                Text(
                  titerValue,
                  style: const TextStyle(
                    fontSize: 12,
                    color: AppColors.textSecondary,
                  ),
                ),
              ],
              if (dueDateRaw != null && daysUntilDue != null)
                _dueDateChip(
                  dueDateRaw,
                  daysUntilDue,
                  isOverdue: dose['is_overdue'] as bool?,
                  isDueToday: dose['is_due_today'] as bool?,
                ),
            ],
          ),
          if (adminNotes.isNotEmpty) ...[
            const SizedBox(height: 8),
            _adminCommentBox(
              adminNotes,
              canManageComment: canManageComment,
              onEdit: () => _editDoseComment(doseId, adminNotes),
              onDelete: () => _deleteDoseComment(doseId),
            ),
          ],
        ],
      ),
      trailing: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (doseStatus != 'approved')
            IconButton(
              icon: const Icon(
                Icons.check_circle,
                color: AppColors.success,
                size: 22,
              ),
              tooltip: 'Aprobar',
              onPressed: () =>
                  _reviewDose(doseId, 'approved', initialNotes: adminNotes),
            ),
          if (doseStatus != 'denied')
            IconButton(
              icon: const Icon(Icons.cancel, color: AppColors.error, size: 22),
              tooltip: 'Denegar',
              onPressed: () =>
                  _reviewDose(doseId, 'denied', initialNotes: adminNotes),
            ),
        ],
      ),
    );
  }

  Widget _adminCommentBox(
    String comment, {
    required bool canManageComment,
    required VoidCallback onEdit,
    required VoidCallback onDelete,
  }) {
    final colorScheme = Theme.of(context).colorScheme;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: colorScheme.primaryContainer.withValues(alpha: 0.35),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: colorScheme.outlineVariant),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(
                Icons.comment_outlined,
                size: 16,
                color: AppColors.info,
              ),
              const SizedBox(width: 6),
              const Expanded(
                child: Text(
                  'Comentario del administrador',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: AppColors.info,
                  ),
                ),
              ),
              if (canManageComment) ...[
                IconButton(
                  icon: const Icon(Icons.edit_outlined, size: 18),
                  tooltip: 'Editar comentario',
                  onPressed: onEdit,
                ),
                IconButton(
                  icon: const Icon(Icons.delete_outline, size: 18),
                  tooltip: 'Eliminar comentario',
                  onPressed: onDelete,
                ),
              ],
            ],
          ),
          Text(
            comment,
            style: TextStyle(fontSize: 12, color: colorScheme.onSurface),
          ),
        ],
      ),
    );
  }

  Widget _evidenceTab() {
    return ListView(
      padding: const EdgeInsets.all(12),
      children: [
        Wrap(
          spacing: 8,
          children: [
            TextButton(
              onPressed: _evidenceMetadata?['has_previous'] == true
                  ? () {
                      _evidencePage--;
                      _load();
                    }
                  : null,
              child: const Text('Anterior'),
            ),
            Text(
              'Página $_evidencePage de ${_evidenceMetadata?['total_pages'] ?? 0}',
            ),
            TextButton(
              onPressed: _evidenceMetadata?['has_next'] == true
                  ? () {
                      _evidencePage++;
                      _load();
                    }
                  : null,
              child: const Text('Siguiente'),
            ),
          ],
        ),
        if (_evidence.isEmpty) const Text('Sin evidencia subida'),
        ..._evidence.map((batch) {
          final files = (batch['files'] as List?) ?? [];
          final batchId = batch['id']?.toString() ?? '';
          return Card(
            margin: const EdgeInsets.only(bottom: 8),
            child: ExpansionTile(
              leading: const Icon(Icons.folder, color: AppColors.info),
              title: Text('${files.length} archivo(s)'),
              subtitle: Text(
                batch['created_at']?.toString().substring(0, 10) ?? '',
                style: const TextStyle(fontSize: 12),
              ),
              children: [
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  child: Wrap(
                    spacing: 8,
                    children: [
                      _evidenceReviewAction(
                        batchId,
                        'in_review',
                        'En revisión',
                      ),
                      _evidenceReviewAction(batchId, 'approved', 'Aprobar'),
                      _evidenceReviewAction(batchId, 'denied', 'Denegar'),
                    ],
                  ),
                ),
                ...files.map<Widget>((file) {
                  final fileName = file['original_filename'] ?? 'documento.pdf';
                  final fileId = file['id']?.toString() ?? '';
                  return ListTile(
                    dense: true,
                    leading: const Icon(
                      Icons.picture_as_pdf,
                      color: AppColors.error,
                    ),
                    title: Text(fileName, style: const TextStyle(fontSize: 13)),
                    trailing: IconButton(
                      icon: const Icon(
                        Icons.open_in_new,
                        size: 20,
                        color: AppColors.primary,
                      ),
                      onPressed: fileId.isEmpty
                          ? null
                          : () => _downloadEvidenceFile(
                              fileId,
                              fileName.toString(),
                            ),
                    ),
                  );
                }),
                Align(
                  alignment: Alignment.centerRight,
                  child: TextButton.icon(
                    onPressed: batchId.isEmpty
                        ? null
                        : () => _deleteEvidenceBatch(batchId),
                    icon: const Icon(
                      Icons.delete_outline,
                      color: AppColors.error,
                      size: 20,
                    ),
                    label: const Text(
                      'Eliminar',
                      style: TextStyle(color: AppColors.error),
                    ),
                  ),
                ),
                const SizedBox(height: 8),
              ],
            ),
          );
        }),
      ],
    );
  }

  Widget _evidenceReviewAction(String batchId, String status, String label) {
    return TextButton(
      onPressed: batchId.isEmpty
          ? null
          : () async {
              try {
                await ref
                    .read(adminRemoteDataSourceProvider)
                    .reviewEvidenceBatch(batchId, status);
                await _load();
              } catch (error) {
                if (!mounted) return;
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text('No se pudo revisar la evidencia: $error'),
                  ),
                );
              }
            },
      child: Text(label),
    );
  }
}
