import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
// Local font seam, no network dependency in reference captures.
// ignore: implementation_imports
import 'package:google_fonts/src/google_fonts_base.dart' as font_test;
import 'package:immuno_clinic_app/core/theme/app_theme.dart';
import 'package:immuno_clinic_app/core/theme/theme_mode_provider.dart';
import 'package:immuno_clinic_app/features/admin/data/models/admin_models.dart';
import 'package:immuno_clinic_app/features/admin/presentation/providers/admin_provider.dart';
import 'package:immuno_clinic_app/features/admin/presentation/screens/admin_dashboard_screen.dart';
import 'package:immuno_clinic_app/features/auth/presentation/providers/auth_provider.dart';
import 'package:immuno_clinic_app/features/shared/presentation/providers/notification_provider.dart';
import '../../features/admin/presentation/screens/admin_dashboard_screen_test.dart'
    as mocks;

class _LocalFonts implements AssetManifest {
  final Map<String, ByteData> data;
  _LocalFonts(this.data);
  @override
  List<String> listAssets() => data.keys.toList();
  @override
  List<AssetMetadata>? getAssetVariants(String key) => null;
}

final _fixture =
    jsonDecode(
          File(
            '../docs/ui/fixtures/phase5b-admin-dashboard.json',
          ).readAsStringSync(),
        )
        as Map<String, dynamic>;

class _Statistics {
  String state;
  int requests = 0;
  final semesters = <int?>[];
  final pending = Completer<AdminStatistics>();
  _Statistics(this.state);
  Future<AdminStatistics> load(int? semester) async {
    requests++;
    semesters.add(semester);
    if (state == 'loading') return pending.future;
    if (state == 'error') throw Exception('Synthetic unsafe diagnostic');
    return AdminStatistics.fromJson(
      Map<String, dynamic>.from(_fixture[state] as Map),
    );
  }
}

Future<(GlobalKey, GoRouter)> _mount(
  WidgetTester tester,
  _Statistics stats, {
  String role = 'admin',
  bool dark = false,
  double scale = 1,
  Future<void> Function(int?)? exportTask,
}) async {
  tester.view.physicalSize = const Size(390, 844);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
  final boundary = GlobalKey();
  final router = GoRouter(
    initialLocation: '/admin',
    routes: [
      GoRoute(path: '/admin', builder: (_, _) => const AdminDashboardScreen()),
      for (final path in [
        'students',
        'students/create',
        'communications',
        'history',
        'profile',
        'notifications',
        'admins',
        'vaccines',
      ])
        GoRoute(
          path: '/admin/$path',
          builder: (_, state) => Scaffold(
            body: Text('Synthetic destination $path ${state.uri.query}'),
          ),
        ),
    ],
  );
  addTearDown(router.dispose);
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        authStateProvider.overrideWith(
          (ref) => mocks.MockAuthNotifier(
            AuthState(
              isAuthenticated: true,
              email: 'admin@example.invalid',
              role: role,
            ),
          ),
        ),
        notificationProvider.overrideWith(
          (ref) => mocks.MockNotificationNotifier(const NotificationState()),
        ),
        themeModeProvider.overrideWith(
          (ref) => mocks.MockThemeModeController(
            dark ? ThemeMode.dark : ThemeMode.light,
          ),
        ),
        adminStatisticsProvider.overrideWith(
          (ref, semester) => stats.load(semester),
        ),
        adminExportReportProvider.overrideWith(
          (ref) => (int? semester) async {
            if (exportTask != null) await exportTask(semester);
            return null;
          },
        ),
      ],
      child: MaterialApp.router(
        theme: dark ? AppTheme.darkTheme : AppTheme.lightTheme,
        routerConfig: router,
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(
            context,
          ).copyWith(textScaler: TextScaler.linear(scale)),
          child: RepaintBoundary(key: boundary, child: child!),
        ),
      ),
    ),
  );
  await tester.pump(const Duration(milliseconds: 500));
  await tester.pump(const Duration(milliseconds: 500));
  return (boundary, router);
}

Future<void> _capture(WidgetTester tester, GlobalKey key, String name) async {
  final prefix = Platform.environment['PHASE5B_CAPTURE_PREFIX'] ?? 'after';
  if (prefix == 'after') {
    await expectLater(
      find.byKey(key),
      matchesGoldenFile(
        '../../../../docs/ui/evidence/phase5b/admin-dashboard/after-flutter-$name.png',
      ),
    );
  }
  final destination = Platform.environment['PHASE5B_ARTIFACT_DIR'];
  if (destination == null) return;
  final image = (await tester.runAsync(
    () => (key.currentContext!.findRenderObject()! as RenderRepaintBoundary)
        .toImage(pixelRatio: 1),
  ))!;
  try {
    final bytes = (await tester.runAsync(
      () => image.toByteData(format: ui.ImageByteFormat.png),
    ))!;
    await tester.runAsync(() async {
      await Directory(destination).create(recursive: true);
      await File(
        '$destination/$prefix-flutter-$name.png',
      ).writeAsBytes(bytes.buffer.asUint8List());
    });
  } finally {
    image.dispose();
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  final measurements = <Map<String, Object>>[];
  setUpAll(() async {
    final fonts = <String, ByteData>{};
    for (final file in Directory(
      'test/fixtures/fonts',
    ).listSync().whereType<File>()) {
      if (file.path.endsWith('.ttf')) {
        fonts[file.path] = ByteData.sublistView(file.readAsBytesSync());
      }
    }
    expect(fonts.length, 4);
    final assets = <String, ByteData>{
      ...fonts,
      'AssetManifest.bin': await rootBundle.load('AssetManifest.bin'),
      'assets/images/ucc_logo_app.png': await rootBundle.load(
        'assets/images/ucc_logo_app.png',
      ),
    };
    final material = await rootBundle.load('fonts/MaterialIcons-Regular.otf');
    font_test.assetManifest = _LocalFonts(fonts);
    GoogleFonts.config.allowRuntimeFetching = false;
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMessageHandler(
          'flutter/assets',
          (message) async =>
              assets[utf8.decode(
                message!.buffer.asUint8List(
                  message.offsetInBytes,
                  message.lengthInBytes,
                ),
              )],
        );
    await (FontLoader('MaterialIcons')..addFont(Future.value(material))).load();
    AppTheme.lightTheme;
    await GoogleFonts.pendingFonts();
  });
  tearDownAll(() {
    final destination = Platform.environment['PHASE5B_ARTIFACT_DIR'];
    if (destination != null) {
      File(
        '$destination/flutter-measurements.json',
      ).writeAsStringSync('${jsonEncode(measurements)}\n');
    }
    font_test.assetManifest = null;
    GoogleFonts.config.allowRuntimeFetching = true;
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMessageHandler('flutter/assets', null);
  });
  for (final role in ['admin', 'app_admin']) {
    for (final dark in [false, true]) {
      for (final scale in [1.0, 2.0]) {
        for (final state in ['data', 'empty', 'loading', 'error']) {
          testWidgets('$role $state ${dark ? 'dark' : 'light'} text$scale', (
            tester,
          ) async {
            final stats = _Statistics(state);
            final (boundary, _) = await _mount(
              tester,
              stats,
              role: role,
              dark: dark,
              scale: scale,
            );
            final name =
                '$role-$state-${dark ? 'dark' : 'light'}-390-text${scale.toInt()}';
            await _capture(tester, boundary, '$name-top');
            final scrollable = find.byType(Scrollable).first;
            final target = state == 'error'
                ? find.textContaining('estadísticas')
                : role == 'admin'
                ? find.text('Crear Estudiante')
                : find.text('Análisis global');
            await tester.scrollUntilVisible(
              target,
              250,
              scrollable: scrollable,
            );
            await tester.pump(const Duration(milliseconds: 500));
            await _capture(tester, boundary, '$name-content');
            if (state == 'error') {
              expect(
                find.textContaining('Synthetic unsafe diagnostic'),
                findsNothing,
              );
              expect(find.text('Reintentar'), findsOneWidget);
              final retry = find.widgetWithText(OutlinedButton, 'Reintentar');
              final theme = Theme.of(tester.element(retry));
              final foreground = tester
                  .widget<OutlinedButton>(retry)
                  .style!
                  .foregroundColor!
                  .resolve({})!;
              final background =
                  theme.cardTheme.color ?? theme.colorScheme.surface;
              final high = foreground.computeLuminance(),
                  low = background.computeLuminance();
              final contrast =
                  ((high > low ? high : low) + .05) /
                  ((high > low ? low : high) + .05);
              expect(contrast, greaterThanOrEqualTo(4.5));
              measurements.add({
                'role': role,
                'theme': dark ? 'dark' : 'light',
                'textScale': scale,
                'retry_contrast': contrast,
              });
            }
            if (role == 'admin') {
              expect(find.text('Administradores'), findsNothing);
            }
            expect(tester.takeException(), isNull);
            await tester.pumpWidget(const SizedBox.shrink());
            await tester.pump();
          });
        }
      }
    }
  }
  for (final role in ['admin', 'app_admin']) {
    testWidgets('$role retries statistics without exposing raw errors', (
      tester,
    ) async {
      final stats = _Statistics('error');
      await _mount(tester, stats, role: role);
      await tester.scrollUntilVisible(
        find.text('Reintentar'),
        250,
        scrollable: find.byType(Scrollable).first,
      );
      stats.state = 'data';
      await tester.tap(find.text('Reintentar'));
      await tester.pump(const Duration(milliseconds: 500));
      await tester.pump(const Duration(milliseconds: 500));
      expect(stats.requests, 2);
      expect(find.text('Reintentar'), findsNothing);
      expect(find.textContaining('Synthetic unsafe diagnostic'), findsNothing);
      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pump();
    });
  }
  testWidgets(
    'admin notification button has an accessible name and preserves its destination',
    (tester) async {
      await _mount(tester, _Statistics('data'));
      await tester.tap(find.byTooltip('Notificaciones'));
      await tester.pump();
      await tester.pump(const Duration(seconds: 1));
      expect(find.text('Synthetic destination notifications '), findsOneWidget);
      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pump();
    },
  );
  for (final role in ['admin', 'app_admin']) {
    testWidgets('$role retry disabled while its GET remains pending', (
      tester,
    ) async {
      final stats = _Statistics('error');
      await _mount(tester, stats, role: role);
      await tester.scrollUntilVisible(
        find.text('Reintentar'),
        250,
        scrollable: find.byType(Scrollable).first,
      );
      stats.state = 'loading';
      await tester.tap(find.text('Reintentar'));
      await tester.pump();
      await tester.pump();
      final retry = find.widgetWithText(OutlinedButton, 'Reintentar');
      expect(tester.widget<OutlinedButton>(retry).onPressed, isNull);
      expect(stats.requests, 2);
      stats.pending.complete(
        AdminStatistics.fromJson(
          Map<String, dynamic>.from(_fixture['data'] as Map),
        ),
      );
      await tester.pump(const Duration(milliseconds: 500));
      await tester.pump();
      expect(find.text('Reintentar'), findsNothing);
      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pump();
    });
  }
  testWidgets(
    'export failure displays a safe message without raw diagnostics',
    (tester) async {
      var calls = 0;
      await _mount(
        tester,
        _Statistics('data'),
        exportTask: (_) async {
          calls++;
          throw Exception('Synthetic unsafe diagnostic');
        },
      );
      await tester.ensureVisible(find.byTooltip('Exportar reporte CSV'));
      await tester.tap(find.byTooltip('Exportar reporte CSV'));
      await tester.pump();
      expect(calls, 1);
      expect(find.textContaining('Synthetic unsafe diagnostic'), findsNothing);
      expect(
        find.text('No se pudo exportar el reporte. Intenta nuevamente.'),
        findsOneWidget,
      );
      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pump();
    },
  );
  testWidgets(
    'admin preserves semester through all five statistics routes and return',
    (tester) async {
      final stats = _Statistics('data');
      final (_, router) = await _mount(tester, stats);
      final filter = find.byType(DropdownButton<int?>);
      await tester.ensureVisible(filter);
      await tester.tap(filter);
      await tester.pumpAndSettle();
      await tester.tap(find.text('Semestre 3').last);
      await tester.pumpAndSettle();
      expect(tester.widget<DropdownButton<int?>>(filter).value, 3);
      for (final entry in [
        ('Totales', 'semester=3'),
        ('Activos', 'active=true&semester=3'),
        ('Desactivados', 'active=false&semester=3'),
        ('Esquema 100%', 'scheme=approved&semester=3'),
        ('Pendientes', 'scheme=pending&semester=3'),
      ]) {
        await tester.scrollUntilVisible(
          find.text(entry.$1),
          200,
          scrollable: find.byType(Scrollable).first,
        );
        await tester.tap(find.text(entry.$1));
        await tester.pumpAndSettle();
        expect(
          find.text('Synthetic destination students ${entry.$2}'),
          findsOneWidget,
        );
        router.pop();
        await tester.pumpAndSettle();
        expect(tester.widget<DropdownButton<int?>>(filter).value, 3);
        expect(stats.semesters.last, 3);
      }
      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pump();
    },
  );
}
