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

void main() {
  late MockSessionManager mockSessionManager;
  late MockAuthRemoteDataSource mockDataSource;
  late SharedPreferences prefs;
  late AuthNotifier authNotifier;

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    prefs = await SharedPreferences.getInstance();
    mockSessionManager = MockSessionManager();
    mockDataSource = MockAuthRemoteDataSource();
    authNotifier = AuthNotifier(mockDataSource, mockSessionManager, prefs);
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
        ),
      ).thenAnswer((_) async => {});

      when(
        () => mockSessionManager.saveUserRole(any()),
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
  });
}
