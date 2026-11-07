import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
// Same offline font seam as the existing Phase5B references.
// ignore: implementation_imports
import 'package:google_fonts/src/google_fonts_base.dart' as font_test;
import 'package:mocktail/mocktail.dart';
import 'package:immuno_clinic_app/core/network/api_client.dart';
import 'package:immuno_clinic_app/core/theme/app_theme.dart';
import 'package:immuno_clinic_app/features/auth/presentation/providers/auth_provider.dart';
import 'package:immuno_clinic_app/features/shared/presentation/screens/audit_history_screen.dart';
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
  final reads = <Completer<Response<dynamic>>>[],
      paths = <String>[],
      pages = <int>[];
  _Api() {
    when(
      () => dio.get<dynamic>(
        any(),
        queryParameters: any(named: 'queryParameters'),
      ),
    ).thenAnswer((call) {
      paths.add(call.positionalArguments.first as String);
      final params = call.namedArguments[#queryParameters] as Map;
      pages.add(params['page'] as int);
      expect(params['page_size'], 20);
      expect(params['include_self'], true);
      final r = Completer<Response<dynamic>>();
      reads.add(r);
      return r.future;
    });
  }
  void loaded({bool empty = false}) => reads.last.complete(
    Response(
      requestOptions: RequestOptions(path: paths.last),
      data: {
        'page': pages.last,
        'page_size': 20,
        'total': empty ? 0 : 21,
        'total_pages': empty ? 0 : 2,
        'has_next': !empty && pages.last < 2,
        'has_previous': !empty && pages.last > 1,
        'items': empty
            ? []
            : [
                {
                  'id': 'synthetic-event',
                  'action': 'profile.updated',
                  'actor': null,
                  'created_at': '2026-01-01T10:00:00Z',
                  'details': {'notes': 'Synthetic authorized history'},
                },
              ],
      },
    ),
  );
  void failed(int status) => reads.last.completeError(
    DioException(
      requestOptions: RequestOptions(path: paths.last),
      response: Response(
        requestOptions: RequestOptions(path: paths.last),
        statusCode: status,
        data: {'message': 'PRIVATE_DIAGNOSTIC'},
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
  String role,
  GlobalKey key, {
  bool dark = false,
}) async {
  t.view.physicalSize = const Size(390, 844);
  t.view.devicePixelRatio = 1;
  addTearDown(t.view.resetPhysicalSize);
  addTearDown(t.view.resetDevicePixelRatio);
  await t.pumpWidget(
    ProviderScope(
      overrides: [
        apiClientProvider.overrideWithValue(api),
        authStateProvider.overrideWith(
          (ref) => mocks.MockAuthNotifier(
            AuthState(
              isAuthenticated: true,
              userId: 'synthetic-user',
              role: role,
              email: 'synthetic@example.invalid',
            ),
          ),
        ),
      ],
      child: MaterialApp(
        theme: dark ? AppTheme.darkTheme : AppTheme.lightTheme,
        home: RepaintBoundary(key: key, child: const AuditHistoryScreen()),
      ),
    ),
  );
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

  for (final role in ['student', 'admin', 'app_admin']) {
    for (final status in [401, 403, 404, 429, 500, 503]) {
      testWidgets(
        '$role failed GET$status hides cached data/pager and shares retry',
        (t) async {
          final api = _Api();
          await _mount(t, api, role, GlobalKey());
          api.loaded();
          await _paint(t);
          expect(
            api.paths.single,
            role == 'student' ? '/audit/me/page' : '/audit/admin/page',
          );
          await t.tap(find.text('Siguiente'));
          await _paint(t);
          api.failed(status);
          await _paint(t);
          const messages = {
            401: 'Tu sesión expiró. Inicia sesión nuevamente.',
            403: 'No tienes permiso para consultar esta información.',
            404: 'No se encontró la información solicitada.',
            429: 'Demasiadas solicitudes. Espera antes de reintentar.',
            500: 'Ocurrió un error en el servidor. Intenta nuevamente.',
            503: 'El servicio no está disponible temporalmente.',
          };
          expect(find.text(messages[status]!), findsOneWidget);
          expect(find.text('No hay cambios registrados'), findsNothing);
          expect(
            find.text('Comentario: Synthetic authorized history'),
            findsNothing,
          );
          expect(find.text('Anterior'), findsNothing);
          expect(find.textContaining('PRIVATE_DIAGNOSTIC'), findsNothing);
          final retry = find.widgetWithText(TextButton, 'Reintentar');
          await t.tap(retry);
          await t.tap(retry);
          await _paint(t);
          expect(api.reads.length, 3);
          expect(t.widget<TextButton>(retry).onPressed, isNull);
          api.loaded();
          await _paint(t);
          expect(api.pages, [1, 2, 2]);
          expect(find.text('Perfil actualizado'), findsOneWidget);
        },
      );
    }
    testWidgets('$role initial loading and successful empty page differ', (
      t,
    ) async {
      final api = _Api();
      await _mount(t, api, role, GlobalKey());
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
      expect(find.text('No hay cambios registrados'), findsNothing);
      api.loaded(empty: true);
      await _paint(t);
      expect(find.text('No hay cambios registrados'), findsOneWidget);
      expect(find.text('Reintentar'), findsNothing);
    });
    for (final dark in [false, true]) {
      testWidgets('$role read-error reference ${dark ? "dark" : "light"}', (
        t,
      ) async {
        final api = _Api(), key = GlobalKey();
        await _mount(t, api, role, key, dark: dark);
        api.failed(503);
        await _paint(t);
        if (Platform.environment['PHASE5B_SKIP_GOLDENS'] != '1') {
          await expectLater(
            find.byKey(key),
            matchesGoldenFile(
              '../../../../docs/ui/evidence/phase5b/history-recovery/flutter-$role-${dark ? "dark" : "light"}-390.png',
            ),
          );
        }
      });
    }
  }
  testWidgets(
    'same-tick page clicks cannot increment the displayed page twice',
    (t) async {
      final api = _Api();
      await _mount(t, api, 'student', GlobalKey());
      api.loaded();
      await _paint(t);
      final next = find.widgetWithText(TextButton, 'Siguiente');
      await t.tap(next);
      await t.tap(next);
      await _paint(t);
      expect(api.reads.length, 2);
      expect(api.pages, [1, 2]);
      api.loaded();
      await _paint(t);
      expect(find.text('Página 2 de 2'), findsOneWidget);
    },
  );
  testWidgets('disposed read completion cannot update the previous screen', (
    t,
  ) async {
    final api = _Api();
    await _mount(t, api, 'student', GlobalKey());
    await t.pumpWidget(const SizedBox());
    api.failed(503);
    await _paint(t);
    expect(t.takeException(), isNull);
  });
}
