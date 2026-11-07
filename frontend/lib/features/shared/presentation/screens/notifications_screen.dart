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
      body: state.errorMessage == null
          ? _notificationBody(state, colorScheme)
          : state.notifications.isEmpty
          ? Center(child: _loadError(state.errorMessage!))
          : Column(
              children: [
                _loadError(state.errorMessage!),
                Expanded(child: _notificationBody(state, colorScheme)),
              ],
            ),
    );
  }

  Widget _loadError(String message) => Padding(
    padding: const EdgeInsets.all(16),
    child: Semantics(
      liveRegion: true,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(message, textAlign: TextAlign.center),
          TextButton(
            style: TextButton.styleFrom(
              foregroundColor: Theme.of(context).colorScheme.onSurface,
            ),
            onPressed: () => ref.read(notificationProvider.notifier).load(),
            child: const Text('Reintentar'),
          ),
        ],
      ),
    ),
  );

  Widget _notificationBody(NotificationState state, ColorScheme colorScheme) =>
      state.isLoading
      ? const Center(child: CircularProgressIndicator())
      : state.notifications.isEmpty
      ? Center(
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
                style: TextStyle(color: colorScheme.onSurfaceVariant),
              ),
            ],
          ),
        )
      : RefreshIndicator(
          onRefresh: () =>
              ref.read(notificationProvider.notifier).load(forceRefresh: true),
          child: ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: state.notifications.length,
            separatorBuilder: (context, index) => const SizedBox(height: 4),
            itemBuilder: (context, index) {
              final n = state.notifications[index];
              final isRead = n.isRead;
              final actionPath = n.actionPath;
              return Semantics(
                label: isRead ? 'Leída' : 'No leída',
                child: Card(
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
                            tooltip: 'Marcar como leída',
                            icon: const Icon(
                              Icons.check_circle_outline,
                              color: AppColors.primary,
                              size: 20,
                            ),
                            onPressed: () async {
                              await _markRead(n.id);
                            },
                          ),
                        if (actionPath != null && actionPath.isNotEmpty)
                          const Icon(
                            Icons.chevron_right,
                            color: AppColors.textHint,
                          ),
                      ],
                    ),
                  ),
                ),
              );
            },
          ),
        );

  Future<void> _openNotification(NotificationModel notification) async {
    final id = notification.id;
    final actionPath = notification.actionPath;
    final isRead = notification.isRead;

    if (!isRead && id.isNotEmpty) {
      final marked = await _markRead(id);
      if (!marked) return;
    }

    if (!mounted || actionPath == null || actionPath.isEmpty) return;
    context.push(actionPath);
  }

  Future<bool> _markRead(String id) async {
    try {
      await ref.read(notificationProvider.notifier).markRead(id);
      return true;
    } catch (_) {
      if (!mounted) return false;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('No se pudo marcar como leída. Inténtalo de nuevo.'),
        ),
      );
      return false;
    }
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
