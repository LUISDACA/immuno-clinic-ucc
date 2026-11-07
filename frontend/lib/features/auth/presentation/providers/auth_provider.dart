import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../../core/session/session_manager.dart';
import '../../../../core/error/api_error_message.dart';
import '../../../../core/notifications/push_notification_service.dart';
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
  final SchemeCacheStore _cacheStore;
  int _epoch = 0;
  final Future<void> Function()? _beforeLogout;

  AuthNotifier(
    this._dataSource,
    this._sessionManager,
    this._prefs, {
    Future<void> Function()? beforeLogout,
    SchemeCacheStore? cacheStore,
  }) : _beforeLogout = beforeLogout,
       _cacheStore = cacheStore ?? SchemeCache.store,
       super(const AuthState());

  Future<void> checkSession() async {
    final epoch = _epoch;
    state = state.copyWith(isLoading: true);

    try {
      final hasSession = await _sessionManager.hasValidSession();
      if (epoch != _epoch || !mounted) return;
      if (!hasSession) {
        state = const AuthState();
        return;
      }

      // Try to get current user to validate token
      final user = await _dataSource.getCurrentUser().timeout(
        const Duration(seconds: 4),
      );
      if (epoch != _epoch || !mounted) return;
      await _sessionManager.saveUserRole(user.role);

      state = AuthState(
        isAuthenticated: true,
        role: user.role,
        userId: user.id,
        email: user.email,
        mustChangePassword: user.mustChangePassword,
      );
    } catch (_) {
      if (epoch != _epoch || !mounted) return;
      await SchemeCache.clearAll(_prefs, store: _cacheStore);
      await _sessionManager.clearSession();
      state = const AuthState();
    }
  }

  /// Cancels a session restoration that outlived the splash screen timeout.
  ///
  /// The underlying secure-storage read may not be cancellable. Advancing the
  /// epoch makes its eventual result stale, while resetting the state keeps
  /// the login form usable.
  void cancelPendingSessionRestore() {
    _epoch++;
    if (mounted && state.isLoading && !state.isAuthenticated) {
      state = const AuthState();
    }
  }

  /// Login with email and password.
  Future<void> login(String email, String password) async {
    final epoch = ++_epoch;
    final hadActiveSession = state.isAuthenticated;
    if (!hadActiveSession) state = const AuthState(isLoading: true);

    try {
      final previousRefresh = await _sessionManager.getRefreshToken();
      if (previousRefresh != null || hadActiveSession) {
        try {
          await _beforeLogout?.call().timeout(const Duration(seconds: 5));
        } catch (_) {
          /* Continue account switching even when device unregister is offline. */
        }
        if (previousRefresh != null) {
          try {
            await _dataSource
                .logout(previousRefresh)
                .timeout(const Duration(seconds: 5));
          } catch (_) {
            /* FastAPI may be unavailable; new login still replaces credentials. */
          }
        }
      }
      if (epoch != _epoch || !mounted) return;
      // Keep the previous auth state until its FCM token and server family were handled.
      if (hadActiveSession) state = const AuthState(isLoading: true);
      await _sessionManager.clearSession();
      await SchemeCache.clearAll(_prefs, store: _cacheStore);
      final sessionGeneration = _sessionManager.generation;
      final tokens = await _dataSource.login(email, password);
      if (epoch != _epoch || !mounted) {
        await _revokeRefresh(tokens.refreshToken);
        return;
      }
      await _sessionManager.saveTokens(
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expectedGeneration: sessionGeneration,
      );

      // Get user data for role
      if (epoch != _epoch || !mounted) {
        await _revokeRefresh(tokens.refreshToken);
        return;
      }
      final user = await _dataSource.getCurrentUser();
      if (epoch != _epoch || !mounted) {
        await _revokeRefresh(tokens.refreshToken);
        return;
      }
      await _sessionManager.saveUserRole(
        user.role,
        expectedGeneration: sessionGeneration,
      );
      if (epoch != _epoch || !mounted) {
        await _revokeRefresh(tokens.refreshToken);
        return;
      }

      state = AuthState(
        isAuthenticated: true,
        role: user.role,
        userId: user.id,
        email: user.email,
        mustChangePassword:
            tokens.mustChangePassword || user.mustChangePassword,
      );
    } on DioException catch (e) {
      if (epoch != _epoch || !mounted) return;
      await _sessionManager.clearSession();
      String message = 'Error al iniciar sesión';
      if (e.response?.statusCode == 401) {
        message = 'Correo o contraseña incorrectos';
      } else if (e.response?.statusCode == 403) {
        message =
            apiErrorMessageFromData(e.response?.data) ?? 'Cuenta desactivada';
      } else if (e.type == DioExceptionType.connectionTimeout) {
        message = 'No se pudo conectar al servidor';
      }
      state = state.copyWith(isLoading: false, errorMessage: message);
    } catch (e) {
      if (epoch != _epoch || !mounted) return;
      await _sessionManager.clearSession();
      debugPrint('AuthNotifier.login failed');
      state = state.copyWith(
        isLoading: false,
        errorMessage: 'Error inesperado. Intenta de nuevo.',
      );
    }
  }

  Future<void> _revokeRefresh(String refreshToken) async {
    try {
      await _dataSource
          .logout(refreshToken)
          .timeout(const Duration(seconds: 5));
    } catch (_) {
      /* Best effort: another auth operation owns local state. */
    }
  }

  /// Logout — clear tokens and state.
  Future<void> logout() async {
    final epoch = ++_epoch;
    final refreshToken = await _sessionManager.getRefreshToken();
    try {
      await _beforeLogout?.call().timeout(const Duration(seconds: 5));
    } catch (_) {
      /* Local cleanup must still run when offline. */
    }
    try {
      if (refreshToken != null) {
        await _dataSource
            .logout(refreshToken)
            .timeout(const Duration(seconds: 5));
      }
    } catch (_) {
      /* Server outcome is unknown when offline. */
    }
    if (epoch != _epoch || !mounted) return;
    await SchemeCache.clearAll(_prefs, store: _cacheStore);
    await _sessionManager.clearSession();
    if (epoch == _epoch && mounted) state = const AuthState();
  }

  Future<void> _sessionExpired() async {
    ++_epoch;
    await SchemeCache.clearAll(_prefs, store: _cacheStore);
    if (mounted) state = const AuthState();
  }

  void markPasswordChanged() {
    state = state.copyWith(mustChangePassword: false);
  }
}

/// Auth state provider.
final authStateProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  final notifier = AuthNotifier(
    ref.read(authRemoteDataSourceProvider),
    ref.read(sessionManagerProvider),
    ref.read(sharedPreferencesProvider),
    beforeLogout: () =>
        ref.read(pushNotificationServiceProvider).unregisterDevice(),
  );
  final manager = ref.read(sessionManagerProvider);
  manager.onExpired = () => unawaited(notifier._sessionExpired());
  ref.onDispose(() => manager.onExpired = null);
  return notifier;
});
