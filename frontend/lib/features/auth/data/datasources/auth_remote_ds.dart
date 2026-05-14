import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/api_client.dart';
import '../../../../core/models/user_model.dart';

/// Auth data source — handles API calls for authentication.
class AuthRemoteDataSource {
  final ApiClient _apiClient;

  AuthRemoteDataSource(this._apiClient);

  Future<AuthTokens> login(String email, String password) async {
    final response = await _apiClient.dio.post(
      '/auth/login',
      data: {'email': email, 'password': password},
    );
    return AuthTokens.fromJson(response.data);
  }

  Future<String> refreshToken(String refreshToken) async {
    final response = await _apiClient.dio.post(
      '/auth/refresh',
      data: {'refresh_token': refreshToken},
    );
    return response.data['access_token'] as String;
  }

  Future<void> logout(String refreshToken) async {
    await _apiClient.dio.post(
      '/auth/logout',
      data: {'refresh_token': refreshToken},
    );
  }

  Future<void> changePassword(String currentPassword, String newPassword) async {
    await _apiClient.dio.post(
      '/auth/change-password',
      data: {'current_password': currentPassword, 'new_password': newPassword},
    );
  }

  Future<void> forgotPassword(String email) async {
    await _apiClient.dio.post(
      '/auth/forgot-password',
      data: {'email': email},
    );
  }

  Future<void> resetPassword(String token, String newPassword) async {
    await _apiClient.dio.post(
      '/auth/reset-password',
      data: {'token': token, 'new_password': newPassword},
    );
  }

  Future<UserModel> getCurrentUser() async {
    final response = await _apiClient.dio.get('/users/me');
    return UserModel.fromJson(response.data);
  }
}

/// Provider for AuthRemoteDataSource.
final authRemoteDataSourceProvider = Provider<AuthRemoteDataSource>((ref) {
  return AuthRemoteDataSource(ref.read(apiClientProvider));
});
