/// Smoke test — verifies the app boots, the splash redirects when there is
/// no active session, and the login screen is reachable.
///
/// Run with: flutter test integration_test/app_smoke_test.dart
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:immuno_clinic_app/core/theme/theme_mode_provider.dart';
import 'package:immuno_clinic_app/features/auth/presentation/providers/auth_provider.dart';
import 'package:immuno_clinic_app/main.dart';

class _FakeAuthNotifier extends StateNotifier<AuthState>
    implements AuthNotifier {
  _FakeAuthNotifier() : super(const AuthState());

  @override
  Future<void> checkSession() async {
    // No session — keep state unauthenticated.
  }

  @override
  Future<void> login(String email, String password) async {}

  @override
  Future<void> logout() async {}

  @override
  void markPasswordChanged() {}
}

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('App boots and shows the login screen for an anonymous user',
      (tester) async {
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

    // Splash → login redirect needs a few frames to settle.
    await tester.pumpAndSettle(const Duration(seconds: 2));

    expect(find.text('Bienvenido'), findsOneWidget);
    expect(find.text('Correo electrónico'), findsOneWidget);
    expect(find.text('Contraseña'), findsOneWidget);
  });
}
