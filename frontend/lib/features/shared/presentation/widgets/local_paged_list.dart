import 'package:flutter/material.dart';

/// Pages an existing response in memory; it does not fetch additional records.
class LocalPagedList extends StatefulWidget {
  final int itemCount;
  final IndexedWidgetBuilder itemBuilder;
  final double maxHeight;

  const LocalPagedList({
    super.key,
    required this.itemCount,
    required this.itemBuilder,
    this.maxHeight = 240,
  });

  @override
  State<LocalPagedList> createState() => _LocalPagedListState();
}

class _LocalPagedListState extends State<LocalPagedList> {
  static const _size = 20;
  int _page = 1;

  @override
  void didUpdateWidget(LocalPagedList oldWidget) {
    super.didUpdateWidget(oldWidget);
    _page = _page.clamp(1, _pages).toInt();
  }

  int get _pages =>
      widget.itemCount == 0 ? 1 : (widget.itemCount + _size - 1) ~/ _size;

  @override
  Widget build(BuildContext context) {
    final offset = (_page - 1) * _size;
    final count = (widget.itemCount - offset).clamp(0, _size).toInt();
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        ConstrainedBox(
          constraints: BoxConstraints(maxHeight: widget.maxHeight),
          child: ListView.separated(
            key: ValueKey(_page),
            shrinkWrap: true,
            itemCount: count,
            separatorBuilder: (_, _) => const Divider(height: 8),
            itemBuilder: (context, index) =>
                widget.itemBuilder(context, offset + index),
          ),
        ),
        Wrap(
          spacing: 8,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            TextButton(
              onPressed: _page > 1 ? () => setState(() => _page--) : null,
              child: const Text('Anterior'),
            ),
            Text('Página $_page de $_pages · ${widget.itemCount} filas'),
            TextButton(
              onPressed: _page < _pages ? () => setState(() => _page++) : null,
              child: const Text('Siguiente'),
            ),
          ],
        ),
      ],
    );
  }
}
