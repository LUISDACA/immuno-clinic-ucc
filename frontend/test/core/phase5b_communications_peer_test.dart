import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:immuno_clinic_app/features/auth/presentation/providers/auth_provider.dart';
import 'package:immuno_clinic_app/features/shared/data/datasources/communication_remote_ds.dart';
import 'package:immuno_clinic_app/features/shared/presentation/providers/communication_provider.dart';
import 'package:immuno_clinic_app/features/shared/presentation/providers/notification_provider.dart';
import 'package:immuno_clinic_app/features/shared/presentation/screens/communication_detail_screen.dart';
import 'package:immuno_clinic_app/features/shared/presentation/screens/communications_screen.dart';

import '../features/admin/presentation/screens/admin_dashboard_screen_test.dart'
    as mocks;

class _Threads extends StateNotifier<CommunicationState>
    implements CommunicationNotifier {
  _Threads(Map<String, dynamic> thread)
    : super(CommunicationState(threads: [thread]));

  @override
  Future<void> load({
    bool showLoading = true,
    bool forceRefresh = false,
  }) async {}

  @override
  Future<Map<String, dynamic>?> createThread({
    required String subject,
    required String message,
    String? category,
    String? studentId,
    String? adminId,
  }) async => throw StateError('This reference must not create a conversation');
}

class _Details implements CommunicationRemoteDataSource {
  final Map<String, dynamic> thread;
  _Details(this.thread);

  @override
  Future<Map<String, dynamic>> getThread(String threadId) async => thread;

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

void main() {
  final fixture =
      jsonDecode(
            File(
              '../docs/ui/fixtures/phase5b-communications-peer.json',
            ).readAsStringSync(),
          )
          as Map<String, dynamic>;
  final users = fixture['users'] as Map<String, dynamic>;
  const longPreview =
      'Synthetic conversation preview that continues beyond one line Synthetic conversation preview that continues beyond one line Synthetic conversation preview that continues beyond one line';

  for (final raw in fixture['cases'] as List<dynamic>) {
    final test = raw as Map<String, dynamic>;
    final viewer = users[test['viewer']] as Map<String, dynamic>;
    final peer = users[test['peer']] as Map<String, dynamic>;
    final thread = <String, dynamic>{
      'id': 'synthetic-thread',
      'subject': 'Synthetic subject',
      'status': 'open',
      'category': 'general',
      'student': users[test['student']],
      'created_by': users[test['created_by']],
      'recipient': users[test['recipient']],
      'last_message_at': '2026-01-01T00:00:00Z',
      'last_message': longPreview,
      'messages': <dynamic>[],
    };
    for (final detail in [false, true]) {
      testWidgets('${detail ? 'detail' : 'list'} counterpart: ${test['name']}', (
        tester,
      ) async {
        await tester.pumpWidget(
          ProviderScope(
            overrides: [
              authStateProvider.overrideWith(
                (ref) => mocks.MockAuthNotifier(
                  AuthState(
                    isAuthenticated: true,
                    role: viewer['role'] as String,
                    userId: viewer['id'] as String,
                    email: viewer['email'] as String,
                  ),
                ),
              ),
              notificationProvider.overrideWith(
                (ref) =>
                    mocks.MockNotificationNotifier(const NotificationState()),
              ),
              communicationProvider.overrideWith((ref) => _Threads(thread)),
              communicationRemoteDataSourceProvider.overrideWithValue(
                _Details(thread),
              ),
            ],
            child: MaterialApp(
              home: detail
                  ? const CommunicationDetailScreen(
                      threadId: 'synthetic-thread',
                    )
                  : const CommunicationsScreen(),
            ),
          ),
        );
        await tester.pumpAndSettle();
        expect(find.textContaining(peer['name'] as String), findsOneWidget);
        expect(find.textContaining(viewer['name'] as String), findsNothing);
        if (!detail) {
          final preview = find.text(longPreview);
          expect(preview, findsOneWidget);
          expect(tester.widget<Text>(preview).maxLines, 1);
        }
        expect(tester.takeException(), isNull);
        // Dispose polling timers between fixtures; no networking or real identities.
        await tester.pumpWidget(const SizedBox.shrink());
      });
    }
  }

  for (final detail in [false, true]) {
    testWidgets(
      '${detail ? 'detail' : 'list'} hides the recipient when no counterpart exists',
      (tester) async {
        final viewer = users['student'] as Map<String, dynamic>;
        final ownOnlyThread = <String, dynamic>{
          'id': 'synthetic-own-thread',
          'subject': 'Synthetic subject without counterpart',
          'status': 'open',
          'category': 'general',
          'student': viewer,
          'created_by': viewer,
          'recipient': null,
          'last_message_at': '2026-01-01T00:00:00Z',
          'last_message': null,
          'messages': <dynamic>[],
        };
        await tester.pumpWidget(
          ProviderScope(
            overrides: [
              authStateProvider.overrideWith(
                (ref) => mocks.MockAuthNotifier(
                  AuthState(
                    isAuthenticated: true,
                    role: 'student',
                    userId: viewer['id'] as String,
                    email: viewer['email'] as String,
                  ),
                ),
              ),
              notificationProvider.overrideWith(
                (ref) =>
                    mocks.MockNotificationNotifier(const NotificationState()),
              ),
              communicationProvider.overrideWith(
                (ref) => _Threads(ownOnlyThread),
              ),
              communicationRemoteDataSourceProvider.overrideWithValue(
                _Details(ownOnlyThread),
              ),
            ],
            child: MaterialApp(
              home: detail
                  ? const CommunicationDetailScreen(
                      threadId: 'synthetic-own-thread',
                    )
                  : const CommunicationsScreen(),
            ),
          ),
        );
        await tester.pumpAndSettle();
        expect(
          find.text('Synthetic subject without counterpart'),
          findsOneWidget,
        );
        expect(find.textContaining('Synthetic Student'), findsNothing);
        expect(find.textContaining('Con:'), findsNothing);
        expect(tester.takeException(), isNull);
        await tester.pumpWidget(const SizedBox.shrink());
      },
    );
  }
}
