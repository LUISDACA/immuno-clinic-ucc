/// Login flow integration test — uses a fake AuthNotifier to verify the
/// login form validates input, calls the notifier with the typed
/// credentials, and reacts to the resulting authenticated state.
///
/// Run with: flutter test integration_test/login_flow_test.dart
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:immuno_clinic_app/core/theme/theme_mode_provider.dart';
import 'package:immuno_clinic_app/features/auth/presentation/providers/auth_provider.dart';
import 'package:immuno_clinic_app/main.dart';

class _RecordingAuthNotifier extends StateNotifier<AuthState>
    implements AuthNotifier {
  _RecordingAuthNotifier() : super(const AuthState());

  String? lastEmail;
  String? lastPassword;
  int loginCalls = 0;

  @override
  Future<void> checkSession() async {}

  @override
  void cancelPendingSessionRestore() {}

  @override
  Future<void> login(String email, String password) async {
    loginCalls++;
    lastEmail = email;
    lastPassword = password;
    // Simulate a failed login so we don't have to navigate to the
    // student dashboard (which would need many more provider overrides).
    state = state.copyWith(
      isAuthenticated: false,
      errorMessage: 'Credenciales inválidas',
    );
  }

  @override
  Future<void> logout() async {}

  @override
  void markPasswordChanged() {}
}

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('Login form validates input and calls AuthNotifier.login', (
    tester,
  ) async {
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();
    final fakeAuth = _RecordingAuthNotifier();

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          sharedPreferencesProvider.overrideWithValue(prefs),
          authStateProvider.overrideWith((ref) => fakeAuth),
        ],
        child: const ImmunoClinicApp(),
      ),
    );

    await tester.pumpAndSettle(const Duration(seconds: 2));

    // 1. Tapping login with empty fields should NOT call the notifier.
    await tester.tap(find.widgetWithText(ElevatedButton, 'Ingresar'));
    await tester.pump();
    expect(fakeAuth.loginCalls, 0);
    expect(find.text('Ingresa tu correo'), findsOneWidget);
    expect(find.text('Ingresa tu contraseña'), findsOneWidget);

    // 2. Filling in credentials and submitting calls login() once.
    await tester.enterText(
      find.widgetWithText(TextFormField, 'Correo electrónico').first,
      'student@test.com',
    );
    await tester.enterText(
      find.widgetWithText(TextFormField, 'Contraseña').first,
      'StudentPass123!',
    );
    await tester.tap(find.widgetWithText(ElevatedButton, 'Ingresar'));
    await tester.pumpAndSettle(const Duration(milliseconds: 500));

    expect(fakeAuth.loginCalls, 1);
    expect(fakeAuth.lastEmail, 'student@test.com');
    expect(fakeAuth.lastPassword, 'StudentPass123!');

    // 3. Error message bubbles back into the UI.
    expect(find.text('Credenciales inválidas'), findsOneWidget);
  });
}
