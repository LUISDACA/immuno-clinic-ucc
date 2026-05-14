/// Vaccination scheme data models.
///
/// Typed models for the student vaccination scheme, replacing
/// `Map<String, dynamic>` and `List<dynamic>` throughout the student feature.
library;

class DoseConfigModel {
  final String? id;
  final String label;
  final bool isRequired;
  final String doseType;
  final int doseNumber;

  const DoseConfigModel({
    this.id,
    required this.label,
    required this.isRequired,
    required this.doseType,
    required this.doseNumber,
  });

  factory DoseConfigModel.fromJson(Map<String, dynamic> json) {
    return DoseConfigModel(
      id: json['id'] as String?,
      label: json['label'] as String? ?? '',
      isRequired: json['is_required'] as bool? ?? true,
      doseType: json['dose_type'] as String? ?? 'standard',
      doseNumber: json['dose_number'] as int? ?? 0,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'label': label,
      'is_required': isRequired,
      'dose_type': doseType,
      'dose_number': doseNumber,
    };
  }

  bool get isTiter => doseType == 'titer';
}

class DoseModel {
  final String id;
  final int doseNumber;
  final String status;
  final String? appliedDate;
  final String? dueDate;
  final int? daysUntilDue;
  final String? titerValue;
  final String? adminNotes;
  final String? reviewedBy;
  final String? reviewedAt;
  final DoseConfigModel? doseConfig;

  const DoseModel({
    required this.id,
    required this.doseNumber,
    required this.status,
    this.appliedDate,
    this.dueDate,
    this.daysUntilDue,
    this.titerValue,
    this.adminNotes,
    this.reviewedBy,
    this.reviewedAt,
    this.doseConfig,
  });

  factory DoseModel.fromJson(Map<String, dynamic> json) {
    return DoseModel(
      id: json['id'] as String,
      doseNumber: json['dose_number'] as int? ?? 0,
      status: json['status'] as String? ?? 'pending',
      appliedDate: json['applied_date'] as String?,
      dueDate: json['due_date'] as String?,
      daysUntilDue: json['days_until_due'] as int?,
      titerValue: json['titer_value'] as String?,
      adminNotes: json['admin_notes'] as String?,
      reviewedBy: json['reviewed_by'] as String?,
      reviewedAt: json['reviewed_at'] as String?,
      doseConfig: json['dose_config'] != null
          ? DoseConfigModel.fromJson(
              json['dose_config'] as Map<String, dynamic>,
            )
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'dose_number': doseNumber,
      'status': status,
      'applied_date': appliedDate,
      'due_date': dueDate,
      'days_until_due': daysUntilDue,
      'titer_value': titerValue,
      'admin_notes': adminNotes,
      'reviewed_by': reviewedBy,
      'reviewed_at': reviewedAt,
      'dose_config': doseConfig?.toJson(),
    };
  }

  DoseModel copyWith({
    String? status,
    String? appliedDate,
    String? dueDate,
    int? daysUntilDue,
    String? titerValue,
    String? adminNotes,
    String? reviewedBy,
    String? reviewedAt,
    bool clearAppliedDate = false,
    bool clearTiterValue = false,
  }) {
    return DoseModel(
      id: id,
      doseNumber: doseNumber,
      status: status ?? this.status,
      appliedDate: clearAppliedDate ? null : (appliedDate ?? this.appliedDate),
      dueDate: dueDate ?? this.dueDate,
      daysUntilDue: daysUntilDue ?? this.daysUntilDue,
      titerValue: clearTiterValue ? null : (titerValue ?? this.titerValue),
      adminNotes: adminNotes ?? this.adminNotes,
      reviewedBy: reviewedBy ?? this.reviewedBy,
      reviewedAt: reviewedAt ?? this.reviewedAt,
      doseConfig: doseConfig,
    );
  }

  bool get hasAppliedDate => appliedDate != null && appliedDate!.isNotEmpty;
}

class VaccineInfoModel {
  final String name;
  final String code;
  final bool hasTiter;
  final bool hasTiterValue;
  final bool isAnnual;

  const VaccineInfoModel({
    required this.name,
    required this.code,
    required this.hasTiter,
    required this.hasTiterValue,
    required this.isAnnual,
  });

  factory VaccineInfoModel.fromJson(Map<String, dynamic> json) {
    return VaccineInfoModel(
      name: json['name'] as String? ?? '',
      code: json['code'] as String? ?? '',
      hasTiter: json['has_titer'] as bool? ?? false,
      hasTiterValue: json['has_titer_value'] as bool? ?? false,
      isAnnual: json['is_annual'] as bool? ?? false,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'name': name,
      'code': code,
      'has_titer': hasTiter,
      'has_titer_value': hasTiterValue,
      'is_annual': isAnnual,
    };
  }
}

class StudentVaccineModel {
  final String id;
  final String status;
  final VaccineInfoModel? vaccine;
  final List<DoseModel> doses;

  const StudentVaccineModel({
    required this.id,
    required this.status,
    this.vaccine,
    required this.doses,
  });

  factory StudentVaccineModel.fromJson(Map<String, dynamic> json) {
    return StudentVaccineModel(
      id: json['id'] as String,
      status: json['status'] as String? ?? 'pending',
      vaccine: json['vaccine'] != null
          ? VaccineInfoModel.fromJson(json['vaccine'] as Map<String, dynamic>)
          : null,
      doses: ((json['doses'] as List<dynamic>?) ?? [])
          .map((d) => DoseModel.fromJson(d as Map<String, dynamic>))
          .toList(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'status': status,
      'vaccine': vaccine?.toJson(),
      'doses': doses.map((d) => d.toJson()).toList(),
    };
  }

  StudentVaccineModel copyWith({String? status, List<DoseModel>? doses}) {
    return StudentVaccineModel(
      id: id,
      status: status ?? this.status,
      vaccine: vaccine,
      doses: doses ?? this.doses,
    );
  }

  String get vaccineName => vaccine?.name ?? 'Vacuna';

  String get certificateStatus {
    final firstDose = firstRequiredStandardDose;
    if (firstDose != null && firstDose.status == 'denied') return 'denied';
    if (firstDose != null && firstDose.status == 'in_review') {
      return 'in_review';
    }
    if (firstDose == null || firstDose.status != 'approved') return 'pending';
    if (doses.any((dose) => (dose.daysUntilDue ?? 0) < 0)) return 'denied';
    return 'approved';
  }

  DoseModel? get firstRequiredStandardDose {
    final required = doses.where((dose) {
      final config = dose.doseConfig;
      return config != null && config.isRequired && !config.isTiter;
    }).toList();
    required.sort((a, b) => a.doseNumber.compareTo(b.doseNumber));
    return required.isEmpty ? null : required.first;
  }
}

class SchemeOverviewModel {
  final int totalVaccines;
  final int approvedVaccines;
  final int pendingVaccines;
  final int deniedVaccines;
  final int inReviewVaccines;
  final List<StudentVaccineModel> vaccines;

  const SchemeOverviewModel({
    required this.totalVaccines,
    required this.approvedVaccines,
    required this.pendingVaccines,
    required this.deniedVaccines,
    required this.inReviewVaccines,
    required this.vaccines,
  });

  factory SchemeOverviewModel.fromJson(Map<String, dynamic> json) {
    final vaccines = ((json['vaccines'] as List<dynamic>?) ?? [])
        .map((v) => StudentVaccineModel.fromJson(v as Map<String, dynamic>))
        .toList();
    final approved = vaccines
        .where((vaccine) => vaccine.certificateStatus == 'approved')
        .length;
    final denied = vaccines
        .where((vaccine) => vaccine.certificateStatus == 'denied')
        .length;
    final inReview = vaccines
        .where((vaccine) => vaccine.certificateStatus == 'in_review')
        .length;
    return SchemeOverviewModel(
      totalVaccines: json['total_vaccines'] as int? ?? vaccines.length,
      approvedVaccines: approved,
      pendingVaccines: vaccines.length - approved - denied - inReview,
      deniedVaccines: denied,
      inReviewVaccines: inReview,
      vaccines: vaccines,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'total_vaccines': totalVaccines,
      'approved_vaccines': approvedVaccines,
      'pending_vaccines': pendingVaccines,
      'denied_vaccines': deniedVaccines,
      'in_review_vaccines': inReviewVaccines,
      'vaccines': vaccines.map((v) => v.toJson()).toList(),
    };
  }

  double get completionPercentage {
    if (totalVaccines == 0) return 0;
    return approvedVaccines / totalVaccines;
  }

  SchemeOverviewModel recalculate() {
    return SchemeOverviewModel(
      totalVaccines: vaccines.length,
      approvedVaccines: vaccines
          .where((v) => v.certificateStatus == 'approved')
          .length,
      pendingVaccines: vaccines
          .where((v) => v.certificateStatus == 'pending')
          .length,
      deniedVaccines: vaccines
          .where((v) => v.certificateStatus == 'denied')
          .length,
      inReviewVaccines: vaccines
          .where((v) => v.certificateStatus == 'in_review')
          .length,
      vaccines: vaccines,
    );
  }
}
