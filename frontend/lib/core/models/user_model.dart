/// Core data models shared across features.
///
/// These replace the untyped `Map<String, dynamic>` usage throughout
/// the app, providing compile-time type safety and IDE autocomplete.
library;

class UserModel {
  final String id;
  final String email;
  final String role;
  final bool isActive;
  final bool mustChangePassword;
  final ProfileModel? profile;

  const UserModel({
    required this.id,
    required this.email,
    required this.role,
    required this.isActive,
    required this.mustChangePassword,
    this.profile,
  });

  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
      id: json['id'] as String,
      email: json['email'] as String,
      role: json['role'] as String,
      isActive: json['is_active'] as bool? ?? true,
      mustChangePassword: json['must_change_password'] as bool? ?? false,
      profile: json['profile'] != null
          ? ProfileModel.fromJson(json['profile'] as Map<String, dynamic>)
          : null,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'email': email,
    'role': role,
    'is_active': isActive,
    if (profile != null) 'profile': profile!.toJson(),
  };

  String get displayName {
    if (profile != null) {
      return '${profile!.firstName} ${profile!.lastName}';
    }
    return email;
  }
}

class AuthTokens {
  final String accessToken;
  final String refreshToken;
  final bool mustChangePassword;

  const AuthTokens({
    required this.accessToken,
    required this.refreshToken,
    required this.mustChangePassword,
  });

  factory AuthTokens.fromJson(Map<String, dynamic> json) {
    return AuthTokens(
      accessToken: json['access_token'] as String,
      refreshToken: json['refresh_token'] as String,
      mustChangePassword: json['must_change_password'] as bool? ?? false,
    );
  }
}

class ProfileModel {
  final String? id;
  final String firstName;
  final String lastName;
  final String? jobTitle;
  final String? documentNumber;
  final String? studentId;
  final String? birthDate;
  final String sex;
  final String? phone;
  final String? epsAffiliation;
  final String? emergencyContactName;
  final String? emergencyContactPhone;
  final String? program;
  final String? campus;
  final int? semester;

  const ProfileModel({
    this.id,
    required this.firstName,
    required this.lastName,
    this.jobTitle,
    this.documentNumber,
    this.studentId,
    this.birthDate,
    required this.sex,
    this.phone,
    this.epsAffiliation,
    this.emergencyContactName,
    this.emergencyContactPhone,
    this.program,
    this.campus,
    this.semester,
  });

  factory ProfileModel.fromJson(Map<String, dynamic> json) {
    return ProfileModel(
      id: json['id'] as String?,
      firstName: json['first_name'] as String? ?? '',
      lastName: json['last_name'] as String? ?? '',
      jobTitle: json['job_title'] as String?,
      documentNumber: json['document_number'] as String?,
      studentId: json['student_id'] as String?,
      birthDate: json['birth_date'] as String?,
      sex: json['sex'] as String? ?? 'male',
      phone: json['phone'] as String?,
      epsAffiliation: json['eps_affiliation'] as String?,
      emergencyContactName: json['emergency_contact_name'] as String?,
      emergencyContactPhone: json['emergency_contact_phone'] as String?,
      program: json['program'] as String?,
      campus: json['campus'] as String?,
      semester: json['semester'] as int?,
    );
  }

  Map<String, dynamic> toJson() => {
    if (id != null) 'id': id,
    'first_name': firstName,
    'last_name': lastName,
    'job_title': jobTitle,
    'document_number': documentNumber,
    'student_id': studentId,
    'birth_date': birthDate,
    'sex': sex,
    'phone': phone,
    'eps_affiliation': epsAffiliation,
    'emergency_contact_name': emergencyContactName,
    'emergency_contact_phone': emergencyContactPhone,
    'program': program,
    'campus': campus,
    'semester': semester,
  };
}
