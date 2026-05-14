import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../../core/theme/theme_mode_provider.dart';
import '../../../auth/presentation/providers/auth_provider.dart';
import '../../data/cache/scheme_cache.dart';
import '../../data/datasources/scheme_remote_ds.dart';
import '../../data/models/vaccine_model.dart';

/// State for the student's vaccination scheme.
class SchemeState {
  final bool isLoading;
  final bool isOffline;
  final String? error;
  final SchemeOverviewModel? overview;
  final List<StudentVaccineModel> vaccines;

  const SchemeState({
    this.isLoading = false,
    this.isOffline = false,
    this.error,
    this.overview,
    this.vaccines = const [],
  });

  SchemeState copyWith({
    bool? isLoading,
    bool? isOffline,
    String? error,
    SchemeOverviewModel? overview,
    List<StudentVaccineModel>? vaccines,
  }) {
    return SchemeState(
      isLoading: isLoading ?? this.isLoading,
      isOffline: isOffline ?? this.isOffline,
      error: error,
      overview: overview ?? this.overview,
      vaccines: vaccines ?? this.vaccines,
    );
  }
}

class SchemeNotifier extends StateNotifier<SchemeState> {
  static const _cacheTtl = Duration(minutes: 2);

  final SchemeRemoteDataSource _ds;
  final SharedPreferences _prefs;
  final String? _userId;
  SchemeNotifier(this._ds, this._prefs, this._userId)
    : super(const SchemeState());

  DateTime? _lastLoadedAt;
  Future<void>? _inFlightLoad;

  Future<void> loadScheme({bool forceRefresh = false}) {
    final lastLoadedAt = _lastLoadedAt;
    final hasCachedData = state.overview != null || state.vaccines.isNotEmpty;
    if (!forceRefresh &&
        hasCachedData &&
        lastLoadedAt != null &&
        DateTime.now().difference(lastLoadedAt) < _cacheTtl) {
      return Future.value();
    }

    final inFlight = _inFlightLoad;
    if (inFlight != null) return inFlight;

    final load = _loadScheme();
    _inFlightLoad = load;
    load.whenComplete(() => _inFlightLoad = null);
    return load;
  }

  Future<void> _loadScheme() async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final data = await _ds.getMyScheme();
      await _saveCache(data);

      _lastLoadedAt = DateTime.now();
      final overview = SchemeOverviewModel.fromJson(data);
      state = SchemeState(
        overview: overview,
        vaccines: overview.vaccines,
        isOffline: false,
      );
    } on DioException catch (e) {
      final message = _errorMessageFromDio(e);
      if (_canUseOfflineFallback(e)) {
        await _handleOfflineFallback(message);
      } else {
        state = state.copyWith(isLoading: false, error: message);
      }
    } catch (e) {
      debugPrint('SchemeNotifier._loadScheme unexpected error: $e');
      state = state.copyWith(isLoading: false, error: 'Error inesperado. Intenta de nuevo.');
    }
  }

  Future<void> _saveCache(Map<String, dynamic> data) async {
    await SchemeCache.clearLegacy(_prefs);
    final cacheKey = SchemeCache.keyForUser(_userId);
    if (cacheKey == null) return;
    await _prefs.setString(cacheKey, jsonEncode(data));
  }

  bool _canUseOfflineFallback(DioException e) {
    final statusCode = e.response?.statusCode;
    if (statusCode == 401 || statusCode == 403) return false;
    return statusCode == null || statusCode >= 500;
  }

  String _errorMessageFromDio(DioException e) {
    final data = e.response?.data;
    if (data is Map<String, dynamic>) {
      final detail = data['detail'];
      if (detail is String && detail.isNotEmpty) return detail;
    }
    return 'Error al cargar esquema';
  }

  Future<void> _handleOfflineFallback(String errorMessage) async {
    await SchemeCache.clearLegacy(_prefs);
    final cacheKey = SchemeCache.keyForUser(_userId);
    if (cacheKey == null) {
      state = state.copyWith(isLoading: false, error: errorMessage);
      return;
    }

    final cachedData = _prefs.getString(cacheKey);
    if (cachedData != null) {
      try {
        final data = jsonDecode(cachedData) as Map<String, dynamic>;
        final overview = SchemeOverviewModel.fromJson(data);
        state = SchemeState(
          overview: overview,
          vaccines: overview.vaccines,
          isOffline: true,
          error: null,
        );
      } catch (_) {
        state = state.copyWith(isLoading: false, error: errorMessage);
      }
    } else {
      state = state.copyWith(isLoading: false, error: errorMessage);
    }
  }

  Future<bool> updateDose(
    String doseId, {
    String? appliedDate,
    bool clearAppliedDate = false,
    String? titerValue,
    bool clearTiterValue = false,
  }) async {
    try {
      await _ds.updateDose(
        doseId,
        appliedDate: appliedDate,
        clearAppliedDate: clearAppliedDate,
        titerValue: titerValue,
        clearTiterValue: clearTiterValue,
      );
      await loadScheme(forceRefresh: true);
      return true;
    } catch (_) {
      return false;
    }
  }
}

final schemeProvider = StateNotifierProvider<SchemeNotifier, SchemeState>((
  ref,
) {
  final prefs = ref.read(sharedPreferencesProvider);
  final userId = ref.watch(authStateProvider.select((state) => state.userId));
  return SchemeNotifier(
    ref.read(schemeRemoteDataSourceProvider),
    prefs,
    userId,
  );
});
