import 'package:dio/dio.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/api_client.dart';
import '../models/evidence_model.dart';

/// Data source for evidence upload API calls.
class EvidenceRemoteDataSource {
  final ApiClient _api;
  EvidenceRemoteDataSource(this._api);

  Future<List<EvidenceBatchModel>> getMyBatches() async {
    final r = await _api.dio.get('/evidence/');
    return ((r.data as List<dynamic>?) ?? const [])
        .map(
          (item) => EvidenceBatchModel.fromJson(item as Map<String, dynamic>),
        )
        .toList();
  }

  Future<Map<String, dynamic>> uploadEvidence(
    List<PlatformFile> files, {
    String? notes,
  }) async {
    final formData = FormData();
    for (final file in files) {
      if (file.bytes != null) {
        formData.files.add(
          MapEntry(
            'files',
            MultipartFile.fromBytes(file.bytes!, filename: file.name),
          ),
        );
      } else if (file.path != null) {
        formData.files.add(
          MapEntry(
            'files',
            await MultipartFile.fromFile(file.path!, filename: file.name),
          ),
        );
      }
    }
    if (notes != null) formData.fields.add(MapEntry('notes', notes));
    final r = await _api.dio.post('/evidence/upload', data: formData);
    return r.data;
  }

  Future<void> deleteBatch(String batchId) async {
    await _api.dio.delete('/evidence/$batchId');
  }

  Future<List<int>> downloadFile(String fileId) async {
    final r = await _api.dio.get<List<int>>(
      '/evidence/files/$fileId',
      options: Options(responseType: ResponseType.bytes),
    );
    return r.data!;
  }
}

final evidenceRemoteDataSourceProvider = Provider<EvidenceRemoteDataSource>((
  ref,
) {
  return EvidenceRemoteDataSource(ref.read(apiClientProvider));
});
