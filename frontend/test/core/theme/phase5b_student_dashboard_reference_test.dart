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
// Offline local font seam already used by the notification references.
// ignore: implementation_imports
import 'package:google_fonts/src/google_fonts_base.dart' as font_test;
import 'package:immuno_clinic_app/core/theme/app_theme.dart';
import 'package:immuno_clinic_app/core/theme/theme_mode_provider.dart';
import 'package:immuno_clinic_app/core/widgets/skeleton.dart';
import 'package:immuno_clinic_app/features/auth/presentation/providers/auth_provider.dart';
import 'package:immuno_clinic_app/features/shared/presentation/providers/notification_provider.dart';
import 'package:immuno_clinic_app/features/student/data/models/vaccine_model.dart';
import 'package:immuno_clinic_app/features/student/presentation/providers/scheme_provider.dart';
import 'package:immuno_clinic_app/features/student/presentation/screens/student_dashboard_screen.dart';
import '../../widget_test.dart' as mocks;

class _LocalFonts implements AssetManifest {
  final Map<String, ByteData> data;
  _LocalFonts(this.data);
  @override
  List<String> listAssets() => data.keys.toList();
  @override
  List<AssetMetadata>? getAssetVariants(String key) => null;
}

class _Scheme extends mocks.MockSchemeNotifier {
  _Scheme(super.state);
  int forced = 0;
  @override
  Future<void> loadScheme({bool forceRefresh = false}) async {
    if (forceRefresh) forced++;
  }
}

final _fixture =
    jsonDecode(
          File(
            '../docs/ui/fixtures/phase5b-student-dashboard.json',
          ).readAsStringSync(),
        )
        as Map<String, dynamic>;
SchemeState _state(String name) => switch (name) {
  'loading' => const SchemeState(isLoading: true),
  'error' => const SchemeState(error: 'No se pudo cargar el esquema.'),
  'offline' => SchemeState(
    isOffline: true,
    overview: SchemeOverviewModel.fromJson(
      Map<String, dynamic>.from(_fixture['data'] as Map),
    ),
  ),
  _ => SchemeState(
    overview: SchemeOverviewModel.fromJson(
      Map<String, dynamic>.from(_fixture[name] as Map),
    ),
  ),
};

Future<(GlobalKey, GoRouter)> _mount(
  WidgetTester tester,
  _Scheme scheme, {
  bool dark = false,
  double scale = 1,
  double width = 390,
}) async {
  tester.view.physicalSize = Size(width, 844);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
  final boundary = GlobalKey();
  final router = GoRouter(
    initialLocation: '/student',
    routes: [
      GoRoute(
        path: '/student',
        builder: (_, _) => const StudentDashboardScreen(),
      ),
      for (final path in [
        'scheme',
        'evidence',
        'certificate',
        'history',
        'communications',
        'notifications',
        'profile',
        'change-password',
      ])
        GoRoute(
          path: '/student/$path',
          builder: (_, _) =>
              Scaffold(body: Text('Synthetic destination $path')),
        ),
    ],
  );
  addTearDown(router.dispose);
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        authStateProvider.overrideWith(
          (ref) => mocks.MockAuthNotifier(
            const AuthState(
              isAuthenticated: true,
              email: 'student@example.invalid',
              role: 'student',
            ),
          ),
        ),
        schemeProvider.overrideWith((ref) => scheme),
        notificationProvider.overrideWith(
          (ref) => mocks.MockNotificationNotifier(const NotificationState()),
        ),
        themeModeProvider.overrideWith(
          (ref) => mocks.MockThemeModeController(
            dark ? ThemeMode.dark : ThemeMode.light,
          ),
        ),
      ],
      child: SkeletonAnimationScope(
        enabled: false,
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
    ),
  );
  await tester.pump(const Duration(milliseconds: 100));
  return (boundary, router);
}

double _contrast(Color a, Color b) {
  final x = a.computeLuminance(), y = b.computeLuminance();
  return ((x > y ? x : y) + .05) / ((x > y ? y : x) + .05);
}

Future<void> _capture(WidgetTester tester, GlobalKey key, String name) async {
  final prefix = Platform.environment['PHASE5B_CAPTURE_PREFIX'] ?? 'after';
  if (prefix == 'after') {
    await expectLater(
      find.byKey(key),
      matchesGoldenFile(
        '../../../../docs/ui/evidence/phase5b/student-dashboard/after-flutter-$name.png',
      ),
    );
  }
  final destination = Platform.environment['PHASE5B_ARTIFACT_DIR'];
  if (destination == null) return;
  final render =
      key.currentContext!.findRenderObject()! as RenderRepaintBoundary;
  final image = (await tester.runAsync(() => render.toImage(pixelRatio: 1)))!;
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
        '$destination/${Platform.environment['PHASE5B_CAPTURE_PREFIX'] ?? 'after'}-flutter-measurements.json',
      ).writeAsStringSync('${jsonEncode(measurements)}\n');
    }
    font_test.assetManifest = null;
    GoogleFonts.config.allowRuntimeFetching = true;
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMessageHandler('flutter/assets', null);
  });
  for (final dark in [false, true]) {
    for (final scale in [1.0, 2.0]) {
      for (final name in ['data', 'empty', 'loading', 'error', 'offline']) {
        testWidgets('dashboard $name ${dark ? 'dark' : 'light'} text$scale', (
          tester,
        ) async {
          final (boundary, _) = await _mount(
            tester,
            _Scheme(_state(name)),
            dark: dark,
            scale: scale,
          );
          final file =
              'dashboard-$name-${dark ? 'dark' : 'light'}-390-text${scale.toInt()}';
          expect(
            find.text('Información no verificada por falta de conexión.'),
            name == 'offline' ? findsOneWidget : findsNothing,
          );
          await _capture(tester, boundary, '$file-top');
          await tester.scrollUntilVisible(
            find.text('Consultas'),
            250,
            scrollable: find.byType(Scrollable).first,
          );
          await tester.pump(const Duration(milliseconds: 100));
          await _capture(tester, boundary, '$file-actions');
          final ratios = <double>[];
          for (final action in [
            'Mi Esquema',
            'Documentos',
            'Certificado',
            'Historial',
            'Consultas',
          ]) {
            final finder = find.descendant(
              of: find.byType(InkWell),
              matching: find.text(action),
            );
            final label = tester.widget<Text>(finder);
            final context = tester.element(finder);
            ratios.add(
              _contrast(
                label.style!.color!,
                Theme.of(context).colorScheme.surface,
              ),
            );
          }
          final ratio = ratios.reduce((a, b) => a < b ? a : b);
          measurements.add({
            'state': name,
            'theme': dark ? 'dark' : 'light',
            'text_scale': scale,
            'action_label_contrast': ratio,
          });
          expect(ratio, greaterThanOrEqualTo(4.5));
          expect(tester.takeException(), isNull);
          // Dispose the actual dashboard to cancel its notification timer.
          await tester.pumpWidget(const SizedBox());
        });
      }
    }
  }
  testWidgets(
    'manual refresh and retry use existing notifier; loading disables refresh',
    (tester) async {
      final scheme = _Scheme(_state('data'));
      await _mount(tester, scheme);
      await tester.tap(find.byTooltip('Actualizar estadísticas'));
      await tester.pump();
      expect(scheme.forced, 1);
      scheme.updateState(_state('loading'));
      await tester.pump();
      expect(
        tester
            .widget<IconButton>(
              find.byWidgetPredicate(
                (widget) =>
                    widget is IconButton &&
                    widget.tooltip == 'Actualizar estadísticas',
              ),
            )
            .onPressed,
        isNull,
      );
      scheme.updateState(_state('error'));
      await tester.pump();
      await tester.tap(find.text('Reintentar'));
      await tester.pump();
      expect(scheme.forced, 2);
      expect(find.text('Bienvenido'), findsOneWidget);
      await tester.pumpWidget(const SizedBox());
    },
  );
  testWidgets('quick actions preserve destination after a statistics error', (
    tester,
  ) async {
    await _mount(tester, _Scheme(_state('error')));
    await tester.ensureVisible(find.text('Documentos'));
    await tester.tap(find.text('Documentos'));
    await tester.pumpAndSettle();
    expect(find.text('Synthetic destination evidence'), findsOneWidget);
    await tester.pumpWidget(const SizedBox());
  });
  testWidgets('dashboard notification action is named for accessibility', (
    tester,
  ) async {
    await _mount(tester, _Scheme(_state('data')));
    expect(find.byTooltip('Notificaciones'), findsOneWidget);
    await tester.tap(find.byTooltip('Notificaciones'));
    await tester.pumpAndSettle();
    expect(find.text('Synthetic destination notifications'), findsOneWidget);
    await tester.pumpWidget(const SizedBox());
  });
  for (final dark in [false, true]) {
    testWidgets(
      'counter labels readable with text2 ${dark ? 'dark' : 'light'}',
      (tester) async {
        await _mount(tester, _Scheme(_state('data')), dark: dark, scale: 2);
        await tester.scrollUntilVisible(
          find.text('Aprobadas'),
          200,
          scrollable: find.byType(Scrollable).first,
        );
        for (final label in [
          'Total',
          'Aprobadas',
          'Pendientes',
          'Denegadas',
          'En revision',
        ]) {
          final paragraph =
              tester.element(find.text(label)).findRenderObject()!
                  as RenderParagraph;
          expect(
            paragraph.didExceedMaxLines,
            isFalse,
            reason: '$label must be readable',
          );
        }
        await tester.pumpWidget(const SizedBox());
      },
    );
  }
}
