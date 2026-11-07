import 'package:dio/dio.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/error/api_error_message.dart';
import '../../data/datasources/evidence_remote_ds.dart';
import '../../../auth/presentation/providers/auth_provider.dart';
import '../../data/models/evidence_model.dart';

/// State for evidence batches.
class EvidenceState {
  final bool isLoading;
  final bool isUploading;
  final String? error;
  final String? loadError;
  final String? uploadError;
  final bool uploadConfirmed;
  final String? successMessage;
  final List<EvidenceBatchModel> batches;
  final EvidencePageModel? page;

  const EvidenceState({
    this.isLoading = false,
    this.isUploading = false,
    this.error,
    this.loadError,
    this.uploadError,
    this.uploadConfirmed = false,
    this.successMessage,
    this.batches = const [],
    this.page,
  });

  EvidenceState copyWith({
    bool? isLoading,
    bool? isUploading,
    String? error,
    String? loadError,
    String? uploadError,
    bool clearLoadError = false,
    bool clearUploadError = false,
    bool? uploadConfirmed,
    String? successMessage,
    List<EvidenceBatchModel>? batches,
    EvidencePageModel? page,
  }) {
    return EvidenceState(
      isLoading: isLoading ?? this.isLoading,
      isUploading: isUploading ?? this.isUploading,
      error: error,
      loadError: clearLoadError ? null : loadError ?? this.loadError,
      uploadError: clearUploadError ? null : uploadError ?? this.uploadError,
      uploadConfirmed: uploadConfirmed ?? this.uploadConfirmed,
      successMessage: successMessage,
      batches: batches ?? this.batches,
      page: page ?? this.page,
    );
  }
}

class EvidenceNotifier extends StateNotifier<EvidenceState> {
  final EvidenceRemoteDataSource _ds;
  EvidenceNotifier(this._ds) : super(const EvidenceState());

  int _request = 0;
  bool _writing = false;
  Future<void>? _inFlightLoad;
  int _loadingPage = 1;
  int _targetPage = 1;

  Future<void> loadBatches({int? page, bool afterWrite = false}) {
    if (!mounted || (_writing && !afterWrite)) return Future.value();
    final target = page ?? _targetPage;
    if (!afterWrite && target == _loadingPage && _inFlightLoad != null) {
      return _inFlightLoad!;
    }
    _targetPage = target;
    _loadingPage = target;
    final load = _loadBatches(target, afterWrite: afterWrite);
    _inFlightLoad = load;
    load.whenComplete(() {
      if (identical(_inFlightLoad, load)) _inFlightLoad = null;
    });
    return load;
  }

  Future<void> _loadBatches(int target, {required bool afterWrite}) async {
    final request = ++_request;
    state = state.copyWith(isLoading: true, error: null);
    try {
      final data = await _ds.getMyBatches(page: target);
      if (!mounted || request != _request) return;
      if (target > 1 && data.items.isEmpty) {
        await loadBatches(
          page: data.pages > 0
              ? (data.pages < target ? data.pages : target - 1)
              : 1,
          afterWrite: afterWrite,
        );
        return;
      }
      state = state.copyWith(
        isLoading: false,
        batches: data.items,
        page: data,
        clearLoadError: true,
        uploadConfirmed: false,
      );
    } catch (error) {
      if (!mounted || request != _request) return;
      final status = error is DioException ? error.response?.statusCode : null;
      final message = switch (status) {
        401 => 'Tu sesión expiró. Inicia sesión nuevamente.',
        403 => 'No tienes permiso para consultar esta información.',
        404 => 'No se encontró la información solicitada.',
        429 => 'Demasiadas solicitudes. Espera antes de reintentar.',
        500 => 'Ocurrió un error en el servidor. Intenta nuevamente.',
        503 => 'El servicio no está disponible temporalmente.',
        _ => 'Error al cargar documentos',
      };
      state = state.copyWith(
        isLoading: false,
        error: message,
        loadError: message,
      );
    }
  }

  Future<bool> upload(
    List<PlatformFile> files, {
    String? notes,
    String? doseId,
  }) async {
    if (!mounted || _writing) return false;
    _writing = true;
    ++_request;
    _inFlightLoad = null;
    state = state.copyWith(
      isLoading: false,
      isUploading: true,
      error: null,
      successMessage: null,
      clearUploadError: true,
      uploadConfirmed: false,
    );
    try {
      await _ds.uploadEvidence(files, notes: notes, doseId: doseId);
      if (!mounted) return false;
      await loadBatches(afterWrite: true);
      if (!mounted) return false;
      state = state.copyWith(
        isUploading: false,
        error: state.error,
        uploadConfirmed: state.loadError != null,
        successMessage: state.loadError == null
            ? 'Documentos subidos correctamente'
            : null,
      );
      return true;
    } catch (e) {
      if (!mounted) return false;
      const unconfirmed =
          'No se pudo confirmar la carga. Comprueba tus documentos antes de reintentar.';
      final status = e is DioException ? e.response?.statusCode : null;
      // Preserve defined validation feedback; do not surface raw infrastructure
      // or authorization diagnostics as an upload outcome.
      final message = {400, 409, 422}.contains(status)
          ? apiErrorMessageFromData((e as DioException).response?.data) ??
                unconfirmed
          : unconfirmed;
      state = state.copyWith(
        isUploading: false,
        error: message,
        uploadError: message,
      );
      return false;
    } finally {
      _writing = false;
    }
  }

  Future<void> delete(String batchId) async {
    if (!mounted || _writing) return;
    _writing = true;
    ++_request;
    _inFlightLoad = null;
    state = state.copyWith(isLoading: true, error: null);
    try {
      await _ds.deleteBatch(batchId);
      if (!mounted) return;
      await loadBatches(afterWrite: true);
    } catch (error) {
      if (!mounted) return;
      state = state.copyWith(
        isLoading: false,
        error: 'Error al eliminar documentos',
      );
    } finally {
      _writing = false;
    }
  }

  Future<List<int>?> downloadFile(String fileId) async {
    try {
      return await _ds.downloadFile(fileId);
    } catch (error) {
      if (!mounted) return null;
      state = state.copyWith(error: 'Error al descargar documento');
      return null;
    }
  }
}

final evidenceProvider = StateNotifierProvider<EvidenceNotifier, EvidenceState>(
  (ref) {
    ref.watch(authStateProvider.select((state) => state.userId));
    return EvidenceNotifier(ref.read(evidenceRemoteDataSourceProvider));
  },
);
