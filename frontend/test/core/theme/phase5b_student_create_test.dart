import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:dio/dio.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:mocktail/mocktail.dart';
// Same offline fonts as the existing Phase5B references.
// ignore: implementation_imports
import 'package:google_fonts/src/google_fonts_base.dart' as font_test;
import 'package:immuno_clinic_app/core/network/api_client.dart';
import 'package:immuno_clinic_app/core/theme/app_theme.dart';
import 'package:immuno_clinic_app/features/admin/presentation/screens/create_student_screen.dart';
import 'package:immuno_clinic_app/features/auth/presentation/providers/auth_provider.dart';
import '../../features/admin/presentation/screens/admin_dashboard_screen_test.dart'
    show MockAuthNotifier;

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
  final calls =
      <({String path, dynamic data, Completer<Response<dynamic>> result})>[];
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
    for (final path in [
      '/admin/students',
      '/admin/students/import/preview',
      '/admin/students/import',
    ]) {
      when(() => dio.post<dynamic>(path, data: any(named: 'data'))).thenAnswer((
        call,
      ) {
        final result = Completer<Response<dynamic>>();
        calls.add((
          path: path,
          data: call.namedArguments[#data],
          result: result,
        ));
        return result.future;
      });
    }
  }
  void success(Map<String, dynamic> data) => calls.last.result.complete(
    Response(
      requestOptions: RequestOptions(path: calls.last.path),
      data: data,
    ),
  );
  void fail([int status = 503]) => calls.last.result.completeError(
    DioException(
      requestOptions: RequestOptions(path: calls.last.path),
      response: Response(
        requestOptions: RequestOptions(path: calls.last.path),
        statusCode: status,
        data: {'message': 'PRIVATE_DIAGNOSTIC'},
      ),
    ),
  );
}

class _Picker extends FilePicker {
  final requests = <Completer<FilePickerResult?>>[];
  @override
  Future<FilePickerResult?> pickFiles({
    String? dialogTitle,
    String? initialDirectory,
    FileType type = FileType.any,
    List<String>? allowedExtensions,
    Function(FilePickerStatus)? onFileLoading,
    bool allowCompression = true,
    int compressionQuality = 30,
    bool allowMultiple = false,
    bool withData = false,
    bool withReadStream = false,
    bool lockParentWindow = false,
    bool readSequential = false,
  }) {
    expect(type, FileType.custom);
    expect(allowedExtensions, ['xlsx', 'csv']);
    expect(withData, true);
    final c = Completer<FilePickerResult?>();
    requests.add(c);
    return c.future;
  }

  void selected() => requests.last.complete(
    FilePickerResult([
      PlatformFile(
        name: 'synthetic.csv',
        size: 4,
        bytes: Uint8List.fromList([65, 66, 67, 68]),
      ),
    ]),
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
      overrides: [
        apiClientProvider.overrideWithValue(api),
        authStateProvider.overrideWith(
          (ref) => MockAuthNotifier(
            const AuthState(
              isAuthenticated: true,
              role: 'admin',
              userId: 'synthetic-admin',
            ),
          ),
        ),
      ],
      child: MaterialApp(
        theme: dark ? AppTheme.darkTheme : AppTheme.lightTheme,
        home: RepaintBoundary(key: key, child: const CreateStudentScreen()),
      ),
    ),
  );
  await _paint(t);
}

Finder get _import => find.byType(OutlinedButton).first;
Future<void> _tap(WidgetTester t, Finder finder) async {
  await t.ensureVisible(finder);
  await t.pump();
  await t.tap(finder);
  await _paint(t);
}

Future<void> _fill(WidgetTester t) async {
  for (final field in {
    'Correo *': 'synthetic@example.com',
    'Documento / cédula *': 'SYNTHETIC-ONLY',
    'Nombre *': 'Synthetic',
    'Apellido *': 'Student',
  }.entries) {
    final f = find.widgetWithText(TextFormField, field.key);
    await t.ensureVisible(f);
    await t.pump();
    await t.enterText(f, field.value);
  }
}

Future<VoidCallback> _submitAction(WidgetTester t) async {
  final f = find.widgetWithText(ElevatedButton, 'Crear Estudiante');
  await t.ensureVisible(f);
  await t.pump();
  return t.widget<ElevatedButton>(f).onPressed!;
}

const _preview = {
  'will_create': 1,
  'will_skip': 0,
  'errors': 0,
  'rows': <dynamic>[
    {
      'row': 2,
      'email': 'import-ui@example.com',
      'name': 'Synthetic Imported',
      'predicted_status': 'will_create',
      'message': 'Se creará el estudiante',
    },
  ],
};
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

  late _Picker picker;
  setUp(() => FilePicker.platform = picker = _Picker());
  testWidgets('required fields do not submit', (t) async {
    final api = _Api();
    await _mount(t, api, GlobalKey());
    (await _submitAction(t))();
    await _paint(t);
    expect(api.calls, isEmpty);
  });
  testWidgets(
    'same-frame submits create once and freeze manual and import controls',
    (t) async {
      final api = _Api();
      await _mount(t, api, GlobalKey());
      await _fill(t);
      final action = await _submitAction(t);
      action();
      action();
      await _paint(t);
      expect(api.calls.length, 1);
      expect(api.calls.single.path, '/admin/students');
      expect((api.calls.single.data as Map)['sex'], 'male');
      for (final f in t.widgetList<TextFormField>(find.byType(TextFormField))) {
        expect(f.enabled, isFalse);
      }
      expect(t.widget<OutlinedButton>(_import).onPressed, isNull);
      api.fail();
      await _paint(t);
      expect(find.text('PRIVATE_DIAGNOSTIC'), findsNothing);
      expect(
        t
            .widget<TextFormField>(
              find.widgetWithText(TextFormField, 'Correo *'),
            )
            .controller!
            .text,
        'synthetic@example.com',
      );
      expect(t.widget<OutlinedButton>(_import).onPressed, isNotNull);
      expect(t.takeException(), isNull);
    },
  );
  testWidgets(
    'picker locks immediately; cancellation unlocks without request',
    (t) async {
      final api = _Api();
      await _mount(t, api, GlobalKey());
      final action = t.widget<OutlinedButton>(_import).onPressed!;
      action();
      action();
      await _paint(t);
      expect(picker.requests.length, 1);
      for (final f in t.widgetList<TextFormField>(find.byType(TextFormField))) {
        expect(f.enabled, isFalse);
      }
      picker.requests.last.complete(null);
      await _paint(t);
      expect(api.calls, isEmpty);
      expect(t.widget<OutlinedButton>(_import).onPressed, isNotNull);
    },
  );
  for (final status in [401, 403, 409, 422, 429, 503]) {
    testWidgets('import HTTP $status is safe and retains manual draft', (
      t,
    ) async {
      final api = _Api();
      await _mount(t, api, GlobalKey());
      await _fill(t);
      await _tap(t, _import);
      picker.selected();
      await _paint(t);
      expect(api.calls.single.path, '/admin/students/import/preview');
      api.fail(status);
      await _paint(t);
      expect(find.byType(SnackBar), findsOneWidget);
      expect(find.text('PRIVATE_DIAGNOSTIC'), findsNothing);
      expect(
        t
            .widget<TextFormField>(
              find.widgetWithText(TextFormField, 'Nombre *'),
            )
            .controller!
            .text,
        'Synthetic',
      );
      expect(t.widget<OutlinedButton>(_import).onPressed, isNotNull);
      expect(t.takeException(), isNull);
    });
  }
  testWidgets('unreadable file shows safe visible error without request', (
    t,
  ) async {
    final api = _Api();
    await _mount(t, api, GlobalKey());
    await _tap(t, _import);
    picker.requests.last.complete(
      FilePickerResult([PlatformFile(name: 'synthetic.csv', size: 4)]),
    );
    await _paint(t);
    expect(api.calls, isEmpty);
    expect(find.byType(SnackBar), findsOneWidget);
    expect(
      find.descendant(
        of: find.byType(SnackBar),
        matching: find.text('No se pudo leer el archivo seleccionado'),
      ),
      findsOneWidget,
    );
    expect(t.widget<OutlinedButton>(_import).onPressed, isNotNull);
  });
  testWidgets(
    'import requires explicit preview confirmation and posts captured file once',
    (t) async {
      final api = _Api();
      await _mount(t, api, GlobalKey());
      await _tap(t, _import);
      picker.selected();
      await _paint(t);
      api.success(_preview);
      await _paint(t);
      expect(api.calls.length, 1);
      final action = t
          .widget<ElevatedButton>(
            find.widgetWithText(ElevatedButton, 'Importar 1 estudiante(s)'),
          )
          .onPressed!;
      action();
      await _paint(t);
      expect(api.calls.length, 2);
      expect(api.calls.last.path, '/admin/students/import');
      final data = api.calls.last.data as FormData;
      expect(data.files.single.value.filename, 'synthetic.csv');
      api.success({
        'created': 1,
        'skipped': 0,
        'errors': 0,
        'results': <dynamic>[],
      });
      await _paint(t);
      expect(find.text('Importación finalizada'), findsOneWidget);
      await _tap(t, find.widgetWithText(TextButton, 'Cerrar'));
      expect(t.widget<OutlinedButton>(_import).onPressed, isNotNull);
      expect(t.takeException(), isNull);
    },
  );
  testWidgets('cancelling preview never imports', (t) async {
    final api = _Api();
    await _mount(t, api, GlobalKey());
    await _tap(t, _import);
    picker.selected();
    await _paint(t);
    api.success(_preview);
    await _paint(t);
    await _tap(t, find.widgetWithText(TextButton, 'Cancelar'));
    expect(api.calls.length, 1);
    expect(t.widget<OutlinedButton>(_import).onPressed, isNotNull);
  });
  testWidgets('zero creatable rows cannot be confirmed', (t) async {
    final api = _Api();
    await _mount(t, api, GlobalKey());
    await _tap(t, _import);
    picker.selected();
    await _paint(t);
    api.success({..._preview, 'will_create': 0});
    await _paint(t);
    expect(
      t
          .widget<ElevatedButton>(
            find.widgetWithText(ElevatedButton, 'Importar 0 estudiante(s)'),
          )
          .onPressed,
      isNull,
    );
    await _tap(t, find.widgetWithText(TextButton, 'Cancelar'));
    expect(api.calls.length, 1);
  });
  for (final stage in ['picker', 'create', 'preview']) {
    testWidgets('late $stage completion after dispose is safe', (t) async {
      final api = _Api();
      await _mount(t, api, GlobalKey());
      if (stage == 'create') {
        await _fill(t);
        (await _submitAction(t))();
        await _paint(t);
      } else {
        await _tap(t, _import);
        if (stage == 'preview') {
          picker.selected();
          await _paint(t);
        }
      }
      await t.pumpWidget(const SizedBox());
      if (stage == 'picker') {
        picker.selected();
      } else {
        api.fail();
      }
      await _paint(t);
      expect(t.takeException(), isNull);
      if (stage == 'picker') expect(api.calls, isEmpty);
    });
  }
  for (final dark in [false, true]) {
    testWidgets('synthetic preview ${dark ? 'dark' : 'light'} golden', (
      t,
    ) async {
      final api = _Api();
      final key = GlobalKey();
      await _mount(t, api, key, dark: dark);
      await _tap(t, _import);
      picker.selected();
      await _paint(t);
      api.success(_preview);
      await _paint(t);
      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile(
          '../../../../docs/ui/evidence/phase5b/student-create/flutter-preview-${dark ? 'dark' : 'light'}-390.png',
        ),
      );
      await _tap(t, find.widgetWithText(TextButton, 'Cancelar'));
      expect(t.takeException(), isNull);
    });
  }
}
