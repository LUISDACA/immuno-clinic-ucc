import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/auth/presentation/providers/auth_provider.dart';
import '../../features/auth/presentation/screens/login_screen.dart';
import '../../features/auth/presentation/screens/splash_screen.dart';
import '../../features/auth/presentation/screens/forgot_password_screen.dart';
import '../../features/auth/presentation/screens/reset_password_screen.dart';
import '../../features/student/presentation/screens/student_dashboard_screen.dart';
import '../../features/student/presentation/screens/scheme_detail_screen.dart';
import '../../features/student/presentation/screens/evidence_upload_screen.dart';
import '../../features/student/presentation/screens/profile_screen.dart';
import '../../features/student/presentation/screens/certificate_screen.dart';
import '../../features/shared/presentation/screens/notifications_screen.dart';
import '../../features/shared/presentation/screens/change_password_screen.dart';
import '../../features/shared/presentation/screens/audit_history_screen.dart';
import '../../features/shared/presentation/screens/communications_screen.dart';
import '../../features/shared/presentation/screens/communication_detail_screen.dart';
import '../../features/admin/presentation/screens/admin_dashboard_screen.dart';
import '../../features/admin/presentation/screens/admin_student_list_screen.dart';
import '../../features/admin/presentation/screens/create_student_screen.dart';
import '../../features/admin/presentation/screens/admin_student_detail_screen.dart';
import '../../features/admin/presentation/screens/admin_management_screen.dart';
import '../../features/admin/presentation/screens/vaccine_catalog_screen.dart';
import '../utils/role_utils.dart';

class _AuthRouterRefresh extends ChangeNotifier {
  void refresh() => notifyListeners();
}

final routerProvider = Provider<GoRouter>((ref) {
  final authChanges = _AuthRouterRefresh();
  ref.listen(authStateProvider, (_, _) => authChanges.refresh());
  ref.onDispose(authChanges.dispose);
  final router = GoRouter(
    refreshListenable: authChanges,
    debugLogDiagnostics: false,
    redirect: (context, state) {
      final uri = state.uri;
      final path = uri.path;

      if (uri.scheme == 'immunoclinic' &&
          uri.host == 'auth' &&
          path == '/reset-password') {
        return Uri(
          path: '/reset-password',
          queryParameters: uri.queryParameters,
        ).toString();
      }

      // ABSOLUTE BYPASS - No providers read here
      if (path.startsWith('/reset-password') ||
          path.startsWith('/auth/reset-password') ||
          path == '/login' ||
          path == '/forgot-password' ||
          path == '/') {
        return null;
      }

      final authState = ref.read(authStateProvider);
      final isLoggedIn = authState.isAuthenticated;
      final role = authState.role;

      if (!isLoggedIn) {
        return '/login';
      }

      if (isLoggedIn && authState.mustChangePassword) {
        final changePasswordPath = isAdminRole(role)
            ? '/admin/change-password'
            : '/student/change-password';
        if (path != changePasswordPath) return changePasswordPath;
      }
      if (isLoggedIn && (path == '/login' || path == '/')) {
        return isAdminRole(role) ? '/admin' : '/student';
      }
      if (isLoggedIn && path.startsWith('/admin') && !isAdminRole(role)) {
        return '/student';
      }
      if (isLoggedIn && path.startsWith('/student') && isAdminRole(role)) {
        return '/admin';
      }
      return null;
    },
    routes: [
      GoRoute(path: '/', builder: (context, state) => const SplashScreen()),
      GoRoute(path: '/login', builder: (context, state) => const LoginScreen()),
      GoRoute(
        path: '/forgot-password',
        builder: (context, state) => const ForgotPasswordScreen(),
      ),
      GoRoute(
        path: '/reset-password',
        builder: (context, state) => ResetPasswordScreen(
          token: state.uri.queryParameters['token'] ?? '',
        ),
      ),
      GoRoute(
        path: '/auth/reset-password',
        builder: (context, state) => ResetPasswordScreen(
          token: state.uri.queryParameters['token'] ?? '',
        ),
      ),
      // Student
      GoRoute(
        path: '/student',
        builder: (context, state) => const StudentDashboardScreen(),
      ),
      GoRoute(
        path: '/student/scheme',
        builder: (context, state) => const SchemeDetailScreen(),
      ),
      GoRoute(
        path: '/student/evidence',
        builder: (context, state) => const EvidenceUploadScreen(),
      ),
      GoRoute(
        path: '/student/profile',
        builder: (context, state) => const ProfileScreen(),
      ),
      GoRoute(
        path: '/student/certificate',
        builder: (context, state) => const CertificateScreen(),
      ),
      GoRoute(
        path: '/student/history',
        builder: (context, state) => const AuditHistoryScreen(),
      ),
      GoRoute(
        path: '/student/communications',
        builder: (context, state) => const CommunicationsScreen(),
      ),
      GoRoute(
        path: '/student/communications/:id',
        builder: (context, state) =>
            CommunicationDetailScreen(threadId: state.pathParameters['id']!),
      ),
      GoRoute(
        path: '/student/notifications',
        builder: (context, state) => const NotificationsScreen(),
      ),
      GoRoute(
        path: '/student/change-password',
        builder: (context, state) => const ChangePasswordScreen(),
      ),
      // Admin
      GoRoute(
        path: '/admin',
        builder: (context, state) => const AdminDashboardScreen(),
      ),
      GoRoute(
        path: '/admin/students',
        builder: (context, state) => AdminStudentListScreen(
          initialActiveFilter: switch (state.uri.queryParameters['active']) {
            'true' => true,
            'false' => false,
            _ => null,
          },
          initialVaccinationStatus: state.uri.queryParameters['scheme'],
          initialSemester: int.tryParse(
            state.uri.queryParameters['semester'] ?? '',
          ),
        ),
      ),
      GoRoute(
        path: '/admin/students/create',
        builder: (context, state) => const CreateStudentScreen(),
      ),
      GoRoute(
        path: '/admin/admins',
        builder: (context, state) => const AdminManagementScreen(),
      ),
      GoRoute(
        path: '/admin/vaccines',
        builder: (context, state) => const VaccineCatalogScreen(),
      ),
      GoRoute(
        path: '/admin/students/:id',
        builder: (context, state) => AdminStudentDetailScreen(
          studentId: state.pathParameters['id']!,
          initialTab: switch (state.uri.queryParameters['tab']) {
            'scheme' => 1,
            'evidence' => 2,
            _ => 0,
          },
        ),
      ),
      GoRoute(
        path: '/admin/notifications',
        builder: (context, state) => const NotificationsScreen(),
      ),
      GoRoute(
        path: '/admin/profile',
        builder: (context, state) => const ProfileScreen(),
      ),
      GoRoute(
        path: '/admin/history',
        builder: (context, state) => const AuditHistoryScreen(),
      ),
      GoRoute(
        path: '/admin/communications',
        builder: (context, state) => CommunicationsScreen(
          initialStudentId: state.uri.queryParameters['studentId'],
        ),
      ),
      GoRoute(
        path: '/admin/communications/:id',
        builder: (context, state) =>
            CommunicationDetailScreen(threadId: state.pathParameters['id']!),
      ),
      GoRoute(
        path: '/admin/change-password',
        builder: (context, state) => const ChangePasswordScreen(),
      ),
    ],
  );
  ref.onDispose(router.dispose);
  return router;
});
