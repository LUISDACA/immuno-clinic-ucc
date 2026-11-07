import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/api_client.dart';

class CommunicationRemoteDataSource {
  final ApiClient _api;
  CommunicationRemoteDataSource(this._api);

  Future<List<dynamic>> getThreads() async {
    final r = await _api.dio.get('/communications/threads');
    return r.data as List<dynamic>;
  }

  Future<Map<String, dynamic>> getThread(String threadId) async {
    final r = await _api.dio.get('/communications/threads/$threadId');
    return r.data as Map<String, dynamic>;
  }

  Future<List<dynamic>> searchRecipients({
    required String target,
    required String search,
  }) async {
    final r = await _api.dio.post(
      '/communications/recipients/search',
      data: {'target': target, 'search': search},
    );
    return r.data as List<dynamic>;
  }

  Future<Map<String, dynamic>> createThread({
    required String subject,
    required String message,
    String? category,
    String? studentId,
    String? adminId,
  }) async {
    final data = <String, dynamic>{
      'subject': subject,
      'message': message,
      'category': category,
    };
    if (studentId != null) {
      data['student_id'] = studentId;
    }
    if (adminId != null) {
      data['admin_id'] = adminId;
    }
    final r = await _api.dio.post('/communications/threads', data: data);
    return r.data as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> sendMessage(
    String threadId,
    String message,
  ) async {
    final r = await _api.dio.post(
      '/communications/threads/$threadId/messages',
      data: {'message': message},
    );
    return r.data as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> updateStatus(
    String threadId,
    String status,
  ) async {
    final r = await _api.dio.put(
      '/communications/threads/$threadId/status',
      data: {'status': status},
    );
    return r.data as Map<String, dynamic>;
  }
}

final communicationRemoteDataSourceProvider =
    Provider<CommunicationRemoteDataSource>((ref) {
      return CommunicationRemoteDataSource(ref.read(apiClientProvider));
    });
