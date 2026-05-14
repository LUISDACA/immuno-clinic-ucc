import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

const _themeModeKey = 'theme_mode';

final sharedPreferencesProvider = Provider<SharedPreferences>((ref) {
  throw UnimplementedError('SharedPreferences must be provided at app start.');
});

final themeModeProvider = StateNotifierProvider<ThemeModeController, ThemeMode>(
  (ref) {
    return ThemeModeController(ref.watch(sharedPreferencesProvider));
  },
);

class ThemeModeController extends StateNotifier<ThemeMode> {
  final SharedPreferences _prefs;

  ThemeModeController(this._prefs) : super(_readMode(_prefs));

  void cycle() {
    final next = switch (state) {
      ThemeMode.system => ThemeMode.light,
      ThemeMode.light => ThemeMode.dark,
      ThemeMode.dark => ThemeMode.system,
    };
    setMode(next);
  }

  void setMode(ThemeMode mode) {
    state = mode;
    _prefs.setString(_themeModeKey, mode.name);
  }

  static ThemeMode _readMode(SharedPreferences prefs) {
    return switch (prefs.getString(_themeModeKey)) {
      'light' => ThemeMode.light,
      'dark' => ThemeMode.dark,
      _ => ThemeMode.system,
    };
  }
}

class ThemeModeToggle extends ConsumerWidget {
  const ThemeModeToggle({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final mode = ref.watch(themeModeProvider);
    final icon = switch (mode) {
      ThemeMode.dark => Icons.dark_mode_outlined,
      ThemeMode.light => Icons.light_mode_outlined,
      ThemeMode.system => Icons.brightness_auto_outlined,
    };
    final tooltip = switch (mode) {
      ThemeMode.dark => 'Modo oscuro',
      ThemeMode.light => 'Modo claro',
      ThemeMode.system => 'Modo del sistema',
    };

    return IconButton.filledTonal(
      tooltip: tooltip,
      icon: Icon(icon),
      onPressed: () => ref.read(themeModeProvider.notifier).cycle(),
    );
  }
}
