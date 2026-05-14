import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../../core/session/session_manager.dart';
import '../../../../core/theme/theme_mode_provider.dart';
import '../../../student/data/cache/scheme_cache.dart';
import '../../data/datasources/auth_remote_ds.dart';

/// Authentication state.
class AuthState {
  final bool isAuthenticated;
  final bool isLoading;
  final String? role;
  final String? userId;
  final String? email;
  final String? errorMessage;
  final bool mustChangePassword;

  const AuthState({
    this.isAuthenticated = false,
    this.isLoading = false,
    this.role,
    this.userId,
    this.email,
    this.errorMessage,
    this.mustChangePassword = false,
  });

  AuthState copyWith({
    bool? isAuthenticated,
    bool? isLoading,
    String? role,
    String? userId,
    String? email,
    String? errorMessage,
    bool? mustChangePassword,
  }) {
    return AuthState(
      isAuthenticated: isAuthenticated ?? this.isAuthenticated,
      isLoading: isLoading ?? this.isLoading,
      role: role ?? this.role,
      userId: userId ?? this.userId,
      email: email ?? this.email,
      errorMessage: errorMessage,
      mustChangePassword: mustChangePassword ?? this.mustChangePassword,
    );
  }
}

/// Auth state notifier — manages login, logout, session restoration.
class AuthNotifier extends StateNotifier<AuthState> {
  final AuthRemoteDataSource _dataSource;
  final SessionManager _sessionManager;
  final SharedPreferences _prefs;

  AuthNotifier(this._dataSource, this._sessionManager, this._prefs)
    : super(const AuthState());

  Future<void> checkSession() async {
    state = state.copyWith(isLoading: true);

    try {
      final hasSession = await _sessionManager.hasValidSession();
      if (!hasSession) {
        state = const AuthState();
        return;
      }

      // Try to get current user to validate token
      final user = await _dataSource.getCurrentUser().timeout(
        const Duration(seconds: 4),
      );
      await _sessionManager.saveUserRole(user.role);

      state = AuthState(
        isAuthenticated: true,
        role: user.role,
        userId: user.id,
        email: user.email,
        mustChangePassword: user.mustChangePassword,
      );
    } catch (_) {
      await _sessionManager.clearSession();
      state = const AuthState();
    }
  }

  /// Login with email and password.
  Future<void> login(String email, String password) async {
    state = state.copyWith(isLoading: true, errorMessage: null);

    try {
      final tokens = await _dataSource.login(email, password);
      await _sessionManager.saveTokens(
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      );

      // Get user data for role
      final user = await _dataSource.getCurrentUser();
      await _sessionManager.saveUserRole(user.role);

      state = AuthState(
        isAuthenticated: true,
        role: user.role,
        userId: user.id,
        email: user.email,
        mustChangePassword: tokens.mustChangePassword || user.mustChangePassword,
      );
    } on DioException catch (e) {
      String message = 'Error al iniciar sesión';
      if (e.response?.statusCode == 401) {
        message = 'Correo o contraseña incorrectos';
      } else if (e.response?.statusCode == 403) {
        message = e.response?.data['detail'] ?? 'Cuenta desactivada';
      } else if (e.type == DioExceptionType.connectionTimeout) {
        message = 'No se pudo conectar al servidor';
      }
      state = state.copyWith(isLoading: false, errorMessage: message);
    } catch (e) {
      debugPrint('AuthNotifier.login unexpected error: $e');
      state = state.copyWith(
        isLoading: false,
        errorMessage: 'Error inesperado. Intenta de nuevo.',
      );
    }
  }

  /// Logout — clear tokens and state.
  Future<void> logout() async {
    final refreshToken = await _sessionManager.getRefreshToken();
    if (refreshToken != null) {
      // Best effort logout on server
      unawaited(_dataSource.logout(refreshToken).catchError((_) {}));
    }

    await SchemeCache.clearAll(_prefs);
    await _sessionManager.clearSession();
    state = const AuthState();
  }

  void markPasswordChanged() {
    state = state.copyWith(mustChangePassword: false);
  }
}

/// Auth state provider.
final authStateProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  return AuthNotifier(
    ref.read(authRemoteDataSourceProvider),
    ref.read(sessionManagerProvider),
    ref.read(sharedPreferencesProvider),
  );
});
