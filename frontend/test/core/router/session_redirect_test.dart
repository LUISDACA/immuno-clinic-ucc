import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:immuno_clinic_app/core/theme/theme_mode_provider.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:immuno_clinic_app/core/router/app_router.dart';
import 'package:immuno_clinic_app/features/auth/presentation/providers/auth_provider.dart';

class TestAuth extends StateNotifier<AuthState> implements AuthNotifier {
  TestAuth() : super(const AuthState(isAuthenticated: true, role: 'student'));
  void expire() => state = const AuthState();
  @override
  Future<void> checkSession() async {}

  @override
  void cancelPendingSessionRestore() {}
  @override
  Future<void> login(String email, String password) async {}
  @override
  Future<void> logout() async => expire();
  @override
  void markPasswordChanged() {}
}

void main() {
  testWidgets('terminal expiration redirects an already open protected route', (
    tester,
  ) async {
    SharedPreferences.setMockInitialValues({});
    final preferences = await SharedPreferences.getInstance();
    final auth = TestAuth();
    final container = ProviderContainer(
      overrides: [
        authStateProvider.overrideWith((ref) => auth),
        sharedPreferencesProvider.overrideWithValue(preferences),
      ],
    );
    addTearDown(container.dispose);
    final router = container.read(routerProvider);
    router.go('/student/change-password');
    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: MaterialApp.router(routerConfig: router),
      ),
    );
    await tester.pumpAndSettle();
    expect(
      router.routerDelegate.currentConfiguration.uri.path,
      '/student/change-password',
    );
    auth.expire();
    await tester.pumpAndSettle();
    expect(router.routerDelegate.currentConfiguration.uri.path, '/login');
  });
}
