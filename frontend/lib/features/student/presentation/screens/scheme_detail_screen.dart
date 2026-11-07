import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../../core/models/domain_enums.dart';
import '../../../../core/widgets/skeleton.dart';
import '../../../../core/widgets/ucc_brand.dart';
import '../../data/models/vaccine_model.dart';
import '../providers/scheme_provider.dart';

/// Student vaccination scheme detail — view all vaccines/doses, enter dates.
class SchemeDetailScreen extends ConsumerStatefulWidget {
  const SchemeDetailScreen({super.key});

  @override
  ConsumerState<SchemeDetailScreen> createState() => _SchemeDetailScreenState();
}

class _SchemeDetailScreenState extends ConsumerState<SchemeDetailScreen> {
  @override
  void initState() {
    super.initState();
    Future.microtask(() => ref.read(schemeProvider.notifier).loadScheme());
  }

  Color _statusColor(String status) {
    switch (status) {
      case 'approved':
        return AppColors.statusApproved;
      case 'denied':
        return AppColors.statusDenied;
      case 'in_review':
        return AppColors.statusInReview;
      default:
        return AppColors.statusPending;
    }
  }

  String _statusLabel(String status) {
    switch (status) {
      case 'approved':
        return 'Aprobada';
      case 'denied':
        return 'Denegada';
      case 'in_review':
        return 'En Revisión';
      default:
        return 'Estado no reconocido';
    }
  }

  Future<void> _selectDate(String doseId, {String? currentDate}) async {
    final parsedCurrentDate = currentDate == null
        ? null
        : DateTime.tryParse(currentDate);
    final picked = await showDatePicker(
      context: context,
      initialDate: parsedCurrentDate ?? DateTime.now(),
      firstDate: DateTime(1990),
      lastDate: DateTime.now(),
      locale: const Locale('es'),
    );
    if (picked != null) {
      final formatted = DateFormat('yyyy-MM-dd').format(picked);
      final updated = await ref
          .read(schemeProvider.notifier)
          .updateDose(doseId, appliedDate: formatted);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            updated
                ? 'Fecha de aplicacion actualizada'
                : 'No se pudo actualizar la fecha',
          ),
        ),
      );
    }
  }

  Future<void> _editTiterRecord(DoseModel dose) async {
    final doseId = dose.id;
    if (doseId.isEmpty) return;

    final currentDate = dose.appliedDate;
    final valueController = TextEditingController(text: dose.titerValue ?? '');
    DateTime? selectedDate = currentDate == null
        ? null
        : DateTime.tryParse(currentDate);
    String? dateError;
    String? valueError;

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (dialogContext, setDialogState) => AlertDialog(
          title: const Text('Registrar titulación'),
          content: SizedBox(
            width: 420,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: const Icon(Icons.calendar_today_outlined),
                  title: const Text('Fecha'),
                  subtitle: Text(
                    selectedDate == null
                        ? 'Selecciona una fecha'
                        : DateFormat('yyyy-MM-dd').format(selectedDate!),
                    style: TextStyle(
                      color: dateError == null
                          ? AppColors.textSecondary
                          : AppColors.error,
                    ),
                  ),
                  trailing: IconButton(
                    icon: const Icon(Icons.edit_calendar_outlined),
                    onPressed: () async {
                      final picked = await showDatePicker(
                        context: dialogContext,
                        initialDate: selectedDate ?? DateTime.now(),
                        firstDate: DateTime(1990),
                        lastDate: DateTime.now(),
                        locale: const Locale('es'),
                      );
                      if (picked != null) {
                        setDialogState(() {
                          selectedDate = picked;
                          dateError = null;
                        });
                      }
                    },
                  ),
                ),
                if (dateError != null)
                  Align(
                    alignment: Alignment.centerLeft,
                    child: Text(
                      dateError!,
                      style: const TextStyle(
                        color: AppColors.error,
                        fontSize: 12,
                      ),
                    ),
                  ),
                const SizedBox(height: 12),
                TextField(
                  controller: valueController,
                  decoration: InputDecoration(
                    labelText: 'Valor de titulación',
                    hintText: 'Ej: 10 mUI/mL',
                    errorText: valueError,
                  ),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(false),
              child: const Text('Cancelar'),
            ),
            FilledButton(
              onPressed: () {
                final cleanValue = valueController.text.trim();
                setDialogState(() {
                  dateError = selectedDate == null
                      ? 'La fecha es obligatoria'
                      : null;
                  valueError = cleanValue.isEmpty
                      ? 'El valor de titulación es obligatorio'
                      : null;
                });
                if (selectedDate != null && cleanValue.isNotEmpty) {
                  Navigator.of(dialogContext).pop(true);
                }
              },
              child: const Text('Guardar'),
            ),
          ],
        ),
      ),
    );

    if (confirmed == true && selectedDate != null) {
      final formatted = DateFormat('yyyy-MM-dd').format(selectedDate!);
      final updated = await ref
          .read(schemeProvider.notifier)
          .updateDose(
            doseId,
            appliedDate: formatted,
            titerValue: valueController.text.trim(),
          );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            updated
                ? 'Titulación actualizada'
                : 'No se pudo actualizar la titulación',
          ),
        ),
      );
    }

    valueController.dispose();
  }

  Future<void> _clearDoseRecord(
    String doseId, {
    bool clearTiterValue = false,
  }) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(clearTiterValue ? 'Eliminar titulación' : 'Eliminar fecha'),
        content: Text(
          clearTiterValue
              ? 'Esta titulación quedara sin fecha ni valor registrado.'
              : 'Esta dosis quedara sin fecha de aplicacion.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Eliminar'),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    final updated = await ref
        .read(schemeProvider.notifier)
        .updateDose(
          doseId,
          clearAppliedDate: true,
          clearTiterValue: clearTiterValue,
        );
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          updated
              ? (clearTiterValue
                    ? 'Titulación eliminada'
                    : 'Fecha de aplicacion eliminada')
              : (clearTiterValue
                    ? 'No se pudo eliminar la titulación'
                    : 'No se pudo eliminar la fecha'),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(schemeProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Mi Esquema de Vacunación')),
      body: UccBrandBackground(
        child:
            state.isLoading && state.overview == null && state.vaccines.isEmpty
            ? ListView.builder(
                padding: const EdgeInsets.all(16),
                itemCount: 6,
                itemBuilder: (context, index) => const Padding(
                  padding: EdgeInsets.only(bottom: 12),
                  child: SkeletonBox(height: 72),
                ),
              )
            : state.error != null && state.overview == null
            ? Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      state.error!,
                      style: const TextStyle(color: AppColors.error),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 12),
                    OutlinedButton.icon(
                      onPressed: () => ref
                          .read(schemeProvider.notifier)
                          .loadScheme(forceRefresh: true),
                      icon: const Icon(Icons.refresh),
                      label: const Text('Reintentar'),
                    ),
                  ],
                ),
              )
            : _buildScheme(state),
      ),
    );
  }

  Widget _buildScheme(SchemeState state) {
    final overview = state.overview;
    return RefreshIndicator(
      onRefresh: () =>
          ref.read(schemeProvider.notifier).loadScheme(forceRefresh: true),
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        children: [
          if (state.isOffline)
            Container(
              margin: const EdgeInsets.only(bottom: 16),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.warning.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: AppColors.warning.withValues(alpha: 0.5),
                ),
              ),
              child: Row(
                children: [
                  const Icon(Icons.wifi_off_outlined, color: AppColors.warning),
                  const SizedBox(width: 8),
                  const Expanded(
                    child: Text(
                      'Información no verificada por falta de conexión.',
                      style: TextStyle(color: AppColors.warning),
                    ),
                  ),
                ],
              ),
            ),
          // Overview card
          if (overview != null) _buildOverviewCard(overview),
          const SizedBox(height: 16),
          // Vaccines list
          if (state.vaccines.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 28),
              child: Column(
                children: [
                  Icon(
                    Icons.vaccines_outlined,
                    size: 40,
                    color: AppColors.textSecondary,
                  ),
                  SizedBox(height: 12),
                  Text(
                    'Sin vacunas asignadas',
                    style: TextStyle(fontWeight: FontWeight.w600),
                  ),
                  SizedBox(height: 4),
                  Text(
                    'Tu esquema aún no tiene vacunas.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: AppColors.textSecondary),
                  ),
                ],
              ),
            )
          else
            ...state.vaccines.map((v) => _buildVaccineCard(v, state.isOffline)),
        ],
      ),
    );
  }

  Widget _buildOverviewCard(SchemeOverviewModel overview) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: AppColors.brandGradient,
        borderRadius: BorderRadius.circular(16),
      ),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final columns = constraints.maxWidth >= 640 ? 5 : 2;
          const spacing = 12.0;
          final itemWidth =
              (constraints.maxWidth - spacing * (columns - 1)) / columns;

          return Wrap(
            spacing: spacing,
            runSpacing: spacing,
            alignment: WrapAlignment.center,
            children: [
              SizedBox(
                width: itemWidth,
                child: _statItem(
                  'Total',
                  '${overview.totalVaccines}',
                  Colors.white,
                ),
              ),
              SizedBox(
                width: itemWidth,
                child: _statItem(
                  'Aprobadas',
                  '${overview.approvedVaccines}',
                  AppColors.successLight,
                ),
              ),
              SizedBox(
                width: itemWidth,
                child: _statItem(
                  'Pendientes',
                  '${overview.pendingVaccines}',
                  AppColors.warningLight,
                ),
              ),
              SizedBox(
                width: itemWidth,
                child: _statItem(
                  'Denegadas',
                  '${overview.deniedVaccines}',
                  AppColors.errorLight,
                ),
              ),
              SizedBox(
                width: itemWidth,
                child: _statItem(
                  'En revision',
                  '${overview.inReviewVaccines}',
                  AppColors.warningLight,
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _statItem(String label, String value, Color color) {
    return Column(
      children: [
        Text(
          value,
          style: TextStyle(
            fontSize: 24,
            fontWeight: FontWeight.bold,
            color: color,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          label,
          style: TextStyle(
            fontSize: 11,
            color: Colors.white.withValues(alpha: 0.9),
          ),
        ),
      ],
    );
  }

  Widget _buildVaccineCard(StudentVaccineModel vaccine, bool isOffline) {
    final name = vaccine.vaccineName;
    final status = vaccine.status.wireValue;
    final doses = vaccine.doses;

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: ExpansionTile(
        leading: Container(
          width: 8,
          height: 40,
          decoration: BoxDecoration(
            color: _statusColor(status),
            borderRadius: BorderRadius.circular(4),
          ),
        ),
        title: Text(name, style: const TextStyle(fontWeight: FontWeight.w600)),
        subtitle: Wrap(
          spacing: 8,
          runSpacing: 4,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(
                color: _statusColor(status).withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(6),
              ),
              child: Text(
                _statusLabel(status),
                style: TextStyle(
                  fontSize: 11,
                  color: _statusColor(status),
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
            Text(
              '${doses.length} dosis',
              style: const TextStyle(
                fontSize: 12,
                color: AppColors.textSecondary,
              ),
            ),
          ],
        ),
        children: doses.map((dose) => _buildDoseTile(dose, isOffline)).toList(),
      ),
    );
  }

  Widget _buildDoseTile(DoseModel dose, bool isOffline) {
    final label = dose.doseConfig?.label ?? 'Dosis ${dose.doseNumber}';
    final status = dose.status.wireValue;
    final appliedDate = dose.appliedDate;
    final dueDate = dose.dueDate;
    final daysUntilDue = dose.daysUntilDue;
    final titerValue = dose.titerValue;
    final adminNotes = dose.adminNotes?.trim() ?? '';
    final isTiterDose = dose.doseConfig?.isTiter ?? false;

    return ListTile(
      contentPadding: const EdgeInsets.symmetric(horizontal: 24, vertical: 4),
      title: Text(label, style: const TextStyle(fontSize: 14)),
      subtitle: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(
            spacing: 8,
            runSpacing: 4,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              Icon(Icons.circle, size: 8, color: _statusColor(status)),
              Text(
                _statusLabel(status),
                style: TextStyle(fontSize: 12, color: _statusColor(status)),
              ),
              if (appliedDate != null) ...[
                const Icon(
                  Icons.calendar_today,
                  size: 12,
                  color: AppColors.textSecondary,
                ),
                Text(
                  appliedDate,
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
              if (dueDate != null && daysUntilDue != null)
                _dueDateChip(
                  dueDate,
                  daysUntilDue,
                  isOverdue: dose.isOverdue,
                  isDueToday: dose.isDueToday,
                ),
            ],
          ),
          if (adminNotes.isNotEmpty) ...[
            const SizedBox(height: 8),
            _adminCommentBox(adminNotes),
          ],
        ],
      ),

      trailing: _canEditDoseDate(dose.status, isOffline)
          ? _buildDoseActions(dose, appliedDate, isTiterDose)
          : null,
    );
  }

  bool _canEditDoseDate(DoseStatus status, bool isOffline) {
    if (isOffline) return false;
    return status == DoseStatus.denied || status == DoseStatus.inReview;
  }

  Widget _buildDoseActions(
    DoseModel dose,
    String? appliedDate,
    bool isTiterDose,
  ) {
    final doseId = dose.id;
    final hasDate = appliedDate != null && appliedDate.isNotEmpty;
    final titerValue = dose.titerValue;
    final hasTiterValue = titerValue != null && titerValue.isNotEmpty;
    final hasRecord = isTiterDose ? hasDate || hasTiterValue : hasDate;

    if (!hasRecord) {
      return IconButton(
        icon: Icon(
          isTiterDose ? Icons.science_outlined : Icons.edit_calendar,
          color: AppColors.primary,
        ),
        tooltip: isTiterDose ? 'Registrar titulación' : 'Registrar fecha',
        onPressed: () =>
            isTiterDose ? _editTiterRecord(dose) : _selectDate(doseId),
      );
    }

    return PopupMenuButton<String>(
      tooltip: isTiterDose ? 'Opciones de titulación' : 'Opciones de fecha',
      icon: const Icon(Icons.more_vert, color: AppColors.primary),
      onSelected: (value) {
        if (value == 'edit') {
          if (isTiterDose) {
            _editTiterRecord(dose);
          } else {
            _selectDate(doseId, currentDate: appliedDate);
          }
        } else if (value == 'delete') {
          _clearDoseRecord(doseId, clearTiterValue: isTiterDose);
        }
      },
      itemBuilder: (context) => [
        PopupMenuItem(
          value: 'edit',
          child: ListTile(
            leading: Icon(
              isTiterDose
                  ? Icons.science_outlined
                  : Icons.edit_calendar_outlined,
            ),
            title: Text(isTiterDose ? 'Editar titulación' : 'Editar fecha'),
            contentPadding: EdgeInsets.zero,
          ),
        ),
        PopupMenuItem(
          value: 'delete',
          child: const ListTile(
            leading: Icon(Icons.delete_outline, color: AppColors.error),
            title: Text('Eliminar registro'),
            contentPadding: EdgeInsets.zero,
          ),
        ),
      ],
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

  Widget _adminCommentBox(String comment) {
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
          const Wrap(
            spacing: 6,
            runSpacing: 4,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              Icon(Icons.comment_outlined, size: 16, color: AppColors.info),
              Text(
                'Comentario del administrador',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: AppColors.info,
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            comment,
            style: TextStyle(fontSize: 12, color: colorScheme.onSurface),
          ),
        ],
      ),
    );
  }
}
