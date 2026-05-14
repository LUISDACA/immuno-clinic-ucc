import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:network_image_mock/network_image_mock.dart';

import 'package:immuno_clinic_app/core/theme/theme_mode_provider.dart';
import 'package:immuno_clinic_app/features/admin/data/models/admin_models.dart';
import 'package:immuno_clinic_app/features/admin/presentation/providers/admin_provider.dart';
import 'package:immuno_clinic_app/features/admin/presentation/screens/admin_dashboard_screen.dart';
import 'package:immuno_clinic_app/features/auth/presentation/providers/auth_provider.dart';
import 'package:immuno_clinic_app/features/shared/presentation/providers/notification_provider.dart';

// ── Mock notifiers ────────────────────────────────────────────────────────────

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

class MockThemeModeController extends StateNotifier<ThemeMode>
    implements ThemeModeController {
  MockThemeModeController(super.state);

  @override
  void cycle() {}

  @override
  void setMode(ThemeMode mode) {}
}

// ── Helper ────────────────────────────────────────────────────────────────────

Widget _buildApp({
  required AdminStatistics stats,
  String role = 'admin',
  String email = 'admin@ucc.edu.co',
}) {
  final router = GoRouter(
    routes: [
      GoRoute(
        path: '/',
        builder: (context, state) => const AdminDashboardScreen(),
      ),
    ],
  );

  return ProviderScope(
    overrides: [
      authStateProvider.overrideWith(
        (ref) => MockAuthNotifier(
          AuthState(isAuthenticated: true, role: role, email: email),
        ),
      ),
      notificationProvider.overrideWith(
        (ref) => MockNotificationNotifier(
          const NotificationState(unreadCount: 0),
        ),
      ),
      themeModeProvider.overrideWith(
        (ref) => MockThemeModeController(ThemeMode.light),
      ),
      adminStatisticsProvider.overrideWith(
        (ref, semester) async => stats,
      ),
    ],
    child: MaterialApp.router(routerConfig: router),
  );
}

const _baseStats = AdminStatistics(
  totalStudents: 100,
  activeStudents: 90,
  inactiveStudents: 10,
  approvedSchemes: 60,
  pendingSchemes: 40,
  maleStudents: 45,
  femaleStudents: 55,
);

// ── Tests ─────────────────────────────────────────────────────────────────────

void main() {
  group('AdminDashboardScreen — basic rendering', () {
    testWidgets('renders heading and email for normal admin', (tester) async {
      tester.view.physicalSize = const Size(1080, 1920);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await mockNetworkImagesFor(() async {
        await tester.pumpWidget(_buildApp(stats: _baseStats));
        await tester.pumpAndSettle();

        expect(find.text('Panel Administrativo'), findsWidgets);
        expect(find.text('admin@ucc.edu.co'), findsOneWidget);
      });
    });

    testWidgets('renders total/active/inactive student counts', (tester) async {
      tester.view.physicalSize = const Size(1080, 1920);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await mockNetworkImagesFor(() async {
        await tester.pumpWidget(_buildApp(stats: _baseStats));
        await tester.pumpAndSettle();

        expect(find.text('100'), findsOneWidget);
        expect(find.text('90'), findsOneWidget);
        expect(find.text('10'), findsOneWidget);
        expect(find.text('60'), findsOneWidget);
        expect(find.text('40'), findsOneWidget);
      });
    });
  });

  group('AdminDashboardScreen — campus breakdown chart', () {
    testWidgets('shows campus chart title when byCampus data is present',
        (tester) async {
      tester.view.physicalSize = const Size(1080, 1920);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      final stats = AdminStatistics(
        totalStudents: 50,
        activeStudents: 50,
        inactiveStudents: 0,
        approvedSchemes: 50,
        pendingSchemes: 0,
        maleStudents: 25,
        femaleStudents: 25,
        byCampus: const {'Norte': 30, 'Sur': 20},
      );

      await mockNetworkImagesFor(() async {
        await tester.pumpWidget(_buildApp(stats: stats, role: 'app_admin'));
        await tester.pumpAndSettle();

        expect(find.text('Estudiantes por Campus'), findsOneWidget);
      });
    });

    testWidgets('hides campus chart when byCampus is empty', (tester) async {
      tester.view.physicalSize = const Size(1080, 1920);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await mockNetworkImagesFor(() async {
        await tester.pumpWidget(
          _buildApp(stats: _baseStats, role: 'app_admin'),
        ); // byCampus = {}
        await tester.pumpAndSettle();

        expect(find.text('Estudiantes por Campus'), findsNothing);
      });
    });

    testWidgets('campus names appear in chart when data present', (tester) async {
      tester.view.physicalSize = const Size(1080, 1920);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      final stats = AdminStatistics(
        totalStudents: 50,
        activeStudents: 50,
        inactiveStudents: 0,
        approvedSchemes: 50,
        pendingSchemes: 0,
        maleStudents: 25,
        femaleStudents: 25,
        byCampus: const {'Campus Norte': 30, 'Campus Sur': 20},
      );

      await mockNetworkImagesFor(() async {
        await tester.pumpWidget(_buildApp(stats: stats, role: 'app_admin'));
        await tester.pumpAndSettle();

        expect(find.text('Campus Norte'), findsWidgets);
        expect(find.text('Campus Sur'), findsWidgets);
      });
    });
  });

  group('AdminDashboardScreen — program breakdown chart', () {
    testWidgets('shows program chart title when byProgram data is present',
        (tester) async {
      tester.view.physicalSize = const Size(1080, 1920);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      final stats = AdminStatistics(
        totalStudents: 50,
        activeStudents: 50,
        inactiveStudents: 0,
        approvedSchemes: 50,
        pendingSchemes: 0,
        maleStudents: 25,
        femaleStudents: 25,
        byProgram: const {'Medicina': 40, 'Enfermería': 10},
      );

      await mockNetworkImagesFor(() async {
        await tester.pumpWidget(_buildApp(stats: stats, role: 'app_admin'));
        await tester.pumpAndSettle();

        expect(find.text('Estudiantes por Programa'), findsOneWidget);
      });
    });

    testWidgets('hides program chart when byProgram is empty', (tester) async {
      tester.view.physicalSize = const Size(1080, 1920);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await mockNetworkImagesFor(() async {
        await tester.pumpWidget(
          _buildApp(stats: _baseStats, role: 'app_admin'),
        ); // byProgram = {}
        await tester.pumpAndSettle();

        expect(find.text('Estudiantes por Programa'), findsNothing);
      });
    });

    testWidgets('program names appear in chart when data present', (tester) async {
      tester.view.physicalSize = const Size(1080, 1920);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      final stats = AdminStatistics(
        totalStudents: 50,
        activeStudents: 50,
        inactiveStudents: 0,
        approvedSchemes: 50,
        pendingSchemes: 0,
        maleStudents: 25,
        femaleStudents: 25,
        byProgram: const {'Medicina': 40, 'Enfermería': 10},
      );

      await mockNetworkImagesFor(() async {
        await tester.pumpWidget(_buildApp(stats: stats, role: 'app_admin'));
        await tester.pumpAndSettle();

        expect(find.text('Medicina'), findsWidgets);
        expect(find.text('Enfermería'), findsWidgets);
      });
    });
  });

  group('AdminDashboardScreen — both charts shown simultaneously', () {
    testWidgets('shows both campus and program charts when both have data',
        (tester) async {
      tester.view.physicalSize = const Size(1080, 1920);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      final stats = AdminStatistics(
        totalStudents: 50,
        activeStudents: 50,
        inactiveStudents: 0,
        approvedSchemes: 50,
        pendingSchemes: 0,
        maleStudents: 25,
        femaleStudents: 25,
        byCampus: const {'Norte': 30},
        byProgram: const {'Medicina': 50},
      );

      await mockNetworkImagesFor(() async {
        await tester.pumpWidget(_buildApp(stats: stats, role: 'app_admin'));
        await tester.pumpAndSettle();

        expect(find.text('Estudiantes por Campus'), findsOneWidget);
        expect(find.text('Estudiantes por Programa'), findsOneWidget);
      });
    });
  });
}
