import 'package:flutter/material.dart';

class CommunicationQueryError extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;
  final bool retrying;
  final String retryLabel;

  const CommunicationQueryError({
    super.key,
    required this.message,
    required this.onRetry,
    this.retrying = false,
    this.retryLabel = 'Reintentar',
  });

  @override
  Widget build(BuildContext context) => Padding(
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
            onPressed: retrying ? null : onRetry,
            child: Text(retryLabel),
          ),
        ],
      ),
    ),
  );
}
