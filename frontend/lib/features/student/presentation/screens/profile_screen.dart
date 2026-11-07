import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:file_picker/file_picker.dart';

import '../../../../core/network/api_client.dart';
import '../../../../core/error/api_error_message.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/role_utils.dart';
import '../../../../core/widgets/ucc_brand.dart';
import '../../../auth/presentation/providers/auth_provider.dart';

class ProfileState {
  final bool isLoading;
  final bool isSaving;
  final String? error;
  final String? saveError;
  final bool saveConfirmed;
  final Map<String, dynamic>? profile;

  const ProfileState({
    this.isLoading = false,
    this.isSaving = false,
    this.error,
    this.saveError,
    this.saveConfirmed = false,
    this.profile,
  });

  ProfileState copyWith({
    bool? isLoading,
    bool? isSaving,
    String? error,
    String? saveError,
    bool? saveConfirmed,
    Map<String, dynamic>? profile,
  }) {
    return ProfileState(
      isLoading: isLoading ?? this.isLoading,
      isSaving: isSaving ?? this.isSaving,
      error: error,
      saveError: saveError,
      saveConfirmed: saveConfirmed ?? this.saveConfirmed,
      profile: profile ?? this.profile,
    );
  }
}

class ProfileNotifier extends StateNotifier<ProfileState> {
  final ApiClient _api;

  ProfileNotifier(this._api) : super(const ProfileState());

  int _request = 0;
  Future<void>? _inFlightLoad;
  Future<void> loadProfile({bool afterWrite = false}) {
    if (!mounted || (state.isSaving && !afterWrite)) return Future.value();
    if (!afterWrite && _inFlightLoad != null) return _inFlightLoad!;
    final load = _loadProfile();
    _inFlightLoad = load;
    load.whenComplete(() {
      if (identical(_inFlightLoad, load)) _inFlightLoad = null;
    });
    return load;
  }

  Future<void> _loadProfile() async {
    final request = ++_request;
    state = state.copyWith(isLoading: true, saveError: state.saveError);
    try {
      final response = await _api.dio.get('/users/me');
      if (!mounted || request != _request) return;
      state = state.copyWith(
        isLoading: false,
        profile: response.data,
        saveError: state.saveError,
        saveConfirmed: false,
      );
    } catch (error) {
      if (!mounted || request != _request) return;
      final status = error is DioException ? error.response?.statusCode : null;
      final message = switch (status) {
        401 => 'Tu sesión expiró. Inicia sesión nuevamente.',
        403 => 'No tienes permiso para consultar esta información.',
        404 => 'No se encontró la información solicitada.',
        429 => 'Demasiadas solicitudes. Espera antes de reintentar.',
        _ => 'Error al cargar perfil',
      };
      state = state.copyWith(
        isLoading: false,
        error: message,
        saveError: state.saveError,
      );
    }
  }

  void clearSaveError() {
    if (mounted) state = state.copyWith(error: state.error);
  }

  Future<bool> updateProfile({
    String? firstName,
    String? lastName,
    String? jobTitle,
    String? phone,
    String? epsAffiliation,
    String? emergencyContactName,
    String? emergencyContactPhone,
  }) async {
    if (!mounted || state.isSaving) return false;
    ++_request;
    _inFlightLoad = null; // A pre-write GET is obsolete, including for retries.
    state = state.copyWith(
      isSaving: true,
      isLoading: false,
      saveConfirmed: false,
    );
    try {
      final data = <String, dynamic>{
        'phone': phone,
        'eps_affiliation': epsAffiliation,
        'emergency_contact_name': emergencyContactName,
        'emergency_contact_phone': emergencyContactPhone,
      };
      if (firstName != null) data['first_name'] = firstName;
      if (lastName != null) data['last_name'] = lastName;
      if (jobTitle != null) data['job_title'] = jobTitle;
      final response = await _api.dio.put('/users/me/profile', data: data);
      if (!mounted) return false;
      state = state.copyWith(
        profile: response.data is Map<String, dynamic> ? response.data : null,
        saveConfirmed: true,
      );
      await loadProfile(afterWrite: true);
      if (!mounted) return false;
      state = state.copyWith(
        isSaving: false,
        error: state.error,
        saveError: state.saveError,
      );
      return true;
    } catch (_) {
      if (!mounted) return false;
      state = state.copyWith(
        isSaving: false,
        isLoading: false,
        saveConfirmed: false,
        saveError: 'No se pudo guardar el perfil. Intenta nuevamente.',
      );
      return false;
    }
  }
}

final profileProvider = StateNotifierProvider<ProfileNotifier, ProfileState>((
  ref,
) {
  ref.watch(authStateProvider.select((state) => state.userId));
  return ProfileNotifier(ref.watch(apiClientProvider));
});

class ProfileScreen extends ConsumerStatefulWidget {
  const ProfileScreen({super.key});

  @override
  ConsumerState<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends ConsumerState<ProfileScreen> {
  final _formKey = GlobalKey<FormState>();
  final _firstNameController = TextEditingController();
  final _lastNameController = TextEditingController();
  final _jobTitleController = TextEditingController();
  final _studentIdController = TextEditingController();
  final _birthDateController = TextEditingController();
  final _phoneController = TextEditingController();
  final _epsController = TextEditingController();
  final _emergencyNameController = TextEditingController();
  final _emergencyPhoneController = TextEditingController();
  final _programController = TextEditingController();
  final _semesterController = TextEditingController();
  bool _isEditing = false;
  Uint8List? _signatureBytes;
  bool _signatureLoading = false;
  bool _signatureUploading = false;

  @override
  void initState() {
    super.initState();
    Future.microtask(() => ref.read(profileProvider.notifier).loadProfile());
    if (ref.read(authStateProvider).role?.toLowerCase() == 'admin') {
      Future.microtask(_loadSignature);
    }
  }

  Future<void> _loadSignature() async {
    setState(() => _signatureLoading = true);
    try {
      final response = await ref
          .read(apiClientProvider)
          .dio
          .get<List<int>>(
            '/certificates/signature/active/image',
            options: Options(responseType: ResponseType.bytes),
          );
      if (mounted) {
        setState(
          () => _signatureBytes = Uint8List.fromList(response.data ?? []),
        );
      }
    } on DioException catch (error) {
      if (mounted) {
        setState(() => _signatureBytes = null);
        if (error.response?.statusCode != 404) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('No se pudo consultar la firma activa'),
            ),
          );
        }
      }
    } finally {
      if (mounted) setState(() => _signatureLoading = false);
    }
  }

  Future<void> _pickAndUploadSignature() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: const ['png', 'jpg', 'jpeg', 'webp'],
      withData: true,
    );
    final file = result?.files.single;
    if (file == null || file.bytes == null) return;
    final extension = file.extension?.toLowerCase();
    final mime = switch (extension) {
      'png' => DioMediaType('image', 'png'),
      'jpg' || 'jpeg' => DioMediaType('image', 'jpeg'),
      'webp' => DioMediaType('image', 'webp'),
      _ => null,
    };
    if (mime == null) return;
    setState(() => _signatureUploading = true);
    try {
      final form = FormData.fromMap({
        'file': MultipartFile.fromBytes(
          file.bytes!,
          filename: file.name,
          contentType: mime,
        ),
      });
      await ref
          .read(apiClientProvider)
          .dio
          .post('/certificates/signature', data: form);
      await _loadSignature();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Firma guardada para futuros certificados'),
          ),
        );
      }
    } on DioException catch (error) {
      if (mounted) {
        final message =
            apiErrorMessageFromData(error.response?.data) ??
            'No se pudo validar o guardar la firma';
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(message)));
      }
    } finally {
      if (mounted) setState(() => _signatureUploading = false);
    }
  }

  @override
  void dispose() {
    for (final c in [
      _firstNameController,
      _lastNameController,
      _jobTitleController,
      _studentIdController,
      _birthDateController,
      _phoneController,
      _epsController,
      _emergencyNameController,
      _emergencyPhoneController,
      _programController,
      _semesterController,
    ]) {
      c.dispose();
    }
    super.dispose();
  }

  void _populateFields(Map<String, dynamic> profile) {
    final p = profile['profile'] as Map<String, dynamic>? ?? {};
    _firstNameController.text = p['first_name']?.toString() ?? '';
    _lastNameController.text = p['last_name']?.toString() ?? '';
    _jobTitleController.text = p['job_title']?.toString() ?? '';
    _studentIdController.text = p['student_id']?.toString() ?? '';
    _birthDateController.text = p['birth_date']?.toString() ?? '';
    _phoneController.text = p['phone']?.toString() ?? '';
    _epsController.text = p['eps_affiliation']?.toString() ?? '';
    _emergencyNameController.text =
        p['emergency_contact_name']?.toString() ?? '';
    _emergencyPhoneController.text =
        p['emergency_contact_phone']?.toString() ?? '';
    _programController.text = p['program']?.toString() ?? '';
    _semesterController.text = p['semester']?.toString() ?? '';
  }

  String? _cleanText(TextEditingController controller) {
    final value = controller.text.trim();
    return value.isEmpty ? null : value;
  }

  Future<void> _saveProfile() async {
    if (ref.read(profileProvider).isSaving ||
        !(_formKey.currentState?.validate() ?? false)) {
      return;
    }
    final owner = ref.read(authStateProvider).userId;
    final isAdmin = isAdminRole(ref.read(authStateProvider).role);
    final success = await ref
        .read(profileProvider.notifier)
        .updateProfile(
          firstName: isAdmin ? _firstNameController.text.trim() : null,
          lastName: isAdmin ? _lastNameController.text.trim() : null,
          jobTitle: isAdmin ? _jobTitleController.text.trim() : null,
          phone: _cleanText(_phoneController),
          epsAffiliation: _cleanText(_epsController),
          emergencyContactName: _cleanText(_emergencyNameController),
          emergencyContactPhone: _cleanText(_emergencyPhoneController),
        );
    if (success && mounted && ref.read(authStateProvider).userId == owner) {
      setState(() => _isEditing = false);
      if (ref.read(profileProvider).error != null) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Perfil actualizado'),
          backgroundColor: AppColors.success,
        ),
      );
    }
  }

  String _formatDate(dynamic value) {
    if (value == null || value.toString().isEmpty) return 'No registrado';
    final parsed = DateTime.tryParse(value.toString());
    if (parsed == null) return value.toString();
    return DateFormat('dd/MM/yyyy').format(parsed);
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(profileProvider);
    final auth = ref.watch(authStateProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Mi Perfil'),
        actions: [
          if (!_isEditing &&
              state.profile != null &&
              state.error == null &&
              !state.isLoading &&
              !state.isSaving)
            IconButton(
              icon: const Icon(Icons.edit_outlined),
              tooltip: 'Editar',
              onPressed: () {
                ref.read(profileProvider.notifier).clearSaveError();
                _populateFields(state.profile!);
                setState(() => _isEditing = true);
              },
            ),
        ],
      ),
      body: UccBrandBackground(
        child: state.isLoading || (state.profile == null && state.error == null)
            ? const Center(child: CircularProgressIndicator())
            : state.error != null
            ? Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (state.saveConfirmed)
                      Semantics(
                        liveRegion: true,
                        child: const Padding(
                          padding: EdgeInsets.all(16),
                          child: Text(
                            'Los cambios se guardaron, pero no se pudo actualizar el perfil.',
                            textAlign: TextAlign.center,
                          ),
                        ),
                      ),
                    if (state.saveError != null)
                      Semantics(
                        liveRegion: true,
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Text(
                            state.saveError!,
                            textAlign: TextAlign.center,
                          ),
                        ),
                      ),
                    Icon(Icons.error_outline, size: 48, color: AppColors.error),
                    const SizedBox(height: 8),
                    Text(
                      state.error!,
                      style: const TextStyle(color: AppColors.error),
                    ),
                    const SizedBox(height: 16),
                    ElevatedButton(
                      onPressed: () =>
                          ref.read(profileProvider.notifier).loadProfile(),
                      child: const Text('Reintentar'),
                    ),
                  ],
                ),
              )
            : _buildBody(state, auth),
      ),
    );
  }

  Widget _buildBody(ProfileState state, AuthState auth) {
    final profile = state.profile!;
    final p = profile['profile'] as Map<String, dynamic>? ?? {};
    final isAdmin = isAdminRole(auth.role);
    final isNormalAdmin = auth.role?.toLowerCase() == 'admin';
    final email = profile['email'] ?? auth.email ?? '';
    final firstName = p['first_name'] ?? '';
    final lastName = p['last_name'] ?? '';
    final jobTitle = p['job_title'] ?? '';
    final docNumber = p['document_number'] ?? '';
    final studentId = p['student_id'] ?? '';
    final birthDate = p['birth_date'];
    final sex = p['sex'] ?? '';
    final phone = p['phone'] ?? '';
    final eps = p['eps_affiliation'] ?? '';
    final emergencyName = p['emergency_contact_name'] ?? '';
    final emergencyPhone = p['emergency_contact_phone'] ?? '';
    final program = p['program'] ?? '';
    final campus = p['campus'] ?? '';
    final semester = p['semester']?.toString() ?? '';

    return RefreshIndicator(
      onRefresh: () => ref.read(profileProvider.notifier).loadProfile(),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (_isEditing && state.saveError != null)
            Semantics(
              liveRegion: true,
              child: Padding(
                padding: const EdgeInsets.only(bottom: 16),
                child: Text(state.saveError!, textAlign: TextAlign.center),
              ),
            ),
          Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              gradient: AppColors.brandGradient,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Column(
              children: [
                CircleAvatar(
                  radius: 40,
                  backgroundColor: Colors.white.withValues(alpha: 0.2),
                  child: Text(
                    '${firstName.isNotEmpty ? firstName[0] : ''}${lastName.isNotEmpty ? lastName[0] : ''}',
                    style: const TextStyle(
                      fontSize: 28,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                Text(
                  '$firstName $lastName',
                  style: const TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  email,
                  style: TextStyle(color: Colors.white.withValues(alpha: 0.8)),
                ),
                if (isAdmin && jobTitle.toString().isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(
                    jobTitle.toString(),
                    style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.85),
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: 24),
          if (_isEditing) ...[
            Form(
              key: _formKey,
              child: Column(
                children: [
                  if (isAdmin) ...[
                    _lockedInfoTile(
                      Icons.email_outlined,
                      'Correo electrónico',
                      email,
                    ),
                    const SizedBox(height: 16),
                    TextFormField(
                      enabled: !state.isSaving,
                      controller: _firstNameController,
                      decoration: const InputDecoration(
                        labelText: 'Nombre',
                        prefixIcon: Icon(Icons.person_outline),
                      ),
                      validator: (value) =>
                          value == null || value.trim().isEmpty
                          ? 'Requerido'
                          : null,
                    ),
                    const SizedBox(height: 16),
                    TextFormField(
                      enabled: !state.isSaving,
                      controller: _lastNameController,
                      decoration: const InputDecoration(
                        labelText: 'Apellido',
                        prefixIcon: Icon(Icons.person_outline),
                      ),
                      validator: (value) =>
                          value == null || value.trim().isEmpty
                          ? 'Requerido'
                          : null,
                    ),
                    const SizedBox(height: 16),
                    TextFormField(
                      enabled: !state.isSaving,
                      controller: _jobTitleController,
                      decoration: const InputDecoration(
                        labelText: 'Cargo',
                        prefixIcon: Icon(Icons.work_outline),
                      ),
                    ),
                    const SizedBox(height: 16),
                    _lockedInfoTile(
                      Icons.school_outlined,
                      'Programa',
                      program.isNotEmpty ? program : 'No registrado',
                    ),
                    _lockedInfoTile(
                      Icons.location_city_outlined,
                      'Campus',
                      campus.isNotEmpty ? campus : 'No registrado',
                    ),
                  ] else ...[
                    _lockedInfoTile(
                      Icons.email_outlined,
                      'Correo electrónico',
                      email,
                    ),
                    _lockedInfoTile(
                      Icons.badge_outlined,
                      'Documento',
                      docNumber.isNotEmpty ? docNumber : 'No registrado',
                    ),
                    _lockedInfoTile(
                      Icons.perm_identity_outlined,
                      'ID institucional',
                      studentId.isNotEmpty ? studentId : 'No registrado',
                    ),
                    _lockedInfoTile(
                      Icons.cake_outlined,
                      'Fecha de nacimiento',
                      _formatDate(_birthDateController.text),
                    ),
                    _lockedInfoTile(
                      Icons.school_outlined,
                      'Programa',
                      _programController.text.trim().isNotEmpty
                          ? _programController.text.trim()
                          : 'No registrado',
                    ),
                    _lockedInfoTile(
                      Icons.location_city_outlined,
                      'Campus',
                      campus.isNotEmpty ? campus : 'No registrado',
                    ),
                    _lockedInfoTile(
                      Icons.numbers_outlined,
                      'Semestre',
                      _semesterController.text.trim().isNotEmpty
                          ? _semesterController.text.trim()
                          : 'No registrado',
                    ),
                    const SizedBox(height: 16),
                    TextFormField(
                      enabled: !state.isSaving,
                      controller: _phoneController,
                      decoration: const InputDecoration(
                        labelText: 'Teléfono',
                        prefixIcon: Icon(Icons.phone_outlined),
                      ),
                      keyboardType: TextInputType.phone,
                    ),
                    const SizedBox(height: 16),
                    TextFormField(
                      enabled: !state.isSaving,
                      controller: _epsController,
                      decoration: const InputDecoration(
                        labelText: 'EPS afiliado',
                        prefixIcon: Icon(Icons.local_hospital_outlined),
                      ),
                    ),
                    const SizedBox(height: 16),
                    TextFormField(
                      enabled: !state.isSaving,
                      controller: _emergencyNameController,
                      decoration: const InputDecoration(
                        labelText: 'Nombre contacto de emergencia',
                        prefixIcon: Icon(Icons.contact_emergency_outlined),
                      ),
                    ),
                    const SizedBox(height: 16),
                    TextFormField(
                      enabled: !state.isSaving,
                      controller: _emergencyPhoneController,
                      decoration: const InputDecoration(
                        labelText: 'Teléfono contacto de emergencia',
                        prefixIcon: Icon(Icons.phone_in_talk_outlined),
                      ),
                      keyboardType: TextInputType.phone,
                    ),
                  ],
                  const SizedBox(height: 24),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton(
                          onPressed: state.isSaving
                              ? null
                              : () => setState(() => _isEditing = false),
                          child: const Text('Cancelar'),
                        ),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: ElevatedButton(
                          onPressed: state.isSaving ? null : _saveProfile,
                          child: state.isSaving
                              ? const SizedBox(
                                  width: 20,
                                  height: 20,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                  ),
                                )
                              : const Text('Guardar'),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ] else ...[
            if (isAdmin) ...[
              _infoTile(Icons.email_outlined, 'Correo electrónico', email),
              _infoTile(
                Icons.work_outline,
                'Cargo',
                jobTitle.toString().isNotEmpty
                    ? jobTitle.toString()
                    : 'No registrado',
              ),
              _infoTile(
                Icons.school_outlined,
                'Programa',
                program.isNotEmpty ? program : 'No registrado',
              ),
              _infoTile(
                Icons.location_city_outlined,
                'Campus',
                campus.isNotEmpty ? campus : 'No registrado',
              ),
            ] else ...[
              _infoTile(
                Icons.badge_outlined,
                'Documento',
                docNumber.isNotEmpty ? docNumber : 'No registrado',
              ),
              _infoTile(
                Icons.perm_identity_outlined,
                'ID estudiantil',
                studentId.isNotEmpty ? studentId : 'No registrado',
              ),
              _infoTile(
                Icons.cake_outlined,
                'Fecha de nacimiento',
                _formatDate(birthDate),
              ),
              _infoTile(
                Icons.wc_outlined,
                'Sexo',
                sex == 'male'
                    ? 'Masculino'
                    : sex == 'female'
                    ? 'Femenino'
                    : sex,
              ),
              _infoTile(
                Icons.phone_outlined,
                'Teléfono',
                phone.isNotEmpty ? phone : 'No registrado',
              ),
              _infoTile(
                Icons.local_hospital_outlined,
                'EPS afiliado',
                eps.isNotEmpty ? eps : 'No registrado',
              ),
              _infoTile(
                Icons.contact_emergency_outlined,
                'Contacto de emergencia',
                emergencyName.isNotEmpty ? emergencyName : 'No registrado',
              ),
              _infoTile(
                Icons.phone_in_talk_outlined,
                'Teléfono contacto de emergencia',
                emergencyPhone.isNotEmpty ? emergencyPhone : 'No registrado',
              ),
              _infoTile(
                Icons.school_outlined,
                'Programa',
                program.isNotEmpty ? program : 'No registrado',
              ),
              _infoTile(
                Icons.location_city_outlined,
                'Campus',
                campus.isNotEmpty ? campus : 'No registrado',
              ),
              _infoTile(
                Icons.numbers_outlined,
                'Semestre',
                semester.isNotEmpty ? semester : 'No registrado',
              ),
            ],
            if (isNormalAdmin) ...[
              const SizedBox(height: 20),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Firma visual para certificados',
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      const SizedBox(height: 4),
                      const Text(
                        'PNG, JPG o WebP. Máximo 2 MiB, 8 megapíxeles y 4096 px por lado.',
                      ),
                      const SizedBox(height: 12),
                      if (_signatureLoading)
                        const LinearProgressIndicator()
                      else if (_signatureBytes != null)
                        Image.memory(
                          _signatureBytes!,
                          height: 72,
                          fit: BoxFit.contain,
                        ),
                      const SizedBox(height: 8),
                      OutlinedButton.icon(
                        onPressed: _signatureUploading
                            ? null
                            : _pickAndUploadSignature,
                        icon: _signatureUploading
                            ? const SizedBox(
                                width: 18,
                                height: 18,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                ),
                              )
                            : const Icon(Icons.upload_file_outlined),
                        label: Text(
                          _signatureBytes == null
                              ? 'Subir firma'
                              : 'Reemplazar firma',
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ],
        ],
      ),
    );
  }

  Widget _infoTile(IconData icon, String label, String value) {
    final colorScheme = Theme.of(context).colorScheme;

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: colorScheme.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: colorScheme.outlineVariant),
      ),
      child: Row(
        children: [
          Icon(icon, color: AppColors.primary, size: 22),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: TextStyle(
                    fontSize: 11,
                    color: colorScheme.onSurfaceVariant,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  value,
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w500,
                    color: colorScheme.onSurface,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _lockedInfoTile(IconData icon, String label, String value) {
    final colorScheme = Theme.of(context).colorScheme;

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: colorScheme.surfaceContainerHighest.withValues(alpha: 0.55),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: colorScheme.outlineVariant),
      ),
      child: Row(
        children: [
          Icon(icon, color: colorScheme.onSurfaceVariant, size: 22),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: TextStyle(
                    fontSize: 11,
                    color: colorScheme.onSurfaceVariant,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  value,
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w500,
                    color: colorScheme.onSurfaceVariant,
                  ),
                ),
              ],
            ),
          ),
          const Icon(Icons.lock_outline, size: 18, color: AppColors.textHint),
        ],
      ),
    );
  }
}
