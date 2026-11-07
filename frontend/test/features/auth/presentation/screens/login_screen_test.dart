import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
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
  void cancelPendingSessionRestore() {}

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

  testWidgets('login labels remain accessible and reflow at large text scale', (
    WidgetTester tester,
  ) async {
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 2.75;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await mockNetworkImagesFor(() async {
      final semantics = tester.ensureSemantics();
      try {
        final mockNotifier = MockAuthNotifier(const AuthState());
        await tester.pumpWidget(
          ProviderScope(
            overrides: [
              authStateProvider.overrideWith((ref) => mockNotifier),
              themeModeProvider.overrideWith(
                (ref) => MockThemeModeController(ThemeMode.light),
              ),
            ],
            child: MaterialApp(
              home: const LoginScreen(),
              builder: (context, child) => MediaQuery(
                data: MediaQuery.of(
                  context,
                ).copyWith(textScaler: const TextScaler.linear(1.8)),
                child: child!,
              ),
            ),
          ),
        );

        expect(find.bySemanticsLabel('Correo electrónico'), findsOneWidget);
        expect(find.bySemanticsLabel('Contraseña'), findsOneWidget);
        expect(find.bySemanticsLabel('Ingresar'), findsOneWidget);
        final loginButtonRect = tester.getRect(find.byType(ElevatedButton));
        final loginLabelRect = tester.getRect(find.text('Ingresar'));
        expect(
          loginButtonRect.height,
          greaterThan(52),
          reason: 'The login action must grow to fit large text.',
        );
        expect(loginLabelRect.top, greaterThanOrEqualTo(loginButtonRect.top));
        expect(
          loginLabelRect.bottom,
          lessThanOrEqualTo(loginButtonRect.bottom),
        );
        expect(
          tester
              .renderObject<RenderParagraph>(find.text('Correo electrónico'))
              .didExceedMaxLines,
          isFalse,
        );
        expect(tester.takeException(), isNull);
      } finally {
        semantics.dispose();
      }
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

  testWidgets('LoginScreen announces server errors as a live region', (
    WidgetTester tester,
  ) async {
    tester.view.physicalSize = const Size(1080, 1920);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await mockNetworkImagesFor(() async {
      final semantics = tester.ensureSemantics();
      try {
        final mockNotifier = MockAuthNotifier(
          const AuthState(errorMessage: 'Correo o contraseña incorrectos'),
        );

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

        expect(find.text('Correo o contraseña incorrectos'), findsOneWidget);
        final liveRegion = find.byWidgetPredicate(
          (widget) =>
              widget is Semantics && widget.properties.liveRegion == true,
        );
        expect(liveRegion, findsOneWidget);
        expect(
          tester
              .getSemantics(liveRegion)
              .getSemanticsData()
              .flagsCollection
              .isLiveRegion,
          isTrue,
        );
      } finally {
        semantics.dispose();
      }
    });
  });
}
