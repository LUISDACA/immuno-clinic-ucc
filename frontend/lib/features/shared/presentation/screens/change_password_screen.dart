import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/error/api_error_message.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/password_rules.dart';
import '../../../../core/utils/role_utils.dart';
import '../../../auth/data/datasources/auth_remote_ds.dart';
import '../../../auth/presentation/providers/auth_provider.dart';

/// Change password screen shared between student and admin.
class ChangePasswordScreen extends ConsumerStatefulWidget {
  const ChangePasswordScreen({super.key});

  @override
  ConsumerState<ChangePasswordScreen> createState() =>
      _ChangePasswordScreenState();
}

class _ChangePasswordScreenState extends ConsumerState<ChangePasswordScreen> {
  final _formKey = GlobalKey<FormState>();
  final _currentCtrl = TextEditingController();
  final _newCtrl = TextEditingController();
  final _confirmCtrl = TextEditingController();
  bool _isLoading = false;
  String? _error;
  bool _success = false;
  bool _obscureCurrent = true;
  bool _obscureNew = true;
  bool _obscureConfirm = true;

  @override
  void dispose() {
    _currentCtrl.dispose();
    _newCtrl.dispose();
    _confirmCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      await ref
          .read(authRemoteDataSourceProvider)
          .changePassword(_currentCtrl.text, _newCtrl.text);
      ref.read(authStateProvider.notifier).markPasswordChanged();
      setState(() {
        _isLoading = false;
        _success = true;
      });
    } on DioException catch (e) {
      setState(() {
        _isLoading = false;
        _error = dioErrorMessage(e, fallback: 'Error al cambiar contraseña');
      });
    } catch (_) {
      setState(() {
        _isLoading = false;
        _error = 'Error al cambiar contraseña';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authStateProvider);
    return Scaffold(
      appBar: AppBar(
        title: Text(
          authState.mustChangePassword
              ? 'Cambio obligatorio de contraseña'
              : 'Cambiar contraseña',
        ),
        automaticallyImplyLeading: !authState.mustChangePassword,
      ),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: _success ? _buildSuccess(authState) : _buildForm(authState),
      ),
    );
  }

  Widget _buildSuccess(AuthState authState) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.check_circle, size: 64, color: AppColors.success),
          const SizedBox(height: 16),
          Text(
            'Contraseña actualizada',
            style: Theme.of(
              context,
            ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 24),
          OutlinedButton(
            onPressed: () =>
                context.go(isAdminRole(authState.role) ? '/admin' : '/student'),
            child: const Text('Volver'),
          ),
        ],
      ),
    );
  }

  Widget _buildForm(AuthState authState) {
    return Form(
      key: _formKey,
      child: Column(
        children: [
          if (authState.mustChangePassword) ...[
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.warning.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: AppColors.warning.withValues(alpha: 0.5),
                ),
              ),
              child: const Text(
                'Tu contraseña temporal es tu cédula. Debes cambiarla antes de continuar.',
                style: TextStyle(color: AppColors.warning),
              ),
            ),
            const SizedBox(height: 16),
          ],
          TextFormField(
            controller: _currentCtrl,
            obscureText: _obscureCurrent,
            decoration: InputDecoration(
              labelText: 'Contraseña actual',
              prefixIcon: const Icon(Icons.lock_outline),
              suffixIcon: IconButton(
                tooltip: _obscureCurrent
                    ? 'Mostrar contraseña'
                    : 'Ocultar contraseña',
                icon: Icon(
                  _obscureCurrent
                      ? Icons.visibility_off_outlined
                      : Icons.visibility_outlined,
                ),
                onPressed: () =>
                    setState(() => _obscureCurrent = !_obscureCurrent),
              ),
            ),
            validator: (v) => v == null || v.isEmpty ? 'Requerido' : null,
          ),
          const SizedBox(height: 16),
          TextFormField(
            controller: _newCtrl,
            obscureText: _obscureNew,
            decoration: InputDecoration(
              labelText: 'Nueva contraseña',
              helperText: passwordRequirementsText,
              prefixIcon: const Icon(Icons.lock_reset),
              suffixIcon: IconButton(
                tooltip: _obscureNew
                    ? 'Mostrar contraseña'
                    : 'Ocultar contraseña',
                icon: Icon(
                  _obscureNew
                      ? Icons.visibility_off_outlined
                      : Icons.visibility_outlined,
                ),
                onPressed: () => setState(() => _obscureNew = !_obscureNew),
              ),
            ),
            validator: validateStrongPassword,
          ),
          const SizedBox(height: 16),
          TextFormField(
            controller: _confirmCtrl,
            obscureText: _obscureConfirm,
            decoration: InputDecoration(
              labelText: 'Confirmar nueva contraseña',
              prefixIcon: const Icon(Icons.lock_reset),
              suffixIcon: IconButton(
                tooltip: _obscureConfirm
                    ? 'Mostrar contraseña'
                    : 'Ocultar contraseña',
                icon: Icon(
                  _obscureConfirm
                      ? Icons.visibility_off_outlined
                      : Icons.visibility_outlined,
                ),
                onPressed: () =>
                    setState(() => _obscureConfirm = !_obscureConfirm),
              ),
            ),
            validator: (v) =>
                v != _newCtrl.text ? 'Las contraseñas no coinciden' : null,
          ),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.only(top: 12),
              child: Text(
                _error!,
                style: const TextStyle(color: AppColors.error),
              ),
            ),
          const SizedBox(height: 24),
          SizedBox(
            width: double.infinity,
            height: 50,
            child: ElevatedButton(
              onPressed: _isLoading ? null : _submit,
              child: _isLoading
                  ? const SizedBox(
                      width: 22,
                      height: 22,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                  : const Text('Cambiar contraseña'),
            ),
          ),
        ],
      ),
    );
  }
}
