import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/datasources/notification_remote_ds.dart';
import '../../data/models/notification_model.dart';

class NotificationState {
  final bool isLoading;
  final List<NotificationModel> notifications;
  final int unreadCount;

  const NotificationState({
    this.isLoading = false,
    this.notifications = const [],
    this.unreadCount = 0,
  });

  int get unreadCommunicationCount => notifications
      .where(
        (notification) =>
            !notification.isRead && notification.category == 'communication',
      )
      .length;
}

class NotificationNotifier extends StateNotifier<NotificationState> {
  static const _cacheTtl = Duration(seconds: 15);

  final NotificationRemoteDataSource _ds;
  NotificationNotifier(this._ds) : super(const NotificationState());

  DateTime? _lastLoadedAt;
  Future<void>? _inFlightLoad;
  bool _hasLoaded = false;

  Future<void> load({bool forceRefresh = false, bool showLoading = true}) {
    final lastLoadedAt = _lastLoadedAt;
    if (!forceRefresh &&
        _hasLoaded &&
        lastLoadedAt != null &&
        DateTime.now().difference(lastLoadedAt) < _cacheTtl) {
      return Future.value();
    }

    final inFlight = _inFlightLoad;
    if (inFlight != null) return inFlight;

    final load = _load(showLoading: showLoading);
    _inFlightLoad = load;
    load.whenComplete(() => _inFlightLoad = null);
    return load;
  }

  Future<void> _load({required bool showLoading}) async {
    if (showLoading) {
      state = NotificationState(
        isLoading: true,
        notifications: state.notifications,
        unreadCount: state.unreadCount,
      );
    }
    try {
      final data = await _ds.getNotifications();
      final unread = data.where((notification) => !notification.isRead).length;
      _lastLoadedAt = DateTime.now();
      _hasLoaded = true;
      state = NotificationState(notifications: data, unreadCount: unread);
    } catch (error) {
      debugPrint('Notification load failed: $error');
      state = NotificationState(
        notifications: state.notifications,
        unreadCount: state.unreadCount,
      );
    }
  }

  Future<void> markRead(String id) async {
    state = _stateWithReadNotifications({id});
    await _ds.markAsRead(id);
    await load(forceRefresh: true, showLoading: false);
  }

  Future<void> markCategoryRead(String category) async {
    final unreadIds = state.notifications
        .where(
          (notification) =>
              !notification.isRead && notification.category == category,
        )
        .map((notification) => notification.id)
        .where((id) => id.isNotEmpty)
        .toList();

    if (unreadIds.isEmpty && _hasLoaded) return;

    if (unreadIds.isNotEmpty) {
      state = _stateWithReadNotifications(unreadIds.toSet());
    }
    await _ds.markCategoryAsRead(category);
    await load(forceRefresh: true, showLoading: false);
  }

  NotificationState _stateWithReadNotifications(Set<String> ids) {
    final updated = state.notifications.map((notification) {
      if (!ids.contains(notification.id)) return notification;
      return notification.markRead();
    }).toList();
    final unread = updated.where((notification) => !notification.isRead).length;
    return NotificationState(notifications: updated, unreadCount: unread);
  }
}

final notificationProvider =
    StateNotifierProvider<NotificationNotifier, NotificationState>((ref) {
      return NotificationNotifier(
        ref.read(notificationRemoteDataSourceProvider),
      );
    });
