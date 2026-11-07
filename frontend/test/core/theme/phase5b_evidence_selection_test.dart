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
// Same offline font seam as the existing Phase5B references.
// ignore: implementation_imports
import 'package:google_fonts/src/google_fonts_base.dart' as font_test;
import 'package:mocktail/mocktail.dart';
import 'package:immuno_clinic_app/core/network/api_client.dart';
import 'package:immuno_clinic_app/core/theme/app_theme.dart';
import 'package:immuno_clinic_app/features/student/data/datasources/evidence_remote_ds.dart';
import 'package:immuno_clinic_app/features/student/data/models/evidence_model.dart';
import 'package:immuno_clinic_app/features/student/data/models/vaccine_model.dart';
import 'package:immuno_clinic_app/features/student/presentation/providers/evidence_provider.dart';
import 'package:immuno_clinic_app/features/student/presentation/providers/scheme_provider.dart';
import 'package:immuno_clinic_app/features/student/presentation/screens/evidence_upload_screen.dart';

class _Fonts implements AssetManifest {
  final Map<String, ByteData> data;
  _Fonts(this.data);
  @override
  List<String> listAssets() => data.keys.toList();
  @override
  List<AssetMetadata>? getAssetVariants(String key) => null;
}

class _Api extends Mock implements ApiClient {}

class _Remote extends EvidenceRemoteDataSource {
  _Remote() : super(_Api());
  final writes = <Completer<Map<String, dynamic>>>[];
  List<EvidenceBatchModel> batches = const [];
  final payloads =
      <({List<PlatformFile> files, String? notes, String? doseId})>[];
  @override
  Future<EvidencePageModel> getMyBatches({int page = 1, int size = 20}) async {
    return EvidencePageModel(
      items: batches,
      page: page,
      size: size,
      total: batches.length,
      pages: batches.isEmpty ? 0 : 1,
      hasNext: false,
      hasPrevious: false,
    );
  }

  @override
  Future<Map<String, dynamic>> uploadEvidence(
    List<PlatformFile> files, {
    String? notes,
    String? doseId,
  }) {
    payloads.add((files: files, notes: notes, doseId: doseId));
    final result = Completer<Map<String, dynamic>>();
    writes.add(result);
    return result.future;
  }
}

class _Scheme extends StateNotifier<SchemeState> implements SchemeNotifier {
  _Scheme()
    : super(
        SchemeState(
          vaccines: [
            StudentVaccineModel.fromJson({
              'id': 'synthetic-vaccine',
              'vaccine_id': 'synthetic-catalog',
              'vaccine': {'name': 'Synthetic vaccine'},
              'doses': [
                {'id': 'dose-fixture', 'dose_number': 1, 'status': 'in_review'},
              ],
            }),
          ],
        ),
      );
  @override
  Future<void> loadScheme({bool forceRefresh = false}) async {}
  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
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
    expect(allowedExtensions, ['pdf']);
    expect(allowMultiple, true);
    expect(withData, true);
    final result = Completer<FilePickerResult?>();
    requests.add(result);
    return result.future;
  }
}

PlatformFile _file([String name = 'synthetic.pdf', int byte = 65]) =>
    PlatformFile(
      name: name,
      size: 6,
      bytes: Uint8List.fromList([37, 80, 68, 70, 45, byte]),
    );
Future<void> _paint(WidgetTester tester) async {
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 250));
}

final _pick = find.text('Toca para seleccionar archivos PDF');
final _submit = find.widgetWithText(ElevatedButton, 'Subir documentos');
Future<void> _tap(WidgetTester tester, Finder finder) async {
  await tester.ensureVisible(finder);
  await _paint(tester);
  await tester.tap(finder);
  await _paint(tester);
}

Future<void> _mount(
  WidgetTester tester,
  _Remote remote,
  GlobalKey key, {
  bool dark = false,
  Size viewport = const Size(390, 844),
}) async {
  tester.view.physicalSize = viewport;
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        evidenceProvider.overrideWith((ref) => EvidenceNotifier(remote)),
        schemeProvider.overrideWith((ref) => _Scheme()),
      ],
      child: MaterialApp(
        theme: dark ? AppTheme.darkTheme : AppTheme.lightTheme,
        home: RepaintBoundary(key: key, child: const EvidenceUploadScreen()),
      ),
    ),
  );
  await _paint(tester);
}

Future<void> _select(
  WidgetTester tester,
  _Picker picker,
  List<PlatformFile> files,
) async {
  await _tap(tester, _pick);
  picker.requests.last.complete(FilePickerResult(files));
  await _paint(tester);
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  late _Picker picker;
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
  setUp(() {
    picker = _Picker();
    FilePicker.platform = picker;
  });
  testWidgets('removes only one duplicate occurrence without uploading', (
    tester,
  ) async {
    final remote = _Remote();
    await _mount(tester, remote, GlobalKey());
    final first = _file(), second = _file('synthetic.pdf', 66);
    await _select(tester, picker, [first, second]);
    await _tap(tester, find.byTooltip('Quitar synthetic.pdf').last);
    expect(find.text('synthetic.pdf'), findsOneWidget);
    expect(remote.writes, isEmpty);
    await _tap(tester, _submit);
    expect(remote.payloads.single.files, [first]);
    remote.writes.single.complete({});
    await _paint(tester);
  });
  testWidgets('selected long filename wraps on a mobile viewport', (
    tester,
  ) async {
    final remote = _Remote();
    await _mount(tester, remote, GlobalKey(), viewport: const Size(320, 568));
    final name =
        'evidencia sintetica con nombre extenso para comprobar el reflujo en pantallas moviles.pdf';
    await _select(tester, picker, [_file(name)]);
    final filename = find.text(name);
    expect(tester.getSize(filename).height, greaterThan(13));
    expect(tester.takeException(), isNull);
  });
  testWidgets('historical long filename wraps on a mobile viewport', (
    tester,
  ) async {
    final remote = _Remote()
      ..batches = [
        EvidenceBatchModel.fromJson({
          'id': 'synthetic-batch',
          'status': 'in_review',
          'created_at': '2026-01-01T10:00:00Z',
          'files': [
            {
              'id': 'synthetic-file',
              'original_filename':
                  'evidencia sintetica con nombre extenso para comprobar el reflujo en pantallas moviles.pdf',
              'file_size': 123,
              'mime_type': 'application/pdf',
              'uploaded_at': '2026-01-01T10:00:00Z',
            },
          ],
        }),
      ];
    await _mount(tester, remote, GlobalKey(), viewport: const Size(320, 568));
    await tester.pumpAndSettle();
    await tester.drag(find.byType(ListView).first, const Offset(0, -700));
    await tester.pumpAndSettle();
    expect(find.text('1 archivo(s)'), findsOneWidget);
    await _tap(tester, find.text('1 archivo(s)'));
    final filename = find.text(
      'evidencia sintetica con nombre extenso para comprobar el reflujo en pantallas moviles.pdf',
    );
    expect(tester.getSize(filename).height, greaterThan(13));
    expect(tester.takeException(), isNull);
  });
  testWidgets(
    'removing the last file disables upload and picking it again restores it',
    (tester) async {
      final remote = _Remote();
      await _mount(tester, remote, GlobalKey());
      await _select(tester, picker, [_file()]);
      await _tap(tester, find.byTooltip('Quitar synthetic.pdf'));
      expect(tester.widget<ElevatedButton>(_submit).onPressed, isNull);
      await _select(tester, picker, [_file()]);
      expect(tester.widget<ElevatedButton>(_submit).onPressed, isNotNull);
    },
  );
  for (final succeeds in [true, false]) {
    testWidgets(
      'form is frozen during upload, single submit, success=$succeeds',
      (tester) async {
        final remote = _Remote();
        await _mount(tester, remote, GlobalKey());
        await _select(tester, picker, [_file()]);
        await tester.enterText(find.byType(TextField), 'Synthetic draft');
        await _tap(tester, _submit);
        expect(tester.widget<TextField>(find.byType(TextField)).enabled, false);
        expect(
          tester
              .widget<DropdownButtonFormField<String>>(
                find.byType(DropdownButtonFormField<String>),
              )
              .onChanged,
          isNull,
        );
        expect(
          tester
              .widget<IconButton>(
                find.ancestor(
                  of: find.byTooltip('Quitar synthetic.pdf'),
                  matching: find.byType(IconButton),
                ),
              )
              .onPressed,
          isNull,
        );
        expect(
          tester
              .widget<InkWell>(
                find.ancestor(of: _pick, matching: find.byType(InkWell)).first,
              )
              .onTap,
          isNull,
        );
        final sending = find.widgetWithText(ElevatedButton, 'Subiendo...');
        await _tap(tester, sending);
        expect(remote.writes.length, 1);
        expect(remote.payloads.single.notes, 'Synthetic draft');
        if (succeeds) {
          remote.writes.single.complete({});
        } else {
          remote.writes.single.completeError(
            DioException(
              requestOptions: RequestOptions(path: '/evidence/upload'),
            ),
          );
        }
        await _paint(tester);
        expect(tester.widget<TextField>(find.byType(TextField)).enabled, true);
        expect(
          find.text('synthetic.pdf'),
          succeeds ? findsNothing : findsOneWidget,
        );
        expect(
          tester.widget<TextField>(find.byType(TextField)).controller!.text,
          succeeds ? '' : 'Synthetic draft',
        );
      },
    );
  }
  testWidgets('one picker at a time; cancellation preserves the draft', (
    tester,
  ) async {
    await _mount(tester, _Remote(), GlobalKey());
    await _select(tester, picker, [_file()]);
    await _tap(tester, _pick);
    await _tap(tester, _pick);
    expect(picker.requests.length, 2);
    picker.requests.last.complete(null);
    await _paint(tester);
    expect(find.text('synthetic.pdf'), findsOneWidget);
  });
  for (final finishFirst in [false, true]) {
    testWidgets(
      'ignores a picker opened before submission, upload already finished=$finishFirst',
      (tester) async {
        final remote = _Remote();
        await _mount(tester, remote, GlobalKey());
        await _select(tester, picker, [_file()]);
        await _tap(tester, _pick);
        final late = picker.requests.last;
        await _tap(tester, _submit);
        if (finishFirst) {
          remote.writes.single.complete({});
          await _paint(tester);
        }
        late.complete(FilePickerResult([_file('synthetic-late.pdf')]));
        await _paint(tester);
        expect(find.text('synthetic-late.pdf'), findsNothing);
        if (!finishFirst) {
          remote.writes.single.complete({});
          await _paint(tester);
        }
      },
    );
  }
  testWidgets('disposed picker result does not access the screen', (
    tester,
  ) async {
    await _mount(tester, _Remote(), GlobalKey());
    await _tap(tester, _pick);
    await tester.pumpWidget(const SizedBox());
    picker.requests.single.complete(FilePickerResult([_file()]));
    await _paint(tester);
    expect(tester.takeException(), isNull);
  });
  testWidgets('picker failure is safe, preserves files and permits retry', (
    tester,
  ) async {
    await _mount(tester, _Remote(), GlobalKey());
    await _select(tester, picker, [_file()]);
    await _tap(tester, _pick);
    picker.requests.last.completeError(
      PlatformException(code: 'PRIVATE_DIAGNOSTIC'),
    );
    await _paint(tester);
    expect(
      find.text('No se pudieron seleccionar los archivos.'),
      findsOneWidget,
    );
    expect(find.textContaining('PRIVATE_DIAGNOSTIC'), findsNothing);
    expect(find.text('synthetic.pdf'), findsOneWidget);
    await _tap(tester, _pick);
    picker.requests.last.complete(null);
    await _paint(tester);
  });
  for (final dark in [false, true]) {
    for (final busy in [false, true]) {
      testWidgets(
        'reference ${dark ? "dark" : "light"} ${busy ? "sending" : "selected"}',
        (tester) async {
          final remote = _Remote(), key = GlobalKey();
          await _mount(tester, remote, key, dark: dark);
          await _select(tester, picker, [
            _file(),
            _file('synthetic-other.pdf'),
          ]);
          await tester.enterText(find.byType(TextField), 'Synthetic draft');
          if (busy) await _tap(tester, _submit);
          await tester.drag(find.byType(ListView), const Offset(0, 1400));
          await _paint(tester);
          if (Platform.environment['PHASE5B_SKIP_GOLDENS'] != '1') {
            await expectLater(
              find.byKey(key),
              matchesGoldenFile(
                '../../../../docs/ui/evidence/phase5b/evidence-selection/flutter-${dark ? "dark" : "light"}-${busy ? "sending" : "selected"}-390.png',
              ),
            );
          }
          if (busy) {
            remote.writes.single.complete({});
            await _paint(tester);
          }
        },
      );
    }
  }
}
