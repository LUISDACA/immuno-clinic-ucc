import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/role_utils.dart';
import '../../../auth/presentation/providers/auth_provider.dart';
import '../../data/datasources/communication_remote_ds.dart';
import '../providers/notification_provider.dart';

class CommunicationDetailScreen extends ConsumerStatefulWidget {
  final String threadId;

  const CommunicationDetailScreen({super.key, required this.threadId});

  @override
  ConsumerState<CommunicationDetailScreen> createState() =>
      _CommunicationDetailScreenState();
}

class _CommunicationDetailScreenState
    extends ConsumerState<CommunicationDetailScreen> {
  final _messageController = TextEditingController();
  final _scrollController = ScrollController();
  Timer? _refreshTimer;
  bool _refreshing = false;
  bool _loading = true;
  bool _sending = false;
  bool _markedCommunicationRead = false;
  String? _error;
  Map<String, dynamic>? _thread;

  @override
  void initState() {
    super.initState();
    Future.microtask(() => _load(showLoading: true));
    _refreshTimer = Timer.periodic(const Duration(seconds: 3), (_) {
      if (mounted) _load(showLoading: false);
    });
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    _scrollController.dispose();
    _messageController.dispose();
    super.dispose();
  }

  Future<void> _load({bool showLoading = false}) async {
    if (_refreshing) return;
    _refreshing = true;
    if (showLoading && mounted) {
      setState(() {
        _loading = true;
        _error = null;
      });
    }
    try {
      final thread = await ref
          .read(communicationRemoteDataSourceProvider)
          .getThread(widget.threadId);
      if (!mounted) return;
      setState(() {
        _thread = thread;
        _loading = false;
        _error = null;
      });
      await _markThreadSeen(thread);
      _scrollToBottom();
      if (!_markedCommunicationRead) {
        _markedCommunicationRead = true;
        await ref
            .read(notificationProvider.notifier)
            .markCategoryRead('communication');
      }
    } catch (_) {
      if (!mounted) return;
      if (_thread == null) {
        setState(() {
          _error = 'No se pudo cargar la conversación';
          _loading = false;
        });
      }
    } finally {
      _refreshing = false;
    }
  }

  Future<void> _markThreadSeen(Map<String, dynamic> thread) async {
    final threadId = thread['id']?.toString();
    final lastMessageAt = DateTime.tryParse(
      thread['last_message_at']?.toString() ?? '',
    );
    if (threadId == null || threadId.isEmpty || lastMessageAt == null) return;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt(
      'ic_thread_seen_$threadId',
      lastMessageAt.millisecondsSinceEpoch,
    );
  }

  Future<void> _send() async {
    final text = _messageController.text.trim();
    if (text.isEmpty || _sending) return;

    final optimisticId = 'local-${DateTime.now().microsecondsSinceEpoch}';
    final auth = ref.read(authStateProvider);

    setState(() {
      _sending = true;
      _messageController.clear();
      _thread = _threadWithMessage(
        _thread,
        _optimisticMessage(id: optimisticId, body: text, auth: auth),
      );
    });
    _scrollToBottom();

    try {
      final thread = await ref
          .read(communicationRemoteDataSourceProvider)
          .sendMessage(widget.threadId, text);
      if (!mounted) return;
      setState(() {
        _thread = thread;
        _sending = false;
      });
      _scrollToBottom();
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _thread = _threadWithoutMessage(_thread, optimisticId);
        _messageController.text = text;
        _messageController.selection = TextSelection.collapsed(
          offset: _messageController.text.length,
        );
        _sending = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No se pudo enviar el mensaje')),
      );
    }
  }

  Map<String, dynamic> _optimisticMessage({
    required String id,
    required String body,
    required AuthState auth,
  }) {
    return {
      'id': id,
      'body': body,
      'created_at': DateTime.now().toIso8601String(),
      'sender': {
        'id': auth.userId,
        'email': auth.email ?? '',
        'name': null,
        'role': auth.role ?? '',
      },
      'is_sending': true,
    };
  }

  Map<String, dynamic>? _threadWithMessage(
    Map<String, dynamic>? thread,
    Map<String, dynamic> message,
  ) {
    if (thread == null) return thread;
    final updated = Map<String, dynamic>.from(thread);
    final messages = List<dynamic>.from(
      (updated['messages'] as List<dynamic>?) ?? const [],
    );
    messages.add(message);
    updated['messages'] = messages;
    updated['last_message'] = message['body'];
    updated['last_message_at'] = message['created_at'];
    return updated;
  }

  Map<String, dynamic>? _threadWithoutMessage(
    Map<String, dynamic>? thread,
    String messageId,
  ) {
    if (thread == null) return thread;
    final updated = Map<String, dynamic>.from(thread);
    updated['messages'] = ((updated['messages'] as List<dynamic>?) ?? const [])
        .where((message) => message['id']?.toString() != messageId)
        .toList();
    return updated;
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_scrollController.hasClients) return;
      _scrollController.animateTo(
        _scrollController.position.maxScrollExtent,
        duration: const Duration(milliseconds: 180),
        curve: Curves.easeOut,
      );
    });
  }

  Future<void> _toggleStatus() async {
    final current = _thread?['status']?.toString() ?? 'open';
    final next = current == 'open' ? 'closed' : 'open';
    try {
      final thread = await ref
          .read(communicationRemoteDataSourceProvider)
          .updateStatus(widget.threadId, next);
      if (!mounted) return;
      setState(() => _thread = thread);
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No se pudo actualizar el estado')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final thread = _thread;
    final auth = ref.watch(authStateProvider);
    final isAdmin = isAdminRole(auth.role);

    return Scaffold(
      appBar: AppBar(
        title: Text(thread?['subject']?.toString() ?? 'Conversación'),
        actions: [
          if (thread != null)
            IconButton(
              tooltip: thread['status'] == 'open'
                  ? 'Cerrar conversación'
                  : 'Reabrir conversación',
              icon: Icon(
                thread['status'] == 'open'
                    ? Icons.lock_outline
                    : Icons.lock_open_outlined,
              ),
              onPressed: _toggleStatus,
            ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
          ? Center(
              child: Text(
                _error!,
                style: const TextStyle(color: AppColors.error),
              ),
            )
          : Column(
              children: [
                if (thread != null)
                  _ThreadHeader(thread: thread, currentUserId: auth.userId),
                Expanded(
                  child: RefreshIndicator(
                    onRefresh: () => _load(showLoading: false),
                    child: ListView(
                      controller: _scrollController,
                      padding: const EdgeInsets.all(16),
                      children: [
                        ...((_thread?['messages'] as List<dynamic>?) ?? []).map(
                          (message) => _MessageBubble(
                            message: message,
                            isAdmin: isAdmin,
                            currentUserId: auth.userId,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                _Composer(
                  controller: _messageController,
                  enabled: !_sending,
                  onSend: _send,
                ),
              ],
            ),
    );
  }
}

class _ThreadHeader extends StatelessWidget {
  final Map<String, dynamic> thread;
  final String? currentUserId;

  const _ThreadHeader({required this.thread, required this.currentUserId});

  @override
  Widget build(BuildContext context) {
    final status = thread['status']?.toString() ?? 'open';
    final participant = _participant();
    final colorScheme = Theme.of(context).colorScheme;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      decoration: BoxDecoration(
        color: colorScheme.surface,
        border: Border(bottom: BorderSide(color: colorScheme.outlineVariant)),
      ),
      child: Wrap(
        spacing: 10,
        runSpacing: 4,
        crossAxisAlignment: WrapCrossAlignment.center,
        children: [
          Chip(
            label: Text(status == 'open' ? 'Abierta' : 'Cerrada'),
            avatar: Icon(
              status == 'open' ? Icons.lock_open_outlined : Icons.lock_outline,
              size: 16,
            ),
          ),
          if (participant != null)
            Text(
              'Con: ${_userLabel(participant)}',
              style: TextStyle(
                fontSize: 13,
                color: colorScheme.onSurfaceVariant,
              ),
            ),
        ],
      ),
    );
  }

  Map<String, dynamic>? _participant() {
    final recipient = thread['recipient'] as Map<String, dynamic>?;
    final createdBy = thread['created_by'] as Map<String, dynamic>?;
    final student = thread['student'] as Map<String, dynamic>?;
    final candidates = [recipient, createdBy, student];
    for (final user in candidates) {
      if (user != null && user['id']?.toString() != currentUserId) {
        return user;
      }
    }
    return recipient ?? student ?? createdBy;
  }

  String _userLabel(Map<String, dynamic> user) {
    final name = user['name']?.toString();
    final email = user['email']?.toString() ?? '';
    final role = user['role']?.toString();
    final prefix = role == 'admin'
        ? 'Admin: '
        : role == 'app_admin'
        ? 'Admin app: '
        : '';
    if (name != null && name.trim().isNotEmpty) return '$prefix$name <$email>';
    return '$prefix$email';
  }
}

class _MessageBubble extends StatelessWidget {
  final dynamic message;
  final bool isAdmin;
  final String? currentUserId;

  const _MessageBubble({
    required this.message,
    required this.isAdmin,
    required this.currentUserId,
  });

  @override
  Widget build(BuildContext context) {
    final sender = message['sender'] as Map<String, dynamic>?;
    final isMine = sender?['id']?.toString() == currentUserId;
    final isSending = message['is_sending'] == true;
    final createdAt = DateTime.tryParse(
      message['created_at']?.toString() ?? '',
    );
    final dateText = isSending
        ? 'Enviando...'
        : createdAt == null
        ? ''
        : DateFormat('dd/MM/yyyy HH:mm').format(createdAt.toLocal());
    final colorScheme = Theme.of(context).colorScheme;

    return Opacity(
      opacity: isSending ? 0.72 : 1,
      child: Align(
        alignment: isMine ? Alignment.centerRight : Alignment.centerLeft,
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 620),
          child: Container(
            margin: const EdgeInsets.only(bottom: 10),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: isMine ? AppColors.primary : colorScheme.surface,
              borderRadius: BorderRadius.circular(12),
              border: isMine
                  ? null
                  : Border.all(color: colorScheme.outlineVariant),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _senderName(sender),
                  style: TextStyle(
                    fontWeight: FontWeight.w700,
                    color: isMine ? Colors.white : colorScheme.onSurface,
                    fontSize: 12,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  message['body']?.toString() ?? '',
                  style: TextStyle(
                    color: isMine ? Colors.white : colorScheme.onSurface,
                  ),
                ),
                if (dateText.isNotEmpty) ...[
                  const SizedBox(height: 6),
                  Text(
                    dateText,
                    style: TextStyle(
                      fontSize: 11,
                      color: isMine
                          ? Colors.white.withValues(alpha: 0.8)
                          : colorScheme.onSurfaceVariant,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }

  String _senderName(Map<String, dynamic>? sender) {
    if (sender == null) return 'Usuario';
    final name = sender['name']?.toString();
    if (name != null && name.trim().isNotEmpty) return name;
    return sender['email']?.toString() ?? 'Usuario';
  }
}

class _Composer extends StatelessWidget {
  final TextEditingController controller;
  final bool enabled;
  final VoidCallback onSend;

  const _Composer({
    required this.controller,
    required this.enabled,
    required this.onSend,
  });

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return SafeArea(
      top: false,
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: colorScheme.surface,
          border: Border(top: BorderSide(color: colorScheme.outlineVariant)),
        ),
        child: Row(
          children: [
            Expanded(
              child: TextField(
                controller: controller,
                enabled: enabled,
                minLines: 1,
                maxLines: 4,
                decoration: const InputDecoration(
                  hintText: 'Escribe una respuesta',
                ),
              ),
            ),
            const SizedBox(width: 8),
            IconButton.filled(
              onPressed: enabled ? onSend : null,
              icon: const Icon(Icons.send_outlined),
            ),
          ],
        ),
      ),
    );
  }
}
