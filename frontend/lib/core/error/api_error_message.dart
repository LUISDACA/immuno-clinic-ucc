import 'package:dio/dio.dart';

String dioErrorMessage(DioException error, {required String fallback}) {
  final message = apiErrorMessageFromData(error.response?.data);
  if (message == null || message.trim().isEmpty) return fallback;
  return message;
}

String? apiErrorMessageFromData(dynamic data) {
  if (data is Map) {
    return _messageFromDetail(data['message']) ??
        _messageFromDetail(data['detail']);
  }
  return _messageFromDetail(data);
}

String? _messageFromDetail(dynamic detail) {
  if (detail == null) return null;
  if (detail is String) return _cleanMessage(detail);
  if (detail is Map) {
    return _messageFromDetail(detail['msg']) ??
        _messageFromDetail(detail['message']) ??
        _messageFromDetail(detail['detail']);
  }
  if (detail is List) {
    final messages = detail
        .map(_messageFromDetail)
        .whereType<String>()
        .where((message) => message.trim().isNotEmpty)
        .toList();
    if (messages.isEmpty) return null;
    return messages.join('\n');
  }
  return _cleanMessage(detail.toString());
}

String _cleanMessage(String message) {
  return message
      .replaceFirst(RegExp(r'^Value error,\s*'), '')
      .replaceFirst(RegExp(r'^Assertion failed,\s*'), '')
      .trim();
}
