import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter/semantics.dart';
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
  final payloads =
      <({List<PlatformFile> files, String? notes, String? doseId})>[];
  final reads = <Completer<EvidencePageModel>>[];
  final pages = <int>[];
  @override
  Future<EvidencePageModel> getMyBatches({int page = 1, int size = 20}) {
    pages.add(page);
    final result = Completer<EvidencePageModel>();
    reads.add(result);
    return result.future;
  }

  void loaded({String note = 'Synthetic previous data'}) =>
      reads.last.complete(_page(note: note, page: pages.last));
  void failed(int status) => reads.last.completeError(_failure(status));
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
  _Scheme({this.failUntilRetry = false})
    : super(
        SchemeState(
          vaccines: failUntilRetry ? const [] : _vaccines,
          error: failUntilRetry ? 'No se pudo cargar esquema' : null,
        ),
      );
  final bool failUntilRetry;
  int attempts = 0;

  static final _vaccines = [
    StudentVaccineModel.fromJson({
      'id': 'synthetic-vaccine',
      'vaccine_id': 'synthetic-catalog',
      'vaccine': {'name': 'Synthetic vaccine'},
      'doses': [
        {'id': 'dose-fixture', 'dose_number': 1, 'status': 'in_review'},
      ],
    }),
  ];

  @override
  Future<void> loadScheme({bool forceRefresh = false}) async {
    attempts++;
    if (forceRefresh && failUntilRetry) {
      state = SchemeState(vaccines: _vaccines);
    }
  }

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
  _Scheme? scheme,
}) async {
  tester.view.physicalSize = const Size(390, 844);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        evidenceProvider.overrideWith((ref) => EvidenceNotifier(remote)),
        schemeProvider.overrideWith((ref) => scheme ?? _Scheme()),
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

EvidencePageModel _page({
  String note = 'Synthetic previous data',
  int page = 1,
}) => EvidencePageModel(
  items: [
    EvidenceBatchModel.fromJson({
      'id': 'synthetic-batch',
      'status': 'in_review',
      'notes': note,
      'created_at': '2026-01-01T10:00:00Z',
      'files': [],
    }),
  ],
  page: page,
  size: 20,
  total: 21,
  pages: 2,
  hasNext: page < 2,
  hasPrevious: page > 1,
);
DioException _failure(int status) {
  final options = RequestOptions(path: '/evidence/page');
  return DioException(
    requestOptions: options,
    response: Response(
      requestOptions: options,
      statusCode: status,
      data: {'message': 'PRIVATE_DIAGNOSTIC'},
    ),
  );
}

const _confirmed =
    'Los documentos se subieron, pero no se pudo actualizar la lista.';
const _failed =
    'No se pudo confirmar la carga. Comprueba tus documentos antes de reintentar.';
Future<void> _ready(
  WidgetTester tester,
  _Remote remote,
  _Picker picker,
  GlobalKey key, {
  bool dark = false,
}) async {
  await _mount(tester, remote, key, dark: dark);
  remote.loaded();
  await _paint(tester);
  await _select(tester, picker, [_file()]);
  await tester.enterText(find.byType(TextField), 'Synthetic draft');
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

  testWidgets(
    'scheme read failure is distinct from an empty dose list and retries only the scheme GET',
    (tester) async {
      final remote = _Remote();
      final scheme = _Scheme(failUntilRetry: true);
      await _mount(tester, remote, GlobalKey(), scheme: scheme);

      expect(find.text('No se pudo cargar esquema'), findsOneWidget);
      expect(find.text('Carga general, sin dosis asociada'), findsOneWidget);
      final errorSemantics = tester
          .getSemantics(find.text('No se pudo cargar esquema'))
          .getSemanticsData();
      expect(errorSemantics.flagsCollection.isLiveRegion, isTrue);
      final retry = find.widgetWithText(
        OutlinedButton,
        'Reintentar lectura del esquema',
      );
      expect(retry, findsOneWidget);
      final retrySemantics = tester.getSemantics(retry).getSemanticsData();
      expect(retrySemantics.flagsCollection.isButton, isTrue);
      expect(retrySemantics.hasAction(SemanticsAction.tap), isTrue);
      expect(scheme.attempts, 1);
      expect(remote.payloads, isEmpty);

      await _tap(tester, retry);

      expect(scheme.attempts, 2);
      expect(find.text('No se pudo cargar esquema'), findsNothing);
      expect(find.text('Reintentar lectura del esquema'), findsNothing);
      expect(scheme.state.vaccines, hasLength(1));
      await _tap(tester, find.byType(DropdownButtonFormField<String>));
      expect(find.text('Synthetic vaccine · Dosis 1'), findsOneWidget);
      expect(remote.payloads, isEmpty);
    },
  );
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

  for (final status in [401, 403, 404, 429, 500, 503]) {
    testWidgets(
      'confirmed POST + failed GET $status; retry GET only and coalesce double retry',
      (tester) async {
        final remote = _Remote();
        await _ready(tester, remote, picker, GlobalKey());
        await _tap(tester, _submit);
        remote.writes.single.complete({});
        await _paint(tester);
        remote.failed(status);
        await _paint(tester);
        expect(find.text(_confirmed), findsWidgets);
        expect(find.text('No has subido documentos aún'), findsNothing);
        expect(find.text('Synthetic previous data'), findsNothing);
        expect(find.byType(TextField), findsNothing);
        expect(find.textContaining('PRIVATE_DIAGNOSTIC'), findsNothing);
        final retry = find.byType(OutlinedButton);
        await _tap(tester, retry);
        await _tap(tester, retry);
        expect(remote.reads.length, 3);
        expect(remote.writes.length, 1);
        expect(tester.widget<OutlinedButton>(retry).onPressed, isNull);
        remote.loaded();
        await _paint(tester);
        expect(find.byType(TextField), findsOneWidget);
        expect(find.text('synthetic.pdf'), findsNothing);
        expect(
          tester.widget<TextField>(find.byType(TextField)).controller!.text,
          '',
        );
        expect(remote.writes.length, 1);
      },
    );
  }
  testWidgets(
    'failed POST and GET preserves draft and write feedback after GET recovery',
    (tester) async {
      final remote = _Remote();
      await _ready(tester, remote, picker, GlobalKey());
      await _tap(tester, _submit);
      remote.writes.single.completeError(_failure(503));
      await _paint(tester);
      // A separate read failure must not erase the unconfirmed write outcome.
      final context = tester.element(find.byType(EvidenceUploadScreen));
      final notifier = ProviderScope.containerOf(
        context,
      ).read(evidenceProvider.notifier);
      final load = notifier.loadBatches();
      await _paint(tester);
      remote.failed(403);
      await load;
      await _paint(tester);
      expect(find.text(_failed), findsWidgets);
      expect(find.text(_confirmed), findsNothing);
      await _tap(tester, find.widgetWithText(OutlinedButton, 'Reintentar'));
      remote.loaded();
      await _paint(tester);
      expect(find.text('synthetic.pdf'), findsOneWidget);
      expect(
        tester.widget<TextField>(find.byType(TextField)).controller!.text,
        'Synthetic draft',
      );
      expect(find.text(_failed), findsWidgets);
      expect(remote.writes.length, 1);
      await _tap(tester, _submit);
      expect(remote.writes.length, 2);
      remote.writes.last.complete({});
      await _paint(tester);
      remote.loaded();
      await _paint(tester);
      expect(find.text('synthetic.pdf'), findsNothing);
    },
  );
  test(
    'same-page concurrent retries share one GET and preserve the failed target page',
    () async {
      final remote = _Remote();
      final subject = EvidenceNotifier(remote);
      final first = subject.loadBatches(page: 2);
      remote.failed(503);
      await first;
      final a = subject.loadBatches(), b = subject.loadBatches();
      expect(remote.reads.length, 2);
      remote.loaded();
      await Future.wait([a, b]);
      expect(remote.pages, [2, 2]);
      subject.dispose();
    },
  );
  test(
    'a pre-write GET cannot replace a post-write read or block its retry',
    () async {
      final remote = _Remote();
      final notifier = EvidenceNotifier(remote);
      final obsolete = notifier.loadBatches();
      final upload = notifier.upload([_file()]);
      remote.writes.single.complete({});
      await Future<void>.delayed(Duration.zero);
      remote.failed(503);
      expect(await upload, true);
      final retry = notifier.loadBatches();
      remote.loaded(note: 'Synthetic current data');
      await retry;
      remote.reads.first.complete(_page());
      await obsolete;
      expect(notifier.state.batches.single.notes, 'Synthetic current data');
      expect(remote.writes.length, 1);
      notifier.dispose();
    },
  );
  test('disposed notifier ignores post-write completion', () async {
    final remote = _Remote();
    final subject = EvidenceNotifier(remote);
    final upload = subject.upload([_file()]);
    subject.dispose();
    remote.writes.single.complete({});
    expect(await upload, false);
    expect(remote.reads, isEmpty);
  });
  test(
    'a later failed read does not resurrect the earlier confirmed-upload notice',
    () async {
      final remote = _Remote();
      final subject = EvidenceNotifier(remote);
      final upload = subject.upload([_file()]);
      remote.writes.single.complete({});
      await Future<void>.delayed(Duration.zero);
      remote.failed(503);
      expect(await upload, true);
      expect(subject.state.uploadConfirmed, true);
      final recovery = subject.loadBatches();
      remote.loaded();
      await recovery;
      expect(subject.state.uploadConfirmed, false);
      final later = subject.loadBatches();
      remote.failed(503);
      await later;
      expect(subject.state.uploadConfirmed, false);
      expect(subject.state.loadError, isNotNull);
      subject.dispose();
    },
  );
  test(
    'local preparation failure releases uploading without leaking diagnostics',
    () async {
      final remote = _Remote();
      final notifier = EvidenceNotifier(remote);
      final upload = notifier.upload([_file()]);
      remote.writes.single.completeError(StateError('PRIVATE_DIAGNOSTIC'));
      expect(await upload, false);
      expect(notifier.state.isUploading, false);
      expect(notifier.state.uploadError, _failed);
      expect(remote.reads, isEmpty);
      notifier.dispose();
    },
  );
  test(
    'preserves defined server validation feedback for a rejected PDF',
    () async {
      final remote = _Remote();
      final notifier = EvidenceNotifier(remote);
      final upload = notifier.upload([_file()]);
      final options = RequestOptions(path: '/evidence/upload');
      remote.writes.single.completeError(
        DioException(
          requestOptions: options,
          response: Response(
            requestOptions: options,
            statusCode: 400,
            data: {'message': 'Solo se permiten PDFs.'},
          ),
        ),
      );
      expect(await upload, false);
      expect(notifier.state.uploadError, 'Solo se permiten PDFs.');
      notifier.dispose();
    },
  );
  for (final dark in [false, true]) {
    testWidgets('confirmed read failure reference ${dark ? "dark" : "light"}', (
      tester,
    ) async {
      final remote = _Remote(), key = GlobalKey();
      await _ready(tester, remote, picker, key, dark: dark);
      await _tap(tester, _submit);
      remote.writes.single.complete({});
      await _paint(tester);
      remote.failed(503);
      await _paint(tester);
      if (Platform.environment['PHASE5B_SKIP_GOLDENS'] != '1') {
        await expectLater(
          find.byKey(key),
          matchesGoldenFile(
            '../../../../docs/ui/evidence/phase5b/evidence-recovery/flutter-confirmed-${dark ? "dark" : "light"}-390.png',
          ),
        );
      }
    });
  }
}
