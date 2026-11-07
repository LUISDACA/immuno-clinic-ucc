import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

abstract interface class SchemeCacheStore {
  Future<String?> read(String key);
  Future<void> write(String key, String value);
  Future<void> deleteAll();
}

class SecureSchemeCacheStore implements SchemeCacheStore {
  SecureSchemeCacheStore([FlutterSecureStorage? storage])
    : _storage = storage ?? const FlutterSecureStorage();

  final FlutterSecureStorage _storage;

  @override
  Future<String?> read(String key) => _storage.read(key: key);

  @override
  Future<void> write(String key, String value) =>
      _storage.write(key: key, value: value);

  @override
  Future<void> deleteAll() async {
    final values = await _storage.readAll();
    for (final key in values.keys.where(
      (key) => key.startsWith(SchemeCache.prefix),
    )) {
      await _storage.delete(key: key);
    }
  }
}

class SchemeCache {
  static const legacyKey = 'cached_student_scheme';
  static const prefix = 'cached_student_scheme_';
  static final store = SecureSchemeCacheStore();

  static String? keyForUser(String? userId) {
    if (userId == null || userId.isEmpty) return null;
    return '$prefix$userId';
  }

  static Future<void> clearAll(
    SharedPreferences prefs, {
    SchemeCacheStore? store,
  }) async {
    final keys = prefs.getKeys().where(
      (key) => key == legacyKey || key.startsWith(prefix),
    );
    for (final key in keys.toList()) {
      await prefs.remove(key);
    }
    await (store ?? SchemeCache.store).deleteAll();
  }

  static Future<void> clearLegacy(SharedPreferences prefs) async {
    await prefs.remove(legacyKey);
  }
}
