import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/error/api_error_message.dart';
import '../../../../core/utils/file_download.dart';
import '../../data/datasources/admin_remote_ds.dart';
import '../../../auth/presentation/providers/auth_provider.dart';
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

final academicOptionsProvider = FutureProvider<AcademicOptions>((ref) {
  return ref.read(adminRemoteDataSourceProvider).getAcademicOptions();
});

class AdminStudentListNotifier extends StateNotifier<AdminStudentListState> {
  final AdminRemoteDataSource _ds;
  int _request = 0;
  bool _writing = false;
  String? _search;
  bool? _isActive;
  int? _semester;
  String? _vaccinationStatus;

  AdminStudentListNotifier(this._ds) : super(const AdminStudentListState());

  Future<void> load({
    int page = 1,
    bool afterWrite = false,
    String? search,
    bool? isActive,
    int? semester,
    String? vaccinationStatus,
  }) async {
    if (!mounted || (_writing && !afterWrite)) return;
    final request = ++_request;
    _search = search;
    _isActive = isActive;
    _semester = semester;
    _vaccinationStatus = vaccinationStatus;
    state = state.copyWith(isLoading: true, error: null);
    try {
      final result = await _ds.listStudents(
        page: page,
        pageSize: 20,
        search: search,
        isActive: isActive,
        semester: semester,
        vaccinationStatus: vaccinationStatus,
      );
      if (!mounted || request != _request) return;
      if (page > 1 && result.items.isEmpty) {
        await load(
          page: result.totalPages > 0
              ? (result.totalPages < page ? result.totalPages : page - 1)
              : 1,
          afterWrite: afterWrite,
          search: search,
          isActive: isActive,
          semester: semester,
          vaccinationStatus: vaccinationStatus,
        );
        return;
      }
      state = AdminStudentListState(
        students: result.items,
        total: result.total,
        page: result.page,
        totalPages: result.totalPages,
      );
    } on DioException catch (e) {
      if (!mounted || request != _request) return;
      state = state.copyWith(
        isLoading: false,
        error: apiErrorMessageFromData(e.response?.data) ?? 'Error',
      );
    }
  }

  Future<void> refresh() => load(
    page: state.page,
    search: _search,
    isActive: _isActive,
    semester: _semester,
    vaccinationStatus: _vaccinationStatus,
  );

  Future<void> nextPage() async {
    if (!state.isLoading && state.page < state.totalPages) {
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
    if (!state.isLoading && state.page > 1) {
      await load(
        page: state.page - 1,
        search: _search,
        isActive: _isActive,
        semester: _semester,
        vaccinationStatus: _vaccinationStatus,
      );
    }
  }

  Future<bool> _write(Future<void> Function() action) async {
    if (!mounted || _writing) return false;
    _writing = true;
    ++_request;
    try {
      await action();
      if (!mounted) return false;
      await load(
        page: state.page,
        search: _search,
        isActive: _isActive,
        semester: _semester,
        vaccinationStatus: _vaccinationStatus,
        afterWrite: true,
      );
      return true;
    } catch (_) {
      return false;
    } finally {
      _writing = false;
    }
  }

  Future<bool> deactivate(String id) => _write(() => _ds.deactivateStudent(id));
  Future<bool> reactivate(String id) => _write(() => _ds.reactivateStudent(id));
  Future<bool> deleteStudent(String id) => _write(() => _ds.deleteStudent(id));
}

final adminStudentListProvider =
    StateNotifierProvider<AdminStudentListNotifier, AdminStudentListState>((
      ref,
    ) {
      ref.watch(authStateProvider.select((state) => state.userId));
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
  final String? writeError;
  final String? confirmedChange;
  final List<VaccineCatalogItem> vaccines;

  const VaccineCatalogState({
    this.isLoading = false,
    this.error,
    this.writeError,
    this.confirmedChange,
    this.vaccines = const [],
  });

  VaccineCatalogState copyWith({
    bool? isLoading,
    String? error,
    String? writeError,
    String? confirmedChange,
    List<VaccineCatalogItem>? vaccines,
  }) {
    return VaccineCatalogState(
      isLoading: isLoading ?? this.isLoading,
      error: error,
      writeError: writeError,
      confirmedChange: confirmedChange,
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
        error:
            apiErrorMessageFromData(e.response?.data) ??
            'Error al cargar vacunas',
      );
    } catch (_) {
      state = state.copyWith(
        isLoading: false,
        error: 'No se pudo cargar el catálogo. Intenta nuevamente.',
      );
    }
  }

  Future<bool> create(Map<String, dynamic> payload) async {
    try {
      await _ds.createVaccine(payload);
      await _reloadAfterWrite(
        'La vacuna se creó, pero no se pudo actualizar el catálogo.',
      );
      return true;
    } on DioException catch (e) {
      state = state.copyWith(
        writeError:
            apiErrorMessageFromData(e.response?.data) ??
            'Error al crear vacuna',
      );
      return false;
    } catch (_) {
      state = state.copyWith(writeError: 'No se pudo crear la vacuna.');
      return false;
    }
  }

  Future<bool> update(String id, Map<String, dynamic> payload) async {
    try {
      await _ds.updateVaccine(id, payload);
      await _reloadAfterWrite(
        'Los cambios se guardaron, pero no se pudo actualizar el catálogo.',
      );
      return true;
    } on DioException catch (e) {
      state = state.copyWith(
        writeError:
            apiErrorMessageFromData(e.response?.data) ??
            'Error al actualizar vacuna',
      );
      return false;
    } catch (_) {
      state = state.copyWith(writeError: 'No se pudo actualizar la vacuna.');
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
      await _reloadAfterWrite(
        'El estado se actualizó, pero no se pudo actualizar el catálogo.',
      );
      return true;
    } on DioException catch (e) {
      state = state.copyWith(
        writeError:
            apiErrorMessageFromData(e.response?.data) ??
            'Error al actualizar vacuna',
      );
      return false;
    } catch (_) {
      state = state.copyWith(writeError: 'No se pudo actualizar la vacuna.');
      return false;
    }
  }

  Future<void> _reloadAfterWrite(String confirmedMessage) async {
    await load();
    if (state.error != null) {
      state = VaccineCatalogState(
        error: state.error,
        confirmedChange: confirmedMessage,
        vaccines: state.vaccines,
      );
    }
  }
}

final vaccineCatalogProvider =
    StateNotifierProvider<VaccineCatalogNotifier, VaccineCatalogState>((ref) {
      return VaccineCatalogNotifier(ref.read(adminRemoteDataSourceProvider));
    });
