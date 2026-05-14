import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:immuno_clinic_app/features/student/presentation/screens/student_dashboard_screen.dart';
import 'package:immuno_clinic_app/features/student/presentation/providers/scheme_provider.dart';
import 'package:immuno_clinic_app/features/auth/presentation/providers/auth_provider.dart';
import 'package:immuno_clinic_app/features/shared/presentation/providers/notification_provider.dart';
import 'package:immuno_clinic_app/features/student/data/models/vaccine_model.dart';
import 'package:immuno_clinic_app/core/theme/theme_mode_provider.dart';
import 'package:immuno_clinic_app/core/widgets/skeleton.dart';

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

class MockNotificationNotifier extends StateNotifier<NotificationState>
    implements NotificationNotifier {
  MockNotificationNotifier(super.state);

  @override
  Future<void> load({
    bool forceRefresh = false,
    bool showLoading = true,
  }) async {}

  @override
  Future<void> markRead(String id) async {}

  @override
  Future<void> markCategoryRead(String category) async {}
}

class MockSchemeNotifier extends StateNotifier<SchemeState>
    implements SchemeNotifier {
  MockSchemeNotifier(super.state);

  void updateState(SchemeState newState) {
    state = newState;
  }

  @override
  Future<void> loadScheme({bool forceRefresh = false}) async {}

  @override
  Future<bool> updateDose(
    String doseId, {
    String? appliedDate,
    bool clearAppliedDate = false,
    String? titerValue,
    bool clearTiterValue = false,
  }) async {
    return true;
  }
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
  testWidgets('StudentDashboardScreen shows loading state and then stats', (
    WidgetTester tester,
  ) async {
    tester.view.physicalSize = const Size(1920, 1080);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final router = GoRouter(
      routes: [
        GoRoute(
          path: '/',
          builder: (context, state) => const StudentDashboardScreen(),
        ),
      ],
    );

    final mockAuth = AuthState(
      isAuthenticated: true,
      email: 'test@student.ucc.edu.co',
      role: 'student',
    );

    final mockSchemeNotifier = MockSchemeNotifier(
      const SchemeState(isLoading: true),
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authStateProvider.overrideWith((ref) => MockAuthNotifier(mockAuth)),
          notificationProvider.overrideWith(
            (ref) => MockNotificationNotifier(const NotificationState()),
          ),
          schemeProvider.overrideWith((ref) => mockSchemeNotifier),
          themeModeProvider.overrideWith(
            (ref) => MockThemeModeController(ThemeMode.system),
          ),
        ],
        child: SkeletonAnimationScope(
          enabled: false,
          child: MaterialApp.router(routerConfig: router),
        ),
      ),
    );

    expect(find.byType(SkeletonBox), findsWidgets);

    final mockOverview = SchemeOverviewModel(
      totalVaccines: 10,
      approvedVaccines: 5,
      pendingVaccines: 2,
      deniedVaccines: 1,
      inReviewVaccines: 2,
      vaccines: [],
    );

    mockSchemeNotifier.updateState(
      SchemeState(isLoading: false, overview: mockOverview),
    );

    await tester.pump(); // Trigger frame

    expect(find.byType(CircularProgressIndicator), findsNothing);
    expect(find.text('5'), findsOneWidget);
    expect(find.text('10'), findsOneWidget);
    expect(find.text('2'), findsNWidgets(2));

    mockSchemeNotifier.updateState(
      const SchemeState(isLoading: false, error: 'Error loading scheme data'),
    );

    await tester.pump();

    expect(find.text('Error loading scheme data'), findsOneWidget);
    expect(find.text('Reintentar'), findsOneWidget);

    // Dispose the widget tree to cancel any pending timers
    await tester.pumpWidget(const SizedBox());
  });
}
