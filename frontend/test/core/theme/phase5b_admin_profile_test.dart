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
    when(
      () => dio.get<List<int>>(
        '/certificates/signature/active/image',
        options: any(named: 'options'),
      ),
    ).thenAnswer(
      (_) async => throw DioException(
        requestOptions: RequestOptions(
          path: '/certificates/signature/active/image',
        ),
        response: Response(
          requestOptions: RequestOptions(
            path: '/certificates/signature/active/image',
          ),
          statusCode: 404,
        ),
      ),
    );

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
  String role,
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
            AuthState(
              isAuthenticated: true,
              role: role,
              userId: 'synthetic-admin',
              email: 'admin@example.com',
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
      '../../../../docs/ui/evidence/phase5b/admin-profile/flutter-$name.png',
    ),
  );
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  const fixture = <String, dynamic>{
    'id': 'synthetic-admin',
    'email': 'admin@example.com',
    'role': 'admin',
    'is_active': true,
    'must_change_password': false,
    'created_at': '2026-01-01T12:00:00Z',
    'profile': {
      'id': 'synthetic-profile',
      'first_name': 'Synthetic',
      'last_name': 'Administrator',
      'job_title': 'Cargo sintético',
      'sex': 'female',
      'program': 'Medicina',
      'campus': 'Bogotá',
    },
  };
  final changed = {
    ...fixture,
    'profile': {
      ...(fixture['profile'] as Map<String, dynamic>),
      'first_name': 'Updated',
      'job_title': 'Cargo actualizado',
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

  Future<void> edit(WidgetTester t) async {
    await t.tap(find.byTooltip('Editar'));
    await _paint(t);
    for (final field in {
      'Nombre': 'Updated',
      'Cargo': 'Cargo actualizado',
    }.entries) {
      final f = find.widgetWithText(TextFormField, field.key);
      await t.ensureVisible(f);
      await _paint(t);
      await t.enterText(f, field.value);
    }
  }

  Future<VoidCallback> save(WidgetTester t) async {
    final f = find.widgetWithText(ElevatedButton, 'Guardar');
    await t.scrollUntilVisible(
      f,
      200,
      scrollable: find.byType(Scrollable).first,
    );
    await t.ensureVisible(f);
    await _paint(t);
    return t.widget<ElevatedButton>(f).onPressed!;
  }

  ProfileNotifier state(WidgetTester t) => ProviderScope.containerOf(
    t.element(find.byType(ProfileScreen)),
  ).read(profileProvider.notifier);
  Future<void> checkDraft(WidgetTester t) async {
    final f = find.widgetWithText(TextFormField, 'Nombre');
    await t.scrollUntilVisible(
      f,
      -250,
      scrollable: find.byType(Scrollable).first,
    );
    await t.ensureVisible(f);
    await _paint(t);
    expect(t.widget<TextFormField>(f).controller!.text, 'Updated');
  }

  for (final role in ['admin', 'app_admin']) {
    final user = {...fixture, 'role': role};
    final updated = {...changed, 'role': role};
    for (final status in [401, 403, 503]) {
      for (final editing in [false, true]) {
        testWidgets(
          '$role GET $status editing=$editing hides data and restores draft',
          (t) async {
            final api = _Api();
            await _mount(t, api, GlobalKey(), false, 1, 390, role);
            api.success(user);
            await _paint(t);
            if (editing) await edit(t);
            final read = state(t).loadProfile();
            api.fail(status);
            await read;
            await _paint(t);
            expect(find.byType(TextFormField), findsNothing);
            expect(find.byTooltip('Editar'), findsNothing);
            expect(find.text('PRIVATE_DIAGNOSTIC'), findsNothing);
            final retry = t
                .widget<ElevatedButton>(
                  find.widgetWithText(ElevatedButton, 'Reintentar'),
                )
                .onPressed!;
            retry();
            retry();
            await _paint(t);
            expect(api.requests.length, 3);
            api.success(user);
            await _paint(t);
            if (editing) {
              await checkDraft(t);
            } else {
              expect(find.byTooltip('Editar'), findsOneWidget);
            }
            expect(api.writes, isEmpty);
            expect(t.takeException(), isNull);
          },
        );
      }
    }
    for (final dark in [false, true]) {
      testWidgets(
        '$role confirmed PUT GET503 ${dark ? 'dark' : 'light'} recovery golden',
        (t) async {
          final api = _Api(), key = GlobalKey();
          await _mount(t, api, key, dark, 1, 390, role);
          api.success(user);
          await _paint(t);
          await edit(t);
          final action = await save(t);
          action();
          action();
          await _paint(t);
          expect(api.writes.length, 1);
          expect(api.payloads.single['first_name'], 'Updated');
          expect(api.payloads.single['job_title'], 'Cargo actualizado');
          expect(api.payloads.single.containsKey('program'), isFalse);
          expect(api.payloads.single.containsKey('campus'), isFalse);
          for (final f in t.widgetList<TextFormField>(
            find.byType(TextFormField),
          )) {
            expect(f.enabled, isFalse);
          }
          api.saved(updated);
          await _paint(t);
          api.fail(503);
          await _paint(t);
          expect(find.text(confirmed), findsOneWidget);
          expect(find.text('Perfil actualizado'), findsNothing);
          await _capture(
            t,
            key,
            '$role-saved-get503-${dark ? 'dark' : 'light'}-390',
          );
          await t.tap(find.text('Reintentar'));
          await _paint(t);
          api.success(updated);
          await _paint(t);
          expect(find.byTooltip('Editar'), findsOneWidget);
          expect(api.writes.length, 1);
          expect(api.requests.length, 3);
          expect(t.takeException(), isNull);
        },
      );
    }
    testWidgets(
      '$role failed PUT preserves draft after GET error and explicit retry writes once',
      (t) async {
        final api = _Api();
        await _mount(t, api, GlobalKey(), false, 1, 390, role);
        api.success(user);
        await _paint(t);
        await edit(t);
        (await save(t))();
        await _paint(t);
        api.writes.last.completeError(api.failure(503));
        await _paint(t);
        final read = state(t).loadProfile();
        api.fail(403);
        await read;
        await _paint(t);
        expect(
          find.text('No se pudo guardar el perfil. Intenta nuevamente.'),
          findsOneWidget,
        );
        await t.tap(find.text('Reintentar'));
        await _paint(t);
        api.success(user);
        await _paint(t);
        await checkDraft(t);
        expect(api.writes.length, 1);
        (await save(t))();
        await _paint(t);
        api.saved(updated);
        await _paint(t);
        api.success(updated);
        await _paint(t);
        expect(api.writes.length, 2);
        expect(find.byTooltip('Editar'), findsOneWidget);
        expect(t.takeException(), isNull);
      },
    );
    testWidgets('$role late failed write after dispose is safe', (t) async {
      final api = _Api();
      await _mount(t, api, GlobalKey(), false, 1, 390, role);
      api.success(user);
      await _paint(t);
      await edit(t);
      (await save(t))();
      await _paint(t);
      await t.pumpWidget(const SizedBox());
      api.writes.last.completeError(api.failure(503));
      await _paint(t);
      expect(t.takeException(), isNull);
    });
  }

  testWidgets('admin profile wraps long read-only values at narrow width', (
    t,
  ) async {
    final api = _Api();
    await _mount(t, api, GlobalKey(), false, 2, 320, 'admin');
    const email =
        'synthetic-address-segment-synthetic-address-segment-synthetic-address-segment@example.invalid';
    const firstName = 'Synthetic Name With Multiple Long Segments';
    const lastName = 'Long Last Name For Narrow Screen';
    const jobTitle =
        'Synthetic Administrative Role Synthetic Administrative Role';
    const program = 'Synthetic Academic Program Synthetic Academic Program';
    const campus = 'Synthetic Campus Location Synthetic Campus Location';
    final longProfile = {
      ...fixture,
      'email': email,
      'profile': {
        ...(fixture['profile'] as Map<String, dynamic>),
        'first_name': firstName,
        'last_name': lastName,
        'job_title': jobTitle,
        'program': program,
        'campus': campus,
      },
    };
    api.success(longProfile);
    await _paint(t);

    for (final value in ['$firstName $lastName', email, jobTitle]) {
      expect(
        find.byWidgetPredicate(
          (widget) => widget is Text && widget.data == value,
        ),
        findsAtLeastNWidgets(1),
        reason: 'Profile text should retain the complete value: $value',
      );
    }
    await t.drag(find.byType(ListView).first, const Offset(0, -1600));
    await _paint(t);
    for (final value in [program, campus]) {
      expect(
        find.byWidgetPredicate(
          (widget) => widget is Text && widget.data == value,
        ),
        findsAtLeastNWidgets(1),
        reason: 'Profile text should retain the complete value: $value',
      );
    }
    expect(t.takeException(), isNull);
  });
}
