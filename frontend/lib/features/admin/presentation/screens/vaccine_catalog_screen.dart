import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_theme.dart';
import '../../data/models/admin_models.dart';
import '../providers/admin_provider.dart';

/// Vaccine catalog CRUD — app_admin only.
class VaccineCatalogScreen extends ConsumerStatefulWidget {
  const VaccineCatalogScreen({super.key});

  @override
  ConsumerState<VaccineCatalogScreen> createState() =>
      _VaccineCatalogScreenState();
}

class _VaccineCatalogScreenState extends ConsumerState<VaccineCatalogScreen> {
  @override
  void initState() {
    super.initState();
    Future.microtask(() => ref.read(vaccineCatalogProvider.notifier).load());
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(vaccineCatalogProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Catálogo de vacunas')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _openEditor(null),
        icon: const Icon(Icons.add),
        label: const Text('Nueva vacuna'),
      ),
      body: state.isLoading
          ? const Center(child: CircularProgressIndicator())
          : state.error != null
              ? _ErrorState(
                  message: state.error!,
                  onRetry: () =>
                      ref.read(vaccineCatalogProvider.notifier).load(),
                )
              : RefreshIndicator(
                  onRefresh: () =>
                      ref.read(vaccineCatalogProvider.notifier).load(),
                  child: ListView.separated(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    itemCount: state.vaccines.length,
                    separatorBuilder: (_, _) => const Divider(height: 1),
                    itemBuilder: (context, index) {
                      final v = state.vaccines[index];
                      return _VaccineRow(
                        vaccine: v,
                        onEdit: () => _openEditor(v),
                        onToggleActive: () => _toggleActive(v),
                      );
                    },
                  ),
                ),
    );
  }

  Future<void> _toggleActive(VaccineCatalogItem v) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(v.isActive ? 'Desactivar vacuna' : 'Reactivar vacuna'),
        content: Text(
          v.isActive
              ? 'Al desactivar "${v.name}" se eliminará del esquema de los '
                  'estudiantes activos. ¿Continuar?'
              : 'Al reactivar "${v.name}" se asignará al esquema de los '
                  'estudiantes activos. ¿Continuar?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancelar'),
          ),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: Text(v.isActive ? 'Desactivar' : 'Reactivar'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    await ref
        .read(vaccineCatalogProvider.notifier)
        .setActive(v.id, !v.isActive);
  }

  Future<void> _openEditor(VaccineCatalogItem? existing) async {
    await showDialog<void>(
      context: context,
      builder: (_) => Dialog(
        insetPadding: const EdgeInsets.all(16),
        child: SizedBox(
          width: 600,
          child: _VaccineEditor(existing: existing),
        ),
      ),
    );
  }
}

class _VaccineRow extends StatelessWidget {
  final VaccineCatalogItem vaccine;
  final VoidCallback onEdit;
  final VoidCallback onToggleActive;

  const _VaccineRow({
    required this.vaccine,
    required this.onEdit,
    required this.onToggleActive,
  });

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: CircleAvatar(
        backgroundColor:
            vaccine.isActive ? AppColors.successLight : AppColors.errorLight,
        child: Icon(
          Icons.vaccines,
          color: vaccine.isActive ? AppColors.success : AppColors.error,
        ),
      ),
      title: Text(vaccine.name),
      subtitle: Text(
        '${vaccine.code} · ${vaccine.doseConfigs.length} dosis · '
        '${_appliesToLabel(vaccine.appliesTo)}'
        '${vaccine.isActive ? '' : ' · Inactiva'}',
      ),
      trailing: Wrap(
        spacing: 4,
        children: [
          IconButton(
            tooltip: 'Editar',
            icon: const Icon(Icons.edit_outlined),
            onPressed: onEdit,
          ),
          IconButton(
            tooltip: vaccine.isActive ? 'Desactivar' : 'Reactivar',
            icon: Icon(
              vaccine.isActive ? Icons.toggle_on : Icons.toggle_off,
              color:
                  vaccine.isActive ? AppColors.success : AppColors.textSecondary,
            ),
            onPressed: onToggleActive,
          ),
        ],
      ),
    );
  }

  String _appliesToLabel(String value) {
    switch (value) {
      case 'male':
        return 'Hombres';
      case 'female':
        return 'Mujeres';
      default:
        return 'Ambos sexos';
    }
  }
}

class _VaccineEditor extends ConsumerStatefulWidget {
  final VaccineCatalogItem? existing;

  const _VaccineEditor({this.existing});

  @override
  ConsumerState<_VaccineEditor> createState() => _VaccineEditorState();
}

class _VaccineEditorState extends ConsumerState<_VaccineEditor> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _name;
  late final TextEditingController _code;
  late final TextEditingController _baseDoses;
  late final TextEditingController _displayOrder;
  String _appliesTo = 'all';
  bool _hasBooster = false;
  bool _hasTiter = false;
  bool _hasTiterValue = false;
  bool _isAnnual = false;
  late List<VaccineDoseConfigDTO> _configs;
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final v = widget.existing;
    _name = TextEditingController(text: v?.name ?? '');
    _code = TextEditingController(text: v?.code ?? '');
    _baseDoses = TextEditingController(text: '${v?.baseDoses ?? 1}');
    _displayOrder = TextEditingController(text: '${v?.displayOrder ?? 0}');
    if (v != null) {
      _appliesTo = v.appliesTo;
      _hasBooster = v.hasBooster;
      _hasTiter = v.hasTiter;
      _hasTiterValue = v.hasTiterValue;
      _isAnnual = v.isAnnual;
      _configs = [...v.doseConfigs];
    } else {
      _configs = [
        const VaccineDoseConfigDTO(doseNumber: 1, label: 'Primera dosis'),
      ];
    }
  }

  @override
  void dispose() {
    _name.dispose();
    _code.dispose();
    _baseDoses.dispose();
    _displayOrder.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isEdit = widget.existing != null;
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Form(
        key: _formKey,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                isEdit ? 'Editar vacuna' : 'Nueva vacuna',
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: 12),
              if (isEdit)
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppColors.warningLight,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Text(
                    'Al guardar se regenerará el esquema de todos los '
                    'estudiantes activos. Las fechas aplicadas se preservan '
                    'para las dosis cuyo número se mantenga.',
                    style: TextStyle(fontSize: 13),
                  ),
                ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _name,
                decoration: const InputDecoration(labelText: 'Nombre'),
                validator: (v) =>
                    (v == null || v.trim().isEmpty) ? 'Requerido' : null,
              ),
              const SizedBox(height: 8),
              TextFormField(
                controller: _code,
                enabled: !isEdit,
                decoration: const InputDecoration(
                  labelText: 'Código (mayúsculas, dígitos y _)',
                  helperText: 'No se puede cambiar después de crear',
                ),
                validator: (v) {
                  if (v == null || v.trim().isEmpty) return 'Requerido';
                  if (!RegExp(r'^[A-Z0-9_]+$').hasMatch(v.trim())) {
                    return 'Solo mayúsculas, dígitos y _';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(
                    child: TextFormField(
                      controller: _baseDoses,
                      keyboardType: TextInputType.number,
                      decoration:
                          const InputDecoration(labelText: 'Dosis base'),
                      validator: _intValidator,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: TextFormField(
                      controller: _displayOrder,
                      keyboardType: TextInputType.number,
                      decoration:
                          const InputDecoration(labelText: 'Orden visual'),
                      validator: _intValidator,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              DropdownButtonFormField<String>(
                initialValue: _appliesTo,
                decoration: const InputDecoration(labelText: 'Aplica a'),
                items: const [
                  DropdownMenuItem(value: 'all', child: Text('Ambos sexos')),
                  DropdownMenuItem(value: 'male', child: Text('Hombres')),
                  DropdownMenuItem(value: 'female', child: Text('Mujeres')),
                ],
                onChanged: (v) => setState(() => _appliesTo = v ?? 'all'),
              ),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                children: [
                  FilterChip(
                    label: const Text('Refuerzo'),
                    selected: _hasBooster,
                    onSelected: (v) => setState(() => _hasBooster = v),
                  ),
                  FilterChip(
                    label: const Text('Titulación'),
                    selected: _hasTiter,
                    onSelected: (v) => setState(() => _hasTiter = v),
                  ),
                  FilterChip(
                    label: const Text('Valor titer'),
                    selected: _hasTiterValue,
                    onSelected: (v) => setState(() => _hasTiterValue = v),
                  ),
                  FilterChip(
                    label: const Text('Anual'),
                    selected: _isAnnual,
                    onSelected: (v) => setState(() => _isAnnual = v),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: Text(
                      'Dosis (${_configs.length})',
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                  ),
                  TextButton.icon(
                    onPressed: _addDose,
                    icon: const Icon(Icons.add),
                    label: const Text('Agregar'),
                  ),
                ],
              ),
              ..._configs.asMap().entries.map(_buildDoseEditor),
              const SizedBox(height: 12),
              if (_error != null)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Text(
                    _error!,
                    style: const TextStyle(color: AppColors.error),
                  ),
                ),
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  TextButton(
                    onPressed:
                        _saving ? null : () => Navigator.of(context).pop(),
                    child: const Text('Cancelar'),
                  ),
                  const SizedBox(width: 8),
                  FilledButton(
                    onPressed: _saving ? null : _save,
                    child: _saving
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child:
                                CircularProgressIndicator(strokeWidth: 2),
                          )
                        : Text(isEdit ? 'Guardar' : 'Crear'),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildDoseEditor(MapEntry<int, VaccineDoseConfigDTO> entry) {
    final index = entry.key;
    final config = entry.value;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Container(
        padding: const EdgeInsets.all(8),
        decoration: BoxDecoration(
          border: Border.all(color: AppColors.divider),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                SizedBox(
                  width: 80,
                  child: TextFormField(
                    initialValue: '${config.doseNumber}',
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(labelText: 'N°'),
                    onChanged: (v) {
                      final num_ = int.tryParse(v);
                      if (num_ != null) {
                        setState(() {
                          _configs[index] =
                              config.copyWith(doseNumber: num_);
                        });
                      }
                    },
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: TextFormField(
                    initialValue: config.label,
                    decoration: const InputDecoration(labelText: 'Etiqueta'),
                    onChanged: (v) {
                      _configs[index] = config.copyWith(label: v);
                    },
                  ),
                ),
                IconButton(
                  tooltip: 'Quitar',
                  icon:
                      const Icon(Icons.delete_outline, color: AppColors.error),
                  onPressed: () =>
                      setState(() => _configs.removeAt(index)),
                ),
              ],
            ),
            Row(
              children: [
                Expanded(
                  child: DropdownButtonFormField<String>(
                    initialValue: config.doseType,
                    decoration: const InputDecoration(labelText: 'Tipo'),
                    items: const [
                      DropdownMenuItem(
                          value: 'standard', child: Text('Estándar')),
                      DropdownMenuItem(
                          value: 'booster', child: Text('Refuerzo')),
                      DropdownMenuItem(
                          value: 'titer', child: Text('Titulación')),
                    ],
                    onChanged: (v) => setState(() {
                      _configs[index] =
                          config.copyWith(doseType: v ?? 'standard');
                    }),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: DropdownButtonFormField<String>(
                    initialValue: config.appliesTo,
                    decoration: const InputDecoration(labelText: 'Aplica a'),
                    items: const [
                      DropdownMenuItem(value: 'all', child: Text('Ambos')),
                      DropdownMenuItem(value: 'male', child: Text('Hombres')),
                      DropdownMenuItem(
                          value: 'female', child: Text('Mujeres')),
                    ],
                    onChanged: (v) => setState(() {
                      _configs[index] =
                          config.copyWith(appliesTo: v ?? 'all');
                    }),
                  ),
                ),
              ],
            ),
            CheckboxListTile(
              title: const Text('Requerida para certificación'),
              value: config.isRequired,
              onChanged: (v) => setState(() {
                _configs[index] = config.copyWith(isRequired: v ?? true);
              }),
              dense: true,
              contentPadding: EdgeInsets.zero,
            ),
          ],
        ),
      ),
    );
  }

  void _addDose() {
    final next = _configs.isEmpty
        ? 1
        : (_configs.map((c) => c.doseNumber).reduce((a, b) => a > b ? a : b) +
            1);
    setState(() {
      _configs.add(
        VaccineDoseConfigDTO(doseNumber: next, label: 'Dosis $next'),
      );
    });
  }

  String? _intValidator(String? v) {
    if (v == null || v.trim().isEmpty) return 'Requerido';
    if (int.tryParse(v) == null) return 'Número inválido';
    return null;
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    if (_configs.isEmpty) {
      setState(() => _error = 'Debe haber al menos una dosis');
      return;
    }
    final numbers = _configs.map((c) => c.doseNumber).toList();
    if (numbers.toSet().length != numbers.length) {
      setState(() => _error = 'Los números de dosis no pueden repetirse');
      return;
    }

    setState(() {
      _saving = true;
      _error = null;
    });

    final isEdit = widget.existing != null;
    final notifier = ref.read(vaccineCatalogProvider.notifier);
    final payload = <String, dynamic>{
      'name': _name.text.trim(),
      'base_doses': int.parse(_baseDoses.text),
      'has_booster': _hasBooster,
      'has_titer': _hasTiter,
      'has_titer_value': _hasTiterValue,
      'is_annual': _isAnnual,
      'applies_to': _appliesTo,
      'display_order': int.parse(_displayOrder.text),
      'dose_configs': _configs.map((c) => c.toJson()).toList(),
    };

    bool ok;
    if (isEdit) {
      ok = await notifier.update(widget.existing!.id, payload);
    } else {
      payload['code'] = _code.text.trim();
      ok = await notifier.create(payload);
    }

    if (!mounted) return;
    if (ok) {
      Navigator.of(context).pop();
    } else {
      setState(() {
        _saving = false;
        _error = ref.read(vaccineCatalogProvider).error ??
            'No se pudo guardar la vacuna';
      });
    }
  }
}

class _ErrorState extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;

  const _ErrorState({required this.message, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline,
                size: 48, color: AppColors.error),
            const SizedBox(height: 12),
            Text(message, textAlign: TextAlign.center),
            const SizedBox(height: 12),
            FilledButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh),
              label: const Text('Reintentar'),
            ),
          ],
        ),
      ),
    );
  }
}
