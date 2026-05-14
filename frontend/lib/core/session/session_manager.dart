import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../constants/app_constants.dart';

/// Manages JWT tokens and session state.
class SessionManager {
  final FlutterSecureStorage _storage = const FlutterSecureStorage();
  String? _accessToken;
  String? _refreshToken;
  String? _userRole;
  bool _accessTokenLoaded = false;
  bool _refreshTokenLoaded = false;
  bool _userRoleLoaded = false;

  Future<void> saveTokens({
    required String accessToken,
    required String refreshToken,
  }) async {
    _accessToken = accessToken;
    _refreshToken = refreshToken;
    _accessTokenLoaded = true;
    _refreshTokenLoaded = true;
    await _storage.write(key: AppConstants.accessTokenKey, value: accessToken);
    await _storage.write(
      key: AppConstants.refreshTokenKey,
      value: refreshToken,
    );
  }

  Future<String?> getAccessToken() async {
    if (_accessTokenLoaded) return _accessToken;
    _accessToken = await _storage.read(key: AppConstants.accessTokenKey);
    _accessTokenLoaded = true;
    return _accessToken;
  }

  Future<String?> getRefreshToken() async {
    if (_refreshTokenLoaded) return _refreshToken;
    _refreshToken = await _storage.read(key: AppConstants.refreshTokenKey);
    _refreshTokenLoaded = true;
    return _refreshToken;
  }

  Future<void> saveUserRole(String role) async {
    _userRole = role;
    _userRoleLoaded = true;
    await _storage.write(key: AppConstants.userRoleKey, value: role);
  }

  Future<String?> getUserRole() async {
    if (_userRoleLoaded) return _userRole;
    _userRole = await _storage.read(key: AppConstants.userRoleKey);
    _userRoleLoaded = true;
    return _userRole;
  }

  Future<void> clearSession() async {
    _accessToken = null;
    _refreshToken = null;
    _userRole = null;
    _accessTokenLoaded = true;
    _refreshTokenLoaded = true;
    _userRoleLoaded = true;
    await _storage.deleteAll();
  }

  Future<bool> hasValidSession() async {
    final token = await getAccessToken();
    return token != null && token.isNotEmpty;
  }
}

/// Global session manager provider.
final sessionManagerProvider = Provider<SessionManager>((ref) {
  return SessionManager();
});
