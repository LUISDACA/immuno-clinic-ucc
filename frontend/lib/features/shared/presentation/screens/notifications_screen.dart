import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/app_theme.dart';
import '../../data/models/notification_model.dart';
import '../providers/notification_provider.dart';

/// Notifications screen — shared between student and admin.
class NotificationsScreen extends ConsumerStatefulWidget {
  const NotificationsScreen({super.key});

  @override
  ConsumerState<NotificationsScreen> createState() =>
      _NotificationsScreenState();
}

class _NotificationsScreenState extends ConsumerState<NotificationsScreen> {
  @override
  void initState() {
    super.initState();
    Future.microtask(() => ref.read(notificationProvider.notifier).load());
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(notificationProvider);
    final colorScheme = Theme.of(context).colorScheme;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Notificaciones'),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 12),
            child: Center(
              child: Badge(
                isLabelVisible: state.unreadCount > 0,
                label: Text('${state.unreadCount}'),
                child: const Icon(Icons.notifications_outlined),
              ),
            ),
          ),
        ],
      ),
      body: state.isLoading
          ? const Center(child: CircularProgressIndicator())
          : state.notifications.isEmpty
          ? const Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    Icons.notifications_none,
                    size: 56,
                    color: AppColors.textHint,
                  ),
                  SizedBox(height: 12),
                  Text(
                    'No tienes notificaciones',
                    style: TextStyle(color: AppColors.textSecondary),
                  ),
                ],
              ),
            )
          : RefreshIndicator(
              onRefresh: () => ref
                  .read(notificationProvider.notifier)
                  .load(forceRefresh: true),
              child: ListView.separated(
                padding: const EdgeInsets.all(16),
                itemCount: state.notifications.length,
                separatorBuilder: (context, index) => const SizedBox(height: 4),
                itemBuilder: (context, index) {
                  final n = state.notifications[index];
                  final isRead = n.isRead;
                  final actionPath = n.actionPath;
                  return Card(
                    color: isRead
                        ? null
                        : colorScheme.primaryContainer.withValues(alpha: 0.35),
                    child: ListTile(
                      onTap: () => _openNotification(n),
                      leading: CircleAvatar(
                        backgroundColor: isRead
                            ? colorScheme.surfaceContainerHighest
                            : AppColors.primary,
                        child: Icon(
                          _categoryIcon(n.category),
                          color: isRead
                              ? colorScheme.onSurfaceVariant
                              : Colors.white,
                          size: 20,
                        ),
                      ),
                      title: Text(
                        n.title,
                        style: TextStyle(
                          fontWeight: isRead
                              ? FontWeight.normal
                              : FontWeight.w600,
                          fontSize: 14,
                        ),
                      ),
                      subtitle: Text(
                        n.message,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontSize: 12),
                      ),
                      trailing: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          if (!isRead)
                            IconButton(
                              icon: const Icon(
                                Icons.check_circle_outline,
                                color: AppColors.primary,
                                size: 20,
                              ),
                              onPressed: () => ref
                                  .read(notificationProvider.notifier)
                                  .markRead(n.id),
                            ),
                          if (actionPath != null && actionPath.isNotEmpty)
                            const Icon(
                              Icons.chevron_right,
                              color: AppColors.textHint,
                            ),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),
    );
  }

  Future<void> _openNotification(NotificationModel notification) async {
    final id = notification.id;
    final actionPath = notification.actionPath;
    final isRead = notification.isRead;

    if (!isRead && id.isNotEmpty) {
      await ref.read(notificationProvider.notifier).markRead(id);
    }

    if (!mounted || actionPath == null || actionPath.isEmpty) return;
    context.push(actionPath);
  }

  IconData _categoryIcon(String? category) {
    switch (category) {
      case 'scheme':
        return Icons.vaccines;
      case 'review':
        return Icons.rate_review_outlined;
      case 'evidence':
        return Icons.picture_as_pdf_outlined;
      case 'communication':
        return Icons.forum_outlined;
      case 'system':
        return Icons.info_outline;
      default:
        return Icons.notifications_outlined;
    }
  }
}
