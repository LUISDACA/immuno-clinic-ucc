class NotificationModel {
  final String id;
  final String title;
  final String message;
  final bool isRead;
  final String? category;
  final String? actionPath;
  final String createdAt;

  const NotificationModel({
    required this.id,
    required this.title,
    required this.message,
    required this.isRead,
    required this.createdAt,
    this.category,
    this.actionPath,
  });

  factory NotificationModel.fromJson(Map<String, dynamic> json) {
    return NotificationModel(
      id: json['id']?.toString() ?? '',
      title: json['title']?.toString() ?? '',
      message: json['message']?.toString() ?? '',
      isRead: json['is_read'] == true,
      category: json['category']?.toString(),
      actionPath: json['action_path']?.toString(),
      createdAt: json['created_at']?.toString() ?? '',
    );
  }

  NotificationModel markRead() {
    return NotificationModel(
      id: id,
      title: title,
      message: message,
      isRead: true,
      createdAt: createdAt,
      category: category,
      actionPath: actionPath,
    );
  }
}
