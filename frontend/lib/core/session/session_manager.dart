import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../constants/app_constants.dart';

/// A token pair is one secure-storage value. Writes cannot overtake logout.
class SessionManager {
  final FlutterSecureStorage _storage;
  static const bundleKey = 'auth_session_v2';
  Map<String, dynamic>? _bundle;
  bool _loaded = false;
  int _generation = 0;
  Future<void> _writes = Future.value();
  void Function()? onExpired;
  SessionManager({FlutterSecureStorage? storage})
    : _storage = storage ?? const FlutterSecureStorage();
  int get generation => _generation;

  Future<void> _enqueue(Future<void> Function() action) {
    final next = _writes.then((_) => action());
    _writes = next.catchError((Object _) {});
    return next;
  }

  Future<void> _load() async {
    if (_loaded) return;
    final epoch = _generation;
    final raw = await _storage.read(key: bundleKey);
    if (epoch != _generation) return;
    try {
      _bundle = raw == null ? null : jsonDecode(raw) as Map<String, dynamic>;
    } catch (_) {
      _bundle = null;
    }
    _loaded = true;
  }

  Future<void> saveTokens({
    required String accessToken,
    required String refreshToken,
    int? expectedGeneration,
  }) {
    final epoch = expectedGeneration ?? _generation;
    return _enqueue(() async {
      if (epoch != _generation) return;
      _bundle = {
        'access': accessToken,
        'refresh': refreshToken,
        'role': _bundle?['role'],
      };
      _loaded = true;
      await _storage.write(key: bundleKey, value: jsonEncode(_bundle));
    });
  }

  Future<String?> getAccessToken() async {
    await _load();
    return _bundle?['access'] as String?;
  }

  Future<String?> getRefreshToken() async {
    await _load();
    return _bundle?['refresh'] as String?;
  }

  Future<String?> getUserRole() async {
    await _load();
    return _bundle?['role'] as String?;
  }

  Future<void> saveUserRole(String role, {int? expectedGeneration}) {
    final epoch = expectedGeneration ?? _generation;
    return _enqueue(() async {
      if (epoch != _generation || _bundle == null) return;
      _bundle!['role'] = role;
      await _storage.write(key: bundleKey, value: jsonEncode(_bundle));
    });
  }

  Future<void> clearSession() {
    _generation++;
    _bundle = null;
    _loaded = true;
    return _enqueue(() async {
      for (final key in [
        bundleKey,
        AppConstants.accessTokenKey,
        AppConstants.refreshTokenKey,
        AppConstants.userRoleKey,
      ]) {
        await _storage.delete(key: key);
      }
    });
  }

  Future<void> expire() async {
    await clearSession();
    onExpired?.call();
  }

  Future<bool> hasValidSession() async =>
      (await getRefreshToken())?.isNotEmpty ?? false;
}

final sessionManagerProvider = Provider<SessionManager>(
  (ref) => SessionManager(),
);
