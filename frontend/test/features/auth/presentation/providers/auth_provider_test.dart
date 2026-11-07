import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:immuno_clinic_app/core/models/user_model.dart';
import 'package:immuno_clinic_app/core/session/session_manager.dart';
import 'package:immuno_clinic_app/features/auth/data/datasources/auth_remote_ds.dart';
import 'package:immuno_clinic_app/features/auth/presentation/providers/auth_provider.dart';
import 'package:immuno_clinic_app/features/student/data/cache/scheme_cache.dart';

class MockSessionManager extends Mock implements SessionManager {}

class MockAuthRemoteDataSource extends Mock implements AuthRemoteDataSource {}

class FakeSchemeCacheStore implements SchemeCacheStore {
  @override
  Future<String?> read(String key) async => null;
  @override
  Future<void> write(String key, String value) async {}
  @override
  Future<void> deleteAll() async {}
}

void main() {
  late MockSessionManager mockSessionManager;
  late MockAuthRemoteDataSource mockDataSource;
  late SharedPreferences prefs;
  late FakeSchemeCacheStore cacheStore;
  late AuthNotifier authNotifier;

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    prefs = await SharedPreferences.getInstance();
    mockSessionManager = MockSessionManager();
    mockDataSource = MockAuthRemoteDataSource();
    cacheStore = FakeSchemeCacheStore();
    when(() => mockSessionManager.generation).thenReturn(0);
    when(() => mockSessionManager.clearSession()).thenAnswer((_) async {});
    when(
      () => mockSessionManager.getRefreshToken(),
    ).thenAnswer((_) async => null);
    authNotifier = AuthNotifier(
      mockDataSource,
      mockSessionManager,
      prefs,
      cacheStore: cacheStore,
    );
  });

  group('AuthNotifier', () {
    test('initial state is unauthenticated', () {
      expect(authNotifier.state.isAuthenticated, false);
      expect(authNotifier.state.isLoading, false);
    });

    test('login success updates state correctly', () async {
      // Arrange
      const email = 'test@student.ucc.edu.co';
      const password = 'password123';

      when(() => mockDataSource.login(email, password)).thenAnswer(
        (_) async => const AuthTokens(
          accessToken: 'fake_access_token',
          refreshToken: 'fake_refresh_token',
          mustChangePassword: false,
        ),
      );

      when(() => mockDataSource.getCurrentUser()).thenAnswer(
        (_) async => const UserModel(
          id: 'user123',
          email: email,
          role: 'student',
          isActive: true,
          mustChangePassword: false,
        ),
      );

      when(
        () => mockSessionManager.saveTokens(
          accessToken: any(named: 'accessToken'),
          refreshToken: any(named: 'refreshToken'),
          expectedGeneration: any(named: 'expectedGeneration'),
        ),
      ).thenAnswer((_) async => {});

      when(
        () => mockSessionManager.saveUserRole(
          any(),
          expectedGeneration: any(named: 'expectedGeneration'),
        ),
      ).thenAnswer((_) async => {});

      // Act
      final loginFuture = authNotifier.login(email, password);

      // Assert loading state
      expect(authNotifier.state.isLoading, true);

      await loginFuture;

      // Assert authenticated state
      expect(authNotifier.state.isLoading, false);
      expect(authNotifier.state.isAuthenticated, true);
      expect(authNotifier.state.role, 'student');
      expect(authNotifier.state.email, email);

      verify(() => mockDataSource.login(email, password)).called(1);
      verify(() => mockDataSource.getCurrentUser()).called(1);
      verify(
        () => mockSessionManager.saveTokens(
          accessToken: 'fake_access_token',
          refreshToken: 'fake_refresh_token',
          expectedGeneration: any(named: 'expectedGeneration'),
        ),
      ).called(1);
    });

    test('login failure with 401 updates error message', () async {
      // Arrange
      const email = 'wrong@student.ucc.edu.co';
      const password = 'wrongpassword';

      final dioError = DioException(
        requestOptions: RequestOptions(path: '/login'),
        response: Response(
          requestOptions: RequestOptions(path: '/login'),
          statusCode: 401,
        ),
      );

      when(() => mockDataSource.login(email, password)).thenThrow(dioError);

      // Act
      await authNotifier.login(email, password);

      // Assert error state
      expect(authNotifier.state.isLoading, false);
      expect(authNotifier.state.isAuthenticated, false);
      expect(
        authNotifier.state.errorMessage,
        'Correo o contraseña incorrectos',
      );
    });

    test('logout clears session and state', () async {
      // Arrange
      await prefs.setString(SchemeCache.legacyKey, '{"old":true}');
      await prefs.setString('cached_student_scheme_user123', '{"old":true}');
      when(
        () => mockSessionManager.getRefreshToken(),
      ).thenAnswer((_) async => 'fake_refresh_token');
      when(() => mockDataSource.logout(any())).thenAnswer((_) async => {});
      when(() => mockSessionManager.clearSession()).thenAnswer((_) async => {});

      // Act
      await authNotifier.logout();

      // Assert
      expect(authNotifier.state.isAuthenticated, false);
      expect(authNotifier.state.userId, null);
      expect(prefs.getString(SchemeCache.legacyKey), isNull);
      expect(prefs.getString('cached_student_scheme_user123'), isNull);
      verify(() => mockSessionManager.clearSession()).called(1);
    });

    test('device unregister precedes logout and credential cleanup', () async {
      final calls = <String>[];
      when(
        () => mockSessionManager.getRefreshToken(),
      ).thenAnswer((_) async => 'synthetic-refresh');
      when(() => mockDataSource.logout(any())).thenAnswer((_) async {
        calls.add('server');
      });
      when(() => mockSessionManager.clearSession()).thenAnswer((_) async {
        calls.add('clear');
      });
      final notifier = AuthNotifier(
        mockDataSource,
        mockSessionManager,
        prefs,
        cacheStore: cacheStore,
        beforeLogout: () async {
          calls.add('device');
        },
      );
      await notifier.logout();
      expect(calls, ['device', 'server', 'clear']);
    });

    test(
      'account switching unregisters and revokes the previous session first',
      () async {
        const email = 'next@student.ucc.edu.co';
        final calls = <String>[];
        when(
          () => mockSessionManager.hasValidSession(),
        ).thenAnswer((_) async => true);
        when(
          () => mockSessionManager.getRefreshToken(),
        ).thenAnswer((_) async => 'synthetic-old-refresh');
        when(() => mockDataSource.logout('synthetic-old-refresh')).thenAnswer((
          _,
        ) async {
          calls.add('revoke-old');
        });
        when(() => mockSessionManager.clearSession()).thenAnswer((_) async {
          calls.add('clear');
        });
        when(() => mockDataSource.login(email, 'password123')).thenAnswer((
          _,
        ) async {
          calls.add('login-new');
          return const AuthTokens(
            accessToken: 'synthetic-new-access',
            refreshToken: 'synthetic-new-refresh',
            mustChangePassword: false,
          );
        });
        when(() => mockDataSource.getCurrentUser()).thenAnswer(
          (_) async => const UserModel(
            id: 'new-user',
            email: email,
            role: 'student',
            isActive: true,
            mustChangePassword: false,
          ),
        );
        when(
          () => mockSessionManager.saveTokens(
            accessToken: any(named: 'accessToken'),
            refreshToken: any(named: 'refreshToken'),
            expectedGeneration: any(named: 'expectedGeneration'),
          ),
        ).thenAnswer((_) async {});
        when(
          () => mockSessionManager.saveUserRole(
            any(),
            expectedGeneration: any(named: 'expectedGeneration'),
          ),
        ).thenAnswer((_) async {});

        final notifier = AuthNotifier(
          mockDataSource,
          mockSessionManager,
          prefs,
          cacheStore: cacheStore,
          beforeLogout: () async => calls.add('unregister-device'),
        );
        await notifier.checkSession();
        expect(notifier.state.isAuthenticated, true);
        await notifier.login(email, 'password123');

        expect(calls, [
          'unregister-device',
          'revoke-old',
          'clear',
          'login-new',
        ]);
        expect(notifier.state.userId, 'new-user');
      },
    );
    test('offline device failure still clears credentials', () async {
      when(
        () => mockSessionManager.getRefreshToken(),
      ).thenAnswer((_) async => null);
      final notifier = AuthNotifier(
        mockDataSource,
        mockSessionManager,
        prefs,
        cacheStore: cacheStore,
        beforeLogout: () async {
          throw Exception('synthetic offline');
        },
      );
      await notifier.logout();
      verify(() => mockSessionManager.clearSession()).called(1);
      expect(notifier.state.isAuthenticated, false);
    });

    test('checkSession restores state when valid session exists', () async {
      // Arrange
      when(
        () => mockSessionManager.hasValidSession(),
      ).thenAnswer((_) async => true);
      when(() => mockDataSource.getCurrentUser()).thenAnswer(
        (_) async => const UserModel(
          id: 'user123',
          email: 'test@example.com',
          role: 'student',
          isActive: true,
          mustChangePassword: false,
        ),
      );
      when(
        () => mockSessionManager.saveUserRole(any()),
      ).thenAnswer((_) async => {});

      // Act
      await authNotifier.checkSession();

      // Assert
      expect(authNotifier.state.isAuthenticated, true);
      expect(authNotifier.state.userId, 'user123');
      expect(authNotifier.state.role, 'student');
      verify(() => mockSessionManager.hasValidSession()).called(1);
      verify(() => mockDataSource.getCurrentUser()).called(1);
    });

    test(
      'cancelled session restoration clears loading and ignores late result',
      () async {
        final pendingSession = Completer<bool>();
        when(
          () => mockSessionManager.hasValidSession(),
        ).thenAnswer((_) => pendingSession.future);

        final restoration = authNotifier.checkSession();
        expect(authNotifier.state.isLoading, true);

        authNotifier.cancelPendingSessionRestore();
        expect(authNotifier.state.isLoading, false);
        expect(authNotifier.state.isAuthenticated, false);

        pendingSession.complete(true);
        await restoration;

        expect(authNotifier.state.isLoading, false);
        expect(authNotifier.state.isAuthenticated, false);
        verifyNever(() => mockDataSource.getCurrentUser());
      },
    );

    test(
      'checkSession clears local session when profile lookup fails',
      () async {
        when(
          () => mockSessionManager.hasValidSession(),
        ).thenAnswer((_) async => true);
        when(() => mockDataSource.getCurrentUser()).thenThrow(
          DioException(
            requestOptions: RequestOptions(path: '/users/me'),
            type: DioExceptionType.connectionError,
          ),
        );

        await authNotifier.checkSession();

        expect(authNotifier.state.isAuthenticated, false);
        expect(authNotifier.state.userId, isNull);
        verify(() => mockSessionManager.clearSession()).called(1);
        verifyNever(() => mockSessionManager.saveUserRole(any()));
      },
    );

    test(
      'late session restoration cannot restore identity after logout',
      () async {
        final delayedUser = Completer<UserModel>();
        when(
          () => mockSessionManager.hasValidSession(),
        ).thenAnswer((_) async => true);
        when(
          () => mockDataSource.getCurrentUser(),
        ).thenAnswer((_) => delayedUser.future);

        final restoration = authNotifier.checkSession();
        await Future<void>.delayed(Duration.zero);
        verify(() => mockDataSource.getCurrentUser()).called(1);

        await authNotifier.logout();
        delayedUser.complete(
          const UserModel(
            id: 'late-user',
            email: 'late@example.invalid',
            role: 'student',
            isActive: true,
            mustChangePassword: false,
          ),
        );
        await restoration;

        expect(authNotifier.state.isAuthenticated, false);
        expect(authNotifier.state.userId, isNull);
        verifyNever(() => mockSessionManager.saveUserRole(any()));
      },
    );
  });
}
