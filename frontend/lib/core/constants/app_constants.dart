import 'package:flutter/foundation.dart';

/// Application-wide constants.
class AppConstants {
  AppConstants._();

  static const String appName = 'UCC ImmunoClinic';
  static const String appVersion = '2.0.0';

  // API
  static String get baseUrl {
    const configuredUrl = String.fromEnvironment('API_BASE_URL');
    if (configuredUrl.isNotEmpty) {
      return configuredUrl;
    }
    if (kIsWeb) {
      return 'http://localhost:8000/api/v1';
    }
    if (defaultTargetPlatform == TargetPlatform.android) {
      return 'http://10.0.2.2:8000/api/v1';
    }
    return 'http://localhost:8000/api/v1';
  }

  // Storage keys
  static const String accessTokenKey = 'access_token';
  static const String refreshTokenKey = 'refresh_token';
  static const String userRoleKey = 'user_role';

  // Pagination
  static const int defaultPageSize = 20;
}
