bool isAdminRole(String? role) {
  final normalized = role?.toLowerCase();
  return normalized == 'admin' || normalized == 'app_admin';
}

bool isAppAdminRole(String? role) => role?.toLowerCase() == 'app_admin';
