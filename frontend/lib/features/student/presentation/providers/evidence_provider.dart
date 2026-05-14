import 'package:dio/dio.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/datasources/evidence_remote_ds.dart';
import '../../data/models/evidence_model.dart';

/// State for evidence batches.
class EvidenceState {
  final bool isLoading;
  final bool isUploading;
  final String? error;
  final String? successMessage;
  final List<EvidenceBatchModel> batches;

  const EvidenceState({
    this.isLoading = false,
    this.isUploading = false,
    this.error,
    this.successMessage,
    this.batches = const [],
  });

  EvidenceState copyWith({
    bool? isLoading,
    bool? isUploading,
    String? error,
    String? successMessage,
    List<EvidenceBatchModel>? batches,
  }) {
    return EvidenceState(
      isLoading: isLoading ?? this.isLoading,
      isUploading: isUploading ?? this.isUploading,
      error: error,
      successMessage: successMessage,
      batches: batches ?? this.batches,
    );
  }
}

class EvidenceNotifier extends StateNotifier<EvidenceState> {
  final EvidenceRemoteDataSource _ds;
  EvidenceNotifier(this._ds) : super(const EvidenceState());

  Future<void> loadBatches() async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final data = await _ds.getMyBatches();
      state = EvidenceState(batches: data);
    } catch (error) {
      debugPrint('Evidence load failed: $error');
      state = state.copyWith(
        isLoading: false,
        error: 'Error al cargar documentos',
      );
    }
  }

  Future<bool> upload(List<PlatformFile> files, {String? notes}) async {
    state = state.copyWith(
      isUploading: true,
      error: null,
      successMessage: null,
    );
    try {
      await _ds.uploadEvidence(files, notes: notes);
      await loadBatches();
      state = state.copyWith(
        isUploading: false,
        successMessage: 'Documentos subidos correctamente',
      );
      return true;
    } on DioException catch (e) {
      state = state.copyWith(
        isUploading: false,
        error: e.response?.data?['detail'] ?? 'Error al subir documentos',
      );
      return false;
    }
  }

  Future<void> delete(String batchId) async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      await _ds.deleteBatch(batchId);
      await loadBatches();
    } catch (error) {
      debugPrint('Evidence delete failed: $error');
      state = state.copyWith(
        isLoading: false,
        error: 'Error al eliminar documentos',
      );
    }
  }

  Future<List<int>?> downloadFile(String fileId) async {
    try {
      return await _ds.downloadFile(fileId);
    } catch (error) {
      debugPrint('Evidence download failed: $error');
      state = state.copyWith(error: 'Error al descargar documento');
      return null;
    }
  }
}

final evidenceProvider = StateNotifierProvider<EvidenceNotifier, EvidenceState>(
  (ref) {
    return EvidenceNotifier(ref.read(evidenceRemoteDataSourceProvider));
  },
);
