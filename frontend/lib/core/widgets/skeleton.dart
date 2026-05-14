import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';

class SkeletonAnimationScope extends InheritedWidget {
  final bool enabled;

  const SkeletonAnimationScope({
    super.key,
    required this.enabled,
    required super.child,
  });

  static bool enabledOf(BuildContext context) {
    final scope = context
        .dependOnInheritedWidgetOfExactType<SkeletonAnimationScope>();
    return scope?.enabled ?? true;
  }

  @override
  bool updateShouldNotify(SkeletonAnimationScope oldWidget) {
    return enabled != oldWidget.enabled;
  }
}

/// A generic skeleton box that shimmers, used for loading states.
class SkeletonBox extends StatelessWidget {
  final double? width;
  final double? height;
  final BorderRadiusGeometry? borderRadius;
  final bool? animate;

  const SkeletonBox({
    super.key,
    this.width,
    this.height,
    this.borderRadius,
    this.animate,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final baseColor = isDark ? Colors.grey[800]! : Colors.grey[300]!;
    final box = Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        color: baseColor,
        borderRadius: borderRadius ?? BorderRadius.circular(8),
      ),
    );

    if (!(animate ?? SkeletonAnimationScope.enabledOf(context))) {
      return box;
    }

    return box
        .animate(onPlay: (controller) => controller.repeat())
        .shimmer(
          duration: const Duration(milliseconds: 1200),
          color: isDark ? Colors.grey[700]! : Colors.grey[100]!,
        );
  }
}
