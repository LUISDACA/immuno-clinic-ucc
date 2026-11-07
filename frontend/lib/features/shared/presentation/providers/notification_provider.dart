import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/datasources/notification_remote_ds.dart';
import '../../../auth/presentation/providers/auth_provider.dart';
import '../../data/models/notification_model.dart';

class NotificationState {
  final bool isLoading;
  final List<NotificationModel> notifications;
  final int unreadCount;
  final String? errorMessage;

  const NotificationState({
    this.isLoading = false,
    this.notifications = const [],
    this.unreadCount = 0,
    this.errorMessage,
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
  int _request = 0;
  final Map<String, Future<void>> _writes = {};

  Future<void> load({bool forceRefresh = false, bool showLoading = true}) {
    if (!mounted || _writes.isNotEmpty) return Future.value();
    final lastLoadedAt = _lastLoadedAt;
    if (!forceRefresh &&
        _hasLoaded &&
        lastLoadedAt != null &&
        DateTime.now().difference(lastLoadedAt) < _cacheTtl) {
      return Future.value();
    }

    final inFlight = _inFlightLoad;
    if (!forceRefresh && inFlight != null) return inFlight;

    final load = _load(showLoading: showLoading);
    _inFlightLoad = load;
    load.whenComplete(() {
      if (identical(_inFlightLoad, load)) _inFlightLoad = null;
    });
    return load;
  }

  Future<void> _load({required bool showLoading}) async {
    final request = ++_request;
    if (showLoading || state.errorMessage != null) {
      state = NotificationState(
        isLoading: showLoading,
        notifications: state.notifications,
        unreadCount: state.unreadCount,
      );
    }
    try {
      final data = await _ds.getNotifications();
      if (!mounted || request != _request) return;
      final unread = data.where((notification) => !notification.isRead).length;
      _lastLoadedAt = DateTime.now();
      _hasLoaded = true;
      state = NotificationState(notifications: data, unreadCount: unread);
    } catch (error) {
      if (!mounted || request != _request) return;
      // A failed refresh must not make retained data look freshly verified.
      _lastLoadedAt = null;
      _hasLoaded = false;
      final retainPrevious = _canRetainNotifications(error);
      state = NotificationState(
        notifications: retainPrevious ? state.notifications : const [],
        unreadCount: retainPrevious ? state.unreadCount : 0,
        errorMessage: 'No se pudieron cargar las notificaciones.',
      );
    }
  }

  bool _canRetainNotifications(Object error) {
    if (error is! DioException) return true;
    if (error.type == DioExceptionType.cancel) return false;
    final status = error.response?.statusCode;
    return status == null || status == 429 || (status >= 500 && status <= 599);
  }

  Future<void> _write(
    String key,
    Future<void> Function() operation,
    Set<String> ids,
  ) {
    if (!mounted) return Future.value();
    final existing = _writes[key];
    if (existing != null) return existing;
    ++_request; // An earlier GET cannot overwrite a confirmed read.
    final future = () async {
      try {
        await operation();
        ++_request;
        if (mounted) state = _stateWithReadNotifications(ids);
      } finally {
        _writes.remove(key);
        if (mounted) await load(forceRefresh: true, showLoading: false);
      }
    }();
    _writes[key] = future;
    return future;
  }

  Future<void> markRead(String id) =>
      _write(id, () => _ds.markAsRead(id), {id});

  Future<void> markCategoryRead(String category) => _write(
    'category:$category',
    () => _ds.markCategoryAsRead(category),
    state.notifications
        .where((n) => !n.isRead && n.category == category)
        .map((n) => n.id)
        .toSet(),
  );

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
      ref.watch(authStateProvider.select((state) => state.userId));
      return NotificationNotifier(
        ref.read(notificationRemoteDataSourceProvider),
      );
    });
