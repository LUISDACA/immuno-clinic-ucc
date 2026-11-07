import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../constants/app_constants.dart';
import '../session/session_manager.dart';

class ApiClient {
  late final Dio dio;
  ApiClient(SessionManager session, {Dio? client, Dio? refreshClient}) {
    dio =
        client ??
        Dio(
          BaseOptions(
            baseUrl: AppConstants.baseUrl,
            connectTimeout: const Duration(seconds: 30),
            receiveTimeout: const Duration(seconds: 30),
            sendTimeout: const Duration(seconds: 30),
            headers: {'Accept': 'application/json'},
          ),
        );
    dio.interceptors.add(
      AuthInterceptor(
        session,
        dio,
        refreshClient ??
            Dio(
              BaseOptions(
                connectTimeout: const Duration(seconds: 15),
                receiveTimeout: const Duration(seconds: 15),
                sendTimeout: const Duration(seconds: 15),
              ),
            ),
      ),
    );
  }
}

class AuthInterceptor extends Interceptor {
  final SessionManager session;
  final Dio dio;
  final Dio refreshClient;
  Future<bool>? _refresh;
  AuthInterceptor(this.session, this.dio, this.refreshClient);
  bool _public(String path) => [
    'login',
    'forgot-password',
    'reset-password',
    'refresh',
    'logout',
  ].any((p) => path.endsWith('/auth/$p'));

  @override
  void onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    options.extra.putIfAbsent('sessionGeneration', () => session.generation);
    if (options.extra['sessionGeneration'] != session.generation) {
      return handler.reject(
        DioException(requestOptions: options, type: DioExceptionType.cancel),
      );
    }
    if (!_public(options.path) && options.extra['pinnedAuth'] != true) {
      final token = await session.getAccessToken();
      if (token != null) options.headers['Authorization'] = 'Bearer $token';
    }
    handler.next(options);
  }

  @override
  void onResponse(Response response, ResponseInterceptorHandler handler) {
    if (response.requestOptions.extra['sessionGeneration'] !=
        session.generation) {
      return handler.reject(
        DioException(
          requestOptions: response.requestOptions,
          type: DioExceptionType.cancel,
        ),
      );
    }
    handler.next(response);
  }

  Future<bool> _renew(int epoch) async {
    try {
      final token = await session.getRefreshToken();
      if (token == null || epoch != session.generation) return false;
      final result = await refreshClient.post(
        AppConstants.authV2('refresh'),
        data: {'refresh_token': token},
      );
      if (epoch != session.generation) return false;
      await session.saveTokens(
        accessToken: result.data['access_token'] as String,
        refreshToken: result.data['refresh_token'] as String,
        expectedGeneration: epoch,
      );
      return epoch == session.generation;
    } catch (_) {
      // Outcome may be ambiguous: never replay the old refresh automatically.
      if (epoch == session.generation) await session.expire();
      return false;
    }
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) async {
    final options = err.requestOptions;
    final epoch = options.extra['sessionGeneration'];
    if (options.extra['skipRefresh'] == true ||
        err.response?.statusCode != 401 ||
        _public(options.path) ||
        options.extra['retried'] == true ||
        epoch != session.generation) {
      return handler.next(err);
    }
    // A late 401 from an older access token uses the already renewed pair.
    final current = await session.getAccessToken();
    bool renewed =
        current != null &&
        options.headers['Authorization'] != 'Bearer $current';
    if (!renewed) {
      final pending = _refresh ??= _renew(epoch as int);
      renewed = await pending;
      if (identical(_refresh, pending)) _refresh = null;
    }
    if (!renewed || epoch != session.generation) return handler.next(err);
    options.extra['retried'] = true;
    try {
      handler.resolve(await dio.fetch(options));
    } on DioException catch (failure) {
      handler.next(failure);
    }
  }
}

final apiClientProvider = Provider<ApiClient>(
  (ref) => ApiClient(ref.read(sessionManagerProvider)),
);
