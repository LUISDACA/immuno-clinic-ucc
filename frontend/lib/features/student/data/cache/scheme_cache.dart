import 'package:shared_preferences/shared_preferences.dart';

class SchemeCache {
  static const legacyKey = 'cached_student_scheme';
  static const _prefix = 'cached_student_scheme_';

  static String? keyForUser(String? userId) {
    if (userId == null || userId.isEmpty) return null;
    return '$_prefix$userId';
  }

  static Future<void> clearAll(SharedPreferences prefs) async {
    final keys = prefs.getKeys().where(
      (key) => key == legacyKey || key.startsWith(_prefix),
    );
    for (final key in keys.toList()) {
      await prefs.remove(key);
    }
  }

  static Future<void> clearLegacy(SharedPreferences prefs) async {
    await prefs.remove(legacyKey);
  }
}
