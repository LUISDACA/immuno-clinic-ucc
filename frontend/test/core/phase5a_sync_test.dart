import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:immuno_clinic_app/core/network/api_client.dart';
import 'package:immuno_clinic_app/features/admin/data/datasources/admin_remote_ds.dart';
import 'package:immuno_clinic_app/features/admin/data/models/admin_models.dart';
import 'package:immuno_clinic_app/features/admin/presentation/providers/admin_provider.dart';
import 'package:immuno_clinic_app/features/shared/data/datasources/notification_remote_ds.dart';
import 'package:immuno_clinic_app/features/shared/data/models/notification_model.dart';
import 'package:immuno_clinic_app/features/shared/presentation/providers/notification_provider.dart';
import 'package:immuno_clinic_app/features/student/presentation/screens/profile_screen.dart';
import 'package:immuno_clinic_app/features/student/data/datasources/evidence_remote_ds.dart';
import 'package:immuno_clinic_app/features/student/data/models/evidence_model.dart';
import 'package:immuno_clinic_app/features/student/presentation/providers/evidence_provider.dart';

class MockAdmin extends Mock implements AdminRemoteDataSource {}

class MockNotifications extends Mock implements NotificationRemoteDataSource {}

class MockApi extends Mock implements ApiClient {}

class MockEvidence extends Mock implements EvidenceRemoteDataSource {}

PaginatedResponse<AdminStudentListItem> page(int number) => PaginatedResponse(
  items: [
    AdminStudentListItem(
      id: '$number',
      email: 'synthetic@example.invalid',
      isActive: true,
    ),
  ],
  total: 21,
  page: number,
  pageSize: 20,
  totalPages: 2,
);
const unread = NotificationModel(
  id: 'synthetic',
  title: 'Synthetic',
  message: 'Synthetic',
  isRead: false,
  createdAt: '2026-01-01T00:00:00Z',
  category: 'communication',
);

void main() {
  test(
    'removing the last student on a page reloads a valid page with its filters',
    () async {
      final ds = MockAdmin();
      var deleted = false;
      when(
        () => ds.listStudents(
          page: 2,
          pageSize: 20,
          search: 'synthetic',
          isActive: true,
        ),
      ).thenAnswer(
        (_) async => deleted
            ? const PaginatedResponse<AdminStudentListItem>(
                items: [],
                total: 20,
                page: 2,
                pageSize: 20,
                totalPages: 1,
              )
            : page(2),
      );
      when(
        () => ds.listStudents(
          page: 1,
          pageSize: 20,
          search: 'synthetic',
          isActive: true,
        ),
      ).thenAnswer((_) async => page(1));
      when(() => ds.deleteStudent('2')).thenAnswer((_) async {
        deleted = true;
      });
      final notifier = AdminStudentListNotifier(ds);
      await notifier.load(page: 2, search: 'synthetic', isActive: true);
      expect(await notifier.deleteStudent('2'), true);
      expect(notifier.state.page, 1);
      expect(notifier.state.isLoading, false);
      verify(
        () => ds.listStudents(
          page: 1,
          pageSize: 20,
          search: 'synthetic',
          isActive: true,
        ),
      ).called(1);
      notifier.dispose();
    },
  );
  test(
    'removing the last evidence batch reloads without remaining in loading',
    () async {
      final ds = MockEvidence();
      const first = EvidencePageModel(
        items: [],
        page: 1,
        size: 20,
        total: 0,
        pages: 0,
        hasNext: false,
        hasPrevious: false,
      );
      var deleted = false;
      when(() => ds.getMyBatches(page: 2)).thenAnswer(
        (_) async => EvidencePageModel(
          items: deleted
              ? []
              : [
                  EvidenceBatchModel.fromJson({
                    'id': 'synthetic',
                    'status': 'in_review',
                  }),
                ],
          page: 2,
          size: 20,
          total: deleted ? 0 : 21,
          pages: deleted ? 0 : 2,
          hasNext: false,
          hasPrevious: true,
        ),
      );
      when(() => ds.getMyBatches(page: 1)).thenAnswer((_) async => first);
      when(() => ds.deleteBatch('synthetic')).thenAnswer((_) async {
        deleted = true;
      });
      final notifier = EvidenceNotifier(ds);
      await notifier.loadBatches(page: 2);
      await notifier.delete('synthetic');
      expect(notifier.state.page?.page, 1);
      expect(notifier.state.isLoading, false);
      expect(notifier.state.batches, isEmpty);
      verify(() => ds.getMyBatches(page: 1)).called(1);
      notifier.dispose();
    },
  );
  test(
    'student pages are bounded, preserve filters and ignore an older response',
    () async {
      final ds = MockAdmin(),
          old = Completer<PaginatedResponse<AdminStudentListItem>>();
      when(
        () => ds.listStudents(
          page: 1,
          pageSize: 20,
          search: 'synthetic',
          isActive: true,
        ),
      ).thenAnswer((_) => old.future);
      when(
        () => ds.listStudents(
          page: 2,
          pageSize: 20,
          search: 'synthetic',
          isActive: true,
        ),
      ).thenAnswer((_) async => page(2));
      final notifier = AdminStudentListNotifier(ds);
      final pending = notifier.load(search: 'synthetic', isActive: true);
      await notifier.load(page: 2, search: 'synthetic', isActive: true);
      old.complete(page(1));
      await pending;
      expect(notifier.state.page, 2);
      expect(notifier.state.total, 21);
      await notifier.refresh();
      expect(notifier.state.page, 2);
      verify(
        () => ds.listStudents(
          page: 2,
          pageSize: 20,
          search: 'synthetic',
          isActive: true,
        ),
      ).called(2);
      notifier.dispose();
    },
  );
  test(
    'a confirmed notification read cannot be overwritten by a pending GET or duplicated',
    () async {
      final ds = MockNotifications(),
          old = Completer<List<NotificationModel>>(),
          write = Completer<void>();
      var reads = 0;
      when(() => ds.getNotifications()).thenAnswer(
        (_) => ++reads == 1 ? old.future : Future.value([unread.markRead()]),
      );
      when(
        () => ds.markCategoryAsRead('communication'),
      ).thenAnswer((_) => write.future);
      final notifier = NotificationNotifier(ds);
      final pending = notifier.load();
      final first = notifier.markCategoryRead('communication');
      final second = notifier.markCategoryRead('communication');
      write.complete();
      await Future.wait([first, second]);
      old.complete([unread]);
      await pending;
      expect(notifier.state.unreadCount, 0);
      expect(notifier.state.notifications.single.isRead, true);
      verify(() => ds.markCategoryAsRead('communication')).called(1);
      notifier.dispose();
    },
  );
  test('failed read does not pretend that notification was read', () async {
    final ds = MockNotifications();
    when(() => ds.getNotifications()).thenAnswer((_) async => [unread]);
    when(
      () => ds.markAsRead('synthetic'),
    ).thenAnswer((_) async => throw StateError('Synthetic failure'));
    final notifier = NotificationNotifier(ds);
    await notifier.load();
    await expectLater(notifier.markRead('synthetic'), throwsStateError);
    expect(notifier.state.unreadCount, 1);
    expect(notifier.state.notifications.single.isRead, false);
    notifier.dispose();
  });
  test(
    'profile save blocks double submit and discards pre-write response',
    () async {
      final api = MockApi(), dio = Dio(), old = Completer<void>();
      when(() => api.dio).thenReturn(dio);
      var reads = 0, writes = 0;
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) async {
            if (options.method == 'PUT') {
              writes++;
              handler.resolve(
                Response(requestOptions: options, statusCode: 200),
              );
            } else {
              final count = ++reads;
              if (count == 1) await old.future;
              handler.resolve(
                Response(
                  requestOptions: options,
                  statusCode: 200,
                  data: {
                    'profile': {'phone': count == 1 ? 'old' : 'new'},
                  },
                ),
              );
            }
          },
        ),
      );
      final notifier = ProfileNotifier(api);
      final read = notifier.loadProfile();
      await Future<void>.delayed(Duration.zero);
      final save = notifier.updateProfile(phone: 'new');
      expect(await notifier.updateProfile(phone: 'duplicate'), false);
      expect(await save, true);
      old.complete();
      await read;
      expect(writes, 1);
      expect(notifier.state.profile?['profile']['phone'], 'new');
      expect(notifier.state.isSaving, false);
      notifier.dispose();
    },
  );
  test('disposed notification provider ignores late responses', () async {
    final ds = MockNotifications(),
        response = Completer<List<NotificationModel>>();
    when(() => ds.getNotifications()).thenAnswer((_) => response.future);
    final notifier = NotificationNotifier(ds), pending = notifier.load();
    notifier.dispose();
    response.complete([unread]);
    await pending;
  });
}
