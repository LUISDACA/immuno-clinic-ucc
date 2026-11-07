/// Admin feature data models.
///
/// Typed models for admin dashboard, student lists, and statistics.
library;

class AcademicOptions {
  final List<String> programs;
  final List<String> campuses;

  const AcademicOptions({required this.programs, required this.campuses});

  factory AcademicOptions.fromJson(Map<String, dynamic> json) =>
      AcademicOptions(
        programs: List<String>.unmodifiable(
          (json['programs'] as List<dynamic>).cast<String>(),
        ),
        campuses: List<String>.unmodifiable(
          (json['campuses'] as List<dynamic>).cast<String>(),
        ),
      );
}

class AdminStudentListItem {
  final String id;
  final String email;
  final bool isActive;
  final String? firstName;
  final String? lastName;
  final String? documentNumber;
  final String? studentId;
  final String? sex;
  final String? program;
  final String? campus;
  final int? semester;
  final String? vaccinationStatus;
  final int? approvedVaccines;
  final int? totalVaccines;

  const AdminStudentListItem({
    required this.id,
    required this.email,
    required this.isActive,
    this.firstName,
    this.lastName,
    this.documentNumber,
    this.studentId,
    this.sex,
    this.program,
    this.campus,
    this.semester,
    this.vaccinationStatus,
    this.approvedVaccines,
    this.totalVaccines,
  });

  factory AdminStudentListItem.fromJson(Map<String, dynamic> json) {
    final profile = json['profile'] as Map<String, dynamic>?;
    return AdminStudentListItem(
      id: json['id'] as String,
      email: json['email'] as String? ?? '',
      isActive: json['is_active'] as bool? ?? true,
      firstName: profile?['first_name'] as String?,
      lastName: profile?['last_name'] as String?,
      documentNumber: profile?['document_number'] as String?,
      studentId: profile?['student_id'] as String?,
      sex: profile?['sex'] as String?,
      program: profile?['program'] as String?,
      campus: profile?['campus'] as String?,
      semester: profile?['semester'] as int?,
      vaccinationStatus: json['vaccination_status'] as String?,
      approvedVaccines: json['approved_vaccines'] as int?,
      totalVaccines: json['total_vaccines'] as int?,
    );
  }

  String get displayName {
    if (firstName != null && lastName != null) {
      return '$firstName $lastName';
    }
    return email;
  }
}

class PaginatedResponse<T> {
  final List<T> items;
  final int total;
  final int page;
  final int pageSize;
  final int totalPages;
  final bool hasNext;
  final bool hasPrevious;

  const PaginatedResponse({
    required this.items,
    required this.total,
    required this.page,
    required this.pageSize,
    required this.totalPages,
    this.hasNext = false,
    this.hasPrevious = false,
  });

  factory PaginatedResponse.fromJson(
    Map<String, dynamic> json,
    T Function(Map<String, dynamic>) fromItem,
  ) {
    return PaginatedResponse(
      items: ((json['items'] as List<dynamic>?) ?? [])
          .map((item) => fromItem(item as Map<String, dynamic>))
          .toList(),
      total: json['total'] as int? ?? 0,
      page: json['page'] as int? ?? 1,
      pageSize: json['size'] as int? ?? json['page_size'] as int? ?? 20,
      totalPages: json['pages'] as int? ?? json['total_pages'] as int? ?? 1,
      hasNext:
          json['has_next'] as bool? ??
          ((json['pages'] as int? ?? json['total_pages'] as int? ?? 1) >
              (json['page'] as int? ?? 1)),
      hasPrevious:
          json['has_previous'] as bool? ?? ((json['page'] as int? ?? 1) > 1),
    );
  }
}

/// Statistics model matching the actual API response shape:
/// { total_students, active_students, inactive_students,
///   by_sex: {"M": n, "F": n},
///   vaccination_status: {"approved": n, "pending": n} }
class AdminStatistics {
  final int totalStudents;
  final int activeStudents;
  final int inactiveStudents;
  final int maleStudents;
  final int femaleStudents;
  final int approvedSchemes;
  final int pendingSchemes;
  final Map<String, int> byCampus;
  final Map<String, int> byProgram;
  final List<VaccineComplianceStats> vaccineCompliance;

  const AdminStatistics({
    required this.totalStudents,
    required this.activeStudents,
    required this.inactiveStudents,
    required this.maleStudents,
    required this.femaleStudents,
    required this.approvedSchemes,
    required this.pendingSchemes,
    this.byCampus = const {},
    this.byProgram = const {},
    this.vaccineCompliance = const [],
  });

  factory AdminStatistics.fromJson(Map<String, dynamic> json) {
    final bySex = Map<String, dynamic>.from(
      (json['by_sex'] as Map<String, dynamic>?) ?? {},
    );
    final vacStatus = Map<String, dynamic>.from(
      (json['vaccination_status'] as Map<String, dynamic>?) ?? {},
    );
    final byCampusRaw = (json['by_campus'] as Map<String, dynamic>?) ?? {};
    final byProgramRaw = (json['by_program'] as Map<String, dynamic>?) ?? {};
    final vaccineComplianceRaw =
        (json['vaccine_compliance'] as List<dynamic>?) ?? [];
    return AdminStatistics(
      totalStudents: json['total_students'] as int? ?? 0,
      activeStudents: json['active_students'] as int? ?? 0,
      inactiveStudents: json['inactive_students'] as int? ?? 0,
      maleStudents: (bySex['male'] ?? bySex['M'] ?? bySex['Male'] ?? 0) as int,
      femaleStudents:
          (bySex['female'] ?? bySex['F'] ?? bySex['Female'] ?? 0) as int,
      approvedSchemes: (vacStatus['approved'] ?? 0) as int,
      pendingSchemes: (vacStatus['pending'] ?? 0) as int,
      byCampus: byCampusRaw.map((k, v) => MapEntry(k, (v as num).toInt())),
      byProgram: byProgramRaw.map((k, v) => MapEntry(k, (v as num).toInt())),
      vaccineCompliance: vaccineComplianceRaw
          .map(
            (item) =>
                VaccineComplianceStats.fromJson(item as Map<String, dynamic>),
          )
          .toList(),
    );
  }
}

class VaccineComplianceStats {
  final String vaccineId;
  final String name;
  final String code;
  final int upToDate;
  final int pending;
  final int denied;
  final int inReview;
  final int total;

  const VaccineComplianceStats({
    required this.vaccineId,
    required this.name,
    required this.code,
    required this.upToDate,
    required this.pending,
    required this.denied,
    required this.inReview,
    required this.total,
  });

  factory VaccineComplianceStats.fromJson(Map<String, dynamic> json) {
    return VaccineComplianceStats(
      vaccineId: json['vaccine_id']?.toString() ?? '',
      name: json['name']?.toString() ?? 'Vacuna',
      code: json['code']?.toString() ?? '',
      upToDate: (json['up_to_date'] as num?)?.toInt() ?? 0,
      pending: (json['pending'] as num?)?.toInt() ?? 0,
      denied: (json['denied'] as num?)?.toInt() ?? 0,
      inReview: (json['in_review'] as num?)?.toInt() ?? 0,
      total: (json['total'] as num?)?.toInt() ?? 0,
    );
  }

  int get notUpToDate => pending + denied + inReview;
  double get complianceRatio => total == 0 ? 0 : upToDate / total;
}

class VaccineDoseConfigDTO {
  final String? id;
  final int doseNumber;
  final String label;
  final bool isRequired;
  final String appliesTo; // all | male | female
  final String doseType; // standard | booster | titer

  const VaccineDoseConfigDTO({
    this.id,
    required this.doseNumber,
    required this.label,
    this.isRequired = true,
    this.appliesTo = 'all',
    this.doseType = 'standard',
  });

  factory VaccineDoseConfigDTO.fromJson(Map<String, dynamic> json) {
    return VaccineDoseConfigDTO(
      id: json['id'] as String?,
      doseNumber: json['dose_number'] as int,
      label: json['label'] as String? ?? '',
      isRequired: json['is_required'] as bool? ?? true,
      appliesTo: json['applies_to'] as String? ?? 'all',
      doseType: json['dose_type'] as String? ?? 'standard',
    );
  }

  Map<String, dynamic> toJson() => {
    'dose_number': doseNumber,
    'label': label,
    'is_required': isRequired,
    'applies_to': appliesTo,
    'dose_type': doseType,
  };

  VaccineDoseConfigDTO copyWith({
    int? doseNumber,
    String? label,
    bool? isRequired,
    String? appliesTo,
    String? doseType,
  }) {
    return VaccineDoseConfigDTO(
      id: id,
      doseNumber: doseNumber ?? this.doseNumber,
      label: label ?? this.label,
      isRequired: isRequired ?? this.isRequired,
      appliesTo: appliesTo ?? this.appliesTo,
      doseType: doseType ?? this.doseType,
    );
  }
}

class VaccineCatalogItem {
  final String id;
  final String name;
  final String code;
  final int baseDoses;
  final bool hasBooster;
  final bool hasTiter;
  final bool hasTiterValue;
  final bool isAnnual;
  final String appliesTo;
  final bool isActive;
  final int displayOrder;
  final List<VaccineDoseConfigDTO> doseConfigs;

  const VaccineCatalogItem({
    required this.id,
    required this.name,
    required this.code,
    required this.baseDoses,
    required this.hasBooster,
    required this.hasTiter,
    required this.hasTiterValue,
    required this.isAnnual,
    required this.appliesTo,
    required this.isActive,
    required this.displayOrder,
    required this.doseConfigs,
  });

  factory VaccineCatalogItem.fromJson(Map<String, dynamic> json) {
    final raw = (json['dose_configs'] as List<dynamic>?) ?? [];
    return VaccineCatalogItem(
      id: json['id'] as String,
      name: json['name'] as String? ?? '',
      code: json['code'] as String? ?? '',
      baseDoses: json['base_doses'] as int? ?? 1,
      hasBooster: json['has_booster'] as bool? ?? false,
      hasTiter: json['has_titer'] as bool? ?? false,
      hasTiterValue: json['has_titer_value'] as bool? ?? false,
      isAnnual: json['is_annual'] as bool? ?? false,
      appliesTo: json['applies_to'] as String? ?? 'all',
      isActive: json['is_active'] as bool? ?? true,
      displayOrder: json['display_order'] as int? ?? 0,
      doseConfigs: raw
          .map(
            (item) =>
                VaccineDoseConfigDTO.fromJson(item as Map<String, dynamic>),
          )
          .toList(),
    );
  }
}
