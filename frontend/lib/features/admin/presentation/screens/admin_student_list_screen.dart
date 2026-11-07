import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/ucc_brand.dart';
import '../../data/models/admin_models.dart';
import '../providers/admin_provider.dart';

/// Admin student list — search, filter, paginate, deactivate/reactivate.
class AdminStudentListScreen extends ConsumerStatefulWidget {
  final bool? initialActiveFilter;
  final String? initialVaccinationStatus;
  final int? initialSemester;

  const AdminStudentListScreen({
    super.key,
    this.initialActiveFilter,
    this.initialVaccinationStatus,
    this.initialSemester,
  });

  @override
  ConsumerState<AdminStudentListScreen> createState() =>
      _AdminStudentListScreenState();
}

class _AdminStudentListScreenState
    extends ConsumerState<AdminStudentListScreen> {
  final _searchCtrl = TextEditingController();
  Timer? _searchDebounce;
  bool? _activeFilter;
  String? _vaccinationStatusFilter;
  int? _semesterFilter;

  @override
  void initState() {
    super.initState();
    _activeFilter = widget.initialActiveFilter;
    _vaccinationStatusFilter = _normalizedVaccinationFilter(
      widget.initialVaccinationStatus,
    );
    _semesterFilter = widget.initialSemester;
    Future.microtask(() => _search());
  }

  @override
  void dispose() {
    _searchDebounce?.cancel();
    _searchCtrl.dispose();
    super.dispose();
  }

  void _search() {
    ref
        .read(adminStudentListProvider.notifier)
        .load(
          search: _searchCtrl.text.trim().isEmpty
              ? null
              : _searchCtrl.text.trim(),
          isActive: _activeFilter,
          semester: _semesterFilter,
          vaccinationStatus: _vaccinationStatusFilter,
        );
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(adminStudentListProvider);
    final colorScheme = Theme.of(context).colorScheme;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Estudiantes'),
        actions: [
          IconButton(
            tooltip: 'Actualizar lista',
            icon: const Icon(Icons.refresh),
            onPressed: state.isLoading
                ? null
                : () => ref.read(adminStudentListProvider.notifier).refresh(),
          ),
        ],
      ),
      body: UccBrandBackground(
        child: Column(
          children: [
            // Search + filters
            Container(
              padding: const EdgeInsets.all(12),
              color: colorScheme.surface,
              child: Column(
                children: [
                  TextField(
                    controller: _searchCtrl,
                    decoration: InputDecoration(
                      hintText: 'Buscar por nombre, correo, documento o ID...',
                      prefixIcon: const Icon(Icons.search),
                      suffixIcon: IconButton(
                        icon: const Icon(Icons.clear),
                        onPressed: () {
                          _searchCtrl.clear();
                          _search();
                        },
                      ),
                    ),
                    onChanged: (_) {
                      _searchDebounce?.cancel();
                      _searchDebounce = Timer(
                        const Duration(milliseconds: 400),
                        _search,
                      );
                    },
                    onSubmitted: (_) {
                      _searchDebounce?.cancel();
                      _search();
                    },
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Expanded(
                        child: SingleChildScrollView(
                          scrollDirection: Axis.horizontal,
                          child: Row(
                            children: [
                              ChoiceChip(
                                label: const Text('Todos'),
                                selected: _activeFilter == null,
                                onSelected: (_) {
                                  setState(() => _activeFilter = null);
                                  _search();
                                },
                              ),
                              const SizedBox(width: 8),
                              ChoiceChip(
                                label: const Text('Activos'),
                                selected: _activeFilter == true,
                                onSelected: (_) {
                                  setState(() => _activeFilter = true);
                                  _search();
                                },
                              ),
                              const SizedBox(width: 8),
                              ChoiceChip(
                                label: const Text('Desactivados'),
                                selected: _activeFilter == false,
                                onSelected: (_) {
                                  setState(() => _activeFilter = false);
                                  _search();
                                },
                              ),
                              const SizedBox(width: 8),
                              ChoiceChip(
                                label: const Text('Esquema 100%'),
                                selected:
                                    _vaccinationStatusFilter == 'approved',
                                onSelected: (_) {
                                  setState(
                                    () => _vaccinationStatusFilter = 'approved',
                                  );
                                  _search();
                                },
                              ),
                              const SizedBox(width: 8),
                              ChoiceChip(
                                label: const Text('Pendientes'),
                                selected: _vaccinationStatusFilter == 'pending',
                                onSelected: (_) {
                                  setState(
                                    () => _vaccinationStatusFilter = 'pending',
                                  );
                                  _search();
                                },
                              ),
                              const SizedBox(width: 8),
                              if (_vaccinationStatusFilter != null ||
                                  _semesterFilter != null)
                                ActionChip(
                                  avatar: const Icon(Icons.filter_alt_off),
                                  label: Text(
                                    _semesterFilter == null
                                        ? 'Limpiar filtros'
                                        : 'Limpiar semestre ${_semesterFilter!}',
                                  ),
                                  onPressed: () {
                                    setState(() {
                                      _vaccinationStatusFilter = null;
                                      _semesterFilter = null;
                                    });
                                    _search();
                                  },
                                ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Align(
                        alignment: Alignment.centerRight,
                        child: Text(
                          '${state.total} resultados',
                          style: TextStyle(
                            fontSize: 12,
                            color: colorScheme.onSurfaceVariant,
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            // List
            Expanded(
              child: state.isLoading
                  ? const Center(child: CircularProgressIndicator())
                  : state.error != null
                  ? Center(
                      child: TextButton(
                        onPressed: () => ref
                            .read(adminStudentListProvider.notifier)
                            .refresh(),
                        child: Text("${state.error} · Reintentar"),
                      ),
                    )
                  : state.students.isEmpty
                  ? const Center(child: Text('No se encontraron estudiantes'))
                  : Builder(
                      builder: (context) {
                        final semesterGroups = _groupStudentsBySemester(
                          state.students,
                        );

                        return ListView.separated(
                          padding: const EdgeInsets.all(12),
                          itemCount: semesterGroups.length,
                          separatorBuilder: (context, index) =>
                              const SizedBox(height: 8),
                          itemBuilder: (context, i) {
                            final group = semesterGroups.entries.elementAt(i);
                            return _buildSemesterTile(group.key, group.value);
                          },
                        );
                      },
                    ),
            ),
            // Pagination
            if (state.totalPages > 1)
              Container(
                padding: const EdgeInsets.symmetric(vertical: 8),
                color: colorScheme.surface,
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    IconButton(
                      tooltip: 'Página anterior',
                      icon: const Icon(Icons.chevron_left),
                      onPressed: !state.isLoading && state.page > 1
                          ? () => ref
                                .read(adminStudentListProvider.notifier)
                                .prevPage()
                          : null,
                    ),
                    Text(
                      'Página ${state.page} de ${state.totalPages}',
                      style: const TextStyle(fontWeight: FontWeight.w500),
                    ),
                    IconButton(
                      tooltip: 'Página siguiente',
                      icon: const Icon(Icons.chevron_right),
                      onPressed:
                          !state.isLoading && state.page < state.totalPages
                          ? () => ref
                                .read(adminStudentListProvider.notifier)
                                .nextPage()
                          : null,
                    ),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }

  String? _normalizedVaccinationFilter(String? value) {
    if (value == 'approved' || value == 'pending') return value;
    return null;
  }

  Map<int, List<AdminStudentListItem>> _groupStudentsBySemester(
    List<AdminStudentListItem> students,
  ) {
    final groups = <int, List<AdminStudentListItem>>{};
    for (final student in students) {
      final semester = student.semester ?? 0;
      groups.putIfAbsent(semester, () => []).add(student);
    }

    final entries = groups.entries.toList()
      ..sort((a, b) {
        if (a.key == 0) return 1;
        if (b.key == 0) return -1;
        return a.key.compareTo(b.key);
      });
    return Map<int, List<AdminStudentListItem>>.fromEntries(entries);
  }

  Widget _buildSemesterTile(int semester, List<AdminStudentListItem> students) {
    final colorScheme = Theme.of(context).colorScheme;
    final approved = students
        .where((s) => _studentVaccinationStatus(s) == 'approved')
        .length;
    final denied = students
        .where((s) => _studentVaccinationStatus(s) == 'denied')
        .length;
    final pending = students.length - approved - denied;

    return Card(
      clipBehavior: Clip.antiAlias,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(8),
        side: BorderSide(color: colorScheme.outlineVariant),
      ),
      child: ExpansionTile(
        tilePadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        childrenPadding: const EdgeInsets.fromLTRB(8, 0, 8, 8),
        leading: CircleAvatar(
          backgroundColor: AppColors.primary,
          child: Text(
            semester == 0 ? '?' : '$semester',
            style: const TextStyle(
              color: Colors.white,
              fontWeight: FontWeight.bold,
            ),
          ),
        ),
        title: Text(
          semester == 0 ? 'Sin semestre' : 'Semestre $semester',
          style: const TextStyle(fontWeight: FontWeight.w700),
        ),
        subtitle: Wrap(
          spacing: 6,
          runSpacing: 4,
          children: [
            Text(
              '${students.length} estudiante${students.length == 1 ? '' : 's'}',
              style: TextStyle(
                fontSize: 12,
                color: colorScheme.onSurfaceVariant,
              ),
            ),
            _buildSmallStatusText('Aprobados', approved, AppColors.success),
            _buildSmallStatusText('Pendientes', pending, AppColors.warning),
            _buildSmallStatusText('Denegados', denied, AppColors.error),
          ],
        ),
        children: students
            .map(
              (student) => Padding(
                padding: const EdgeInsets.only(top: 6),
                child: _buildStudentTile(student),
              ),
            )
            .toList(),
      ),
    );
  }

  Widget _buildSmallStatusText(String label, int count, Color color) {
    return Text(
      '$label: $count',
      style: TextStyle(fontSize: 12, color: color, fontWeight: FontWeight.w600),
    );
  }

  Widget _buildStudentTile(AdminStudentListItem student) {
    final colorScheme = Theme.of(context).colorScheme;
    final name = student.displayName;
    final email = student.email;
    final program = student.program ?? '';
    final campus = student.campus ?? '';
    final isActive = student.isActive;
    final studentId = student.id;
    final vaccinationStatus = _studentVaccinationStatus(student);

    return Container(
      decoration: BoxDecoration(
        color: colorScheme.surfaceContainerHighest.withValues(alpha: 0.55),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: colorScheme.outlineVariant),
      ),
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: isActive ? AppColors.primary : AppColors.textHint,
          child: Text(
            name.isNotEmpty ? name[0].toUpperCase() : '?',
            style: const TextStyle(
              color: Colors.white,
              fontWeight: FontWeight.bold,
            ),
          ),
        ),
        title: Text(name, style: const TextStyle(fontWeight: FontWeight.w600)),
        subtitle: Wrap(
          spacing: 8,
          runSpacing: 4,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            Text(email, style: const TextStyle(fontSize: 12)),
            if (program.isNotEmpty)
              Text(program, style: const TextStyle(fontSize: 12)),
            if (campus.isNotEmpty)
              Text(campus, style: const TextStyle(fontSize: 12)),
            _buildStatusChip(
              isActive ? 'Activo' : 'Inactivo',
              isActive ? AppColors.success : AppColors.error,
              isActive ? AppColors.successLight : AppColors.errorLight,
            ),
            _buildVaccinationStatusChip(vaccinationStatus),
          ],
        ),
        trailing: PopupMenuButton<String>(
          icon: const Icon(Icons.more_vert),
          onSelected: (action) async {
            if (action == 'detail') {
              await _openStudent(studentId);
            }
            if (action == 'deactivate') {
              await ref
                  .read(adminStudentListProvider.notifier)
                  .deactivate(studentId);
            }
            if (action == 'reactivate') {
              await ref
                  .read(adminStudentListProvider.notifier)
                  .reactivate(studentId);
            }
            if (action == 'delete') {
              await _confirmAndDeleteStudent(studentId, name);
            }
          },
          itemBuilder: (_) => [
            const PopupMenuItem(value: 'detail', child: Text('Ver detalle')),
            if (isActive)
              const PopupMenuItem(
                value: 'deactivate',
                child: Text('Desactivar'),
              ),
            if (!isActive)
              const PopupMenuItem(
                value: 'reactivate',
                child: Text('Reactivar'),
              ),
            const PopupMenuItem(
              value: 'delete',
              child: Text(
                'Eliminar definitivamente',
                style: TextStyle(color: AppColors.error),
              ),
            ),
          ],
        ),
        onTap: () => _openStudent(studentId),
      ),
    );
  }

  Future<void> _openStudent(String id) async {
    await context.push('/admin/students/$id');
    if (mounted) await ref.read(adminStudentListProvider.notifier).refresh();
  }

  String _studentVaccinationStatus(AdminStudentListItem student) {
    final value = student.vaccinationStatus?.toLowerCase();
    if (value == 'approved' || value == 'denied') return value!;
    return 'pending';
  }

  Future<void> _confirmAndDeleteStudent(String studentId, String name) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Eliminar estudiante'),
        content: Text(
          'Esta acción es permanente. Se borrarán los datos del perfil, '
          'esquema, dosis, evidencias y notificaciones de "$name". '
          '¿Deseas continuar?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancelar'),
          ),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            style: TextButton.styleFrom(foregroundColor: AppColors.error),
            child: const Text('Eliminar'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    final ok = await ref
        .read(adminStudentListProvider.notifier)
        .deleteStudent(studentId);
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          ok
              ? 'Estudiante eliminado definitivamente'
              : 'No se pudo eliminar al estudiante',
        ),
      ),
    );
  }

  Widget _buildVaccinationStatusChip(String status) {
    switch (status) {
      case 'approved':
        return _buildStatusChip(
          'Aprobado',
          AppColors.success,
          AppColors.successLight,
          icon: Icons.check_circle_outline,
        );
      case 'denied':
        return _buildStatusChip(
          'Denegado',
          AppColors.error,
          AppColors.errorLight,
          icon: Icons.cancel_outlined,
        );
      default:
        return _buildStatusChip(
          'Pendiente',
          AppColors.warning,
          AppColors.warningLight,
          icon: Icons.hourglass_empty,
        );
    }
  }

  Widget _buildStatusChip(
    String label,
    Color color,
    Color backgroundColor, {
    IconData? icon,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(4),
      ),
      child: Wrap(
        spacing: 3,
        runSpacing: 2,
        crossAxisAlignment: WrapCrossAlignment.center,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 12, color: color),
            const SizedBox(width: 3),
          ],
          Text(
            label,
            style: TextStyle(
              fontSize: 10,
              color: color,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}
