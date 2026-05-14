import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'core/notifications/push_notification_service.dart';
import 'core/router/app_router.dart';
import 'core/theme/app_theme.dart';
import 'core/theme/theme_mode_provider.dart';
import 'features/auth/presentation/providers/auth_provider.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final prefs = await SharedPreferences.getInstance();
  runApp(
    ProviderScope(
      overrides: [sharedPreferencesProvider.overrideWithValue(prefs)],
      child: const ImmunoClinicApp(),
    ),
  );
  unawaited(PushNotificationService.initialize());
}

/// Root application widget.
class ImmunoClinicApp extends ConsumerWidget {
  const ImmunoClinicApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(routerProvider);
    final themeMode = ref.watch(themeModeProvider);
    ref.listen<AuthState>(authStateProvider, (previous, next) {
      final pushService = ref.read(pushNotificationServiceProvider);
      if (next.isAuthenticated && previous?.isAuthenticated != true) {
        unawaited(pushService.registerDevice());
      }
      if (!next.isAuthenticated && previous?.isAuthenticated == true) {
        unawaited(pushService.unregisterDevice());
      }
    });

    return MaterialApp.router(
      title: 'UCC ImmunoClinic',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.lightTheme,
      darkTheme: AppTheme.darkTheme,
      themeMode: themeMode,
      themeAnimationDuration: const Duration(milliseconds: 350),
      routerConfig: router,
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: const [Locale('en', ''), Locale('es', '')],
    );
  }
}
