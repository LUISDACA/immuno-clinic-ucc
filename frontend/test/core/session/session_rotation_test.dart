import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';
import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:immuno_clinic_app/core/network/api_client.dart';
import 'package:immuno_clinic_app/core/session/session_manager.dart';

class Adapter implements HttpClientAdapter {
  final Future<ResponseBody> Function(RequestOptions) answer;
  Adapter(this.answer);
  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? body,
    Future<void>? cancel,
  ) => answer(options);
  @override
  void close({bool force = false}) {}
}

ResponseBody jsonBody(Object body, int status) => ResponseBody.fromString(
  jsonEncode(body),
  status,
  headers: {
    Headers.contentTypeHeader: [Headers.jsonContentType],
  },
);

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUp(() => FlutterSecureStorage.setMockInitialValues({}));
  test('logout prevents late token pair from being persisted', () async {
    final manager = SessionManager();
    await manager.saveTokens(
      accessToken: 'old-access',
      refreshToken: 'old-refresh',
    );
    final epoch = manager.generation;
    await manager.clearSession();
    await manager.saveTokens(
      accessToken: 'late-access',
      refreshToken: 'late-refresh',
      expectedGeneration: epoch,
    );
    expect(await manager.getRefreshToken(), isNull);
    expect(await SessionManager().getAccessToken(), isNull);
  });
  test('parallel 401 requests rotate once and store the successor', () async {
    final manager = SessionManager();
    await manager.saveTokens(
      accessToken: 'old-access',
      refreshToken: 'old-refresh',
    );
    final transport = Dio(
      BaseOptions(baseUrl: 'https://synthetic.invalid/api/v1'),
    );
    final refresh = Dio();
    var calls = 0;
    refresh.httpClientAdapter = Adapter((options) async {
      calls++;
      expect(options.path, endsWith('/api/v2/auth/refresh'));
      expect(options.data['refresh_token'], 'old-refresh');
      await Future<void>.delayed(const Duration(milliseconds: 10));
      return jsonBody({
        'access_token': 'new-access',
        'refresh_token': 'new-refresh',
      }, 200);
    });
    transport.httpClientAdapter = Adapter(
      (options) async => jsonBody(
        {},
        options.headers['Authorization'] == 'Bearer new-access' ? 200 : 401,
      ),
    );
    final api = ApiClient(manager, client: transport, refreshClient: refresh);
    final results = await Future.wait([
      api.dio.get('/users/me'),
      api.dio.get('/scheme/'),
    ]);
    expect(results.every((r) => r.statusCode == 200), true);
    expect(calls, 1);
    expect(await manager.getRefreshToken(), 'new-refresh');
  });
  test('refresh response after logout cannot restore authentication', () async {
    final manager = SessionManager();
    await manager.saveTokens(
      accessToken: 'old-access',
      refreshToken: 'old-refresh',
    );
    final started = Completer<void>();
    final release = Completer<void>();
    final transport = Dio(
      BaseOptions(baseUrl: 'https://synthetic.invalid/api/v1'),
    );
    final refresh = Dio();
    transport.httpClientAdapter = Adapter((_) async => jsonBody({}, 401));
    refresh.httpClientAdapter = Adapter((_) async {
      started.complete();
      await release.future;
      return jsonBody({'access_token': 'late', 'refresh_token': 'late'}, 200);
    });
    final api = ApiClient(manager, client: transport, refreshClient: refresh);
    final request = expectLater(
      api.dio.get('/users/me'),
      throwsA(isA<DioException>()),
    );
    await started.future;
    await manager.clearSession();
    release.complete();
    await request;
    expect(await SessionManager().getRefreshToken(), isNull);
  });
}
