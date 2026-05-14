import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:fl_chart/fl_chart.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/theme_mode_provider.dart';
import '../../../../core/utils/role_utils.dart';
import '../../../../core/widgets/ucc_brand.dart';
import '../../../auth/presentation/providers/auth_provider.dart';
import '../../../shared/presentation/providers/notification_provider.dart';
import '../../data/models/admin_models.dart';

import '../providers/admin_provider.dart';

class AdminDashboardScreen extends ConsumerStatefulWidget {
  const AdminDashboardScreen({super.key});

  @override
  ConsumerState<AdminDashboardScreen> createState() =>
      _AdminDashboardScreenState();
}

class _AdminDashboardScreenState extends ConsumerState<AdminDashboardScreen> {
  int? _semesterFilter;
  bool _isExporting = false;
  Timer? _dashboardRefreshTimer;

  @override
  void initState() {
    super.initState();
    Future.microtask(() => ref.read(notificationProvider.notifier).load());
    _startDashboardRefreshTimer();
  }

  void _startDashboardRefreshTimer() {
    _dashboardRefreshTimer?.cancel();
    _dashboardRefreshTimer = Timer.periodic(const Duration(seconds: 30), (_) {
      if (mounted) _refreshDashboardData();
    });
  }

  void _pauseDashboardRefreshTimer() {
    _dashboardRefreshTimer?.cancel();
    _dashboardRefreshTimer = null;
  }

  @override
  void dispose() {
    _dashboardRefreshTimer?.cancel();
    super.dispose();
  }

  void _refreshDashboardData() {
    ref.invalidate(adminStatisticsProvider(_semesterFilter));
    ref.read(notificationProvider.notifier).load(showLoading: false);
  }

  Future<void> _refreshDashboard() async {
    ref.invalidate(adminStatisticsProvider(_semesterFilter));
    await Future.wait([
      ref.read(adminStatisticsProvider(_semesterFilter).future),
      ref
          .read(notificationProvider.notifier)
          .load(forceRefresh: true, showLoading: false),
    ]);
  }

  Future<void> _openStudents({
    bool? isActive,
    String? vaccinationStatus,
  }) async {
    final params = <String, String>{};
    if (isActive != null) params['active'] = '$isActive';
    if (vaccinationStatus != null) params['scheme'] = vaccinationStatus;
    if (_semesterFilter != null) params['semester'] = '${_semesterFilter!}';
    _pauseDashboardRefreshTimer();
    await context.push(
      Uri(path: '/admin/students', queryParameters: params).toString(),
    );
    if (!mounted) return;
    _refreshDashboardData();
    _startDashboardRefreshTimer();
  }

  Future<void> _openAndRefresh(String route) async {
    _pauseDashboardRefreshTimer();
    await context.push(route);
    if (!mounted) return;
    _refreshDashboardData();
    _startDashboardRefreshTimer();
  }

  Future<void> _openRoute(String route) async {
    _pauseDashboardRefreshTimer();
    await context.push(route);
    if (mounted) _startDashboardRefreshTimer();
  }

  Future<void> _export() async {
    setState(() => _isExporting = true);
    try {
      await ref.read(adminExportReportProvider)(_semesterFilter);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Error exportando: $e')));
      }
    } finally {
      if (mounted) setState(() => _isExporting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authStateProvider);
    final isAppAdmin = isAppAdminRole(auth.role);
    final notifState = ref.watch(notificationProvider);
    if (isAppAdmin) return _buildAppAdminDashboard(notifState);

    final statsAsync = ref.watch(adminStatisticsProvider(_semesterFilter));

    return Scaffold(
      appBar: AppBar(
        title: const Text('Panel Administrativo'),
        actions: [
          const ThemeModeToggle(),
          IconButton(
            icon: Badge(
              isLabelVisible: notifState.unreadCount > 0,
              label: Text('${notifState.unreadCount}'),
              child: const Icon(Icons.notifications_outlined),
            ),
            onPressed: () => unawaited(_openRoute('/admin/notifications')),
          ),
          IconButton(
            icon: Badge(
              isLabelVisible: notifState.unreadCommunicationCount > 0,
              label: Text('${notifState.unreadCommunicationCount}'),
              child: const Icon(Icons.forum_outlined),
            ),
            tooltip: 'Comunicaciones',
            onPressed: () => unawaited(_openRoute('/admin/communications')),
          ),
          PopupMenuButton<String>(
            icon: const Icon(Icons.person_outline),
            onSelected: (v) async {
              if (v == 'profile') unawaited(_openRoute('/admin/profile'));
              if (v == 'history') unawaited(_openRoute('/admin/history'));
              if (v == 'password') {
                unawaited(_openRoute('/admin/change-password'));
              }
              if (v == 'logout') {
                await ref.read(authStateProvider.notifier).logout();
                if (mounted) this.context.go('/login');
              }
            },
            itemBuilder: (_) => [
              const PopupMenuItem(value: 'profile', child: Text('Mi perfil')),
              const PopupMenuItem(value: 'history', child: Text('Historial')),
              const PopupMenuItem(
                value: 'password',
                child: Text('Cambiar Contraseña'),
              ),
              const PopupMenuDivider(),
              const PopupMenuItem(
                value: 'logout',
                child: Text('Cerrar Sesión'),
              ),
            ],
          ),
        ],
      ),
      body: UccBrandBackground(
        child: RefreshIndicator(
          onRefresh: _refreshDashboard,
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                UccHeroPanel(
                  eyebrow: 'Administracion UCC',
                  title: 'Panel Administrativo',
                  subtitle: auth.email ?? '',
                  icon: Icons.admin_panel_settings_outlined,
                  trailing: const UccLogo(size: 76),
                ),
                const SizedBox(height: 24),

                // Statistics Section
                Wrap(
                  spacing: 12,
                  runSpacing: 8,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  alignment: WrapAlignment.spaceBetween,
                  children: [
                    Text(
                      'Estadísticas',
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        if (_isExporting)
                          const Padding(
                            padding: EdgeInsets.symmetric(horizontal: 8.0),
                            child: SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            ),
                          )
                        else
                          IconButton(
                            icon: const Icon(
                              Icons.download,
                              color: AppColors.primary,
                            ),
                            tooltip: 'Exportar reporte CSV',
                            onPressed: _export,
                          ),
                        const SizedBox(width: 8),
                        DropdownButton<int?>(
                          value: _semesterFilter,
                          hint: const Text('Semestre'),
                          items: [
                            const DropdownMenuItem(
                              value: null,
                              child: Text('Todos'),
                            ),
                            ...List.generate(
                              10,
                              (index) => DropdownMenuItem(
                                value: index + 1,
                                child: Text('Semestre ${index + 1}'),
                              ),
                            ),
                          ],
                          onChanged: (val) {
                            setState(() => _semesterFilter = val);
                            _refreshDashboardData();
                          },
                        ),
                      ],
                    ),
                  ],
                ),
                const SizedBox(height: 12),

                statsAsync.when(
                  loading: () => const Center(
                    child: Padding(
                      padding: EdgeInsets.all(32),
                      child: CircularProgressIndicator(),
                    ),
                  ),
                  error: (err, stack) =>
                      Center(child: Text('Error al cargar estadísticas: $err')),
                  data: (stats) {
                    final total = stats.totalStudents;
                    final active = stats.activeStudents;
                    final inactive = stats.inactiveStudents;
                    final approved = stats.approvedSchemes;
                    final pending = stats.pendingSchemes;

                    return Column(
                      children: [
                        _StatGrid(
                          children: [
                            _StatCard(
                              title: 'Totales',
                              value: '$total',
                              icon: Icons.people,
                              color: AppColors.primary,
                              onTap: () => _openStudents(),
                            ),
                            _StatCard(
                              title: 'Activos',
                              value: '$active',
                              icon: Icons.check_circle_outline,
                              color: AppColors.success,
                              onTap: () => _openStudents(isActive: true),
                            ),
                            _StatCard(
                              title: 'Desactivados',
                              value: '$inactive',
                              icon: Icons.person_off_outlined,
                              color: AppColors.error,
                              onTap: () => _openStudents(isActive: false),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        _StatGrid(
                          children: [
                            _StatCard(
                              title: 'Esquema 100%',
                              value: '$approved',
                              icon: Icons.verified_user,
                              color: AppColors.accent,
                              onTap: () =>
                                  _openStudents(vaccinationStatus: 'approved'),
                            ),
                            _StatCard(
                              title: 'Pendientes',
                              value: '$pending',
                              icon: Icons.pending_actions,
                              color: AppColors.warning,
                              onTap: () =>
                                  _openStudents(vaccinationStatus: 'pending'),
                            ),
                          ],
                        ),
                        const SizedBox(height: 24),
                        Text(
                          'Análisis Gráfico',
                          style: Theme.of(context).textTheme.titleMedium
                              ?.copyWith(fontWeight: FontWeight.w600),
                        ),
                        const SizedBox(height: 12),
                        _ChartsSection(stats: stats, showBreakdowns: false),
                      ],
                    );
                  },
                ),

                const SizedBox(height: 24),
                Text(
                  'Gestión',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 12),
                _Tile(
                  icon: Icons.person_add_outlined,
                  title: 'Crear Estudiante',
                  sub: 'Nuevo registro con esquema',
                  onTap: () => _openAndRefresh('/admin/students/create'),
                ),
                const SizedBox(height: 8),
                _Tile(
                  icon: Icons.people_outlined,
                  title: 'Lista de Estudiantes',
                  sub: 'Ver, buscar y filtrar',
                  onTap: () => _openStudents(),
                ),
                if (isAppAdmin) ...[
                  const SizedBox(height: 8),
                  _Tile(
                    icon: Icons.manage_accounts_outlined,
                    title: 'Administradores',
                    sub: 'Crear y asignar programa/campus',
                    onTap: () => unawaited(_openRoute('/admin/admins')),
                  ),
                ],
                const SizedBox(height: 8),
                _Tile(
                  icon: Icons.history,
                  title: 'Historial de Cambios',
                  sub: 'Ver quien cambio que y cuando',
                  onTap: () => unawaited(_openRoute('/admin/history')),
                ),
                const SizedBox(height: 8),
                _Tile(
                  icon: Icons.forum_outlined,
                  title: 'Comunicaciones',
                  sub: 'Responder dudas y problemas',
                  badgeCount: notifState.unreadCommunicationCount,
                  onTap: () => unawaited(_openRoute('/admin/communications')),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildAppAdminDashboard(NotificationState notifState) {
    final statsAsync = ref.watch(adminStatisticsProvider(null));

    return Scaffold(
      appBar: AppBar(
        title: const Text('Administrador de aplicacion'),
        actions: [
          const ThemeModeToggle(),
          IconButton(
            icon: Badge(
              isLabelVisible: notifState.unreadCommunicationCount > 0,
              label: Text('${notifState.unreadCommunicationCount}'),
              child: const Icon(Icons.forum_outlined),
            ),
            tooltip: 'Comunicaciones',
            onPressed: () => unawaited(_openRoute('/admin/communications')),
          ),
          PopupMenuButton<String>(
            icon: const Icon(Icons.person_outline),
            onSelected: (v) async {
              if (v == 'profile') unawaited(_openRoute('/admin/profile'));
              if (v == 'password') {
                unawaited(_openRoute('/admin/change-password'));
              }
              if (v == 'logout') {
                await ref.read(authStateProvider.notifier).logout();
                if (mounted) context.go('/login');
              }
            },
            itemBuilder: (_) => const [
              PopupMenuItem(value: 'profile', child: Text('Mi perfil')),
              PopupMenuItem(
                value: 'password',
                child: Text('Cambiar Contraseña'),
              ),
              PopupMenuDivider(),
              PopupMenuItem(value: 'logout', child: Text('Cerrar Sesión')),
            ],
          ),
        ],
      ),
      body: UccBrandBackground(
        child: RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(adminStatisticsProvider(null));
            await Future.wait([
              ref.read(adminStatisticsProvider(null).future),
              ref.read(notificationProvider.notifier).load(forceRefresh: true),
            ]);
          },
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.all(16),
            children: [
              _Tile(
                icon: Icons.manage_accounts_outlined,
                title: 'Administradores',
                sub: 'Crear, eliminar y asignar programa/campus',
                onTap: () => unawaited(_openRoute('/admin/admins')),
              ),
              const SizedBox(height: 8),
              _Tile(
                icon: Icons.vaccines_outlined,
                title: 'Catálogo de vacunas',
                sub: 'Crear, editar y desactivar vacunas del esquema',
                onTap: () => unawaited(_openRoute('/admin/vaccines')),
              ),
              const SizedBox(height: 8),
              _Tile(
                icon: Icons.forum_outlined,
                title: 'Comunicaciones',
                sub: 'Conversar con administradores',
                badgeCount: notifState.unreadCommunicationCount,
                onTap: () => unawaited(_openRoute('/admin/communications')),
              ),
              const SizedBox(height: 24),
              Text(
                'Análisis global',
                style: Theme.of(
                  context,
                ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: 12),
              statsAsync.when(
                loading: () => const Center(
                  child: Padding(
                    padding: EdgeInsets.all(32),
                    child: CircularProgressIndicator(),
                  ),
                ),
                error: (err, stack) =>
                    Center(child: Text('Error al cargar estadísticas: $err')),
                data: (stats) =>
                    _ChartsSection(stats: stats, showSchemeStatus: false),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _StatGrid extends StatelessWidget {
  final List<Widget> children;

  const _StatGrid({required this.children});

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final columns = constraints.maxWidth >= 720
            ? 3
            : constraints.maxWidth >= 460
            ? 2
            : 1;
        const spacing = 12.0;
        final itemWidth =
            (constraints.maxWidth - spacing * (columns - 1)) / columns;

        return Wrap(
          spacing: spacing,
          runSpacing: spacing,
          children: children
              .map((child) => SizedBox(width: itemWidth, child: child))
              .toList(),
        );
      },
    );
  }
}

class _StatCard extends StatelessWidget {
  final String title;
  final String value;
  final IconData icon;
  final Color color;
  final VoidCallback? onTap;
  const _StatCard({
    required this.title,
    required this.value,
    required this.icon,
    required this.color,
    this.onTap,
  });
  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: colorScheme.surface,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: colorScheme.outlineVariant),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: isDark ? 0.24 : 0.05),
                blurRadius: isDark ? 18 : 10,
                offset: const Offset(0, 6),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(icon, color: color, size: 24),
                  const Spacer(),
                  if (onTap != null)
                    const Icon(
                      Icons.chevron_right,
                      size: 18,
                      color: AppColors.textHint,
                    ),
                ],
              ),
              const SizedBox(height: 12),
              Text(
                value,
                style: TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.bold,
                  color: colorScheme.onSurface,
                ),
              ),
              Text(
                title,
                style: TextStyle(
                  fontSize: 12,
                  color: colorScheme.onSurfaceVariant,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Tile extends StatelessWidget {
  final IconData icon;
  final String title;
  final String sub;
  final int badgeCount;
  final VoidCallback onTap;
  const _Tile({
    required this.icon,
    required this.title,
    required this.sub,
    this.badgeCount = 0,
    required this.onTap,
  });
  @override
  Widget build(BuildContext context) {
    return Card(
      child: ListTile(
        leading: Container(
          width: 44,
          height: 44,
          decoration: BoxDecoration(
            color: AppColors.primary.withValues(alpha: 0.08),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Badge(
            isLabelVisible: badgeCount > 0,
            label: Text('$badgeCount'),
            child: Icon(icon, color: AppColors.primary),
          ),
        ),
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.w600)),
        subtitle: Text(sub, style: const TextStyle(fontSize: 12)),
        trailing: const Icon(Icons.chevron_right, color: AppColors.textHint),
        onTap: onTap,
      ),
    );
  }
}

class _ChartsSection extends StatelessWidget {
  final AdminStatistics stats;
  final bool showSchemeStatus;
  final bool showBreakdowns;

  const _ChartsSection({
    required this.stats,
    this.showSchemeStatus = true,
    this.showBreakdowns = true,
  });

  @override
  Widget build(BuildContext context) {
    final approved = stats.approvedSchemes;
    final pending = stats.pendingSchemes;
    final totalScheme = approved + pending;
    return Column(
      children: [
        if (showSchemeStatus && totalScheme > 0)
          _buildChartCard(
            context,
            title: 'Cumplimiento de Esquema',
            sections: [
              PieChartSectionData(
                value: approved.toDouble(),
                color: AppColors.accent,
                title:
                    '${((approved / totalScheme) * 100).toStringAsFixed(1)}%',
                radius: 50,
                titleStyle: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.bold,
                  fontSize: 12,
                ),
              ),
              PieChartSectionData(
                value: pending.toDouble(),
                color: AppColors.warning,
                title: '${((pending / totalScheme) * 100).toStringAsFixed(1)}%',
                radius: 50,
                titleStyle: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.bold,
                  fontSize: 12,
                ),
              ),
            ],
            legend: _buildLegend([
              _LegendItem(
                color: AppColors.accent,
                text: 'Completo ($approved)',
              ),
              _LegendItem(
                color: AppColors.warning,
                text: 'Pendiente ($pending)',
              ),
            ]),
          ),
        if (showSchemeStatus &&
            totalScheme > 0 &&
            stats.vaccineCompliance.isNotEmpty)
          const SizedBox(height: 16),
        if (stats.vaccineCompliance.isNotEmpty)
          _buildVaccineComplianceCard(context, stats.vaccineCompliance),
        if (showBreakdowns && stats.byCampus.isNotEmpty) ...[
          const SizedBox(height: 16),
          _buildBarCard(
            context,
            title: 'Estudiantes por Campus',
            data: stats.byCampus,
            barColor: AppColors.primary,
          ),
        ],
        if (showBreakdowns && stats.byProgram.isNotEmpty) ...[
          const SizedBox(height: 16),
          _buildBarCard(
            context,
            title: 'Estudiantes por Programa',
            data: stats.byProgram,
            barColor: AppColors.accent,
          ),
        ],
      ],
    );
  }

  Widget _buildVaccineComplianceCard(
    BuildContext context,
    List<VaccineComplianceStats> data,
  ) {
    final colorScheme = Theme.of(context).colorScheme;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final sorted = data.where((item) => item.total > 0).toList()
      ..sort((a, b) {
        final ratioCompare = b.complianceRatio.compareTo(a.complianceRatio);
        if (ratioCompare != 0) return ratioCompare;
        return b.total.compareTo(a.total);
      });
    var expanded = false;

    return StatefulBuilder(
      builder: (context, setLocalState) {
        final visible = expanded ? sorted : sorted.take(3).toList();
        final canExpand = sorted.length > 3;

        return Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: colorScheme.surface,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: colorScheme.outlineVariant),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: isDark ? 0.24 : 0.05),
                blurRadius: isDark ? 18 : 10,
                offset: const Offset(0, 6),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      'Vacunas al dia',
                      style: TextStyle(
                        color: colorScheme.onSurface,
                        fontWeight: FontWeight.bold,
                        fontSize: 16,
                      ),
                    ),
                  ),
                  if (canExpand)
                    TextButton(
                      onPressed: () =>
                          setLocalState(() => expanded = !expanded),
                      child: Text(expanded ? 'Ver menos' : 'Ver mas'),
                    ),
                ],
              ),
              Text(
                'Resumen por cumplimiento del esquema',
                style: TextStyle(
                  color: colorScheme.onSurfaceVariant,
                  fontSize: 12,
                ),
              ),
              const SizedBox(height: 12),
              ...visible.map((item) {
                final upToDateFraction = item.total == 0
                    ? 0.0
                    : item.upToDate / item.total;
                return Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              item.name,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                color: colorScheme.onSurface,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Text(
                            '${(upToDateFraction * 100).toStringAsFixed(0)}%',
                            style: const TextStyle(
                              color: AppColors.success,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      LayoutBuilder(
                        builder: (_, constraints) => Stack(
                          children: [
                            Container(
                              height: 8,
                              width: constraints.maxWidth,
                              decoration: BoxDecoration(
                                color: AppColors.warning.withValues(
                                  alpha: 0.22,
                                ),
                                borderRadius: BorderRadius.circular(999),
                              ),
                            ),
                            Container(
                              height: 8,
                              width: constraints.maxWidth * upToDateFraction,
                              decoration: BoxDecoration(
                                color: AppColors.success,
                                borderRadius: BorderRadius.circular(999),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 5),
                      Text(
                        'Al dia ${item.upToDate} - Pendientes ${item.notUpToDate}',
                        style: TextStyle(
                          color: colorScheme.onSurfaceVariant,
                          fontSize: 11,
                        ),
                      ),
                    ],
                  ),
                );
              }),
            ],
          ),
        );
      },
    );
  }

  Widget _buildBarCard(
    BuildContext context, {
    required String title,
    required Map<String, int> data,
    required Color barColor,
  }) {
    final colorScheme = Theme.of(context).colorScheme;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final sorted = data.entries.toList()
      ..sort((a, b) => b.value.compareTo(a.value));
    final maxVal = sorted.first.value.toDouble();

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: colorScheme.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: colorScheme.outlineVariant),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: isDark ? 0.24 : 0.05),
            blurRadius: isDark ? 18 : 10,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: TextStyle(
              color: colorScheme.onSurface,
              fontWeight: FontWeight.bold,
              fontSize: 16,
            ),
          ),
          const SizedBox(height: 12),
          ...sorted.map((entry) {
            final fraction = maxVal > 0 ? entry.value / maxVal : 0.0;
            return Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          entry.key,
                          style: TextStyle(
                            fontSize: 12,
                            color: colorScheme.onSurfaceVariant,
                          ),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        '${entry.value}',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: colorScheme.onSurface,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  LayoutBuilder(
                    builder: (_, constraints) => Stack(
                      children: [
                        Container(
                          height: 8,
                          width: constraints.maxWidth,
                          decoration: BoxDecoration(
                            color: colorScheme.surfaceContainerHighest,
                            borderRadius: BorderRadius.circular(4),
                          ),
                        ),
                        Container(
                          height: 8,
                          width: constraints.maxWidth * fraction,
                          decoration: BoxDecoration(
                            color: barColor,
                            borderRadius: BorderRadius.circular(4),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            );
          }),
        ],
      ),
    );
  }

  Widget _buildChartCard(
    BuildContext context, {
    required String title,
    required List<PieChartSectionData> sections,
    required Widget legend,
  }) {
    final colorScheme = Theme.of(context).colorScheme;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: colorScheme.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: colorScheme.outlineVariant),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: isDark ? 0.24 : 0.05),
            blurRadius: isDark ? 18 : 10,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: TextStyle(
              color: colorScheme.onSurface,
              fontWeight: FontWeight.bold,
              fontSize: 16,
            ),
          ),
          const SizedBox(height: 16),
          LayoutBuilder(
            builder: (context, constraints) {
              final chart = SizedBox(
                height: 140,
                child: PieChart(
                  PieChartData(
                    sections: sections,
                    centerSpaceRadius: 35,
                    sectionsSpace: 2,
                  ),
                ),
              );

              if (constraints.maxWidth < 460) {
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [chart, const SizedBox(height: 12), legend],
                );
              }

              return Row(
                children: [
                  Expanded(child: chart),
                  const SizedBox(width: 16),
                  Flexible(child: legend),
                ],
              );
            },
          ),
        ],
      ),
    );
  }

  Widget _buildLegend(List<_LegendItem> items) {
    return Builder(
      builder: (context) {
        final textColor = Theme.of(context).colorScheme.onSurfaceVariant;
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.center,
          children: items
              .map(
                (item) => Padding(
                  padding: const EdgeInsets.only(bottom: 8.0),
                  child: Wrap(
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      Container(
                        width: 12,
                        height: 12,
                        decoration: BoxDecoration(
                          color: item.color,
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        item.text,
                        style: TextStyle(
                          color: textColor,
                          fontSize: 12,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                ),
              )
              .toList(),
        );
      },
    );
  }
}

class _LegendItem {
  final Color color;
  final String text;
  _LegendItem({required this.color, required this.text});
}
