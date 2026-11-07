import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:immuno_clinic_app/features/auth/presentation/providers/auth_provider.dart';
import 'package:immuno_clinic_app/features/shared/data/datasources/notification_remote_ds.dart';
import 'package:immuno_clinic_app/features/shared/data/models/notification_model.dart';
import 'package:immuno_clinic_app/features/shared/presentation/providers/notification_provider.dart';
import 'package:immuno_clinic_app/features/shared/presentation/screens/notifications_screen.dart';

class _Source extends Mock implements NotificationRemoteDataSource {}

class _Auth extends StateNotifier<AuthState> implements AuthNotifier {
  _Auth() : super(const AuthState(userId: 'synthetic-first'));
  void changeUser(String? id) => state = AuthState(userId: id);
  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

const _notice = NotificationModel(
  id: 'synthetic',
  title: 'Synthetic notice',
  message: 'Synthetic message',
  isRead: false,
  createdAt: '2026-10-09T12:00:00Z',
);

Future<void> _mount(WidgetTester tester, _Source source) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        notificationProvider.overrideWith(
          (ref) => NotificationNotifier(source),
        ),
      ],
      child: const MaterialApp(home: NotificationsScreen()),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  test(
    'failure keeps previous notifications and permits a retry within cache TTL',
    () async {
      final source = _Source();
      var requests = 0;
      when(() => source.getNotifications()).thenAnswer((_) async {
        if (++requests == 2) throw StateError('Synthetic failure');
        return requests == 1 ? [_notice] : [_notice.markRead()];
      });
      final notifier = NotificationNotifier(source);
      addTearDown(notifier.dispose);
      await notifier.load();
      await notifier.load(forceRefresh: true, showLoading: false);
      expect(
        notifier.state.errorMessage,
        'No se pudieron cargar las notificaciones.',
      );
      expect(notifier.state.notifications.single, same(_notice));
      expect(notifier.state.unreadCount, 1);
      expect(notifier.state.isLoading, false);
      await notifier.load();
      expect(requests, 3);
      expect(notifier.state.errorMessage, isNull);
      expect(notifier.state.notifications.single.isRead, true);
      expect(notifier.state.unreadCount, 0);
    },
  );

  test(
    'authorization failure clears retained notifications and count',
    () async {
      final source = _Source();
      var requests = 0;
      when(() => source.getNotifications()).thenAnswer((_) async {
        if (++requests == 1) return [_notice];
        final request = RequestOptions(path: '/notifications');
        throw DioException(
          requestOptions: request,
          response: Response(
            requestOptions: request,
            statusCode: 403,
            data: {'message': 'Synthetic private diagnostic'},
          ),
        );
      });
      final notifier = NotificationNotifier(source);
      addTearDown(notifier.dispose);

      await notifier.load();
      expect(notifier.state.notifications, [_notice]);
      await notifier.load(forceRefresh: true);

      expect(notifier.state.notifications, isEmpty);
      expect(notifier.state.unreadCount, 0);
      expect(
        notifier.state.errorMessage,
        'No se pudieron cargar las notificaciones.',
      );
    },
  );

  testWidgets('failed mark-read shows a safe message and keeps notice unread', (
    tester,
  ) async {
    final source = _Source();
    when(() => source.getNotifications()).thenAnswer((_) async => [_notice]);
    when(
      () => source.markAsRead(_notice.id),
    ).thenThrow(StateError('Synthetic private diagnostic'));
    await _mount(tester, source);

    await tester.tap(find.byTooltip('Marcar como leída'));
    await tester.pumpAndSettle();

    expect(
      find.text('No se pudo marcar como leída. Inténtalo de nuevo.'),
      findsOneWidget,
    );
    expect(find.text('Synthetic private diagnostic'), findsNothing);
    expect(find.text('Synthetic notice'), findsOneWidget);
    expect(find.text('1'), findsWidgets);
  });

  test('older failure cannot replace a newer success', () async {
    final source = _Source(), old = Completer<List<NotificationModel>>();
    var requests = 0;
    when(
      () => source.getNotifications(),
    ).thenAnswer((_) => ++requests == 1 ? old.future : Future.value([_notice]));
    final notifier = NotificationNotifier(source);
    addTearDown(notifier.dispose);
    final pending = notifier.load();
    await notifier.load(forceRefresh: true);
    old.completeError(StateError('Synthetic late failure'));
    await pending;
    expect(notifier.state.notifications.single, same(_notice));
    expect(notifier.state.errorMessage, isNull);
    expect(notifier.state.isLoading, false);
  });

  test('older success cannot clear a newer failure', () async {
    final source = _Source(), old = Completer<List<NotificationModel>>();
    var requests = 0;
    when(() => source.getNotifications()).thenAnswer(
      (_) => ++requests == 1
          ? old.future
          : Future.error(StateError('Synthetic failure')),
    );
    final notifier = NotificationNotifier(source);
    addTearDown(notifier.dispose);
    final pending = notifier.load();
    await notifier.load(forceRefresh: true);
    old.complete([_notice]);
    await pending;
    expect(notifier.state.notifications, isEmpty);
    expect(notifier.state.errorMessage, isNotNull);
  });

  test(
    'failed post-write refresh preserves confirmed read and exposes load error',
    () async {
      final source = _Source();
      var requests = 0;
      when(() => source.getNotifications()).thenAnswer((_) async {
        if (++requests > 1) throw StateError('Synthetic refresh failure');
        return [_notice];
      });
      when(() => source.markAsRead(_notice.id)).thenAnswer((_) async {});
      final notifier = NotificationNotifier(source);
      addTearDown(notifier.dispose);
      await notifier.load();
      await notifier.markRead(_notice.id);
      expect(notifier.state.notifications.single.isRead, true);
      expect(notifier.state.unreadCount, 0);
      expect(notifier.state.errorMessage, isNotNull);
    },
  );

  for (final userId in <String?>['synthetic-second', null]) {
    test(
      'user change/logout clears error and discards old response: $userId',
      () async {
        final source = _Source(), auth = _Auth();
        final old = Completer<List<NotificationModel>>();
        var requests = 0;
        when(() => source.getNotifications()).thenAnswer((_) {
          if (++requests == 1) {
            return Future.error(StateError('Synthetic failure'));
          }
          return old.future;
        });
        final container = ProviderContainer(
          overrides: [
            authStateProvider.overrideWith((ref) => auth),
            notificationRemoteDataSourceProvider.overrideWithValue(source),
          ],
        );
        addTearDown(container.dispose);
        final subscription = container.listen(notificationProvider, (_, _) {});
        addTearDown(subscription.close);
        final previous = container.read(notificationProvider.notifier);
        await previous.load();
        expect(container.read(notificationProvider).errorMessage, isNotNull);
        final pending = previous.load();
        auth.changeUser(userId);
        await container.pump();
        expect(container.read(notificationProvider).errorMessage, isNull);
        expect(container.read(notificationProvider).notifications, isEmpty);
        old.complete([_notice]);
        await pending;
        expect(container.read(notificationProvider).notifications, isEmpty);
      },
    );
  }

  test('failure after disposal cannot update state', () async {
    final source = _Source(), response = Completer<List<NotificationModel>>();
    when(() => source.getNotifications()).thenAnswer((_) => response.future);
    final notifier = NotificationNotifier(source), pending = notifier.load();
    notifier.dispose();
    response.completeError(StateError('Synthetic late failure'));
    await pending;
  });

  testWidgets('initial failure is an error, never an empty success', (
    tester,
  ) async {
    final source = _Source();
    when(() => source.getNotifications()).thenAnswer(
      (_) async => throw StateError('Synthetic internal diagnostic'),
    );
    await _mount(tester, source);
    expect(
      find.text('No se pudieron cargar las notificaciones.'),
      findsOneWidget,
    );
    expect(find.text('No tienes notificaciones'), findsNothing);
    expect(find.textContaining('Synthetic internal diagnostic'), findsNothing);
    expect(find.widgetWithText(TextButton, 'Reintentar'), findsOneWidget);
    expect(find.byType(CircularProgressIndicator), findsNothing);
  });

  testWidgets('retry loads real state and cannot be submitted twice', (
    tester,
  ) async {
    final source = _Source(), response = Completer<List<NotificationModel>>();
    var requests = 0;
    when(() => source.getNotifications()).thenAnswer((_) {
      if (++requests == 1) return Future.error(StateError('Synthetic failure'));
      return response.future;
    });
    await _mount(tester, source);
    final retry = tester.widget<TextButton>(
      find.widgetWithText(TextButton, 'Reintentar'),
    );
    retry.onPressed!();
    retry.onPressed!();
    await tester.pump();
    expect(requests, 2);
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
    response.complete([_notice]);
    await tester.pumpAndSettle();
    expect(find.text(_notice.title), findsOneWidget);
    expect(
      find.text('No se pudieron cargar las notificaciones.'),
      findsNothing,
    );
    expect(tester.takeException(), isNull);
  });

  testWidgets(
    'failed refresh keeps previous list visible until retry succeeds',
    (tester) async {
      final source = _Source();
      var requests = 0;
      when(() => source.getNotifications()).thenAnswer((_) async {
        if (++requests == 2) throw StateError('Synthetic failure');
        return requests == 1 ? [_notice] : [_notice.markRead()];
      });
      await _mount(tester, source);
      final context = tester.element(find.byType(NotificationsScreen));
      final notifier = ProviderScope.containerOf(
        context,
      ).read(notificationProvider.notifier);
      await notifier.load(forceRefresh: true, showLoading: false);
      await tester.pumpAndSettle();
      expect(find.text(_notice.title), findsOneWidget);
      expect(
        find.text('No se pudieron cargar las notificaciones.'),
        findsOneWidget,
      );
      expect(find.text('No tienes notificaciones'), findsNothing);
      await tester.tap(find.text('Reintentar'));
      await tester.pumpAndSettle();
      expect(find.text(_notice.title), findsOneWidget);
      expect(
        find.text('No se pudieron cargar las notificaciones.'),
        findsNothing,
      );
      expect(find.byTooltip('Marcar como leída'), findsNothing);
    },
  );

  testWidgets('successful empty retry becomes an explicit empty success', (
    tester,
  ) async {
    final source = _Source();
    var requests = 0;
    when(() => source.getNotifications()).thenAnswer((_) async {
      if (++requests == 1) throw StateError('Synthetic failure');
      return [];
    });
    await _mount(tester, source);
    await tester.tap(find.text('Reintentar'));
    await tester.pumpAndSettle();
    expect(find.text('No tienes notificaciones'), findsOneWidget);
    expect(
      find.text('No se pudieron cargar las notificaciones.'),
      findsNothing,
    );
  });
}
