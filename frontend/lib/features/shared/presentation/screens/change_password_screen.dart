import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/error/account_form_error.dart';
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
    if (_isLoading || _formKey.currentState?.validate() != true) return;
    setState(() {
      _isLoading = true;
      _error = null;
    });

    final notifier = ref.read(authStateProvider.notifier);
    final messenger = ScaffoldMessenger.maybeOf(context);
    try {
      await ref
          .read(authRemoteDataSourceProvider)
          .changePassword(_currentCtrl.text, _newCtrl.text);
      await notifier.logout();
      if (messenger != null && messenger.mounted) {
        messenger.showSnackBar(
          const SnackBar(
            content: Text(
              'Contraseña actualizada. Inicia sesión con tu nueva contraseña.',
            ),
          ),
        );
      }
      if (!mounted) return;
      setState(() {
        _isLoading = false;
        _success = true;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _isLoading = false;
        _error = accountFormError(e, AccountFormOperation.change);
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
      body: LayoutBuilder(
        builder: (context, constraints) => SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: ConstrainedBox(
            constraints: BoxConstraints(
              minHeight: constraints.maxHeight > 48
                  ? constraints.maxHeight - 48
                  : 0,
            ),
            child: _success ? _buildSuccess(authState) : _buildForm(authState),
          ),
        ),
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
                'Usa la contraseña temporal recibida por correo. Debes cambiarla antes de continuar.',
                style: TextStyle(color: AppColors.warning),
              ),
            ),
            const SizedBox(height: 16),
          ],
          TextFormField(
            enabled: !_isLoading,
            controller: _currentCtrl,
            obscureText: _obscureCurrent,
            textInputAction: TextInputAction.next,
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
                onPressed: _isLoading
                    ? null
                    : () => setState(() => _obscureCurrent = !_obscureCurrent),
              ),
            ),
            validator: (v) => v == null || v.isEmpty ? 'Requerido' : null,
          ),
          const SizedBox(height: 16),
          TextFormField(
            enabled: !_isLoading,
            controller: _newCtrl,
            obscureText: _obscureNew,
            textInputAction: TextInputAction.next,
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
                onPressed: _isLoading
                    ? null
                    : () => setState(() => _obscureNew = !_obscureNew),
              ),
            ),
            validator: validateStrongPassword,
          ),
          const SizedBox(height: 16),
          TextFormField(
            enabled: !_isLoading,
            controller: _confirmCtrl,
            obscureText: _obscureConfirm,
            textInputAction: TextInputAction.done,
            onFieldSubmitted: (_) => _submit(),
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
                onPressed: _isLoading
                    ? null
                    : () => setState(() => _obscureConfirm = !_obscureConfirm),
              ),
            ),
            validator: (v) =>
                v != _newCtrl.text ? 'Las contraseñas no coinciden' : null,
          ),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.only(top: 12),
              child: Semantics(
                liveRegion: true,
                child: Text(
                  _error!,
                  style: TextStyle(
                    color: Theme.of(context).brightness == Brightness.dark
                        ? AppColors.darkTextPrimary
                        : AppColors.error,
                  ),
                ),
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
