import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/role_utils.dart';
import '../../../auth/presentation/providers/auth_provider.dart';
import '../../data/datasources/communication_remote_ds.dart';
import '../providers/communication_provider.dart';
import '../providers/notification_provider.dart';

class CommunicationsScreen extends ConsumerStatefulWidget {
  final String? initialStudentId;
  final String? initialStudentName;

  const CommunicationsScreen({
    super.key,
    this.initialStudentId,
    this.initialStudentName,
  });

  @override
  ConsumerState<CommunicationsScreen> createState() =>
      _CommunicationsScreenState();
}

class _CommunicationsScreenState extends ConsumerState<CommunicationsScreen> {
  bool _initialDialogShown = false;
  Timer? _refreshTimer;

  @override
  void initState() {
    super.initState();
    Future.microtask(() async {
      await ref.read(communicationProvider.notifier).load();
      await ref.read(notificationProvider.notifier).load(showLoading: false);
    });
    _startRefreshTimer();
    if (widget.initialStudentId != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted || _initialDialogShown) return;
        _initialDialogShown = true;
        _openCreateDialog();
      });
    }
  }

  void _startRefreshTimer() {
    _refreshTimer?.cancel();
    _refreshTimer = Timer.periodic(const Duration(seconds: 8), (_) {
      if (mounted) {
        ref
            .read(communicationProvider.notifier)
            .load(showLoading: false, forceRefresh: true);
      }
    });
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    super.dispose();
  }

  Future<void> _openCreateDialog() async {
    final role = ref.read(authStateProvider).role;
    final isAdmin = isAdminRole(role);
    final isAppAdmin = isAppAdminRole(role);
    final subject = TextEditingController();
    final message = TextEditingController();
    String category = 'general';
    String target = isAppAdmin || !isAdmin ? 'admins' : 'students';
    String? selectedRecipientId = widget.initialStudentId;
    String? formError;
    bool isSending = false;

    final created = await showDialog<Map<String, dynamic>?>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          title: Text(
            isAppAdmin
                ? 'Mensaje a administrador'
                : isAdmin
                ? 'Mensaje a estudiante'
                : 'Nueva consulta al administrador',
          ),
          content: SizedBox(
            width: 460,
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (isAdmin && widget.initialStudentName != null) ...[
                    Align(
                      alignment: Alignment.centerLeft,
                      child: Text(
                        widget.initialStudentName!,
                        style: const TextStyle(
                          fontWeight: FontWeight.w700,
                          color: AppColors.textSecondary,
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                  ],
                  if (isAdmin &&
                      !isAppAdmin &&
                      widget.initialStudentId == null) ...[
                    DropdownButtonFormField<String>(
                      initialValue: target,
                      decoration: const InputDecoration(
                        labelText: 'Destinatario',
                      ),
                      items: const [
                        DropdownMenuItem(
                          value: 'students',
                          child: Text('Estudiante'),
                        ),
                        DropdownMenuItem(
                          value: 'admins',
                          child: Text('Administrador de aplicación'),
                        ),
                      ],
                      onChanged: (value) {
                        setDialogState(() {
                          target = value ?? 'students';
                          selectedRecipientId = null;
                          formError = null;
                        });
                      },
                    ),
                    const SizedBox(height: 12),
                  ],
                  if (widget.initialStudentId == null) ...[
                    _RecipientSearchField(
                      key: ValueKey(target),
                      target: target,
                      labelText: target == 'admins'
                          ? 'Correo del administrador'
                          : 'Correo del estudiante',
                      onSelected: (user) {
                        setDialogState(() {
                          selectedRecipientId = user?['id']?.toString();
                          formError = null;
                        });
                      },
                    ),
                    const SizedBox(height: 12),
                  ],
                  DropdownButtonFormField<String>(
                    initialValue: category,
                    decoration: const InputDecoration(labelText: 'Categoría'),
                    items: const [
                      DropdownMenuItem(
                        value: 'general',
                        child: Text('General'),
                      ),
                      DropdownMenuItem(value: 'scheme', child: Text('Esquema')),
                      DropdownMenuItem(
                        value: 'evidence',
                        child: Text('Documentos'),
                      ),
                      DropdownMenuItem(
                        value: 'technical',
                        child: Text('Soporte técnico'),
                      ),
                    ],
                    onChanged: (value) =>
                        setDialogState(() => category = value ?? category),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: subject,
                    decoration: const InputDecoration(labelText: 'Asunto'),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: message,
                    decoration: const InputDecoration(labelText: 'Mensaje'),
                    minLines: 4,
                    maxLines: 6,
                  ),
                  if (formError != null) ...[
                    const SizedBox(height: 12),
                    Align(
                      alignment: Alignment.centerLeft,
                      child: Text(
                        formError!,
                        style: const TextStyle(
                          color: AppColors.error,
                          fontSize: 12,
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
          actions: [
            TextButton(
              onPressed: isSending ? null : () => Navigator.pop(ctx),
              child: const Text('Cancelar'),
            ),
            FilledButton(
              onPressed: isSending
                  ? null
                  : () async {
                      final cleanSubject = subject.text.trim();
                      final cleanMessage = message.text.trim();
                      if (cleanSubject.length < 3 || cleanMessage.isEmpty) {
                        setDialogState(() {
                          formError = 'Escribe un asunto y un mensaje.';
                        });
                        return;
                      }
                      if (widget.initialStudentId == null &&
                          selectedRecipientId == null) {
                        setDialogState(() {
                          formError =
                              'Selecciona un correo de la lista de coincidencias.';
                        });
                        return;
                      }

                      setDialogState(() {
                        isSending = true;
                        formError = null;
                      });

                      try {
                        final thread = await ref
                            .read(communicationRemoteDataSourceProvider)
                            .createThread(
                              subject: cleanSubject,
                              message: cleanMessage,
                              category: category,
                              studentId:
                                  isAdmin && !isAppAdmin && target == 'students'
                                  ? selectedRecipientId
                                  : null,
                              adminId: target == 'admins'
                                  ? selectedRecipientId
                                  : null,
                            );
                        if (ctx.mounted) Navigator.pop(ctx, thread);
                      } catch (_) {
                        if (!ctx.mounted) return;
                        setDialogState(() {
                          isSending = false;
                          formError = 'No se pudo enviar el mensaje.';
                        });
                      }
                    },
              child: isSending
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Text('Enviar'),
            ),
          ],
        ),
      ),
    );

    await Future<void>.delayed(const Duration(milliseconds: 250));
    subject.dispose();
    message.dispose();

    if (created != null && mounted) {
      await ref
          .read(communicationProvider.notifier)
          .load(showLoading: false, forceRefresh: true);
      if (!mounted) return;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _openThread(created['id'].toString());
      });
    }
  }

  Future<void> _openThread(String threadId) async {
    final role = ref.read(authStateProvider).role;
    final prefix = isAdminRole(role) ? '/admin' : '/student';
    _refreshTimer?.cancel();
    _refreshTimer = null;
    await context.push('$prefix/communications/$threadId');
    if (!mounted) return;
    await ref
        .read(communicationProvider.notifier)
        .load(showLoading: false, forceRefresh: true);
    if (mounted) _startRefreshTimer();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(communicationProvider);
    final role = ref.watch(authStateProvider).role;
    final isAdmin = isAdminRole(role);
    final isAppAdmin = isAppAdminRole(role);

    return Scaffold(
      appBar: AppBar(
        title: Text(
          isAppAdmin
              ? 'Comunicaciones con administradores'
              : isAdmin
              ? 'Comunicaciones'
              : 'Mis consultas',
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _openCreateDialog,
        icon: const Icon(Icons.add_comment_outlined),
        label: const Text('Nuevo'),
      ),
      body: state.isLoading
          ? const Center(child: CircularProgressIndicator())
          : state.error != null
          ? Center(
              child: Text(
                state.error!,
                style: const TextStyle(color: AppColors.error),
              ),
            )
          : state.threads.isEmpty
          ? const Center(
              child: Text(
                'No hay conversaciones',
                style: TextStyle(color: AppColors.textSecondary),
              ),
            )
          : RefreshIndicator(
              onRefresh: () => ref
                  .read(communicationProvider.notifier)
                  .load(forceRefresh: true),
              child: ListView.separated(
                padding: const EdgeInsets.all(16),
                itemCount: state.threads.length,
                separatorBuilder: (context, index) => const SizedBox(height: 8),
                itemBuilder: (context, index) {
                  final thread = state.threads[index];
                  return _ThreadTile(
                    thread: thread,
                    currentUserId: ref.read(authStateProvider).userId,
                    onTap: () => _openThread(thread['id'].toString()),
                  );
                },
              ),
            ),
    );
  }
}

class _RecipientSearchField extends ConsumerStatefulWidget {
  final String target;
  final String labelText;
  final ValueChanged<Map<String, dynamic>?> onSelected;

  const _RecipientSearchField({
    super.key,
    required this.target,
    required this.labelText,
    required this.onSelected,
  });

  @override
  ConsumerState<_RecipientSearchField> createState() =>
      _RecipientSearchFieldState();
}

class _RecipientSearchFieldState extends ConsumerState<_RecipientSearchField> {
  final _controller = TextEditingController();
  Timer? _debounce;
  List<dynamic> _options = const [];
  bool _loading = false;
  bool _selecting = false;
  String? _selectedId;

  @override
  void initState() {
    super.initState();
    _controller.addListener(_onTextChanged);
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _controller
      ..removeListener(_onTextChanged)
      ..dispose();
    super.dispose();
  }

  void _onTextChanged() {
    if (_selecting) return;
    if (_selectedId != null) {
      _selectedId = null;
      widget.onSelected(null);
    }
    _debounce?.cancel();
    final query = _controller.text.trim();
    if (query.length < 2) {
      setState(() => _options = const []);
      return;
    }
    _debounce = Timer(const Duration(milliseconds: 280), () => _search(query));
  }

  Future<void> _search(String query) async {
    setState(() => _loading = true);
    try {
      final options = await ref
          .read(communicationRemoteDataSourceProvider)
          .searchRecipients(target: widget.target, search: query);
      if (!mounted || _controller.text.trim() != query) return;
      setState(() {
        _options = options;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _options = const [];
        _loading = false;
      });
    }
  }

  void _select(Map<String, dynamic> user) {
    final label = _userLabel(user);
    _selecting = true;
    _controller.text = label;
    _controller.selection = TextSelection.collapsed(offset: label.length);
    _selecting = false;
    setState(() {
      _selectedId = user['id']?.toString();
      _options = const [];
    });
    widget.onSelected(user);
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        TextField(
          controller: _controller,
          keyboardType: TextInputType.emailAddress,
          decoration: InputDecoration(
            labelText: widget.labelText,
            prefixIcon: const Icon(Icons.alternate_email),
            suffixIcon: _loading
                ? const Padding(
                    padding: EdgeInsets.all(12),
                    child: SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    ),
                  )
                : _selectedId != null
                ? const Icon(Icons.check_circle_outline)
                : null,
          ),
        ),
        if (_options.isNotEmpty) ...[
          const SizedBox(height: 6),
          ConstrainedBox(
            constraints: const BoxConstraints(maxHeight: 180),
            child: Material(
              color: colorScheme.surface,
              shape: RoundedRectangleBorder(
                side: BorderSide(color: colorScheme.outlineVariant),
                borderRadius: BorderRadius.circular(8),
              ),
              clipBehavior: Clip.antiAlias,
              child: ListView.separated(
                shrinkWrap: true,
                itemCount: _options.length,
                separatorBuilder: (_, _) =>
                    Divider(height: 1, color: colorScheme.outlineVariant),
                itemBuilder: (context, index) {
                  final user = _options[index] as Map<String, dynamic>;
                  return ListTile(
                    dense: true,
                    leading: const Icon(Icons.mail_outline),
                    title: Text(
                      user['email']?.toString() ?? '',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    subtitle: _nameOf(user).isEmpty
                        ? null
                        : Text(
                            _nameOf(user),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                    onTap: () => _select(user),
                  );
                },
              ),
            ),
          ),
        ],
      ],
    );
  }

  String _userLabel(Map<String, dynamic> user) {
    final email = user['email']?.toString() ?? '';
    final name = _nameOf(user);
    return name.isEmpty ? email : '$name <$email>';
  }

  String _nameOf(Map<String, dynamic> user) {
    return (user['name']?.toString() ?? '').trim();
  }
}

class _ThreadTile extends StatefulWidget {
  final dynamic thread;
  final String? currentUserId;
  final VoidCallback onTap;

  const _ThreadTile({
    required this.thread,
    required this.currentUserId,
    required this.onTap,
  });

  @override
  State<_ThreadTile> createState() => _ThreadTileState();
}

class _ThreadTileState extends State<_ThreadTile> {
  int _seenAt = 0;

  @override
  void initState() {
    super.initState();
    _loadSeenAt();
  }

  @override
  void didUpdateWidget(covariant _ThreadTile oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.thread['id']?.toString() != widget.thread['id']?.toString()) {
      _loadSeenAt();
    }
  }

  Future<void> _loadSeenAt() async {
    final threadId = widget.thread['id']?.toString();
    if (threadId == null || threadId.isEmpty) return;
    final prefs = await SharedPreferences.getInstance();
    final seenAt = prefs.getInt('ic_thread_seen_$threadId') ?? 0;
    if (!mounted) return;
    setState(() => _seenAt = seenAt);
  }

  @override
  Widget build(BuildContext context) {
    final thread = widget.thread;
    final status = thread['status']?.toString() ?? 'open';
    final participant = _participant();
    final colorScheme = Theme.of(context).colorScheme;
    final lastMessageAt = DateTime.tryParse(
      thread['last_message_at']?.toString() ?? '',
    );
    final dateText = lastMessageAt == null
        ? ''
        : DateFormat('dd/MM/yyyy HH:mm').format(lastMessageAt.toLocal());
    final lastSender = thread['last_message_sender'] as Map<String, dynamic>?;
    final lastSenderId = lastSender?['id']?.toString();
    final lastMessageMillis = lastMessageAt?.millisecondsSinceEpoch ?? 0;
    final hasNewMessage =
        lastSenderId != null &&
        lastSenderId != widget.currentUserId &&
        lastMessageMillis > _seenAt;

    return Card(
      color: hasNewMessage
          ? colorScheme.primaryContainer.withValues(alpha: 0.38)
          : null,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(
          color: hasNewMessage ? AppColors.primary : colorScheme.outlineVariant,
        ),
      ),
      child: ListTile(
        onTap: widget.onTap,
        leading: Stack(
          clipBehavior: Clip.none,
          children: [
            CircleAvatar(
              backgroundColor: status == 'open'
                  ? AppColors.primary.withValues(alpha: 0.12)
                  : colorScheme.surfaceContainerHighest,
              child: Icon(
                status == 'open' ? Icons.forum_outlined : Icons.lock_outline,
                color: status == 'open'
                    ? AppColors.primary
                    : colorScheme.onSurfaceVariant,
              ),
            ),
            if (hasNewMessage)
              Positioned(
                right: -1,
                top: -1,
                child: Container(
                  width: 11,
                  height: 11,
                  decoration: BoxDecoration(
                    color: AppColors.error,
                    shape: BoxShape.circle,
                    border: Border.all(color: colorScheme.surface, width: 2),
                  ),
                ),
              ),
          ],
        ),
        title: Row(
          children: [
            Expanded(
              child: Text(
                thread['subject']?.toString() ?? 'Conversacion',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontWeight: hasNewMessage ? FontWeight.w800 : FontWeight.w700,
                ),
              ),
            ),
            if (hasNewMessage) ...[
              const SizedBox(width: 8),
              Chip(
                visualDensity: VisualDensity.compact,
                label: const Text('Nuevo'),
                labelStyle: const TextStyle(fontSize: 11),
                backgroundColor: AppColors.primary.withValues(alpha: 0.12),
                side: BorderSide.none,
              ),
            ],
          ],
        ),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (participant != null)
              Text(
                'Con: ${_userLabel(participant)}',
                style: const TextStyle(fontSize: 12),
              ),
            if ((thread['last_message']?.toString() ?? '').isNotEmpty)
              Text(
                thread['last_message'].toString(),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: hasNewMessage
                      ? FontWeight.w700
                      : FontWeight.normal,
                  color: hasNewMessage ? AppColors.primary : null,
                ),
              ),
            if (dateText.isNotEmpty)
              Text(
                dateText,
                style: TextStyle(
                  fontSize: 12,
                  color: colorScheme.onSurfaceVariant,
                ),
              ),
          ],
        ),
        trailing: const Icon(Icons.chevron_right, color: AppColors.textHint),
      ),
    );
  }

  Map<String, dynamic>? _participant() {
    final recipient = widget.thread['recipient'] as Map<String, dynamic>?;
    final createdBy = widget.thread['created_by'] as Map<String, dynamic>?;
    final student = widget.thread['student'] as Map<String, dynamic>?;
    final candidates = [recipient, createdBy, student];
    for (final user in candidates) {
      if (user != null && user['id']?.toString() != widget.currentUserId) {
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
