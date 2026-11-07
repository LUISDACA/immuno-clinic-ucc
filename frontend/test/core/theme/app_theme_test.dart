import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:immuno_clinic_app/core/theme/app_theme.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  test('both themes preserve the platform transition builders', () {
    final builders = AppTheme.pageTransitionsTheme.builders;
    expect(
      builders[TargetPlatform.iOS].runtimeType.toString(),
      'CupertinoPageTransitionsBuilder',
    );
    expect(
      builders[TargetPlatform.macOS].runtimeType.toString(),
      'CupertinoPageTransitionsBuilder',
    );
    for (final platform in [
      TargetPlatform.android,
      TargetPlatform.windows,
      TargetPlatform.linux,
    ]) {
      expect(builders[platform], isA<FadeUpwardsPageTransitionsBuilder>());
    }
  });
}
