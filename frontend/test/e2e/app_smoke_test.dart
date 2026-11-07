/// Smoke test — verifies the app boots, the splash redirects when there is
/// no active session, and the login screen is reachable.
///
/// Runs as a widget test under `flutter test`, no device required.
/// The same content also lives in integration_test/ for execution on
/// real devices via `flutter test integration_test/`.
library;

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:immuno_clinic_app/core/theme/theme_mode_provider.dart';
import 'package:immuno_clinic_app/features/auth/presentation/providers/auth_provider.dart';
import 'package:immuno_clinic_app/main.dart';

class _FakeAuthNotifier extends StateNotifier<AuthState>
    implements AuthNotifier {
  _FakeAuthNotifier({
    Future<void> Function()? onCheckSession,
    this.loadingWhileChecking = false,
  }) : _onCheckSession = onCheckSession ?? (() async {}),
       super(const AuthState());

  final Future<void> Function() _onCheckSession;
  final bool loadingWhileChecking;
  int cancelCalls = 0;

  @override
  Future<void> checkSession() {
    if (loadingWhileChecking) state = state.copyWith(isLoading: true);
    return _onCheckSession();
  }

  @override
  void cancelPendingSessionRestore() {
    cancelCalls++;
    state = const AuthState();
  }

  @override
  Future<void> login(String email, String password) async {}

  @override
  Future<void> logout() async {}

  @override
  void markPasswordChanged() {}
}

void main() {
  testWidgets('App boots and shows the login screen for an anonymous user', (
    tester,
  ) async {
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          sharedPreferencesProvider.overrideWithValue(prefs),
          authStateProvider.overrideWith((ref) => _FakeAuthNotifier()),
        ],
        child: const ImmunoClinicApp(),
      ),
    );

    await tester.pumpAndSettle(const Duration(seconds: 2));

    expect(find.text('Bienvenido'), findsOneWidget);
    expect(find.text('Correo electrónico'), findsOneWidget);
    expect(find.text('Contraseña'), findsOneWidget);

    // Clean up timers/animations before the test ends.
    await tester.pumpWidget(const SizedBox());
  });

  testWidgets('Splash routes to login when session restoration exceeds 5s', (
    tester,
  ) async {
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();
    final pendingRestoration = Completer<void>();
    final notifier = _FakeAuthNotifier(
      onCheckSession: () => pendingRestoration.future,
      loadingWhileChecking: true,
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          sharedPreferencesProvider.overrideWithValue(prefs),
          authStateProvider.overrideWith((ref) => notifier),
        ],
        child: const ImmunoClinicApp(),
      ),
    );

    expect(find.byType(LinearProgressIndicator), findsOneWidget);
    await tester.pump(const Duration(seconds: 5));
    await tester.pumpAndSettle();

    expect(find.text('Bienvenido'), findsOneWidget);
    expect(find.text('Ingresar'), findsOneWidget);
    expect(find.text('Ingresando'), findsNothing);
    expect(notifier.cancelCalls, 1);
    pendingRestoration.complete();
    await tester.pumpWidget(const SizedBox());
  });
}
