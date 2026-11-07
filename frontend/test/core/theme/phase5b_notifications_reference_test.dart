import 'dart:convert';
import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
// The package's visibleForTesting seam lets real local fonts load offline.
// ignore: implementation_imports
import 'package:google_fonts/src/google_fonts_base.dart' as font_test;
import 'package:immuno_clinic_app/core/theme/app_theme.dart';
import 'package:immuno_clinic_app/features/shared/data/models/notification_model.dart';
import 'package:immuno_clinic_app/features/shared/presentation/providers/notification_provider.dart';
import 'package:immuno_clinic_app/features/shared/presentation/screens/notifications_screen.dart';

class _LocalFonts implements AssetManifest {
  final Map<String, ByteData> data;
  _LocalFonts(this.data);
  @override
  List<String> listAssets() => data.keys.toList();
  @override
  List<AssetMetadata>? getAssetVariants(String key) => null;
}

// Only presentation state is controlled. Real API/permissions are tested in Chrome.
class _Notifications extends StateNotifier<NotificationState>
    implements NotificationNotifier {
  _Notifications(super.state);
  final marked = <String>[];
  int get unreadCount => state.unreadCount;
  @override
  Future<void> load({
    bool forceRefresh = false,
    bool showLoading = true,
  }) async {}
  @override
  Future<void> markRead(String id) async {
    marked.add(id);
    final items = state.notifications
        .map((n) => n.id == id ? n.markRead() : n)
        .toList();
    state = NotificationState(
      notifications: items,
      unreadCount: items.where((n) => !n.isRead).length,
    );
  }

  @override
  Future<void> markCategoryRead(String category) async {}
}

List<NotificationModel> _fixture() {
  final data =
      jsonDecode(
            File(
              '../docs/ui/fixtures/phase5b-notifications.json',
            ).readAsStringSync(),
          )
          as List;
  return data.indexed
      .map(
        (pair) => NotificationModel.fromJson({
          ...Map<String, dynamic>.from(pair.$2 as Map),
          'id': 'synthetic-${pair.$1}',
          'action_path': '/student/profile',
        }),
      )
      .toList();
}

Future<(GlobalKey, GoRouter)> _mount(
  WidgetTester tester,
  _Notifications notifier, {
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
    initialLocation: '/student/notifications',
    routes: [
      GoRoute(
        path: '/student/notifications',
        builder: (_, _) => const NotificationsScreen(),
      ),
      GoRoute(
        path: '/student/profile',
        builder: (_, _) => const Scaffold(body: Text('Synthetic profile')),
      ),
    ],
  );
  addTearDown(router.dispose);
  await tester.pumpWidget(
    ProviderScope(
      overrides: [notificationProvider.overrideWith((ref) => notifier)],
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
  await tester.pump(const Duration(milliseconds: 100));
  return (boundary, router);
}

double _contrast(Color a, Color b) {
  final x = a.computeLuminance(), y = b.computeLuminance();
  return ((x > y ? x : y) + .05) / ((x > y ? y : x) + .05);
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
    final materialBytes = await rootBundle.load(
      'fonts/MaterialIcons-Regular.otf',
    );
    font_test.assetManifest = _LocalFonts(fonts);
    GoogleFonts.config.allowRuntimeFetching = false;
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMessageHandler(
          'flutter/assets',
          (message) async =>
              fonts[utf8.decode(
                message!.buffer.asUint8List(
                  message.offsetInBytes,
                  message.lengthInBytes,
                ),
              )],
        );
    // Real Material Icons font, supplied by the test runner's bundle.
    final loader = FontLoader('MaterialIcons')
      ..addFont(Future.value(materialBytes));
    await loader.load();
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

  for (final dark in [false, true]) {
    for (final scale in [1.0, 2.0]) {
      for (final retained in [false, true]) {
        testWidgets(
          'error reference ${dark ? 'dark' : 'light'} text $scale retained $retained',
          (tester) async {
            final (boundary, _) = await _mount(
              tester,
              _Notifications(
                NotificationState(
                  errorMessage: 'No se pudieron cargar las notificaciones.',
                  notifications: retained ? _fixture() : [],
                  unreadCount: retained ? 2 : 0,
                ),
              ),
              dark: dark,
              scale: scale,
            );
            expect(
              find.text('No se pudieron cargar las notificaciones.'),
              findsOneWidget,
            );
            expect(find.text('Reintentar'), findsOneWidget);
            final context = tester.element(find.text('Reintentar'));
            final button = tester.widget<TextButton>(
              find.widgetWithText(TextButton, 'Reintentar'),
            );
            final foreground =
                button.style?.foregroundColor?.resolve({}) ??
                Theme.of(
                  context,
                ).textButtonTheme.style!.foregroundColor!.resolve({})!;
            final background = Theme.of(context).scaffoldBackgroundColor;
            final contrast = _contrast(foreground, background);
            measurements.add({
              'state': retained ? 'error-retained' : 'error-initial',
              'theme': dark ? 'dark' : 'light',
              'text_scale': scale,
              'foreground': foreground.toARGB32().toRadixString(16),
              'background': background.toARGB32().toRadixString(16),
              'retry_contrast': contrast,
            });
            expect(contrast, greaterThanOrEqualTo(4.5));
            expect(find.text('No tienes notificaciones'), findsNothing);
            if (retained) {
              expect(find.text('Synthetic notice 1'), findsOneWidget);
            }
            expect(tester.takeException(), isNull);
            final semantics = tester.ensureSemantics();
            try {
              await expectLater(
                tester,
                meetsGuideline(labeledTapTargetGuideline),
              );
              await expectLater(
                tester,
                meetsGuideline(androidTapTargetGuideline),
              );
            } finally {
              semantics.dispose();
            }
            final destination = Platform.environment['PHASE5B_ARTIFACT_DIR'];
            if (destination != null) {
              final render =
                  boundary.currentContext!.findRenderObject()!
                      as RenderRepaintBoundary;
              final image = (await tester.runAsync(
                () => render.toImage(pixelRatio: 1),
              ))!;
              try {
                final bytes = (await tester.runAsync(
                  () => image.toByteData(format: ui.ImageByteFormat.png),
                ))!;
                await tester.runAsync(() async {
                  await Directory(destination).create(recursive: true);
                  await File(
                    '$destination/flutter-notifications-error-${retained ? 'retained' : 'initial'}-${dark ? 'dark' : 'light'}-390-text${scale.toInt()}.png',
                  ).writeAsBytes(bytes.buffer.asUint8List());
                });
              } finally {
                image.dispose();
              }
            }
          },
        );
      }
    }
    for (final scale in [1.0, 2.0]) {
      for (final state in ['unread', 'read', 'empty', 'loading']) {
        testWidgets('reference $state ${dark ? 'dark' : 'light'} text $scale', (
          tester,
        ) async {
          final items = ['unread', 'read'].contains(state)
              ? _fixture()
              : <NotificationModel>[];
          final notifier = _Notifications(
            NotificationState(
              notifications: state == 'read'
                  ? items.map((n) => n.markRead()).toList()
                  : items,
              unreadCount: state == 'unread' ? items.length : 0,
              isLoading: state == 'loading',
            ),
          );
          final (boundary, _) = await _mount(
            tester,
            notifier,
            dark: dark,
            scale: scale,
          );
          expect(
            tester.takeException(),
            isNull,
            reason: 'No layout or font error',
          );
          if (state == 'loading') {
            expect(find.byType(CircularProgressIndicator), findsOneWidget);
          }
          if (state == 'empty') {
            expect(find.text('No tienes notificaciones'), findsOneWidget);
          }
          if (items.isNotEmpty) {
            expect(find.text('Synthetic notice 1'), findsOneWidget);
          }
          if (state == 'unread') {
            expect(
              tester.getRect(find.text('2')).right,
              lessThanOrEqualTo(390),
              reason: 'Unread count remains inside viewport',
            );
          }
          expect(notifier.marked, isEmpty);
          // Compare the checked-in reference BEFORE any optional export.
          // Never regenerate a golden as part of checking it.
          await expectLater(
            find.byKey(boundary),
            matchesGoldenFile(
              '../../../../docs/ui/evidence/phase5b/notifications-comparison/after-flutter-notifications-$state-${dark ? 'dark' : 'light'}-390-text${scale.toInt()}.png',
            ),
          );
          final destination = Platform.environment['PHASE5B_ARTIFACT_DIR'];
          if (destination != null) {
            final render =
                boundary.currentContext!.findRenderObject()!
                    as RenderRepaintBoundary;
            final image = (await tester.runAsync(
              () => render.toImage(pixelRatio: 1),
            ))!;
            try {
              final bytes = (await tester.runAsync(
                () => image.toByteData(format: ui.ImageByteFormat.png),
              ))!;
              await tester.runAsync(() async {
                await Directory(destination).create(recursive: true);
                final prefix =
                    Platform.environment['PHASE5B_CAPTURE_PREFIX'] ?? 'after';
                await File(
                  '$destination/$prefix-flutter-notifications-$state-${dark ? 'dark' : 'light'}-390-text${scale.toInt()}.png',
                ).writeAsBytes(bytes.buffer.asUint8List());
              });
            } finally {
              image.dispose();
            }
          }
        });
      }
    }
    testWidgets('empty contrast ${dark ? 'dark' : 'light'}', (tester) async {
      await _mount(
        tester,
        _Notifications(const NotificationState()),
        dark: dark,
      );
      final label = tester.widget<Text>(find.text('No tienes notificaciones'));
      final context = tester.element(find.text('No tienes notificaciones'));
      final color =
          label.style?.color ?? DefaultTextStyle.of(context).style.color!;
      measurements.add({
        'state': 'empty',
        'theme': dark ? 'dark' : 'light',
        'foreground': color.toARGB32().toRadixString(16),
        'background': Theme.of(
          context,
        ).scaffoldBackgroundColor.toARGB32().toRadixString(16),
        'contrast': _contrast(color, Theme.of(context).scaffoldBackgroundColor),
        'fontFamily':
            DefaultTextStyle.of(context).style.fontFamily ?? 'unknown',
        'fontSource': 'local Inter verified against google_fonts 6.3.3',
      });
      expect(
        _contrast(color, Theme.of(context).scaffoldBackgroundColor),
        greaterThanOrEqualTo(4.5),
      );
    });
  }
  testWidgets(
    'independent read action has a label, changes count and never navigates',
    (tester) async {
      final semantics = tester.ensureSemantics();
      try {
        final notifier = _Notifications(
          NotificationState(notifications: _fixture(), unreadCount: 2),
        );
        await _mount(tester, notifier);
        final mark = find.byTooltip('Marcar como leída').first;
        expect(mark, findsOneWidget);
        await expectLater(tester, meetsGuideline(labeledTapTargetGuideline));
        await expectLater(tester, meetsGuideline(androidTapTargetGuideline));
        await tester.tap(mark);
        await tester.pumpAndSettle();
        expect(notifier.marked, ['synthetic-0']);
        expect(notifier.unreadCount, 1);
        expect(find.text('Synthetic profile'), findsNothing);
        expect(find.bySemanticsLabel(RegExp(r'\bLeída\b')), findsWidgets);
      } finally {
        semantics.dispose();
      }
    },
  );
  testWidgets('opening unread marks once and uses its destination', (
    tester,
  ) async {
    final notifier = _Notifications(
      NotificationState(notifications: _fixture(), unreadCount: 2),
    );
    await _mount(tester, notifier);
    await tester.tap(find.text('Synthetic notice 1'));
    await tester.pumpAndSettle();
    expect(notifier.marked, ['synthetic-0']);
    expect(find.text('Synthetic profile'), findsOneWidget);
  });
  testWidgets('read notices do not expose read mutation', (tester) async {
    final notifier = _Notifications(
      NotificationState(
        notifications: _fixture().map((n) => n.markRead()).toList(),
      ),
    );
    await _mount(tester, notifier, width: 320, scale: 2);
    expect(tester.takeException(), isNull);
    expect(find.byTooltip('Marcar como leída'), findsNothing);
    expect(notifier.marked, isEmpty);
  });
}
