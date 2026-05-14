import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:network_image_mock/network_image_mock.dart';

import 'package:immuno_clinic_app/features/auth/presentation/providers/auth_provider.dart';
import 'package:immuno_clinic_app/features/auth/presentation/screens/login_screen.dart';

import 'package:immuno_clinic_app/core/theme/theme_mode_provider.dart';

class MockAuthNotifier extends StateNotifier<AuthState>
    implements AuthNotifier {
  MockAuthNotifier(super.state);

  @override
  Future<void> checkSession() async {}

  @override
  Future<void> login(String email, String password) async {}

  @override
  Future<void> logout() async {}

  @override
  void markPasswordChanged() {}
}

class MockThemeModeController extends StateNotifier<ThemeMode>
    implements ThemeModeController {
  MockThemeModeController(super.state);

  @override
  void cycle() {}

  @override
  void setMode(ThemeMode mode) {}
}

void main() {
  testWidgets('LoginScreen shows input fields and login button', (
    WidgetTester tester,
  ) async {
    // Disable physical size constraint
    tester.view.physicalSize = const Size(1080, 1920);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await mockNetworkImagesFor(() async {
      final mockNotifier = MockAuthNotifier(const AuthState());

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            authStateProvider.overrideWith((ref) => mockNotifier),
            themeModeProvider.overrideWith(
              (ref) => MockThemeModeController(ThemeMode.light),
            ),
          ],
          child: const MaterialApp(home: LoginScreen()),
        ),
      );

      // Verify essential UI components exist
      expect(find.byType(TextFormField), findsNWidgets(2));
      expect(find.text('Ingresar'), findsOneWidget);
    });
  });

  testWidgets('LoginScreen shows loading indicator when isLoading is true', (
    WidgetTester tester,
  ) async {
    // Disable physical size constraint
    tester.view.physicalSize = const Size(1080, 1920);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await mockNetworkImagesFor(() async {
      final mockNotifier = MockAuthNotifier(const AuthState(isLoading: true));

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            authStateProvider.overrideWith((ref) => mockNotifier),
            themeModeProvider.overrideWith(
              (ref) => MockThemeModeController(ThemeMode.light),
            ),
          ],
          child: const MaterialApp(home: LoginScreen()),
        ),
      );

      expect(find.byType(CircularProgressIndicator), findsWidgets);
    });
  });
}
