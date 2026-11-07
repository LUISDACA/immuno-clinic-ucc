import 'dart:async';
import 'dart:collection';
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
import 'package:immuno_clinic_app/core/theme/app_theme.dart';
import 'package:immuno_clinic_app/features/auth/presentation/providers/auth_provider.dart';
import 'package:immuno_clinic_app/features/shared/data/datasources/communication_remote_ds.dart';
import 'package:immuno_clinic_app/features/shared/presentation/providers/communication_provider.dart';
import 'package:immuno_clinic_app/features/shared/presentation/providers/notification_provider.dart';
import 'package:immuno_clinic_app/features/shared/presentation/screens/communication_detail_screen.dart';
import 'package:immuno_clinic_app/features/shared/presentation/screens/communications_screen.dart';

import '../features/admin/presentation/screens/admin_dashboard_screen_test.dart'
    as mocks;

class _Fonts implements AssetManifest {
  final Map<String, ByteData> fonts;
  _Fonts(this.fonts);
  @override
  List<String> listAssets() => fonts.keys.toList();
  @override
  List<AssetMetadata>? getAssetVariants(String key) => null;
}

class _Remote implements CommunicationRemoteDataSource {
  final lists = <Completer<List<dynamic>>>[];
  final details = <Completer<Map<String, dynamic>>>[];
  final recipientRequests =
      <({String target, String search, Completer<List<dynamic>> result})>[];
  final send = Completer<Map<String, dynamic>>();
  int sends = 0;
  int statuses = 0;
  @override
  Future<List<dynamic>> getThreads() {
    final request = Completer<List<dynamic>>();
    lists.add(request);
    return request.future;
  }

  @override
  Future<Map<String, dynamic>> getThread(String id) {
    final request = Completer<Map<String, dynamic>>();
    details.add(request);
    return request.future;
  }

  @override
  Future<List<dynamic>> searchRecipients({
    required String target,
    required String search,
  }) {
    final result = Completer<List<dynamic>>();
    recipientRequests.add((target: target, search: search, result: result));
    return result.future;
  }

  @override
  Future<Map<String, dynamic>> sendMessage(String id, String message) {
    sends++;
    return send.future;
  }

  @override
  Future<Map<String, dynamic>> updateStatus(String id, String status) async {
    statuses++;
    return {..._thread(), 'status': status};
  }

  @override
  Future<Map<String, dynamic>> createThread({
    required String subject,
    required String message,
    String? category,
    String? studentId,
    String? adminId,
  }) async => throw _error(503);

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class _Notifications extends mocks.MockNotificationNotifier {
  final pending = Queue<Completer<void>>();
  int writes = 0;
  _Notifications() : super(const NotificationState());
  @override
  Future<void> markCategoryRead(String category) {
    expect(category, 'communication');
    writes++;
    if (pending.isEmpty) return Future.value();
    return pending.removeFirst().future;
  }
}

Map<String, dynamic> _thread({bool empty = false, String role = 'student'}) => {
  'id': 'synthetic-thread',
  'subject': 'Synthetic conversation',
  'status': 'open',
  'student': role == 'app_admin'
      ? null
      : {
          'id': 'synthetic-student',
          'role': 'student',
          'name': 'Synthetic student',
          'email': 'student@example.invalid',
        },
  'created_by': {
    'id': role == 'app_admin' ? 'synthetic-app_admin' : 'synthetic-admin',
    'role': role == 'app_admin' ? 'app_admin' : 'admin',
    'name': role == 'app_admin' ? 'Synthetic app admin' : 'Synthetic admin',
    'email': 'admin@example.invalid',
  },
  'recipient': {
    'id': role == 'app_admin' ? 'synthetic-admin' : 'synthetic-student',
    'role': role == 'app_admin' ? 'admin' : 'student',
    'name': role == 'app_admin' ? 'Synthetic admin' : 'Synthetic student',
    'email': role == 'app_admin'
        ? 'admin@example.invalid'
        : 'student@example.invalid',
  },
  'last_message_at': '2026-10-01T12:00:00Z',
  'messages': empty
      ? <dynamic>[]
      : [
          {
            'id': 'synthetic-message',
            'body': 'Synthetic message',
            'created_at': '2026-10-01T12:00:00Z',
            'sender': {
              'id': 'synthetic-admin',
              'role': 'admin',
              'name': 'Synthetic admin',
            },
          },
        ],
};

DioException _error(int status) {
  final request = RequestOptions(path: '/communications/threads');
  return DioException(
    requestOptions: request,
    response: Response(
      requestOptions: request,
      statusCode: status,
      data: {'message': 'PRIVATE_DIAGNOSTIC_MUST_NOT_RENDER'},
    ),
  );
}

const _messages = {
  401: 'Tu sesión expiró. Inicia sesión nuevamente.',
  403: 'No tienes permiso para consultar esta información.',
  404: 'No se encontró la información solicitada.',
  429: 'Demasiadas solicitudes. Espera antes de reintentar.',
  500: 'Ocurrió un error en el servidor. Intenta nuevamente.',
  503: 'El servicio no está disponible temporalmente.',
};

Future<ProviderContainer> _mount(
  WidgetTester tester,
  _Remote remote, {
  required bool detail,
  String role = 'student',
  bool dark = false,
  _Notifications? notifications,
  GlobalKey? capture,
}) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        authStateProvider.overrideWith(
          (ref) => mocks.MockAuthNotifier(
            AuthState(
              isAuthenticated: true,
              role: role,
              userId: 'synthetic-$role',
              email: '$role@example.invalid',
            ),
          ),
        ),
        notificationProvider.overrideWith(
          (ref) => notifications ?? _Notifications(),
        ),
        communicationRemoteDataSourceProvider.overrideWithValue(remote),
      ],
      child: MaterialApp(
        theme: dark ? AppTheme.darkTheme : AppTheme.lightTheme,
        home: RepaintBoundary(
          key: capture,
          child: detail
              ? const CommunicationDetailScreen(threadId: 'synthetic-thread')
              : const CommunicationsScreen(),
        ),
      ),
    ),
  );
  await tester.pump();
  return ProviderScope.containerOf(tester.element(find.byType(Scaffold).first));
}

Future<void> _paint(WidgetTester tester) async {
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 250));
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
    final assets = {
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

  for (final detail in [false, true]) {
    for (final entry in _messages.entries) {
      testWidgets('${detail ? 'detail' : 'list'} safe ${entry.key} and retry', (
        tester,
      ) async {
        final remote = _Remote();
        await _mount(tester, remote, detail: detail);
        expect(find.byType(CircularProgressIndicator), findsOneWidget);
        if (detail) {
          remote.details.single.completeError(_error(entry.key));
        } else {
          remote.lists.single.completeError(_error(entry.key));
        }
        await _paint(tester);
        expect(find.text(entry.value), findsOneWidget);
        expect(find.textContaining('PRIVATE_DIAGNOSTIC'), findsNothing);
        expect(find.text('No hay conversaciones'), findsNothing);
        final retry = tester.widget<TextButton>(
          find.widgetWithText(TextButton, 'Reintentar'),
        );
        retry.onPressed!();
        retry.onPressed!(); // Same callbacks, before the next frame.
        await _paint(tester);
        expect(detail ? remote.details.length : remote.lists.length, 2);
        expect(find.byType(CircularProgressIndicator), findsOneWidget);
        if (detail) {
          remote.details.last.complete(_thread(empty: true));
        } else {
          remote.lists.last.complete([]);
        }
        await _paint(tester);
        expect(
          find.text(detail ? 'No hay mensajes' : 'No hay conversaciones'),
          findsOneWidget,
        );
        expect(remote.sends + remote.statuses, 0);
        expect(tester.takeException(), isNull);
        await tester.pumpWidget(const SizedBox.shrink());
      });
    }
  }

  testWidgets(
    'recipient search distinguishes empty from error and retries the same query',
    (tester) async {
      final remote = _Remote();
      await _mount(tester, remote, detail: false);
      remote.lists.single.complete([]);
      await _paint(tester);
      await tester.tap(find.text('Nuevo'));
      await _paint(tester);

      final field = find.byWidgetPredicate(
        (widget) =>
            widget is TextField &&
            widget.decoration?.labelText == 'Correo del administrador',
      );
      await tester.enterText(field, 'al');
      await tester.pump(const Duration(milliseconds: 300));
      expect(remote.recipientRequests.single.search, 'al');
      expect(remote.recipientRequests.single.target, 'admins');

      remote.recipientRequests.single.result.completeError(_error(503));
      await _paint(tester);
      expect(find.text('No se pudieron buscar destinatarios.'), findsOneWidget);
      expect(find.text('No hay destinatarios disponibles.'), findsNothing);
      expect(find.textContaining('PRIVATE_DIAGNOSTIC'), findsNothing);

      await tester.tap(find.text('Reintentar búsqueda'));
      await _paint(tester);
      expect(remote.recipientRequests.length, 2);
      expect(remote.recipientRequests.last.search, 'al');
      remote.recipientRequests.last.result.complete([]);
      await _paint(tester);
      expect(find.text('No hay destinatarios disponibles.'), findsOneWidget);
      expect(find.text('No se pudieron buscar destinatarios.'), findsNothing);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );

  testWidgets(
    'shortening a recipient query clears loading and ignores the late response',
    (tester) async {
      final remote = _Remote();
      await _mount(tester, remote, detail: false);
      remote.lists.single.complete([]);
      await _paint(tester);
      await tester.tap(find.text('Nuevo'));
      await _paint(tester);

      final field = find.byWidgetPredicate(
        (widget) =>
            widget is TextField &&
            widget.decoration?.labelText == 'Correo del administrador',
      );
      await tester.enterText(field, 'al');
      await tester.pump(const Duration(milliseconds: 300));
      expect(remote.recipientRequests.length, 1);
      expect(find.byType(CircularProgressIndicator), findsOneWidget);

      await tester.enterText(field, 'a');
      await tester.pump();
      expect(find.byType(CircularProgressIndicator), findsNothing);
      remote.recipientRequests.single.result.complete([
        {
          'id': 'synthetic-admin',
          'name': 'Synthetic admin',
          'email': 'admin@example.invalid',
        },
      ]);
      await _paint(tester);
      expect(find.text('admin@example.invalid'), findsNothing);
      expect(find.byType(CircularProgressIndicator), findsNothing);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );

  test(
    'list failed refresh invalidates TTL; a nonforced retry reaches the API',
    () async {
      final remote = _Remote();
      final state = CommunicationNotifier(remote);
      addTearDown(state.dispose);
      final initial = state.load();
      remote.lists.last.complete([_thread()]);
      await initial;
      final refresh = state.load(forceRefresh: true, showLoading: false);
      remote.lists.last.completeError(_error(503));
      await refresh;
      final retry = state.load();
      expect(remote.lists.length, 3);
      remote.lists.last.complete([]);
      await retry;
      expect(state.state.error, isNull);
    },
  );

  test(
    'list error after failed creation cannot trap retry behind the TTL',
    () async {
      final remote = _Remote();
      final notifier = CommunicationNotifier(remote);
      addTearDown(notifier.dispose);
      final first = notifier.load();
      remote.lists.last.complete([]);
      await first;
      expect(
        await notifier.createThread(
          subject: 'Synthetic subject',
          message: 'Synthetic message',
        ),
        isNull,
      );
      final retry = notifier.load();
      expect(remote.lists.length, 2);
      remote.lists.last.complete([]);
      await retry;
      expect(notifier.state.error, isNull);
    },
  );

  testWidgets(
    'detail denies stale content/actions after 403, preserves draft through recovery',
    (tester) async {
      final remote = _Remote();
      await _mount(tester, remote, detail: true);
      remote.details.last.complete(_thread());
      await _paint(tester);
      await tester.enterText(find.byType(TextField), 'Synthetic unsent draft');
      await tester.pump(const Duration(seconds: 3));
      remote.details.last.completeError(_error(403));
      await _paint(tester);
      expect(find.text(_messages[403]!), findsOneWidget);
      expect(find.text('Synthetic message'), findsNothing);
      expect(find.byType(TextField), findsNothing);
      expect(find.byTooltip('Cerrar conversación'), findsNothing);
      await tester.tap(find.text('Reintentar'));
      await _paint(tester);
      remote.details.last.complete(_thread());
      await _paint(tester);
      expect(find.text('Synthetic unsent draft'), findsOneWidget);
      expect(find.text('Synthetic message'), findsOneWidget);
      expect(remote.sends + remote.statuses, 0);
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );

  testWidgets(
    'a failed GET started before sending cannot replace the confirmed message',
    (tester) async {
      final remote = _Remote();
      await _mount(tester, remote, detail: true);
      remote.details.last.complete(_thread());
      await _paint(tester);
      await tester.pump(const Duration(seconds: 3));
      final olderRead = remote.details.last;
      await tester.enterText(find.byType(TextField), 'Synthetic sent message');
      await tester.tap(find.byIcon(Icons.send_outlined));
      remote.send.complete({
        ..._thread(),
        'messages': [
          {
            'id': 'confirmed',
            'body': 'Synthetic confirmed message',
            'sender': {'id': 'synthetic-student'},
          },
        ],
      });
      await _paint(tester);
      olderRead.completeError(_error(403));
      await _paint(tester);
      expect(find.text('Synthetic confirmed message'), findsOneWidget);
      expect(find.text('Reintentar'), findsNothing);
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );

  testWidgets(
    'read-mark failure has separate recovery and cannot masquerade as a GET failure',
    (tester) async {
      final remote = _Remote(), notifications = _Notifications();
      final failed = Completer<void>(), retry = Completer<void>();
      notifications.pending.addAll([failed, retry]);
      await _mount(tester, remote, detail: true, notifications: notifications);
      remote.details.last.complete(_thread());
      await _paint(tester);
      failed.completeError(_error(503));
      await _paint(tester);
      expect(find.text('Synthetic message'), findsOneWidget);
      expect(
        find.text('No se pudo actualizar la lectura de notificaciones.'),
        findsOneWidget,
      );
      final button = tester.widget<TextButton>(
        find.widgetWithText(TextButton, 'Reintentar lectura'),
      );
      button.onPressed!();
      button.onPressed!();
      await _paint(tester);
      expect(notifications.writes, 2);
      expect(remote.details.length, 1);
      expect(
        tester
            .widget<TextButton>(
              find.widgetWithText(TextButton, 'Reintentar lectura'),
            )
            .onPressed,
        isNull,
      );
      retry.complete();
      await _paint(tester);
      expect(
        find.text('No se pudo actualizar la lectura de notificaciones.'),
        findsNothing,
      );
      expect(find.text('Synthetic message'), findsOneWidget);
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );

  testWidgets(
    'polling the same thread cannot invalidate a pending read retry',
    (tester) async {
      final remote = _Remote(), notifications = _Notifications();
      final failed = Completer<void>(), retry = Completer<void>();
      notifications.pending.addAll([failed, retry]);
      await _mount(tester, remote, detail: true, notifications: notifications);
      remote.details.last.complete(_thread());
      await _paint(tester);
      failed.completeError(_error(503));
      await _paint(tester);
      await tester.tap(find.text('Reintentar lectura'));
      await _paint(tester);
      await tester.pump(const Duration(seconds: 3));
      remote.details.last.complete(_thread());
      await _paint(tester);
      retry.complete();
      await _paint(tester);
      expect(notifications.writes, 2);
      expect(
        find.text('No se pudo actualizar la lectura de notificaciones.'),
        findsNothing,
      );
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );

  for (final role in ['student', 'admin', 'app_admin']) {
    for (final dark in [false, true]) {
      for (final detail in [false, true]) {
        testWidgets(
          'states reference $role ${dark ? 'dark' : 'light'} ${detail ? 'detail' : 'list'}',
          (tester) async {
            tester.view.physicalSize = const Size(390, 844);
            tester.view.devicePixelRatio = 1;
            addTearDown(tester.view.resetPhysicalSize);
            addTearDown(tester.view.resetDevicePixelRatio);
            final remote = _Remote(), key = GlobalKey();
            final container = await _mount(
              tester,
              remote,
              detail: detail,
              role: role,
              dark: dark,
              capture: key,
            );
            Future<void> capture(String state) async {
              if (Platform.environment['PHASE5B_SKIP_GOLDENS'] == '1') return;
              await expectLater(
                find.byKey(key),
                matchesGoldenFile(
                  '../../../docs/ui/evidence/phase5b/communications-states/flutter-$role-${dark ? 'dark' : 'light'}-${detail ? 'detail' : 'list'}-$state-390.png',
                ),
              );
            }

            await capture('loading');
            if (detail) {
              remote.details.last.complete(_thread(empty: true, role: role));
            } else {
              remote.lists.last.complete([]);
            }
            await _paint(tester);
            expect(
              find.text(detail ? 'No hay mensajes' : 'No hay conversaciones'),
              findsOneWidget,
            );
            await capture('empty');
            if (detail) {
              await tester.pump(const Duration(seconds: 3));
              remote.details.last.completeError(_error(503));
            } else {
              final load = container
                  .read(communicationProvider.notifier)
                  .load(forceRefresh: true, showLoading: false);
              remote.lists.last.completeError(_error(503));
              await load;
            }
            await _paint(tester);
            expect(find.text(_messages[503]!), findsOneWidget);
            await capture('error');
            await tester.tap(find.text('Reintentar'));
            await _paint(tester);
            await capture('retrying');
            if (detail) {
              remote.details.last.complete(_thread(role: role));
            } else {
              remote.lists.last.complete([_thread(role: role)]);
            }
            await _paint(tester);
            expect(find.text('Synthetic conversation'), findsOneWidget);
            await capture('success');
            expect(remote.sends + remote.statuses, 0);
            expect(tester.takeException(), isNull);
            await tester.pumpWidget(const SizedBox.shrink());
          },
        );
      }
    }
  }
}
