import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:mocktail/mocktail.dart';
// Same offline font seam as existing Phase5B references.
// ignore: implementation_imports
import 'package:google_fonts/src/google_fonts_base.dart' as font_test;
import 'package:immuno_clinic_app/core/network/api_client.dart';
import 'package:immuno_clinic_app/core/theme/app_theme.dart';
import 'package:immuno_clinic_app/features/auth/presentation/providers/auth_provider.dart';
import 'package:immuno_clinic_app/features/student/presentation/screens/profile_screen.dart';
import '../../features/admin/presentation/screens/admin_dashboard_screen_test.dart'
    as mocks;

class _Fonts implements AssetManifest {
  final Map<String, ByteData> data;
  _Fonts(this.data);
  @override
  List<String> listAssets() => data.keys.toList();
  @override
  List<AssetMetadata>? getAssetVariants(String key) => null;
}

class _Dio extends Mock implements Dio {}

class _Api implements ApiClient {
  @override
  Dio dio = _Dio();
  final requests = <Completer<Response<dynamic>>>[];
  _Api() {
    when(() => dio.get<dynamic>('/users/me')).thenAnswer((_) {
      final request = Completer<Response<dynamic>>();
      requests.add(request);
      return request.future;
    });
  }
  void success(Map<String, dynamic> user) => requests.last.complete(
    Response(
      requestOptions: RequestOptions(path: '/users/me'),
      data: user,
    ),
  );
  void fail() {
    final options = RequestOptions(path: '/users/me');
    requests.last.completeError(
      DioException(
        requestOptions: options,
        response: Response(requestOptions: options, statusCode: 503),
      ),
    );
  }
}

Future<void> _paint(WidgetTester tester) async {
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 250));
}

Future<void> _mount(
  WidgetTester tester,
  _Api api,
  GlobalKey key,
  bool dark,
  double scale,
  double width,
) async {
  tester.view.physicalSize = Size(width, 844);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        apiClientProvider.overrideWithValue(api),
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
      ],
      child: MaterialApp(
        theme: dark ? AppTheme.darkTheme : AppTheme.lightTheme,
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(
            context,
          ).copyWith(textScaler: TextScaler.linear(scale)),
          child: child!,
        ),
        home: RepaintBoundary(key: key, child: const ProfileScreen()),
      ),
    ),
  );
  await tester.pump();
}

Future<void> _capture(WidgetTester tester, GlobalKey key, String name) async {
  if (Platform.environment['PHASE5B_SKIP_GOLDENS'] == '1') return;
  await expectLater(
    find.byKey(key),
    matchesGoldenFile(
      '../../../../docs/ui/evidence/phase5b/student-profile/flutter-$name.png',
    ),
  );
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  final fixture =
      jsonDecode(
            File(
              '../docs/ui/fixtures/phase5b-student-profile.json',
            ).readAsStringSync(),
          )
          as Map<String, dynamic>;
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
    font_test.assetManifest = null;
    GoogleFonts.config.allowRuntimeFetching = true;
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMessageHandler('flutter/assets', null);
  });
  for (final dark in [false, true]) {
    final theme = dark ? 'dark' : 'light';
    testWidgets('profile initial load, error/retry and absent fields $theme', (
      tester,
    ) async {
      final api = _Api(), key = GlobalKey();
      await _mount(tester, api, key, dark, 1, 390);
      expect(tester.takeException(), isNull);
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
      await _capture(tester, key, '$theme-loading-390');
      api.fail();
      await _paint(tester);
      expect(find.text('Reintentar'), findsOneWidget);
      await _capture(tester, key, '$theme-error-390');
      await tester.tap(find.text('Reintentar'));
      await _paint(tester);
      expect(api.requests.length, 2);
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
      await _capture(tester, key, '$theme-retrying-390');
      api.success({...fixture, 'profile': null});
      await _paint(tester);
      expect(find.text('No registrado'), findsWidgets);
      await _capture(tester, key, '$theme-absent-390');
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox.shrink());
    });
    for (final width in [320.0, 390.0]) {
      for (final scale in [1.0, 2.0]) {
        testWidgets('profile full text $theme width$width scale$scale', (
          tester,
        ) async {
          final api = _Api(), key = GlobalKey();
          await _mount(tester, api, key, dark, scale, width);
          expect(tester.takeException(), isNull);
          api.success(fixture);
          await _paint(tester);
          final email = find.text(fixture['email'] as String);
          expect(email, findsOneWidget);
          final text = tester.renderObject<RenderParagraph>(email);
          expect(text.didExceedMaxLines, isFalse);
          expect(tester.getRect(email).right, lessThanOrEqualTo(width));
          await _capture(
            tester,
            key,
            '$theme-data-${width.toInt()}-text${scale.toInt()}',
          );
          await tester.scrollUntilVisible(
            find.text('Programa'),
            250,
            scrollable: find.byType(Scrollable).first,
          );
          await _paint(tester);
          expect(
            find.text((fixture['profile'] as Map)['program'] as String),
            findsOneWidget,
          );
          await _capture(
            tester,
            key,
            '$theme-details-${width.toInt()}-text${scale.toInt()}',
          );
          expect(tester.takeException(), isNull);
          await tester.pumpWidget(const SizedBox.shrink());
        });
      }
    }
  }
}
