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
import 'package:shared_preferences/shared_preferences.dart';
// Same offline font seam as existing Phase5B references.
// ignore: implementation_imports
import 'package:google_fonts/src/google_fonts_base.dart' as font_test;
import 'package:immuno_clinic_app/core/error/account_form_error.dart';
import 'package:immuno_clinic_app/core/router/app_router.dart';
import 'package:immuno_clinic_app/core/network/api_client.dart';
import 'package:immuno_clinic_app/core/theme/app_theme.dart';
import 'package:immuno_clinic_app/core/theme/theme_mode_provider.dart';
import 'package:immuno_clinic_app/features/auth/presentation/providers/auth_provider.dart';
import 'package:immuno_clinic_app/features/auth/presentation/screens/forgot_password_screen.dart';
import 'package:immuno_clinic_app/features/auth/presentation/screens/reset_password_screen.dart';
import 'package:immuno_clinic_app/features/shared/presentation/screens/change_password_screen.dart';
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

class _Auth extends mocks.MockAuthNotifier {
  int logouts = 0;
  final bool clearOnLogout;
  _Auth({
    bool forced = false,
    String role = 'student',
    this.clearOnLogout = false,
  }) : super(
         AuthState(
           isAuthenticated: true,
           role: role,
           userId: 'synthetic-user',
           mustChangePassword: forced,
         ),
       );
  @override
  Future<void> logout() async {
    logouts++;
    if (clearOnLogout) state = const AuthState();
  }
}

class _Api implements ApiClient {
  @override
  Dio dio = _Dio();
  final calls = <String>[],
      requests = <Completer<Response<dynamic>>>[],
      payloads = <Map<String, dynamic>>[];
  _Api() {
    when(() => dio.post<dynamic>(any(), data: any(named: 'data'))).thenAnswer((
      call,
    ) {
      calls.add(call.positionalArguments.first as String);
      payloads.add(
        Map<String, dynamic>.from(call.namedArguments[#data] as Map),
      );
      final c = Completer<Response<dynamic>>();
      requests.add(c);
      return c.future;
    });
  }
  void success() => requests.last.complete(
    Response(
      requestOptions: RequestOptions(path: calls.last),
      data: {'message': 'Synthetic safe success'},
    ),
  );
  void fail(int status) => requests.last.completeError(
    DioException(
      requestOptions: RequestOptions(path: calls.last),
      response: Response(
        requestOptions: RequestOptions(path: calls.last),
        statusCode: status,
        data: {'message': 'PRIVATE_DIAGNOSTIC', 'detail': 'PRIVATE_DIAGNOSTIC'},
      ),
    ),
  );
}

Future<void> _paint(WidgetTester t) async {
  await t.pump();
  await t.pump(const Duration(milliseconds: 250));
}

Future<void> _mount(
  WidgetTester t,
  _Api api,
  _Auth auth,
  String kind,
  GlobalKey key, {
  bool dark = false,
  double height = 844,
  double scale = 1,
}) async {
  t.view.physicalSize = Size(390, height);
  t.view.devicePixelRatio = 1;
  addTearDown(t.view.resetPhysicalSize);
  addTearDown(t.view.resetDevicePixelRatio);
  await t.pumpWidget(
    ProviderScope(
      overrides: [
        apiClientProvider.overrideWithValue(api),
        authStateProvider.overrideWith((ref) => auth),
      ],
      child: MaterialApp(
        theme: dark ? AppTheme.darkTheme : AppTheme.lightTheme,
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(
            context,
          ).copyWith(textScaler: TextScaler.linear(scale)),
          child: child!,
        ),
        home: RepaintBoundary(
          key: key,
          child: kind == 'forgot'
              ? const ForgotPasswordScreen()
              : kind == 'reset'
              ? const ResetPasswordScreen(token: 'synthetic-reset-only')
              : const ChangePasswordScreen(),
        ),
      ),
    ),
  );
  await _paint(t);
}

Future<void> _fill(WidgetTester t, String kind) async {
  final values = kind == 'forgot'
      ? {'Correo electrónico': 'synthetic@example.com'}
      : kind == 'reset'
      ? {
          'Nueva contraseña': 'SyntheticNew123!',
          'Confirmar contraseña': 'SyntheticNew123!',
        }
      : {
          'Contraseña actual': 'SyntheticOld123!',
          'Nueva contraseña': 'SyntheticNew123!',
          'Confirmar nueva contraseña': 'SyntheticNew123!',
        };
  for (final e in values.entries) {
    final f = find.widgetWithText(TextFormField, e.key);
    await t.ensureVisible(f);
    await t.pump();
    await t.enterText(f, e.value);
  }
}

Future<void> _submit(WidgetTester t, String kind, {bool twice = false}) async {
  final label = kind == 'forgot'
      ? 'Enviar instrucciones'
      : kind == 'reset'
      ? 'Cambiar Contraseña'
      : 'Cambiar contraseña';
  final b = find.widgetWithText(ElevatedButton, label);
  await t.ensureVisible(b);
  await t.pump();
  final action = t.widget<ElevatedButton>(b).onPressed!;
  action();
  if (twice) action();
  await _paint(t);
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
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

  for (final kind in ['forgot', 'reset', 'change']) {
    testWidgets('$kind invalid fields never send request', (t) async {
      final api = _Api();
      await _mount(t, api, _Auth(), kind, GlobalKey());
      await _submit(t, kind);
      expect(api.calls, isEmpty);
    });
    testWidgets(
      '$kind duplicate sends once, freezes fields and preserves success sequence',
      (t) async {
        final api = _Api(), auth = _Auth();
        await _mount(t, api, auth, kind, GlobalKey());
        await _fill(t, kind);
        await _submit(t, kind, twice: true);
        expect(api.calls.length, 1);
        for (final field in t.widgetList<TextFormField>(
          find.byType(TextFormField),
        )) {
          expect(field.enabled, isFalse);
        }
        api.success();
        await _paint(t);
        expect(auth.logouts, kind == 'change' ? 1 : 0);
        expect(
          find.text(
            kind == 'forgot'
                ? 'Correo enviado'
                : kind == 'reset'
                ? '¡Contraseña actualizada!'
                : 'Contraseña actualizada',
          ),
          findsOneWidget,
        );
        expect(t.takeException(), isNull);
      },
    );
    for (final status in [400, 401, 429, 503]) {
      testWidgets(
        '$kind HTTP $status is safe, retains draft and allows explicit retry',
        (t) async {
          final api = _Api();
          await _mount(t, api, _Auth(), kind, GlobalKey());
          await _fill(t, kind);
          await _submit(t, kind);
          api.fail(status);
          await _paint(t);
          expect(find.text('PRIVATE_DIAGNOSTIC'), findsNothing);
          if (status == 503) {
            expect(
              find.text('El servicio no está disponible temporalmente.'),
              findsOneWidget,
            );
          }
          final first = t.widget<TextFormField>(
            find.byType(TextFormField).first,
          );
          expect(first.enabled, isTrue);
          expect(first.controller!.text, isNotEmpty);
          expect(api.calls.length, 1);
          await _submit(t, kind);
          expect(api.calls.length, 2);
          api.success();
          await _paint(t);
          expect(t.takeException(), isNull);
        },
      );
    }
    for (final fail in [false, true]) {
      testWidgets(
        '$kind dispose before ${fail ? 'failure' : 'success'} is safe',
        (t) async {
          final api = _Api(), auth = _Auth();
          await _mount(t, api, auth, kind, GlobalKey());
          await _fill(t, kind);
          await _submit(t, kind);
          await t.pumpWidget(const SizedBox());
          if (fail) {
            api.fail(503);
          } else {
            api.success();
          }
          await _paint(t);
          expect(t.takeException(), isNull);
          if (kind == 'change' && !fail) {
            expect(auth.logouts, 1);
          }
        },
      );
    }
    testWidgets('$kind short viewport and large text remain scrollable', (
      t,
    ) async {
      final api = _Api();
      await _mount(t, api, _Auth(), kind, GlobalKey(), height: 568, scale: 2);
      await _fill(t, kind);
      expect(t.takeException(), isNull);
      await _submit(t, kind);
      expect(api.calls.length, 1);
      api.fail(503);
      await _paint(t);
      expect(t.takeException(), isNull);
    });
    for (final dark in [false, true]) {
      testWidgets('$kind 503 reference ${dark ? 'dark' : 'light'}', (t) async {
        final api = _Api();
        final key = GlobalKey();
        await _mount(t, api, _Auth(), kind, key, dark: dark);
        await _fill(t, kind);
        await _submit(t, kind);
        api.fail(503);
        await _paint(t);
        if (dark) {
          final text = t.widget<Text>(
            find.text('El servicio no está disponible temporalmente.'),
          );
          expect(text.style!.color, AppColors.darkTextPrimary);
          final background = kind == 'reset'
              ? Color.alphaBlend(
                  AppColors.error.withValues(alpha: .08),
                  AppColors.darkBackground,
                )
              : AppColors.darkBackground;
          final a = text.style!.color!.computeLuminance(),
              b = background.computeLuminance();
          expect((a + .05) / (b + .05), greaterThanOrEqualTo(4.5));
        }
        t.testTextInput.hide();
        await t.pump();
        if (Platform.environment['PHASE5B_SKIP_GOLDENS'] != '1') {
          await expectLater(
            find.byKey(key),
            matchesGoldenFile(
              '../../../../docs/ui/evidence/phase5b/account-forms/flutter-$kind-503-${dark ? 'dark' : 'light'}-390.png',
            ),
          );
        }
      });
    }
  }
  for (final operation in AccountFormOperation.values) {
    test('safe additional status and timeout copy for $operation', () {
      final request = RequestOptions(path: '/auth/synthetic');
      for (final status in [403, 422, 500]) {
        final error = DioException(
          requestOptions: request,
          response: Response(
            requestOptions: request,
            statusCode: status,
            data: {'message': 'PRIVATE_DIAGNOSTIC'},
          ),
        );
        expect(
          accountFormError(error, operation),
          isNot(contains('PRIVATE_DIAGNOSTIC')),
        );
        expect(
          accountFormError(error, operation),
          isNot(contains('Token inválido')),
        );
      }
      final timeout = DioException(
        requestOptions: request,
        type: DioExceptionType.connectionTimeout,
        message: 'PRIVATE_DIAGNOSTIC',
      );
      expect(accountFormError(timeout, operation), contains('tardó demasiado'));
      expect(
        accountFormError(StateError('PRIVATE_DIAGNOSTIC'), operation),
        isNot(contains('PRIVATE_DIAGNOSTIC')),
      );
    });
  }
  for (final kind in ['reset', 'change']) {
    testWidgets('$kind server errors are announced as a live region', (
      t,
    ) async {
      final semantics = t.ensureSemantics();
      try {
        final api = _Api();
        await _mount(t, api, _Auth(), kind, GlobalKey());
        await _fill(t, kind);
        await _submit(t, kind);
        api.fail(503);
        await _paint(t);

        expect(
          find.text('El servicio no está disponible temporalmente.'),
          findsOneWidget,
        );
        final liveRegion = find.byWidgetPredicate(
          (widget) =>
              widget is Semantics && widget.properties.liveRegion == true,
        );
        expect(liveRegion, findsOneWidget);
        expect(
          t
              .getSemantics(liveRegion)
              .getSemanticsData()
              .flagsCollection
              .isLiveRegion,
          isTrue,
        );
      } finally {
        semantics.dispose();
      }
    });
  }
  testWidgets('forgot password submits on the email keyboard done action', (
    t,
  ) async {
    final api = _Api();
    await _mount(t, api, _Auth(), 'forgot', GlobalKey());
    await _fill(t, 'forgot');

    await t.testTextInput.receiveAction(TextInputAction.done);
    await _paint(t);

    expect(api.calls, ['/auth/forgot-password']);
    expect(api.payloads.single, {'email': 'synthetic@example.com'});
    api.success();
    await _paint(t);
    expect(find.text('Correo enviado'), findsOneWidget);
  });

  testWidgets(
    'reset password submits on the confirmation keyboard done action',
    (t) async {
      final api = _Api();
      await _mount(t, api, _Auth(), 'reset', GlobalKey());
      await _fill(t, 'reset');

      await t.testTextInput.receiveAction(TextInputAction.done);
      await _paint(t);

      expect(api.calls, ['/auth/reset-password']);
      expect(api.payloads.single, {
        'token': 'synthetic-reset-only',
        'new_password': 'SyntheticNew123!',
      });
      api.success();
      await _paint(t);
      expect(find.text('¡Contraseña actualizada!'), findsOneWidget);
    },
  );

  testWidgets(
    'change password submits on the confirmation keyboard done action',
    (t) async {
      final api = _Api(), auth = _Auth();
      await _mount(t, api, auth, 'change', GlobalKey());
      await _fill(t, 'change');

      await t.testTextInput.receiveAction(TextInputAction.done);
      await _paint(t);

      expect(api.calls, ['/auth/change-password']);
      expect(api.payloads.single, {
        'current_password': 'SyntheticOld123!',
        'new_password': 'SyntheticNew123!',
      });
      api.success();
      await _paint(t);
      expect(auth.logouts, 1);
      expect(find.text('Contraseña actualizada'), findsOneWidget);
    },
  );

  for (final role in ['student', 'admin']) {
    testWidgets('successful $role password change redirects after logout', (
      t,
    ) async {
      SharedPreferences.setMockInitialValues({});
      final preferences = await SharedPreferences.getInstance();
      final api = _Api(), auth = _Auth(role: role, clearOnLogout: true);
      final container = ProviderContainer(
        overrides: [
          sharedPreferencesProvider.overrideWithValue(preferences),
          apiClientProvider.overrideWithValue(api),
          authStateProvider.overrideWith((ref) => auth),
        ],
      );
      addTearDown(container.dispose);
      final router = container.read(routerProvider);
      router.go('/$role/change-password');
      await t.pumpWidget(
        UncontrolledProviderScope(
          container: container,
          child: MaterialApp.router(routerConfig: router),
        ),
      );
      await _paint(t);
      await _fill(t, 'change');
      await _submit(t, 'change');
      api.success();
      await _paint(t);

      expect(auth.logouts, 1);
      expect(router.routeInformationProvider.value.uri.path, '/login');
      expect(
        find.text(
          'Contraseña actualizada. Inicia sesión con tu nueva contraseña.',
        ),
        findsOneWidget,
      );
    });
  }

  testWidgets('forced change never describes document-derived password', (
    t,
  ) async {
    await _mount(t, _Api(), _Auth(forced: true), 'change', GlobalKey());
    expect(find.textContaining('tu cédula'), findsNothing);
    expect(find.textContaining('recibida por correo'), findsOneWidget);
  });
}
