import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/theme_mode_provider.dart';
import '../../../../core/widgets/ucc_brand.dart';
import '../../../../core/widgets/skeleton.dart';
import '../../../auth/presentation/providers/auth_provider.dart';
import '../../../shared/presentation/providers/notification_provider.dart';
import '../providers/scheme_provider.dart';

class StudentDashboardScreen extends ConsumerStatefulWidget {
  const StudentDashboardScreen({super.key});

  @override
  ConsumerState<StudentDashboardScreen> createState() =>
      _StudentDashboardScreenState();
}

class _StudentDashboardScreenState
    extends ConsumerState<StudentDashboardScreen> {
  Timer? _notificationTimer;

  @override
  void initState() {
    super.initState();
    Future.microtask(() {
      ref.read(notificationProvider.notifier).load();
      ref.read(schemeProvider.notifier).loadScheme();
    });
    _notificationTimer = Timer.periodic(const Duration(seconds: 30), (_) {
      if (mounted) {
        ref.read(notificationProvider.notifier).load(showLoading: false);
      }
    });
  }

  @override
  void dispose() {
    _notificationTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authStateProvider);
    final notifState = ref.watch(notificationProvider);
    final schemeState = ref.watch(schemeProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Mi Esquema'),
        actions: [
          const ThemeModeToggle(),
          IconButton(
            icon: Badge(
              isLabelVisible: notifState.unreadCount > 0,
              label: Text('${notifState.unreadCount}'),
              child: const Icon(Icons.notifications_outlined),
            ),
            onPressed: () => context.push('/student/notifications'),
          ),
          IconButton(
            icon: Badge(
              isLabelVisible: notifState.unreadCommunicationCount > 0,
              label: Text('${notifState.unreadCommunicationCount}'),
              child: const Icon(Icons.forum_outlined),
            ),
            tooltip: 'Comunicaciones',
            onPressed: () => context.push('/student/communications'),
          ),
          PopupMenuButton<String>(
            icon: const Icon(Icons.person_outline),
            onSelected: (v) async {
              if (v == 'profile') context.push('/student/profile');
              if (v == 'history') context.push('/student/history');
              if (v == 'password') context.push('/student/change-password');
              if (v == 'logout') {
                await ref.read(authStateProvider.notifier).logout();
                if (context.mounted) context.go('/login');
              }
            },
            itemBuilder: (_) => const [
              PopupMenuItem(value: 'profile', child: Text('Mi perfil')),
              PopupMenuItem(value: 'history', child: Text('Historial')),
              PopupMenuItem(
                value: 'password',
                child: Text('Cambiar contraseña'),
              ),
              PopupMenuDivider(),
              PopupMenuItem(value: 'logout', child: Text('Cerrar sesión')),
            ],
          ),
        ],
      ),
      body: UccBrandBackground(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            if (schemeState.isOffline)
              Container(
                margin: const EdgeInsets.only(bottom: 16),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.warning.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: AppColors.warning.withValues(alpha: 0.5),
                  ),
                ),
                child: Row(
                  children: [
                    const Icon(
                      Icons.wifi_off_outlined,
                      color: AppColors.warning,
                    ),
                    const SizedBox(width: 8),
                    const Expanded(
                      child: Text(
                        'Modo sin conexión: mostrando datos guardados. Conéctate a internet para ver la información más reciente.',
                        style: TextStyle(color: AppColors.warning),
                      ),
                    ),
                  ],
                ),
              ),
            UccHeroPanel(
              eyebrow: 'Estudiante UCC',
              title: 'Bienvenido',
              subtitle: auth.email ?? 'Estudiante',
              icon: Icons.school_outlined,
              trailing: const UccLogo(size: 76),
            ),
            const SizedBox(height: 24),
            _buildStatsSection(context, schemeState),
            const SizedBox(height: 24),
            const BrandSectionTitle(title: 'Acciones rápidas'),
            const SizedBox(height: 12),
            _QuickActionGrid(
              actions: [
                _QAData(
                  icon: Icons.vaccines_outlined,
                  label: 'Mi Esquema',
                  color: AppColors.primaryDark,
                  onTap: () => context.push('/student/scheme'),
                ),
                _QAData(
                  icon: Icons.upload_file_outlined,
                  label: 'Documentos',
                  color: AppColors.primary,
                  onTap: () => context.push('/student/evidence'),
                ),
                _QAData(
                  icon: Icons.verified_outlined,
                  label: 'Certificado',
                  color: AppColors.accent,
                  onTap: () => context.push('/student/certificate'),
                ),
                _QAData(
                  icon: Icons.history,
                  label: 'Historial',
                  color: AppColors.info,
                  onTap: () => context.push('/student/history'),
                ),
                _QAData(
                  icon: Icons.forum_outlined,
                  label: 'Consultas',
                  color: AppColors.warning,
                  badgeCount: notifState.unreadCommunicationCount,
                  onTap: () => context.push('/student/communications'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStatsSection(BuildContext context, SchemeState state) {
    final overview = state.overview;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        BrandSectionTitle(
          title: 'Estadísticas de vacunas',
          trailing: IconButton(
            tooltip: 'Actualizar estadísticas',
            icon: const Icon(Icons.refresh),
            onPressed: state.isLoading
                ? null
                : () => ref
                      .read(schemeProvider.notifier)
                      .loadScheme(forceRefresh: true),
          ),
        ),
        const SizedBox(height: 12),
        if (state.isLoading && overview == null)
          LayoutBuilder(
            builder: (context, constraints) {
              final columns = constraints.maxWidth >= 680 ? 5 : 2;
              const spacing = 12.0;
              final itemWidth =
                  (constraints.maxWidth - spacing * (columns - 1)) / columns;

              return Wrap(
                spacing: spacing,
                runSpacing: spacing,
                children: List.generate(
                  5,
                  (_) => SkeletonBox(
                    width: itemWidth,
                    height: 82,
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
              );
            },
          )
        else if (state.error != null && overview == null)
          _StatsError(
            message: state.error!,
            onRetry: () => ref
                .read(schemeProvider.notifier)
                .loadScheme(forceRefresh: true),
          )
        else
          LayoutBuilder(
            builder: (context, constraints) {
              final columns = constraints.maxWidth >= 680 ? 5 : 2;
              const spacing = 12.0;
              final itemWidth =
                  (constraints.maxWidth - spacing * (columns - 1)) / columns;

              return Wrap(
                spacing: spacing,
                runSpacing: spacing,
                children: [
                  _StudentStatCard(
                    width: itemWidth,
                    title: 'Total',
                    value: '${overview?.totalVaccines ?? 0}',
                    icon: Icons.vaccines_outlined,
                    color: AppColors.primaryDark,
                  ),
                  _StudentStatCard(
                    width: itemWidth,
                    title: 'Aprobadas',
                    value: '${overview?.approvedVaccines ?? 0}',
                    icon: Icons.check_circle_outline,
                    color: AppColors.statusApproved,
                  ),
                  _StudentStatCard(
                    width: itemWidth,
                    title: 'Pendientes',
                    value: '${overview?.pendingVaccines ?? 0}',
                    icon: Icons.pending_actions,
                    color: AppColors.statusPending,
                  ),
                  _StudentStatCard(
                    width: itemWidth,
                    title: 'Denegadas',
                    value: '${overview?.deniedVaccines ?? 0}',
                    icon: Icons.cancel_outlined,
                    color: AppColors.statusDenied,
                  ),
                  _StudentStatCard(
                    width: itemWidth,
                    title: 'En revision',
                    value: '${overview?.inReviewVaccines ?? 0}',
                    icon: Icons.rate_review_outlined,
                    color: AppColors.statusInReview,
                  ),
                ],
              );
            },
          ),
      ],
    );
  }
}

class _StudentStatCard extends StatelessWidget {
  final double width;
  final String title;
  final String value;
  final IconData icon;
  final Color color;

  const _StudentStatCard({
    required this.width,
    required this.title,
    required this.value,
    required this.icon,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return SizedBox(
      width: width,
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: colorScheme.surface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: colorScheme.outlineVariant),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: isDark ? 0.22 : 0.05),
              blurRadius: isDark ? 18 : 16,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon, color: color, size: 22),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    value,
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.w900,
                      color: colorScheme.onSurface,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: colorScheme.onSurfaceVariant,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _StatsError extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;

  const _StatsError({required this.message, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.errorLight,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.error.withValues(alpha: 0.25)),
      ),
      child: Row(
        children: [
          const Icon(Icons.error_outline, color: AppColors.error),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              message,
              style: const TextStyle(color: AppColors.error, fontSize: 13),
            ),
          ),
          TextButton(onPressed: onRetry, child: const Text('Reintentar')),
        ],
      ),
    );
  }
}

class _QAData {
  final IconData icon;
  final String label;
  final Color color;
  final int badgeCount;
  final VoidCallback onTap;

  const _QAData({
    required this.icon,
    required this.label,
    required this.color,
    this.badgeCount = 0,
    required this.onTap,
  });
}

class _QuickActionGrid extends StatelessWidget {
  final List<_QAData> actions;

  const _QuickActionGrid({required this.actions});

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final columns = constraints.maxWidth >= 720
            ? 5
            : constraints.maxWidth >= 360
            ? 2
            : 1;
        const spacing = 12.0;
        final itemWidth =
            (constraints.maxWidth - spacing * (columns - 1)) / columns;

        return Wrap(
          spacing: spacing,
          runSpacing: spacing,
          children: actions
              .map(
                (action) => SizedBox(
                  width: itemWidth,
                  child: _QA(action: action),
                ),
              )
              .toList(),
        );
      },
    );
  }
}

class _QA extends StatelessWidget {
  final _QAData action;

  const _QA({required this.action});

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: action.onTap,
        borderRadius: BorderRadius.circular(12),
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 112),
          child: Ink(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: colorScheme.surface,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: action.color.withValues(alpha: 0.20)),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: isDark ? 0.20 : 0.05),
                  blurRadius: isDark ? 18 : 16,
                  offset: const Offset(0, 8),
                ),
              ],
            ),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    color: action.color.withValues(alpha: 0.11),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Badge(
                    isLabelVisible: action.badgeCount > 0,
                    label: Text('${action.badgeCount}'),
                    child: Icon(action.icon, size: 28, color: action.color),
                  ),
                ),
                const SizedBox(height: 10),
                Text(
                  action.label,
                  textAlign: TextAlign.center,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w800,
                    color: action.color,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
