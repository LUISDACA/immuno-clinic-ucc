import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/api_client.dart';
import '../models/notification_model.dart';

/// Data source for notification API calls.
class NotificationRemoteDataSource {
  final ApiClient _api;
  NotificationRemoteDataSource(this._api);

  Future<List<NotificationModel>> getNotifications() async {
    final r = await _api.dio.get('/notifications/');
    return ((r.data as List<dynamic>?) ?? const [])
        .map((item) => NotificationModel.fromJson(item as Map<String, dynamic>))
        .toList();
  }

  Future<void> markAsRead(String notificationId) async {
    await _api.dio.put('/notifications/$notificationId/read');
  }

  Future<void> markCategoryAsRead(String category) async {
    await _api.dio.put('/notifications/category/$category/read');
  }
}

final notificationRemoteDataSourceProvider =
    Provider<NotificationRemoteDataSource>((ref) {
      return NotificationRemoteDataSource(ref.read(apiClientProvider));
    });
