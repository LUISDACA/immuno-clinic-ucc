import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
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
  final writes = <Completer<Response<dynamic>>>[];
  final payloads = <Map<String, dynamic>>[];
  _Api() {
    when(() => dio.get<dynamic>('/users/me')).thenAnswer((_) {
      final c = Completer<Response<dynamic>>();
      requests.add(c);
      return c.future;
    });
    when(
      () => dio.put<dynamic>('/users/me/profile', data: any(named: 'data')),
    ).thenAnswer((call) {
      payloads.add(
        Map<String, dynamic>.from(call.namedArguments[#data] as Map),
      );
      final c = Completer<Response<dynamic>>();
      writes.add(c);
      return c.future;
    });
  }
  void success(Map<String, dynamic> user) => requests.last.complete(
    Response(
      requestOptions: RequestOptions(path: '/users/me'),
      data: user,
    ),
  );
  void fail([int status = 503]) => requests.last.completeError(failure(status));
  DioException failure(int status) {
    final options = RequestOptions(path: '/users/me');
    return DioException(
      requestOptions: options,
      response: Response(
        requestOptions: options,
        statusCode: status,
        data: {'message': 'PRIVATE_DIAGNOSTIC'},
      ),
    );
  }

  void saved(Map<String, dynamic> user) => writes.last.complete(
    Response(
      requestOptions: RequestOptions(path: '/users/me/profile'),
      data: user,
    ),
  );
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
      '../../../../docs/ui/evidence/phase5b/profile-recovery/flutter-$name.png',
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
  final changed = {
    ...fixture,
    'profile': {
      ...fixture['profile'] as Map<String, dynamic>,
      'phone': '0000000003',
    },
  };
  const confirmed =
      'Los cambios se guardaron, pero no se pudo actualizar el perfil.';
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
  Future<void> edit(WidgetTester tester) async {
    await tester.tap(find.byTooltip('Editar'));
    await _paint(tester);
    await tester.scrollUntilVisible(
      find.text('Teléfono'),
      250,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.enterText(
      find.widgetWithText(TextFormField, 'Teléfono'),
      '0000000003',
    );
  }

  Future<void> submit(WidgetTester tester) async {
    await tester.scrollUntilVisible(
      find.text('Guardar'),
      200,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.ensureVisible(find.text('Guardar'));
    await _paint(tester);
    await tester.tap(find.text('Guardar'));
    await _paint(tester);
  }

  for (final status in [401, 403, 503]) {
    for (final editing in [false, true]) {
      testWidgets(
        'GET $status with previous data editing=$editing hides data and preserves context',
        (tester) async {
          final api = _Api(), key = GlobalKey();
          await _mount(tester, api, key, false, 1, 390);
          api.success(fixture);
          await _paint(tester);
          if (editing) await edit(tester);
          final container = ProviderScope.containerOf(
            tester.element(find.byType(ProfileScreen)),
          );
          final refresh = container
              .read(profileProvider.notifier)
              .loadProfile();
          api.fail(status);
          await refresh;
          await _paint(tester);
          expect(find.text('Reintentar'), findsOneWidget);
          expect(find.text('PRIVATE_DIAGNOSTIC'), findsNothing);
          expect(find.byTooltip('Editar'), findsNothing);
          expect(find.byType(TextFormField), findsNothing);
          final retry = tester.widget<ElevatedButton>(
            find.widgetWithText(ElevatedButton, 'Reintentar'),
          );
          retry.onPressed!();
          retry.onPressed!();
          await _paint(tester);
          expect(api.requests.length, 3);
          api.success(fixture);
          await _paint(tester);
          if (editing) {
            await tester.scrollUntilVisible(
              find.text('Teléfono'),
              250,
              scrollable: find.byType(Scrollable).first,
            );
            expect(
              tester
                  .widget<TextFormField>(
                    find.widgetWithText(TextFormField, 'Teléfono'),
                  )
                  .controller!
                  .text,
              '0000000003',
            );
          } else {
            expect(find.byTooltip('Editar'), findsOneWidget);
          }
          expect(api.writes, isEmpty);
          await tester.pumpWidget(const SizedBox.shrink());
        },
      );
    }
  }
  for (final dark in [false, true]) {
    for (final status in [403, 503]) {
      testWidgets(
        'PUT confirmed then GET $status ${dark ? 'dark' : 'light'}: no duplicate write on recovery',
        (tester) async {
          final api = _Api(), key = GlobalKey();
          await _mount(tester, api, key, dark, 1, 390);
          api.success(fixture);
          await _paint(tester);
          await edit(tester);
          await submit(tester);
          expect(api.writes.length, 1);
          expect(
            tester
                .widget<OutlinedButton>(
                  find.widgetWithText(OutlinedButton, 'Cancelar'),
                )
                .onPressed,
            isNull,
          );
          api.saved(changed);
          await _paint(tester);
          expect(api.requests.length, 2);
          api.fail(status);
          await _paint(tester);
          expect(find.text(confirmed), findsOneWidget);
          expect(find.text('Perfil actualizado'), findsNothing);
          expect(find.byTooltip('Editar'), findsNothing);
          expect(find.byType(TextFormField), findsNothing);
          await _capture(
            tester,
            key,
            'saved-get$status-${dark ? 'dark' : 'light'}-390',
          );
          await tester.tap(find.text('Reintentar'));
          await _paint(tester);
          api.success(changed);
          await _paint(tester);
          expect(find.byTooltip('Editar'), findsOneWidget);
          expect(find.text(confirmed), findsNothing);
          expect(api.writes.length, 1);
          expect(api.requests.length, 3);
          await tester.pumpWidget(const SizedBox.shrink());
        },
      );
    }
  }
  for (final dark in [false, true]) {
    testWidgets(
      'failed PUT is visible, preserves draft through read denial ${dark ? 'dark' : 'light'}',
      (tester) async {
        final api = _Api(), key = GlobalKey();
        await _mount(tester, api, key, dark, 1, 390);
        api.success(fixture);
        await _paint(tester);
        await edit(tester);
        await submit(tester);
        api.writes.last.completeError(api.failure(503));
        await _paint(tester);
        final container = ProviderScope.containerOf(
          tester.element(find.byType(ProfileScreen)),
        );
        final read = container.read(profileProvider.notifier).loadProfile();
        api.fail(403);
        await read;
        await _paint(tester);
        expect(
          find.text('No se pudo guardar el perfil. Intenta nuevamente.'),
          findsOneWidget,
        );
        await _capture(
          tester,
          key,
          'failed-put-get403-${dark ? 'dark' : 'light'}-390',
        );
        await tester.tap(find.text('Reintentar'));
        await _paint(tester);
        api.success(fixture);
        await _paint(tester);
        expect(
          find.text('No se pudo guardar el perfil. Intenta nuevamente.'),
          findsOneWidget,
        );
        await tester.scrollUntilVisible(
          find.text('Teléfono'),
          250,
          scrollable: find.byType(Scrollable).first,
        );
        expect(
          tester
              .widget<TextFormField>(
                find.widgetWithText(TextFormField, 'Teléfono'),
              )
              .controller!
              .text,
          '0000000003',
        );
        expect(api.writes.length, 1);
        await submit(tester);
        api.saved(changed);
        await _paint(tester);
        api.success(changed);
        await _paint(tester);
        expect(api.writes.length, 2);
        expect(find.byTooltip('Editar'), findsOneWidget);
        await tester.pumpWidget(const SizedBox.shrink());
      },
    );
  }
  testWidgets(
    'starting a new edit after the server returns profile:null clears an abandoned draft',
    (tester) async {
      final api = _Api(), key = GlobalKey();
      await _mount(tester, api, key, false, 1, 390);
      api.success(fixture);
      await _paint(tester);
      await edit(tester);
      await tester.scrollUntilVisible(
        find.text('Cancelar'),
        250,
        scrollable: find.byType(Scrollable).first,
      );
      await tester.ensureVisible(find.text('Cancelar'));
      await _paint(tester);
      await tester.tap(find.text('Cancelar'));
      await _paint(tester);
      final container = ProviderScope.containerOf(
        tester.element(find.byType(ProfileScreen)),
      );
      final read = container.read(profileProvider.notifier).loadProfile();
      api.success({...fixture, 'profile': null});
      await read;
      await _paint(tester);
      await tester.tap(find.byTooltip('Editar'));
      await _paint(tester);
      await tester.scrollUntilVisible(
        find.text('Teléfono'),
        250,
        scrollable: find.byType(Scrollable).first,
      );
      expect(
        tester
            .widget<TextFormField>(
              find.widgetWithText(TextFormField, 'Teléfono'),
            )
            .controller!
            .text,
        isEmpty,
      );
      expect(api.writes, isEmpty);
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );
  test(
    'confirmed PUT and failed GET preserve the query error and authoritative PUT response',
    () async {
      final api = _Api();
      final notifier = ProfileNotifier(api);
      addTearDown(notifier.dispose);
      final read = notifier.loadProfile();
      api.success(fixture);
      await read;
      final write = notifier.updateProfile(phone: '0000000003');
      api.saved(changed);
      await Future<void>.delayed(Duration.zero);
      api.fail(403);
      expect(await write, isTrue);
      expect(notifier.state.error, isNotNull);
      expect(notifier.state.profile?['profile']['phone'], '0000000003');
      expect(notifier.state.isSaving, isFalse);
    },
  );
  test(
    'failed PUT releases loading and a retry bypasses its obsolete GET',
    () async {
      final api = _Api();
      final state = ProfileNotifier(api);
      addTearDown(state.dispose);
      final oldRead = state.loadProfile();
      final old = api.requests.last;
      final write = state.updateProfile(phone: '0000000003');
      api.writes.last.completeError(api.failure(503));
      expect(await write, isFalse);
      expect(state.state.isLoading, isFalse);
      expect(state.state.isSaving, isFalse);
      final fresh = state.loadProfile();
      expect(api.requests.length, 2);
      api.success(changed);
      await fresh;
      old.complete(
        Response(
          requestOptions: RequestOptions(path: '/users/me'),
          data: fixture,
        ),
      );
      await oldRead;
      expect(state.state.profile?['profile']['phone'], '0000000003');
    },
  );
  test(
    'obsolete GET success cannot erase a confirmed PUT and subsequent denial',
    () async {
      final api = _Api();
      final notifier = ProfileNotifier(api);
      addTearDown(notifier.dispose);
      final oldRead = notifier.loadProfile(), old = api.requests.last;
      final write = notifier.updateProfile(phone: '0000000003');
      api.saved(changed);
      await Future<void>.delayed(Duration.zero);
      api.fail(403);
      expect(await write, isTrue);
      old.complete(
        Response(
          requestOptions: RequestOptions(path: '/users/me'),
          data: fixture,
        ),
      );
      await oldRead;
      expect(notifier.state.error, isNotNull);
      expect(notifier.state.profile?['profile']['phone'], '0000000003');
    },
  );
  test(
    'disposed profile provider discards pending read and write completions',
    () async {
      final api = _Api();
      final notifier = ProfileNotifier(api);
      final read = notifier.loadProfile();
      final write = notifier.updateProfile(phone: '0000000003');
      notifier.dispose();
      api.success(fixture);
      api.saved(changed);
      await read;
      expect(await write, isFalse);
      expect(api.requests.length, 1);
    },
  );
}
