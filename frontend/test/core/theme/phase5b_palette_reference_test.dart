import 'dart:convert';
import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:immuno_clinic_app/core/theme/app_theme.dart';

// Raster reference of actual AppColors; deliberately not a screen/font golden.
void main() {
  for (final dark in [false, true]) {
    testWidgets('renders ${dark ? "dark" : "light"} source palette', (
      tester,
    ) async {
      tester.view.physicalSize = const Size(640, 360);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final palette = <String, Color>{
        'background': dark ? AppColors.darkBackground : AppColors.background,
        'surface': dark ? AppColors.darkSurface : AppColors.surface,
        'surface_variant': dark
            ? AppColors.darkSurfaceVariant
            : AppColors.surfaceVariant,
        'foreground': dark ? AppColors.darkTextPrimary : AppColors.textPrimary,
        'muted_foreground': dark
            ? AppColors.darkTextSecondary
            : AppColors.textSecondary,
        'primary': dark ? AppColors.primaryLight : AppColors.primary,
        'border': dark ? AppColors.darkBorder : AppColors.border,
        'divider': dark ? AppColors.darkDivider : AppColors.divider,
      };
      final key = GlobalKey();
      await tester.pumpWidget(
        Directionality(
          textDirection: TextDirection.ltr,
          child: RepaintBoundary(
            key: key,
            child: Row(
              children: palette.values
                  .map(
                    (color) => Expanded(
                      child: ColoredBox(
                        color: color,
                        child: const SizedBox.expand(),
                      ),
                    ),
                  )
                  .toList(),
            ),
          ),
        ),
      );
      final boundary =
          key.currentContext!.findRenderObject()! as RenderRepaintBoundary;
      final image = (await tester.runAsync(
        () => boundary.toImage(pixelRatio: 1),
      ))!;
      try {
        final bytes = (await tester.runAsync(
          () => image.toByteData(format: ui.ImageByteFormat.rawRgba),
        ))!;
        for (var i = 0; i < palette.length; i++) {
          final pixel = (180 * 640 + i * 80 + 40) * 4;
          final color = palette.values.elementAt(i).toARGB32();
          expect(bytes.getUint8(pixel), (color >> 16) & 255);
          expect(bytes.getUint8(pixel + 1), (color >> 8) & 255);
          expect(bytes.getUint8(pixel + 2), color & 255);
          expect(bytes.getUint8(pixel + 3), 255);
        }
        final path = Platform.environment['PHASE5B_ARTIFACT_DIR'];
        if (path != null) {
          await tester.runAsync(() async {
            await Directory(path).create(recursive: true);
            final mode = dark ? 'dark' : 'light';
            final png = (await image.toByteData(
              format: ui.ImageByteFormat.png,
            ))!;
            await File(
              '$path/flutter-palette-$mode.png',
            ).writeAsBytes(png.buffer.asUint8List());
            await File('$path/flutter-palette-$mode.json').writeAsString(
              '${jsonEncode({'kind': 'source-palette-only', 'width': 640, 'height': 360, 'colors': palette.map((name, color) => MapEntry(name, '#${color.toARGB32().toRadixString(16).padLeft(8, "0").substring(2)}'))})}\n',
            );
          });
        }
      } finally {
        image.dispose();
      }
    });
  }
}
