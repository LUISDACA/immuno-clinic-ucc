import 'dart:convert';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:mocktail/mocktail.dart';
// Same local offline font seam as existing Phase5B references.
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

class _Api implements ApiClient {
  @override
  Dio dio = _Dio();
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
    when(() => dio.get<dynamic>('/admin/admins')).thenAnswer(
      (_) async => Response(
        requestOptions: RequestOptions(path: '/admin/admins'),
        data: <dynamic>[],
      ),
    );
  }
}

Future<void> _mount(
  WidgetTester tester,
  _Api api,
  GlobalKey key,
  bool dark,
) async {
  tester.view.physicalSize = const Size(390, 844);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
  await tester.pumpWidget(
    ProviderScope(
      overrides: [apiClientProvider.overrideWithValue(api)],
      child: MaterialApp(
        theme: dark ? AppTheme.darkTheme : AppTheme.lightTheme,
        home: RepaintBoundary(key: key, child: const AdminManagementScreen()),
      ),
    ),
  );
  await tester.pumpAndSettle();
  await _waitForAcademicOptions(tester);
}

Future<void> _waitForAcademicOptions(WidgetTester tester) async {
  for (var attempt = 0; attempt < 20; attempt++) {
    if (find.text('Cargando opciones académicas…').evaluate().isEmpty) return;
    await tester.pump(const Duration(milliseconds: 50));
  }
  fail('Las opciones académicas no terminaron de cargar en el test.');
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
  for (final dark in [false, true]) {
    testWidgets(
      'existing administrator form reference ${dark ? 'dark' : 'light'}',
      (tester) async {
        final api = _Api();
        final key = GlobalKey();
        await _mount(tester, api, key, dark);
        expect(find.text('Nuevo administrador'), findsOneWidget);
        expect(find.widgetWithText(TextFormField, 'Correo'), findsOneWidget);
        await expectLater(
          find.byKey(key),
          matchesGoldenFile(
            '../../../../docs/ui/evidence/phase5b/admin-create/flutter-form-${dark ? 'dark' : 'light'}-390.png',
          ),
        );
        verifyNever(
          () => api.dio.post<dynamic>(any(), data: any(named: 'data')),
        );
      },
    );
  }
  testWidgets('Flutter reference rejects missing data without POST', (
    tester,
  ) async {
    final api = _Api();
    await _mount(tester, api, GlobalKey(), false);
    final button = find.widgetWithText(FilledButton, 'Crear administrador');
    await tester.ensureVisible(button);
    await tester.pumpAndSettle();
    await tester.tap(button);
    await tester.pumpAndSettle();
    expect(find.text('Correo inválido'), findsOneWidget);
    expect(find.text('Minimo 8 caracteres'), findsOneWidget);
    expect(find.text('Selecciona un programa'), findsOneWidget);
    expect(find.text('Selecciona un campus'), findsOneWidget);
    verifyNever(() => api.dio.post<dynamic>(any(), data: any(named: 'data')));
  });
  testWidgets('Flutter reference rejects short password without POST', (
    tester,
  ) async {
    final api = _Api();
    await _mount(tester, api, GlobalKey(), true);
    await tester.enterText(
      find.widgetWithText(TextFormField, 'Correo'),
      'synthetic@example.invalid',
    );
    await tester.enterText(
      find.widgetWithText(TextFormField, 'Contraseña'),
      'short',
    );
    final button = find.widgetWithText(FilledButton, 'Crear administrador');
    await tester.ensureVisible(button);
    await tester.pumpAndSettle();
    await tester.tap(button);
    await tester.pumpAndSettle();
    expect(find.text('Minimo 8 caracteres'), findsOneWidget);
    verifyNever(() => api.dio.post<dynamic>(any(), data: any(named: 'data')));
  });
}
