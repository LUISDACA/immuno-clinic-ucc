import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../constants/app_constants.dart';
import '../session/session_manager.dart';

/// Configured Dio HTTP client with auth interceptor.
class ApiClient {
  late final Dio dio;
  final SessionManager _sessionManager;

  ApiClient(this._sessionManager) {
    dio = Dio(
      BaseOptions(
        baseUrl: AppConstants.baseUrl,
        connectTimeout: const Duration(seconds: 30),
        receiveTimeout: const Duration(seconds: 30),
        sendTimeout: const Duration(seconds: 30),
        headers: {'Accept': 'application/json'},
      ),
    );

    dio.interceptors.add(_AuthInterceptor(_sessionManager, dio));
  }
}

/// Interceptor that attaches JWT and handles token refresh.
class _AuthInterceptor extends Interceptor {
  final SessionManager _sessionManager;
  final Dio _dio;
  bool _isRefreshing = false;
  final List<Completer<void>> _pendingRequests = [];

  _AuthInterceptor(this._sessionManager, this._dio);

  @override
  void onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    // Skip auth header for public endpoints
    final publicPaths = [
      '/auth/login',
      '/auth/forgot-password',
      '/auth/reset-password',
      '/auth/refresh',
    ];
    final isPublic = publicPaths.any((p) => options.path.contains(p));

    if (!isPublic) {
      final token = await _sessionManager.getAccessToken();
      if (token != null) {
        options.headers['Authorization'] = 'Bearer $token';
      }
    }

    handler.next(options);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) async {
    if (err.response?.statusCode != 401) {
      return handler.next(err);
    }

    // If a refresh is already in progress, queue this request and wait.
    if (_isRefreshing) {
      final completer = Completer<void>();
      _pendingRequests.add(completer);
      try {
        await completer.future;
        final newToken = await _sessionManager.getAccessToken();
        if (newToken != null) {
          err.requestOptions.headers['Authorization'] = 'Bearer $newToken';
          final retryResponse = await _dio.fetch(err.requestOptions);
          return handler.resolve(retryResponse);
        }
      } catch (_) {
        // Refresh failed; fall through to pass the original error.
      }
      return handler.next(err);
    }

    final refreshToken = await _sessionManager.getRefreshToken();
    if (refreshToken == null) {
      return handler.next(err);
    }

    // Start refresh. _isRefreshing is always reset in finally.
    _isRefreshing = true;
    try {
      final response = await Dio(
        BaseOptions(
          baseUrl: AppConstants.baseUrl,
          connectTimeout: const Duration(seconds: 30),
          receiveTimeout: const Duration(seconds: 30),
          sendTimeout: const Duration(seconds: 30),
        ),
      ).post('/auth/refresh', data: {'refresh_token': refreshToken});

      final newAccessToken = response.data['access_token'] as String;
      await _sessionManager.saveTokens(
        accessToken: newAccessToken,
        refreshToken: refreshToken,
      );

      for (final c in _pendingRequests) {
        c.complete();
      }
      _pendingRequests.clear();

      err.requestOptions.headers['Authorization'] = 'Bearer $newAccessToken';
      final retryResponse = await _dio.fetch(err.requestOptions);
      return handler.resolve(retryResponse);
    } catch (_) {
      for (final c in _pendingRequests) {
        c.completeError(err);
      }
      _pendingRequests.clear();
      await _sessionManager.clearSession();
      return handler.next(err);
    } finally {
      _isRefreshing = false;
    }
  }
}

/// Provider for ApiClient.
final apiClientProvider = Provider<ApiClient>((ref) {
  final sessionManager = ref.read(sessionManagerProvider);
  return ApiClient(sessionManager);
});
