import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/api_client.dart';
import '../models/admin_models.dart';

/// Data source for admin API calls.
class AdminRemoteDataSource {
  final ApiClient _api;
  AdminRemoteDataSource(this._api);

  Future<void> updateDoseComment(String doseId, String? notes) async {
    await _api.dio.patch(
      '/admin/doses/$doseId/comment',
      data: {'admin_notes': notes},
    );
  }

  Future<Map<String, dynamic>> createStudent(Map<String, dynamic> data) async {
    final r = await _api.dio.post('/admin/students', data: data);
    return r.data;
  }

  Future<AcademicOptions> getAcademicOptions() async {
    final r = await _api.dio.get('/admin/academic-options');
    return AcademicOptions.fromJson(Map<String, dynamic>.from(r.data as Map));
  }

  Future<List<dynamic>> listAdmins() async {
    final r = await _api.dio.get('/admin/admins');
    return r.data as List<dynamic>;
  }

  Future<Map<String, dynamic>> createAdmin(Map<String, dynamic> data) async {
    final r = await _api.dio.post('/admin/admins', data: data);
    return r.data;
  }

  Future<void> deleteAdmin(String adminId) async {
    await _api.dio.delete('/admin/admins/$adminId');
  }

  // ── Vaccine catalog (app_admin only) ────────────────────────────────

  Future<List<dynamic>> listVaccines() async {
    final r = await _api.dio.get('/admin/vaccines');
    return r.data as List<dynamic>;
  }

  Future<Map<String, dynamic>> createVaccine(Map<String, dynamic> data) async {
    final r = await _api.dio.post('/admin/vaccines', data: data);
    return r.data as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> updateVaccine(
    String vaccineId,
    Map<String, dynamic> data,
  ) async {
    final r = await _api.dio.put('/admin/vaccines/$vaccineId', data: data);
    return r.data as Map<String, dynamic>;
  }

  Future<void> deactivateVaccine(String vaccineId) async {
    await _api.dio.post('/admin/vaccines/$vaccineId/deactivate');
  }

  Future<void> reactivateVaccine(String vaccineId) async {
    await _api.dio.post('/admin/vaccines/$vaccineId/reactivate');
  }

  Future<Map<String, dynamic>> previewImportStudentsExcel({
    required String fileName,
    required List<int> bytes,
  }) async {
    final formData = FormData.fromMap({
      'file': MultipartFile.fromBytes(bytes, filename: fileName),
    });
    final r = await _api.dio.post(
      '/admin/students/import/preview',
      data: formData,
    );
    return r.data;
  }

  Future<Map<String, dynamic>> importStudentsExcel({
    required String fileName,
    required List<int> bytes,
  }) async {
    final formData = FormData.fromMap({
      'file': MultipartFile.fromBytes(bytes, filename: fileName),
    });
    final r = await _api.dio.post('/admin/students/import', data: formData);
    return r.data;
  }

  Future<PaginatedResponse<AdminStudentListItem>> listStudents({
    String? search,
    bool? isActive,
    String? program,
    String? campus,
    String? sex,
    int? semester,
    String? vaccinationStatus,
    int page = 1,
    int pageSize = 50,
  }) async {
    final params = <String, dynamic>{'page': page, 'size': pageSize};
    if (search != null) params['search'] = search;
    if (isActive != null) params['is_active'] = isActive;
    if (program != null) params['program'] = program;
    if (campus != null) params['campus'] = campus;
    if (sex != null) params['sex'] = sex;
    if (semester != null) params['semester'] = semester;
    if (vaccinationStatus != null) {
      params['vaccination_status'] = vaccinationStatus;
    }
    final r = await _api.dio.post('/admin/students/search', data: params);
    return PaginatedResponse.fromJson(
      r.data as Map<String, dynamic>,
      AdminStudentListItem.fromJson,
    );
  }

  Future<List<AdminStudentListItem>> listAllStudents({
    String? search,
    bool? isActive,
    String? program,
    String? campus,
    String? sex,
    int? semester,
    String? vaccinationStatus,
  }) async {
    const pageSize = 100;
    final first = await listStudents(
      search: search,
      isActive: isActive,
      program: program,
      campus: campus,
      sex: sex,
      semester: semester,
      vaccinationStatus: vaccinationStatus,
      page: 1,
      pageSize: pageSize,
    );
    if (first.totalPages <= 1) return first.items;

    final pages = await Future.wait(
      List.generate(
        first.totalPages - 1,
        (index) => listStudents(
          search: search,
          isActive: isActive,
          program: program,
          campus: campus,
          sex: sex,
          semester: semester,
          vaccinationStatus: vaccinationStatus,
          page: index + 2,
          pageSize: pageSize,
        ),
      ),
    );
    return [...first.items, for (final page in pages) ...page.items];
  }

  Future<Map<String, dynamic>> getStudentDetail(String studentId) async {
    final r = await _api.dio.get('/admin/students/$studentId');
    return r.data;
  }

  Future<List<dynamic>> getStudentScheme(String studentId) async {
    final r = await _api.dio.get('/admin/students/$studentId/scheme');
    return r.data as List<dynamic>;
  }

  Future<Map<String, dynamic>> getStudentEvidencePage(
    String studentId, {
    int page = 1,
  }) async {
    final response = await _api.dio.get(
      '/admin/students/$studentId/evidence/page',
      queryParameters: {'page': page, 'page_size': 20},
    );
    return response.data as Map<String, dynamic>;
  }

  Future<List<dynamic>> getStudentEvidence(String studentId) async {
    final r = await _api.dio.get('/admin/students/$studentId/evidence');
    return r.data as List<dynamic>;
  }

  Future<void> deleteStudentEvidence(String studentId, String batchId) async {
    await _api.dio.delete('/admin/students/$studentId/evidence/$batchId');
  }

  Future<void> reviewEvidenceBatch(
    String batchId,
    String status, {
    String? notes,
  }) async {
    await _api.dio.patch(
      '/evidence/batches/$batchId/review',
      data: {
        'status': status,
        ...?(notes == null ? null : {'notes': notes}),
      },
    );
  }

  Future<List<int>> downloadEvidenceFile(String fileId) async {
    final r = await _api.dio.get<List<int>>(
      '/evidence/files/$fileId',
      options: Options(responseType: ResponseType.bytes),
    );
    return r.data!;
  }

  Future<void> deactivateStudent(String studentId) async {
    await _api.dio.post('/admin/students/$studentId/deactivate');
  }

  Future<void> reactivateStudent(String studentId) async {
    await _api.dio.post('/admin/students/$studentId/reactivate');
  }

  Future<void> deleteStudent(String studentId) async {
    await _api.dio.delete('/admin/students/$studentId');
  }

  Future<void> updateStudentProfile(
    String studentId,
    Map<String, dynamic> data,
  ) async {
    await _api.dio.put('/admin/students/$studentId/profile', data: data);
  }

  Future<void> reviewDose(String doseId, String status, {String? notes}) async {
    final data = <String, dynamic>{'status': status, 'admin_notes': notes};
    await _api.dio.put('/admin/doses/$doseId/review', data: data);
  }

  Future<AdminStatistics> getStatistics({int? semester}) async {
    final params = <String, dynamic>{};
    if (semester != null) params['semester'] = semester;
    final r = await _api.dio.get('/admin/statistics', queryParameters: params);
    return AdminStatistics.fromJson(r.data as Map<String, dynamic>);
  }

  Future<List<int>> exportStudentsCSV({int? semester}) async {
    final params = <String, dynamic>{};
    if (semester != null) params['semester'] = semester;
    final r = await _api.dio.get<List<int>>(
      '/admin/students/export',
      queryParameters: params,
      options: Options(responseType: ResponseType.bytes),
    );
    return r.data!;
  }

  Future<List<int>> downloadStudentCertificate(String studentId) async {
    final r = await _api.dio.get<List<int>>(
      '/admin/students/$studentId/certificate',
      options: Options(responseType: ResponseType.bytes),
    );
    return r.data!;
  }
}

final adminRemoteDataSourceProvider = Provider<AdminRemoteDataSource>((ref) {
  return AdminRemoteDataSource(ref.read(apiClientProvider));
});
