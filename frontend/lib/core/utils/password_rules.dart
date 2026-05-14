const passwordRequirementsText =
    'Minimo 8 caracteres, una mayuscula, una minuscula, un numero y un simbolo (!@#\$%...).';

List<String> missingPasswordRequirements(String password) {
  final missing = <String>[];
  if (password.length < 8) missing.add('8 caracteres');
  if (!password.contains(RegExp(r'[A-Z]'))) missing.add('una mayuscula');
  if (!password.contains(RegExp(r'[a-z]'))) missing.add('una minuscula');
  if (!password.contains(RegExp(r'[0-9]'))) missing.add('un numero');
  if (!password.contains(RegExp(r'''[!@#$%^&*()_+\-=\[\]{}|;':",./<>?]'''))) {
    missing.add('un simbolo');
  }
  return missing;
}

String? validateStrongPassword(String? value) {
  if (value == null || value.isEmpty) return 'Requerido';
  final missing = missingPasswordRequirements(value);
  if (missing.isEmpty) return null;
  return 'Debe tener ${missing.join(', ')}';
}
