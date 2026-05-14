import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

class UccLogo extends StatelessWidget {
  static const String assetPath = 'assets/images/ucc_logo_app.png';

  final double size;
  final bool showWordmark;
  final Color wordmarkColor;

  const UccLogo({
    super.key,
    this.size = 96,
    this.showWordmark = false,
    this.wordmarkColor = AppColors.brandGray,
  });

  @override
  Widget build(BuildContext context) {
    final pixelRatio = MediaQuery.devicePixelRatioOf(context);
    final height = showWordmark ? size * 0.90 : size * 0.74;
    final resolvedWordmarkColor =
        wordmarkColor == AppColors.brandGray &&
            Theme.of(context).brightness == Brightness.dark
        ? AppColors.darkTextSecondary
        : wordmarkColor;

    return RepaintBoundary(
      child: Image.asset(
        assetPath,
        width: size,
        height: height,
        cacheWidth: (size * pixelRatio).round(),
        cacheHeight: (height * pixelRatio).round(),
        fit: BoxFit.contain,
        filterQuality: FilterQuality.medium,
        errorBuilder: (context, error, stackTrace) => _FallbackUccLogo(
          size: size,
          showWordmark: showWordmark,
          wordmarkColor: resolvedWordmarkColor,
        ),
      ),
    );
  }
}

class _FallbackUccLogo extends StatelessWidget {
  final double size;
  final bool showWordmark;
  final Color wordmarkColor;

  const _FallbackUccLogo({
    required this.size,
    required this.showWordmark,
    required this.wordmarkColor,
  });

  @override
  Widget build(BuildContext context) {
    final logo = SizedBox(
      width: size,
      height: size * 0.74,
      child: CustomPaint(painter: _UccLogoPainter()),
    );
    if (!showWordmark) return logo;

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        logo,
        SizedBox(height: size * 0.08),
        Text(
          'Universidad Cooperativa',
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
            color: wordmarkColor,
            fontWeight: FontWeight.w700,
            height: 1,
          ),
        ),
        Text(
          'de Colombia',
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
            color: wordmarkColor,
            fontWeight: FontWeight.w700,
            height: 1.1,
          ),
        ),
      ],
    );
  }
}

class UccBrandBackground extends StatelessWidget {
  final Widget child;

  const UccBrandBackground({super.key, required this.child});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return DecoratedBox(
      decoration: BoxDecoration(
        gradient: isDark ? AppColors.darkSoftGradient : AppColors.softGradient,
      ),
      child: Stack(
        children: [
          Positioned(
            top: -70,
            right: -54,
            child: _SoftBrandRing(
              size: 220,
              opacity: isDark ? 0.18 : 0.12,
              onDark: isDark,
            ),
          ),
          Positioned(
            bottom: -84,
            left: -60,
            child: _SoftBrandRing(
              size: 240,
              opacity: isDark ? 0.14 : 0.10,
              onDark: isDark,
            ),
          ),
          child,
        ],
      ),
    );
  }
}

class UccHeroPanel extends StatelessWidget {
  final String eyebrow;
  final String title;
  final String subtitle;
  final IconData icon;
  final Widget? trailing;

  const UccHeroPanel({
    super.key,
    required this.eyebrow,
    required this.title,
    required this.subtitle,
    required this.icon,
    this.trailing,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: AppColors.brandGradient,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: isDark ? 0.28 : 0.16),
            blurRadius: isDark ? 28 : 20,
            offset: const Offset(0, 12),
          ),
        ],
      ),
      child: Stack(
        children: [
          const Positioned(
            right: -34,
            top: -40,
            child: _SoftBrandRing(size: 140, opacity: 0.18, onDark: true),
          ),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 52,
                height: 52,
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.18),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: Colors.white.withValues(alpha: 0.24),
                  ),
                ),
                child: Icon(icon, color: Colors.white, size: 28),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      eyebrow.toUpperCase(),
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: Colors.white.withValues(alpha: 0.78),
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      title,
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(
                        color: Colors.white,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      subtitle,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: Colors.white.withValues(alpha: 0.84),
                      ),
                    ),
                  ],
                ),
              ),
              if (trailing != null) ...[const SizedBox(width: 12), trailing!],
            ],
          ),
        ],
      ),
    );
  }
}

class BrandSectionTitle extends StatelessWidget {
  final String title;
  final Widget? trailing;

  const BrandSectionTitle({super.key, required this.title, this.trailing});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 5,
          height: 22,
          decoration: BoxDecoration(
            color: AppColors.accent,
            borderRadius: BorderRadius.circular(99),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            title,
            style: Theme.of(
              context,
            ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
          ),
        ),
        ?trailing,
      ],
    );
  }
}

class _SoftBrandRing extends StatelessWidget {
  final double size;
  final double opacity;
  final bool onDark;

  const _SoftBrandRing({
    required this.size,
    required this.opacity,
    this.onDark = false,
  });

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: RepaintBoundary(
        child: CustomPaint(
          size: Size.square(size),
          painter: _RingPainter(opacity: opacity, onDark: onDark),
        ),
      ),
    );
  }
}

class _RingPainter extends CustomPainter {
  final double opacity;
  final bool onDark;

  const _RingPainter({required this.opacity, required this.onDark});

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = size.shortestSide * 0.36;
    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = size.shortestSide * 0.12
      ..strokeCap = StrokeCap.square
      ..color = (onDark ? Colors.white : AppColors.primary).withValues(
        alpha: opacity,
      );

    canvas.drawArc(
      Rect.fromCircle(center: center, radius: radius),
      -math.pi / 2,
      math.pi * 1.55,
      false,
      paint,
    );
  }

  @override
  bool shouldRepaint(covariant _RingPainter oldDelegate) {
    return oldDelegate.opacity != opacity || oldDelegate.onDark != onDark;
  }
}

class _UccLogoPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final s = size.shortestSide;
    final cyan = Paint()
      ..color = AppColors.primary
      ..style = PaintingStyle.stroke
      ..strokeWidth = s * 0.16
      ..strokeCap = StrokeCap.square
      ..strokeJoin = StrokeJoin.round;
    final green = Paint()..color = AppColors.accent;

    final uPath = Path()
      ..moveTo(size.width * 0.16, size.height * 0.08)
      ..lineTo(size.width * 0.16, size.height * 0.60)
      ..quadraticBezierTo(
        size.width * 0.16,
        size.height * 0.88,
        size.width * 0.43,
        size.height * 0.88,
      )
      ..lineTo(size.width * 0.88, size.height * 0.88);
    canvas.drawPath(uPath, cyan);

    final shield = RRect.fromRectAndCorners(
      Rect.fromLTWH(
        size.width * 0.34,
        size.height * 0.08,
        size.width * 0.22,
        size.height * 0.55,
      ),
      bottomLeft: Radius.circular(s * 0.08),
      bottomRight: Radius.circular(s * 0.08),
    );
    canvas.drawRRect(shield, green);

    final cPaint = Paint()
      ..color = AppColors.accent
      ..style = PaintingStyle.stroke
      ..strokeWidth = s * 0.09
      ..strokeCap = StrokeCap.square;
    canvas.drawArc(
      Rect.fromCircle(
        center: Offset(size.width * 0.82, size.height * 0.44),
        radius: s * 0.22,
      ),
      -math.pi / 2,
      math.pi,
      false,
      cPaint,
    );

    final innerPaint = Paint()
      ..color = AppColors.lime
      ..style = PaintingStyle.stroke
      ..strokeWidth = s * 0.08
      ..strokeCap = StrokeCap.square;
    canvas.drawArc(
      Rect.fromCircle(
        center: Offset(size.width * 0.84, size.height * 0.44),
        radius: s * 0.11,
      ),
      -math.pi / 2,
      math.pi,
      false,
      innerPaint,
    );

    canvas.drawCircle(
      Offset(size.width * 0.86, size.height * 0.44),
      s * 0.035,
      Paint()..color = AppColors.primary,
    );

    final topTriangle = Path()
      ..moveTo(size.width * 0.67, size.height * 0.08)
      ..lineTo(size.width * 0.75, size.height * 0.08)
      ..lineTo(size.width * 0.67, size.height * 0.16)
      ..close();
    canvas.drawPath(topTriangle, Paint()..color = AppColors.primary);

    final bottomTriangle = Path()
      ..moveTo(size.width * 0.66, size.height * 0.70)
      ..lineTo(size.width * 0.74, size.height * 0.88)
      ..lineTo(size.width * 0.64, size.height * 0.88)
      ..close();
    canvas.drawPath(bottomTriangle, Paint()..color = AppColors.primary);

    canvas.drawCircle(
      Offset(size.width * 0.47, size.height * 0.32),
      s * 0.18,
      Paint()
        ..shader =
            RadialGradient(
              colors: [
                Colors.white.withValues(alpha: 0.18),
                Colors.transparent,
              ],
            ).createShader(
              Rect.fromCircle(
                center: Offset(size.width * 0.47, size.height * 0.32),
                radius: s * 0.30,
              ),
            ),
    );
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
