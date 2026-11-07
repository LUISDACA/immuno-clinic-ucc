import 'dart:convert';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:immuno_clinic_app/core/network/api_client.dart';
import 'package:immuno_clinic_app/core/session/session_manager.dart';
import 'package:immuno_clinic_app/features/auth/data/datasources/auth_remote_ds.dart';
import 'package:immuno_clinic_app/features/auth/presentation/providers/auth_provider.dart';
import 'package:immuno_clinic_app/features/student/data/cache/scheme_cache.dart';

class _SessionManager extends Mock implements SessionManager {}

class _CacheStore implements SchemeCacheStore {
  int clearCount = 0;

  @override
  Future<String?> read(String key) async => null;

  @override
  Future<void> write(String key, String value) async {}

  @override
  Future<void> deleteAll() async {
    clearCount++;
  }
}

class _LocalApi {
  final HttpServer server;
  final List<Map<String, String?>> requests;
  final Future<void> Function() close;

  const _LocalApi(this.server, this.requests, this.close);
  String get baseUrl => 'http://127.0.0.1:${server.port}/api/v1';
}

Future<_LocalApi> _serve(
  Future<void> Function(HttpRequest request) respond,
) async {
  final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
  final requests = <Map<String, String?>>[];
  server.listen((request) async {
    requests.add({
      'path': request.uri.path,
      'authorization': request.headers.value(HttpHeaders.authorizationHeader),
    });
    await respond(request);
  });
  return _LocalApi(server, requests, () => server.close(force: true));
}

void main() {
  late _SessionManager session;
  late SharedPreferences preferences;
  late _CacheStore cache;
  late _LocalApi api;
  late AuthNotifier notifier;

  Future<void> mount() async {
    SharedPreferences.setMockInitialValues({
      SchemeCache.legacyKey: '{"synthetic":true}',
      '${SchemeCache.prefix}synthetic-user': '{"synthetic":true}',
    });
    preferences = await SharedPreferences.getInstance();
    session = _SessionManager();
    when(() => session.generation).thenReturn(0);
    when(() => session.hasValidSession()).thenAnswer((_) async => true);
    when(
      () => session.getAccessToken(),
    ).thenAnswer((_) async => 'synthetic-access-token');
    when(() => session.clearSession()).thenAnswer((_) async {});
    cache = _CacheStore();
    final client = Dio(
      BaseOptions(
        baseUrl: api.baseUrl,
        connectTimeout: const Duration(seconds: 2),
        receiveTimeout: const Duration(seconds: 10),
      ),
    );
    final dataSource = AuthRemoteDataSource(
      ApiClient(session, client: client, refreshClient: Dio()),
    );
    notifier = AuthNotifier(
      dataSource,
      session,
      preferences,
      cacheStore: cache,
    );
  }

  Future<void> expectCleared() async {
    expect(api.requests, [
      {
        'path': '/api/v1/users/me',
        'authorization': 'Bearer synthetic-access-token',
      },
    ]);
    expect(notifier.state.isLoading, isFalse);
    expect(notifier.state.isAuthenticated, isFalse);
    expect(notifier.state.role, isNull);
    expect(preferences.getString(SchemeCache.legacyKey), isNull);
    expect(
      preferences.getString('${SchemeCache.prefix}synthetic-user'),
      isNull,
    );
    expect(cache.clearCount, 1);
    verify(() => session.clearSession()).called(1);
  }

  tearDown(() async {
    await api.close();
    notifier.dispose();
  });

  test(
    'real local HTTP 503 clears restored Flutter auth and cached scheme',
    () async {
      api = await _serve((request) async {
        request.response.statusCode = HttpStatus.serviceUnavailable;
        request.response.headers.contentType = ContentType.json;
        request.response.write(
          jsonEncode({'code': 'SERVICE_UNAVAILABLE', 'message': 'Unavailable'}),
        );
        await request.response.close();
      });
      await mount();

      await notifier.checkSession();

      await expectCleared();
    },
  );

  test(
    'real local TCP reset clears restored Flutter auth and cached scheme',
    () async {
      api = await _serve((request) async {
        final socket = await request.response.detachSocket(writeHeaders: false);
        socket.destroy();
      });
      await mount();

      await notifier.checkSession();

      await expectCleared();
    },
  );

  test(
    'slow real local HTTP response times out and cannot restore stale auth',
    () async {
      api = await _serve((request) async {
        await Future<void>.delayed(const Duration(milliseconds: 4300));
        try {
          request.response.statusCode = HttpStatus.ok;
          request.response.headers.contentType = ContentType.json;
          request.response.write(
            jsonEncode({
              'id': 'synthetic-user',
              'email': 'user@example.invalid',
              'role': 'student',
              'is_active': true,
              'must_change_password': false,
            }),
          );
          await request.response.close();
        } on IOException {
          // The client timeout may close its socket before this delayed response.
        }
      });
      await mount();
      final startedAt = DateTime.now();

      await notifier.checkSession();
      final elapsed = DateTime.now().difference(startedAt);
      expect(elapsed, greaterThanOrEqualTo(const Duration(seconds: 3)));
      expect(elapsed, lessThan(const Duration(seconds: 5)));
      await Future<void>.delayed(const Duration(milliseconds: 500));

      await expectCleared();
    },
  );
}
