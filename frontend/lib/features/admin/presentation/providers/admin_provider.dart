import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/utils/file_download.dart';
import '../../data/datasources/admin_remote_ds.dart';
import '../../data/models/admin_models.dart';

class AdminStudentListState {
  final bool isLoading;
  final String? error;
  final List<AdminStudentListItem> students;
  final int total;
  final int page;
  final int totalPages;

  const AdminStudentListState({
    this.isLoading = false,
    this.error,
    this.students = const [],
    this.total = 0,
    this.page = 1,
    this.totalPages = 1,
  });

  AdminStudentListState copyWith({
    bool? isLoading,
    String? error,
    List<AdminStudentListItem>? students,
    int? total,
    int? page,
    int? totalPages,
  }) {
    return AdminStudentListState(
      isLoading: isLoading ?? this.isLoading,
      error: error,
      students: students ?? this.students,
      total: total ?? this.total,
      page: page ?? this.page,
      totalPages: totalPages ?? this.totalPages,
    );
  }
}

class AdminStudentListNotifier extends StateNotifier<AdminStudentListState> {
  final AdminRemoteDataSource _ds;
  String? _search;
  bool? _isActive;
  int? _semester;
  String? _vaccinationStatus;

  AdminStudentListNotifier(this._ds) : super(const AdminStudentListState());

  Future<void> load({
    int page = 1,
    String? search,
    bool? isActive,
    int? semester,
    String? vaccinationStatus,
  }) async {
    _search = search;
    _isActive = isActive;
    _semester = semester;
    _vaccinationStatus = vaccinationStatus;
    state = state.copyWith(isLoading: true, error: null);
    try {
      final students = await _ds.listAllStudents(
        search: search,
        isActive: isActive,
        semester: semester,
        vaccinationStatus: vaccinationStatus,
      );
      state = AdminStudentListState(
        students: students,
        total: students.length,
        page: 1,
        totalPages: 1,
      );
    } on DioException catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: e.response?.data?['detail'] ?? 'Error',
      );
    }
  }

  Future<void> nextPage() async {
    if (state.page < state.totalPages) {
      await load(
        page: state.page + 1,
        search: _search,
        isActive: _isActive,
        semester: _semester,
        vaccinationStatus: _vaccinationStatus,
      );
    }
  }

  Future<void> prevPage() async {
    if (state.page > 1) {
      await load(
        page: state.page - 1,
        search: _search,
        isActive: _isActive,
        semester: _semester,
        vaccinationStatus: _vaccinationStatus,
      );
    }
  }

  Future<bool> deactivate(String studentId) async {
    try {
      await _ds.deactivateStudent(studentId);
      await load(
        page: state.page,
        search: _search,
        isActive: _isActive,
        semester: _semester,
        vaccinationStatus: _vaccinationStatus,
      );
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<bool> reactivate(String studentId) async {
    try {
      await _ds.reactivateStudent(studentId);
      await load(
        page: state.page,
        search: _search,
        isActive: _isActive,
        semester: _semester,
        vaccinationStatus: _vaccinationStatus,
      );
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<bool> deleteStudent(String studentId) async {
    try {
      await _ds.deleteStudent(studentId);
      await load(
        page: state.page,
        search: _search,
        isActive: _isActive,
        semester: _semester,
        vaccinationStatus: _vaccinationStatus,
      );
      return true;
    } catch (_) {
      return false;
    }
  }
}

final adminStudentListProvider =
    StateNotifierProvider<AdminStudentListNotifier, AdminStudentListState>((
      ref,
    ) {
      return AdminStudentListNotifier(ref.read(adminRemoteDataSourceProvider));
    });

final adminStatisticsProvider = FutureProvider.family<AdminStatistics, int?>((
  ref,
  semester,
) async {
  return ref
      .read(adminRemoteDataSourceProvider)
      .getStatistics(semester: semester);
});

final adminExportReportProvider = Provider((ref) {
  return (int? semester) async {
    final bytes = await ref
        .read(adminRemoteDataSourceProvider)
        .exportStudentsCSV(semester: semester);
    final fileName =
        'reporte_estudiantes_${DateTime.now().millisecondsSinceEpoch}.csv';
    await saveAndOpenFile(bytes, fileName);
  };
});

// ── Vaccine catalog ────────────────────────────────────────────────────

class VaccineCatalogState {
  final bool isLoading;
  final String? error;
  final List<VaccineCatalogItem> vaccines;

  const VaccineCatalogState({
    this.isLoading = false,
    this.error,
    this.vaccines = const [],
  });

  VaccineCatalogState copyWith({
    bool? isLoading,
    String? error,
    List<VaccineCatalogItem>? vaccines,
  }) {
    return VaccineCatalogState(
      isLoading: isLoading ?? this.isLoading,
      error: error,
      vaccines: vaccines ?? this.vaccines,
    );
  }
}

class VaccineCatalogNotifier extends StateNotifier<VaccineCatalogState> {
  final AdminRemoteDataSource _ds;
  VaccineCatalogNotifier(this._ds) : super(const VaccineCatalogState());

  Future<void> load() async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final raw = await _ds.listVaccines();
      final items = raw
          .map(
            (item) => VaccineCatalogItem.fromJson(item as Map<String, dynamic>),
          )
          .toList();
      state = state.copyWith(isLoading: false, vaccines: items);
    } on DioException catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: e.response?.data?.toString() ?? e.message,
      );
    }
  }

  Future<bool> create(Map<String, dynamic> payload) async {
    try {
      await _ds.createVaccine(payload);
      await load();
      return true;
    } on DioException catch (e) {
      state = state.copyWith(error: e.response?.data?.toString() ?? e.message);
      return false;
    }
  }

  Future<bool> update(String id, Map<String, dynamic> payload) async {
    try {
      await _ds.updateVaccine(id, payload);
      await load();
      return true;
    } on DioException catch (e) {
      state = state.copyWith(error: e.response?.data?.toString() ?? e.message);
      return false;
    }
  }

  Future<bool> setActive(String id, bool active) async {
    try {
      if (active) {
        await _ds.reactivateVaccine(id);
      } else {
        await _ds.deactivateVaccine(id);
      }
      await load();
      return true;
    } on DioException catch (e) {
      state = state.copyWith(error: e.response?.data?.toString() ?? e.message);
      return false;
    }
  }
}

final vaccineCatalogProvider =
    StateNotifierProvider<VaccineCatalogNotifier, VaccineCatalogState>((ref) {
      return VaccineCatalogNotifier(ref.read(adminRemoteDataSourceProvider));
    });
