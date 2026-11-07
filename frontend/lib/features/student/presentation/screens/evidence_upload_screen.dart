import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:file_picker/file_picker.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../../core/models/domain_enums.dart';
import '../../../../core/utils/file_download.dart';
import '../../data/models/evidence_model.dart';
import '../providers/evidence_provider.dart';
import '../providers/scheme_provider.dart';

/// Evidence upload screen — student uploads PDFs for their entire scheme.
class EvidenceUploadScreen extends ConsumerStatefulWidget {
  const EvidenceUploadScreen({super.key});

  @override
  ConsumerState<EvidenceUploadScreen> createState() =>
      _EvidenceUploadScreenState();
}

class _EvidenceUploadScreenState extends ConsumerState<EvidenceUploadScreen> {
  final _notesController = TextEditingController();
  List<PlatformFile> _selectedFiles = [];
  String _selectedDoseId = '';
  bool _pickingFiles = false;
  int _selectionEpoch = 0;

  @override
  void initState() {
    super.initState();
    Future.microtask(() => ref.read(evidenceProvider.notifier).loadBatches());
    Future.microtask(() => ref.read(schemeProvider.notifier).loadScheme());
  }

  @override
  void dispose() {
    _notesController.dispose();
    super.dispose();
  }

  Future<void> _pickFiles() async {
    if (_pickingFiles || ref.read(evidenceProvider).isUploading) return;
    final epoch = _selectionEpoch;
    setState(() => _pickingFiles = true);
    try {
      final result = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: ['pdf'],
        allowMultiple: true,
        withData: true,
      );
      if (!mounted ||
          epoch != _selectionEpoch ||
          ref.read(evidenceProvider).isUploading) {
        return;
      }
      if (result != null) {
        setState(() => _selectedFiles = List.of(result.files));
      }
    } catch (_) {
      if (!mounted ||
          epoch != _selectionEpoch ||
          ref.read(evidenceProvider).isUploading) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('No se pudieron seleccionar los archivos.'),
        ),
      );
    } finally {
      if (mounted) setState(() => _pickingFiles = false);
    }
  }

  Future<void> _upload() async {
    if (_selectedFiles.isEmpty || ref.read(evidenceProvider).isUploading) {
      return;
    }
    // Ignore results from a picker opened before this submission, even if it
    // resolves after the upload has already finished.
    ++_selectionEpoch;

    final success = await ref
        .read(evidenceProvider.notifier)
        .upload(
          List.of(_selectedFiles),
          notes: _notesController.text.trim().isEmpty
              ? null
              : _notesController.text.trim(),
          doseId: _selectedDoseId.isEmpty ? null : _selectedDoseId,
        );
    if (success && mounted) {
      setState(() {
        _selectedFiles = [];
        _selectedDoseId = '';
      });
      _notesController.clear();
      final readFailed = ref.read(evidenceProvider).loadError != null;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            readFailed
                ? 'Los documentos se subieron, pero no se pudo actualizar la lista.'
                : 'Documentos subidos correctamente',
          ),
          backgroundColor: readFailed ? null : AppColors.success,
        ),
      );
    }
  }

  Future<void> _confirmDeleteBatch(String batchId) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Eliminar documentos'),
        content: const Text(
          'Esta accion eliminara tus PDF de forma permanente.',
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

    await ref.read(evidenceProvider.notifier).delete(batchId);
    if (!mounted) return;
    final error = ref.read(evidenceProvider).error;
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(error ?? 'Documentos eliminados')));
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(evidenceProvider);
    final scheme = ref.watch(schemeProvider);

    if (state.loadError != null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Documentos de Soporte')),
        body: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            if (state.uploadConfirmed)
              Semantics(
                liveRegion: true,
                child: const Text(
                  'Los documentos se subieron, pero no se pudo actualizar la lista.',
                ),
              ),
            if (state.uploadError != null)
              Semantics(liveRegion: true, child: Text(state.uploadError!)),
            const SizedBox(height: 12),
            Semantics(liveRegion: true, child: Text(state.loadError!)),
            const SizedBox(height: 12),
            OutlinedButton(
              onPressed: state.isLoading || state.isUploading
                  ? null
                  : () => ref.read(evidenceProvider.notifier).loadBatches(),
              child: Text(state.isLoading ? 'Reintentando…' : 'Reintentar'),
            ),
          ],
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Documentos de Soporte')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Upload section
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  DropdownButtonFormField<String>(
                    key: ValueKey(_selectedDoseId),
                    initialValue: _selectedDoseId,
                    isExpanded: true,
                    decoration: const InputDecoration(
                      labelText: 'Dosis relacionada (opcional)',
                    ),
                    items: [
                      const DropdownMenuItem(
                        value: '',
                        child: Text('Carga general, sin dosis asociada'),
                      ),
                      for (final vaccine in scheme.vaccines)
                        for (final dose in vaccine.doses)
                          DropdownMenuItem(
                            value: dose.id,
                            child: Text(
                              '${vaccine.vaccineName} · ${dose.doseConfig?.label ?? 'Dosis ${dose.doseNumber}'}',
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                    ],
                    onChanged: state.isUploading
                        ? null
                        : (value) {
                            if (ref.read(evidenceProvider).isUploading) return;
                            setState(() => _selectedDoseId = value ?? '');
                          },
                  ),
                  if (scheme.isLoading && scheme.vaccines.isEmpty) ...[
                    const SizedBox(height: 8),
                    const LinearProgressIndicator(),
                    const SizedBox(height: 4),
                    Semantics(
                      liveRegion: true,
                      child: Text('Cargando dosis disponibles…'),
                    ),
                  ],
                  if (scheme.error != null) ...[
                    const SizedBox(height: 8),
                    Semantics(
                      liveRegion: true,
                      child: Text(
                        scheme.error!,
                        style: const TextStyle(
                          color: AppColors.error,
                          fontSize: 13,
                        ),
                      ),
                    ),
                    Align(
                      alignment: Alignment.centerLeft,
                      child: OutlinedButton(
                        onPressed: scheme.isLoading || state.isUploading
                            ? null
                            : () => ref
                                  .read(schemeProvider.notifier)
                                  .loadScheme(forceRefresh: true),
                        child: Text(
                          scheme.isLoading
                              ? 'Reintentando…'
                              : 'Reintentar lectura del esquema',
                        ),
                      ),
                    ),
                  ],
                  const SizedBox(height: 16),
                  Text(
                    'Subir documentos PDF',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 4),
                  const Text(
                    'Sube los documentos que respaldan tu esquema de vacunación completo.',
                    style: TextStyle(
                      fontSize: 13,
                      color: AppColors.textSecondary,
                    ),
                  ),
                  const SizedBox(height: 16),
                  // File picker area
                  Semantics(
                    button: true,
                    enabled: !state.isUploading && !_pickingFiles,
                    label: 'Seleccionar archivos PDF',
                    child: InkWell(
                      borderRadius: BorderRadius.circular(12),
                      onTap: state.isUploading || _pickingFiles
                          ? null
                          : _pickFiles,
                      child: Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(24),
                        decoration: BoxDecoration(
                          border: Border.all(
                            color: AppColors.primary,
                            style: BorderStyle.solid,
                            width: 1.5,
                          ),
                          borderRadius: BorderRadius.circular(12),
                          color: AppColors.primary.withValues(alpha: 0.03),
                        ),
                        child: Column(
                          children: [
                            Icon(
                              Icons.cloud_upload_outlined,
                              size: 40,
                              color: AppColors.primary,
                            ),
                            const SizedBox(height: 8),
                            Text(
                              'Toca para seleccionar archivos PDF',
                              style: TextStyle(
                                color: AppColors.primary,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                  // Selected files
                  if (_selectedFiles.isNotEmpty) ...[
                    const SizedBox(height: 12),
                    ...(_selectedFiles.map(
                      (f) => ListTile(
                        dense: true,
                        leading: const Icon(
                          Icons.picture_as_pdf,
                          color: AppColors.error,
                        ),
                        title: Text(
                          f.name,
                          style: const TextStyle(fontSize: 13),
                        ),
                        subtitle: Text(
                          '${(f.size / 1024).toStringAsFixed(1)} KB',
                        ),
                        trailing: IconButton(
                          tooltip: 'Quitar ${f.name}',
                          icon: const Icon(Icons.close, size: 18),
                          onPressed: state.isUploading
                              ? null
                              : () => setState(() {
                                  _selectedFiles.remove(f);
                                }),
                        ),
                      ),
                    )),
                  ],
                  const SizedBox(height: 12),
                  TextField(
                    enabled: !state.isUploading,
                    controller: _notesController,
                    decoration: const InputDecoration(
                      labelText: 'Notas (opcional)',
                      hintText: 'Descripción de los documentos',
                    ),
                    maxLines: 2,
                  ),
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton.icon(
                      onPressed: _selectedFiles.isEmpty || state.isUploading
                          ? null
                          : _upload,
                      icon: state.isUploading
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : const Icon(Icons.upload),
                      label: Text(
                        state.isUploading ? 'Subiendo...' : 'Subir documentos',
                      ),
                    ),
                  ),
                  if (state.uploadError != null || state.error != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 8),
                      child: Text(
                        state.uploadError ?? state.error!,
                        style: const TextStyle(
                          color: AppColors.error,
                          fontSize: 13,
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 24),
          // Existing batches
          Text(
            'Documentos subidos',
            style: Theme.of(
              context,
            ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 8),
          if (state.page != null)
            Wrap(
              spacing: 8,
              children: [
                TextButton(
                  onPressed: !state.isLoading && state.page!.hasPrevious
                      ? () => ref
                            .read(evidenceProvider.notifier)
                            .loadBatches(page: state.page!.page - 1)
                      : null,
                  child: const Text('Anterior'),
                ),
                Text(
                  'Página ${state.page!.page} de ${state.page!.pages} · ${state.page!.total} registros',
                ),
                TextButton(
                  onPressed: !state.isLoading && state.page!.hasNext
                      ? () => ref
                            .read(evidenceProvider.notifier)
                            .loadBatches(page: state.page!.page + 1)
                      : null,
                  child: const Text('Siguiente'),
                ),
              ],
            ),
          if (state.isLoading)
            const Center(child: CircularProgressIndicator())
          else if (state.batches.isEmpty)
            const Center(
              child: Padding(
                padding: EdgeInsets.all(24),
                child: Text(
                  'No has subido documentos aún',
                  style: TextStyle(color: AppColors.textSecondary),
                ),
              ),
            )
          else
            ...state.batches.map((batch) => _buildBatchCard(batch)),
        ],
      ),
    );
  }

  Widget _buildBatchCard(EvidenceBatchModel batch) {
    final files = batch.files;
    final status = switch (batch.status) {
      EvidenceBatchStatus.inReview => 'En revisión',
      EvidenceBatchStatus.approved => 'Aprobada',
      EvidenceBatchStatus.denied => 'Denegada',
      EvidenceBatchStatus.uploaded ||
      EvidenceBatchStatus.underReview => 'En revisión (estado histórico)',
      EvidenceBatchStatus.reviewed => 'Estado histórico sin resultado',
      EvidenceBatchStatus.legacyPending => 'En revisión (estado histórico)',
      EvidenceBatchStatus.unknown => 'Estado no reconocido',
    };
    final createdAt = batch.createdAt.length >= 10
        ? batch.createdAt.substring(0, 10)
        : batch.createdAt;

    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ExpansionTile(
        leading: Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: AppColors.infoLight,
            borderRadius: BorderRadius.circular(10),
          ),
          child: const Icon(Icons.folder_outlined, color: AppColors.info),
        ),
        title: Text(
          '${files.length} archivo(s)',
          style: const TextStyle(fontWeight: FontWeight.w500),
        ),
        subtitle: Text(
          '$createdAt • $status',
          style: const TextStyle(fontSize: 12),
        ),
        children: [
          ...files.map((file) {
            final fileName = file.originalFilename;
            final fileId = file.id;
            return ListTile(
              dense: true,
              leading: const Icon(Icons.picture_as_pdf, color: AppColors.error),
              title: Text(fileName, style: const TextStyle(fontSize: 13)),
              trailing: IconButton(
                icon: const Icon(
                  Icons.open_in_new,
                  size: 20,
                  color: AppColors.primary,
                ),
                onPressed: fileId.isEmpty
                    ? null
                    : () async {
                        final bytes = await ref
                            .read(evidenceProvider.notifier)
                            .downloadFile(fileId);
                        if (bytes != null) {
                          await saveAndOpenFile(bytes, fileName);
                        }
                      },
              ),
            );
          }),
          Align(
            alignment: Alignment.centerRight,
            child: TextButton.icon(
              onPressed: () => _confirmDeleteBatch(batch.id),
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
  }
}
