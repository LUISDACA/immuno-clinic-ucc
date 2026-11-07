import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
// Same offline font seam as the other Phase5B references.
// ignore: implementation_imports
import 'package:google_fonts/src/google_fonts_base.dart' as font_test;
import 'package:immuno_clinic_app/core/theme/app_theme.dart';
import 'package:immuno_clinic_app/features/auth/presentation/providers/auth_provider.dart';
import 'package:immuno_clinic_app/features/shared/data/datasources/communication_remote_ds.dart';
import 'package:immuno_clinic_app/features/shared/presentation/providers/notification_provider.dart';
import 'package:immuno_clinic_app/features/shared/presentation/screens/communication_detail_screen.dart';
import '../features/admin/presentation/screens/admin_dashboard_screen_test.dart'
    as mocks;

class _Fonts implements AssetManifest {
  final Map<String, ByteData> data;
  _Fonts(this.data);
  @override
  List<String> listAssets() => data.keys.toList();
  @override
  List<AssetMetadata>? getAssetVariants(String key) => null;
}

class _Remote implements CommunicationRemoteDataSource {
  final pending = Completer<Map<String, dynamic>>();
  int writes = 0;
  final thread = <String, dynamic>{
    'id': 'synthetic-thread',
    'subject': 'Synthetic conversation',
    'status': 'open',
    'student': {
      'id': 'synthetic-student',
      'name': 'Synthetic student',
      'email': 'student@example.invalid',
      'role': 'student',
    },
    'created_by': {
      'id': 'synthetic-admin',
      'name': 'Synthetic admin',
      'email': 'admin@example.invalid',
      'role': 'admin',
    },
    'recipient': {
      'id': 'synthetic-student',
      'name': 'Synthetic student',
      'email': 'student@example.invalid',
      'role': 'student',
    },
    'last_message_at': '2026-10-01T12:00:00Z',
    'messages': [
      {
        'id': 'synthetic-own',
        'body': 'Synthetic own body',
        'created_at': '2026-10-01T12:00:00Z',
        'sender': {
          'id': 'synthetic-student',
          'name': 'Synthetic student',
          'role': 'student',
        },
      },
      {
        'id': 'synthetic-received',
        'body': 'Synthetic received body',
        'created_at': '2026-10-01T12:00:00Z',
        'sender': {
          'id': 'synthetic-admin',
          'name': 'Synthetic admin',
          'role': 'admin',
        },
      },
    ],
  };
  @override
  Future<Map<String, dynamic>> getThread(String id) async => thread;
  @override
  Future<Map<String, dynamic>> sendMessage(String id, String message) {
    writes++;
    return pending.future;
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
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
        '../../../docs/ui/evidence/phase5b/communications-recovery/after-flutter-$name.png',
      ),
    );
  }
  final directory = Platform.environment['PHASE5B_ARTIFACT_DIR'];
  if (directory == null) return;
  final render =
      key.currentContext!.findRenderObject()! as RenderRepaintBoundary;
  final image = (await tester.runAsync(() => render.toImage(pixelRatio: 1)))!;
  try {
    final bytes = (await tester.runAsync(
      () => image.toByteData(format: ui.ImageByteFormat.png),
    ))!;
    await tester.runAsync(() async {
      await Directory(directory).create(recursive: true);
      await File(
        '$directory/$prefix-flutter-$name.png',
      ).writeAsBytes(bytes.buffer.asUint8List());
    });
  } finally {
    image.dispose();
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  final measurements = <Map<String, dynamic>>[];
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
    };
    final material = await rootBundle.load('fonts/MaterialIcons-Regular.otf');
    font_test.assetManifest = _Fonts(fonts);
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
    final directory = Platform.environment['PHASE5B_ARTIFACT_DIR'];
    if (directory != null) {
      File(
        '$directory/${Platform.environment['PHASE5B_CAPTURE_PREFIX'] ?? 'after'}-flutter-measurements.json',
      ).writeAsStringSync('${jsonEncode(measurements)}\n');
    }
    font_test.assetManifest = null;
    GoogleFonts.config.allowRuntimeFetching = true;
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMessageHandler('flutter/assets', null);
  });
  for (final dark in [false, true]) {
    testWidgets(
      'own message contrast, actual pending send and reference ${dark ? 'dark' : 'light'}',
      (tester) async {
        tester.view.physicalSize = const Size(390, 844);
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);
        final remote = _Remote(),
            key = GlobalKey(),
            theme = dark ? AppTheme.darkTheme : AppTheme.lightTheme;
        await tester.pumpWidget(
          ProviderScope(
            overrides: [
              authStateProvider.overrideWith(
                (ref) => mocks.MockAuthNotifier(
                  const AuthState(
                    isAuthenticated: true,
                    role: 'student',
                    userId: 'synthetic-student',
                    email: 'student@example.invalid',
                  ),
                ),
              ),
              notificationProvider.overrideWith(
                (ref) =>
                    mocks.MockNotificationNotifier(const NotificationState()),
              ),
              communicationRemoteDataSourceProvider.overrideWithValue(remote),
            ],
            child: MaterialApp(
              theme: theme,
              home: RepaintBoundary(
                key: key,
                child: const CommunicationDetailScreen(
                  threadId: 'synthetic-thread',
                ),
              ),
            ),
          ),
        );
        await tester.pumpAndSettle();
        for (final pending in [false, true]) {
          final body = pending
              ? 'Synthetic pending body'
              : 'Synthetic own body';
          if (pending) {
            await tester.enterText(find.byType(TextField), body);
            await tester.tap(find.byIcon(Icons.send_outlined));
            await tester.pump();
            await tester.pump(const Duration(milliseconds: 250));
            expect(remote.writes, 1);
            expect(find.text('Enviando...'), findsOneWidget);
          }
          final name =
              'detail-${dark ? 'dark' : 'light'}-${pending ? 'pending' : 'sent'}-390';
          await _capture(tester, key, name);
          final finder = find.text(body), text = tester.widget<Text>(finder);
          final container = finder
              .evaluate()
              .single
              .findAncestorWidgetOfExactType<Container>()!;
          final background = (container.decoration! as BoxDecoration).color!;
          final opacity = finder
              .evaluate()
              .single
              .findAncestorWidgetOfExactType<Opacity>()!
              .opacity;
          final effectiveBackground = Color.alphaBlend(
            background.withValues(alpha: opacity),
            theme.scaffoldBackgroundColor,
          );
          final column = finder
              .evaluate()
              .single
              .findAncestorWidgetOfExactType<Column>()!;
          final ratios = column.children.whereType<Text>().map((child) {
            final foreground = Color.alphaBlend(
              child.style!.color!,
              background,
            );
            final effective = Color.alphaBlend(
              foreground.withValues(alpha: opacity),
              theme.scaffoldBackgroundColor,
            );
            return _contrast(effective, effectiveBackground);
          }).toList();
          measurements.add({
            'theme': dark ? 'dark' : 'light',
            'pending': pending,
            'opacity': opacity,
            'body_color': text.style!.color!.toARGB32(),
            'ratios': ratios,
          });
          expect(ratios, hasLength(3));
          expect(
            ratios.every((ratio) => ratio >= 4.5),
            isTrue,
            reason:
                'sender, body and timestamp/pending indicator must remain readable',
          );
        }
        await tester.pumpWidget(const SizedBox.shrink());
        remote.pending.complete(remote.thread);
      },
    );
  }
}
