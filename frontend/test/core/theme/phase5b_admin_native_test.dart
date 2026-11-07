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
import 'package:immuno_clinic_app/features/admin/presentation/screens/admin_management_screen.dart';

class _Fonts implements AssetManifest {
  final Map<String, ByteData> data;
  _Fonts(this.data);
  @override
  List<String> listAssets() => data.keys.toList();
  @override
  List<AssetMetadata>? getAssetVariants(String key) => null;
}

class _Dio extends Mock implements Dio {}

const _row = {
  'id': 'synthetic-admin',
  'email': 'admin@example.com',
  'profile': {
    'first_name': 'Synthetic',
    'last_name': 'Admin',
    'program': 'Medicina',
    'campus': 'Bogotá',
  },
};

class _Api implements ApiClient {
  @override
  Dio dio = _Dio();
  final reads = <Completer<Response<dynamic>>>[],
      creates = <Completer<Response<dynamic>>>[],
      removes = <Completer<Response<dynamic>>>[];
  final payloads = <Map<String, dynamic>>[];
  _Api() {
    when(() => dio.get<dynamic>('/admin/academic-options')).thenAnswer(
      (_) async => Response(
        requestOptions: RequestOptions(path: '/admin/academic-options'),
        data: {
          'programs': ['Medicina', 'Enfermería'],
          'campuses': ['Bogotá', 'Cali'],
        },
      ),
    );
    when(() => dio.get<dynamic>('/admin/admins')).thenAnswer((_) {
      final c = Completer<Response<dynamic>>();
      reads.add(c);
      return c.future;
    });
    when(
      () => dio.post<dynamic>('/admin/admins', data: any(named: 'data')),
    ).thenAnswer((call) {
      payloads.add(
        Map<String, dynamic>.from(call.namedArguments[#data] as Map),
      );
      final c = Completer<Response<dynamic>>();
      creates.add(c);
      return c.future;
    });
    when(() => dio.delete<dynamic>('/admin/admins/synthetic-admin')).thenAnswer(
      (_) {
        final c = Completer<Response<dynamic>>();
        removes.add(c);
        return c.future;
      },
    );
  }
  void loaded({bool empty = false}) => reads.last.complete(
    Response(
      requestOptions: RequestOptions(path: '/admin/admins'),
      data: empty ? <dynamic>[] : [_row],
    ),
  );
  DioException failure(int status) => DioException(
    requestOptions: RequestOptions(path: '/admin/admins'),
    response: Response(
      requestOptions: RequestOptions(path: '/admin/admins'),
      statusCode: status,
      data: {'message': 'PRIVATE_DIAGNOSTIC'},
    ),
  );
  void failed(int status) => reads.last.completeError(failure(status));
  void written(bool removing) => (removing ? removes : creates).last.complete(
    Response(
      requestOptions: RequestOptions(path: '/admin/admins'),
      data: _row,
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
  GlobalKey key, {
  bool dark = false,
}) async {
  t.view.physicalSize = const Size(390, 844);
  t.view.devicePixelRatio = 1;
  addTearDown(t.view.resetPhysicalSize);
  addTearDown(t.view.resetDevicePixelRatio);
  await t.pumpWidget(
    ProviderScope(
      overrides: [apiClientProvider.overrideWithValue(api)],
      child: MaterialApp(
        theme: dark ? AppTheme.darkTheme : AppTheme.lightTheme,
        home: RepaintBoundary(key: key, child: const AdminManagementScreen()),
      ),
    ),
  );
  await _paint(t);
  await _waitForAcademicOptions(t);
}

Future<void> _waitForAcademicOptions(WidgetTester t) async {
  for (var attempt = 0; attempt < 20; attempt++) {
    if (find.text('Cargando opciones académicas…').evaluate().isEmpty) return;
    await t.pump(const Duration(milliseconds: 50));
  }
  fail('Las opciones académicas no terminaron de cargar en el test.');
}

Future<void> _draft(WidgetTester t) async {
  await _waitForAcademicOptions(t);
  for (final e in {
    'Correo': 'new-admin@example.com',
    'Contraseña': 'SyntheticOnly123!',
    'Nombre': 'Synthetic',
    'Apellido': 'Administrator',
  }.entries) {
    final f = find.widgetWithText(TextFormField, e.key);
    await t.ensureVisible(f);
    await t.pump();
    await t.enterText(f, e.value);
  }
  for (final e in {'Programa': 'Enfermería', 'Campus': 'Bogotá'}.entries) {
    final f = find
        .byType(DropdownButtonFormField<String>)
        .at(e.key == 'Programa' ? 0 : 1);
    await t.ensureVisible(f);
    await t.pump();
    await t.tap(f);
    await t.pumpAndSettle();
    await t.tap(find.text(e.value).last);
    await t.pumpAndSettle();
  }
}

Future<void> _create(WidgetTester t) async {
  final b = find.widgetWithText(FilledButton, 'Crear administrador');
  await t.ensureVisible(b);
  await t.pump();
  await t.tap(b);
  await _paint(t);
}

Future<void> _remove(WidgetTester t) async {
  final b = find.byTooltip('Eliminar');
  await t.ensureVisible(b);
  await t.pump();
  await t.tap(b);
  await t.pumpAndSettle();
  await t.tap(find.widgetWithText(FilledButton, 'Eliminar'));
  await _paint(t);
}

Future<void> _refresh(WidgetTester t) async {
  final f = t.widget<RefreshIndicator>(find.byType(RefreshIndicator));
  unawaited(f.onRefresh());
  await _paint(t);
}

Future<void> _retry(WidgetTester t) async {
  await t.tap(find.text('Reintentar'));
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

  for (final status in [401, 403, 404, 429, 500, 503]) {
    testWidgets(
      'GET $status hides stale data, shares retry and restores draft',
      (t) async {
        final api = _Api();
        await _mount(t, api, GlobalKey());
        api.loaded();
        await _paint(t);
        await _draft(t);
        await _refresh(t);
        api.failed(status);
        await _paint(t);
        expect(find.byType(Form), findsNothing);
        expect(find.text('admin@example.com'), findsNothing);
        expect(find.text('No hay administradores creados'), findsNothing);
        expect(find.text('PRIVATE_DIAGNOSTIC'), findsNothing);
        final before = api.reads.length;
        await t.tap(find.text('Reintentar'));
        await t.tap(find.text('Reintentar'));
        await _paint(t);
        expect(api.reads.length, before + 1);
        expect(
          t
              .widget<TextButton>(find.widgetWithText(TextButton, 'Reintentar'))
              .onPressed,
          isNull,
        );
        api.loaded();
        await _paint(t);
        expect(
          t
              .widget<TextFormField>(
                find.widgetWithText(TextFormField, 'Correo'),
              )
              .controller!
              .text,
          'new-admin@example.com',
        );
        final scopes = t
            .widgetList<DropdownButtonFormField<String>>(
              find.byType(DropdownButtonFormField<String>),
            )
            .toList();
        expect(scopes[0].initialValue, 'Enfermería');
        expect(scopes[1].initialValue, 'Bogotá');
        expect(api.creates, isEmpty);
        expect(api.removes, isEmpty);
        expect(t.takeException(), isNull);
      },
    );
  }
  for (final status in [403, 503]) {
    testWidgets('initial GET $status is not empty and recovers', (t) async {
      final api = _Api();
      await _mount(t, api, GlobalKey());
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
      api.failed(status);
      await _paint(t);
      expect(find.byType(Form), findsNothing);
      expect(find.text('No hay administradores creados'), findsNothing);
      await _retry(t);
      api.loaded(empty: true);
      await _paint(t);
      expect(find.text('No hay administradores creados'), findsOneWidget);
    });
  }
  for (final removing in [false, true]) {
    final message = removing
        ? 'El administrador se eliminó, pero no se pudo actualizar la lista.'
        : 'El administrador se creó, pero no se pudo actualizar la lista.';
    for (final status in [403, 503]) {
      testWidgets(
        'write removing=$removing confirmed with GET $status retries only read',
        (t) async {
          final api = _Api();
          await _mount(t, api, GlobalKey());
          api.loaded();
          await _paint(t);
          if (removing) {
            await _remove(t);
          } else {
            await _draft(t);
            await _create(t);
          }
          api.written(removing);
          await _paint(t);
          api.failed(status);
          await _paint(t);
          expect(find.text(message), findsOneWidget);
          expect(find.byType(Form), findsNothing);
          expect(find.text('admin@example.com'), findsNothing);
          await _retry(t);
          api.loaded();
          await _paint(t);
          expect(find.text(message), findsNothing);
          expect(removing ? api.removes.length : api.creates.length, 1);
          if (!removing) {
            expect(
              t
                  .widget<TextFormField>(
                    find.widgetWithText(TextFormField, 'Contraseña'),
                  )
                  .controller!
                  .text,
              isEmpty,
            );
            expect(
              t
                  .widget<DropdownButtonFormField<String>>(
                    find.byType(DropdownButtonFormField<String>).first,
                  )
                  .initialValue,
              isNull,
            );
          }
          await _refresh(t);
          api.failed(503);
          await _paint(t);
          expect(find.text(message), findsNothing);
        },
      );
    }
    testWidgets('write removing=$removing failure keeps draft and safe error', (
      t,
    ) async {
      final api = _Api();
      await _mount(t, api, GlobalKey());
      api.loaded();
      await _paint(t);
      await _draft(t);
      if (removing) {
        await _remove(t);
      } else {
        await _create(t);
      }
      (removing ? api.removes : api.creates).last.completeError(
        api.failure(503),
      );
      await _paint(t);
      expect(find.text('PRIVATE_DIAGNOSTIC'), findsNothing);
      expect(find.text(message), findsNothing);
      expect(api.reads.length, 1);
      expect(
        t
            .widget<TextFormField>(find.widgetWithText(TextFormField, 'Correo'))
            .controller!
            .text,
        'new-admin@example.com',
      );
      await _refresh(t);
      api.failed(403);
      await _paint(t);
      await _retry(t);
      api.loaded();
      await _paint(t);
      expect(removing ? api.removes.length : api.creates.length, 1);
      expect(
        t
            .widget<TextFormField>(find.widgetWithText(TextFormField, 'Correo'))
            .controller!
            .text,
        'new-admin@example.com',
      );
    });
    testWidgets('dispose during write removing=$removing is safe', (t) async {
      final api = _Api();
      await _mount(t, api, GlobalKey());
      api.loaded();
      await _paint(t);
      if (removing) {
        await _remove(t);
      } else {
        await _draft(t);
        await _create(t);
      }
      await t.pumpWidget(const SizedBox());
      api.written(removing);
      await _paint(t);
      expect(t.takeException(), isNull);
      expect(api.reads.length, 1);
    });
  }
  testWidgets('same-frame creation is single and all form controls freeze', (
    t,
  ) async {
    final api = _Api();
    await _mount(t, api, GlobalKey());
    api.loaded();
    await _paint(t);
    await _draft(t);
    final button = find.widgetWithText(FilledButton, 'Crear administrador');
    await t.ensureVisible(button);
    await t.pump();
    final action = t.widget<FilledButton>(button).onPressed!;
    action();
    action();
    await _paint(t);
    expect(api.creates.length, 1);
    expect(api.payloads.single['program'], 'Enfermería');
    expect(api.payloads.single['campus'], 'Bogotá');
    for (final field in t.widgetList<TextFormField>(
      find.byType(TextFormField),
    )) {
      expect(field.enabled, isFalse);
    }
    for (final field in t.widgetList<DropdownButtonFormField<String>>(
      find.byType(DropdownButtonFormField<String>),
    )) {
      expect(field.onChanged, isNull);
    }
    final before = api.reads.length;
    await _refresh(t);
    expect(api.reads.length, before);
    api.written(false);
    await _paint(t);
    api.loaded();
    await _paint(t);
    expect(t.takeException(), isNull);
  });
  testWidgets(
    'delete cancellation and concurrent confirmation never duplicate DELETE',
    (t) async {
      final api = _Api();
      await _mount(t, api, GlobalKey());
      api.loaded();
      await _paint(t);
      final button = find.byTooltip('Eliminar');
      await t.ensureVisible(button);
      await t.pump();
      await t.tap(button);
      await t.pumpAndSettle();
      await t.tap(find.text('Cancelar'));
      await t.pumpAndSettle();
      expect(api.removes, isEmpty);
      final action = t
          .widget<IconButton>(
            find.byWidgetPredicate(
              (w) => w is IconButton && w.tooltip == 'Eliminar',
            ),
          )
          .onPressed!;
      action();
      action();
      await t.pumpAndSettle();
      expect(find.byType(AlertDialog), findsOneWidget);
      await t.tap(find.widgetWithText(FilledButton, 'Eliminar'));
      await _paint(t);
      expect(api.removes.length, 1);
      api.written(true);
      await _paint(t);
      api.loaded();
      await _paint(t);
    },
  );
  testWidgets('dispose during pending GET success is safe', (t) async {
    final api = _Api();
    await _mount(t, api, GlobalKey());
    await t.pumpWidget(const SizedBox());
    api.loaded();
    await _paint(t);
    expect(t.takeException(), isNull);
  });
  for (final removing in [false, true]) {
    testWidgets('dispose during write failure removing=$removing is safe', (
      t,
    ) async {
      final api = _Api();
      await _mount(t, api, GlobalKey());
      api.loaded();
      await _paint(t);
      if (removing) {
        await _remove(t);
      } else {
        await _draft(t);
        await _create(t);
      }
      await t.pumpWidget(const SizedBox());
      (removing ? api.removes : api.creates).last.completeError(
        api.failure(503),
      );
      await _paint(t);
      expect(t.takeException(), isNull);
      expect(api.reads.length, 1);
    });
  }
  testWidgets('dispose during pending GET failure is safe', (t) async {
    final api = _Api();
    await _mount(t, api, GlobalKey());
    await t.pumpWidget(const SizedBox());
    api.failed(503);
    await _paint(t);
    expect(t.takeException(), isNull);
  });
  for (final dark in [false, true]) {
    for (final status in [403, 503]) {
      testWidgets('error reference $status ${dark ? 'dark' : 'light'}', (
        t,
      ) async {
        final api = _Api();
        final key = GlobalKey();
        await _mount(t, api, key, dark: dark);
        api.failed(status);
        await _paint(t);
        if (Platform.environment['PHASE5B_SKIP_GOLDENS'] != '1') {
          await expectLater(
            find.byKey(key),
            matchesGoldenFile(
              '../../../../docs/ui/evidence/phase5b/admin-native/flutter-get$status-${dark ? 'dark' : 'light'}-390.png',
            ),
          );
        }
      });
    }
  }
}
