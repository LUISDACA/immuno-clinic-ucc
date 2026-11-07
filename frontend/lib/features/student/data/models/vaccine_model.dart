/// Vaccination scheme data models.
///
/// Typed models for the student vaccination scheme, replacing
/// `Map<String, dynamic>` and `List<dynamic>` throughout the student feature.
library;

import '../../../../core/models/domain_enums.dart';

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
  final DoseStatus status;
  final String? rawStatus;
  final String? appliedDate;
  final String? dueDate;
  final int? daysUntilDue;
  final bool? isOverdue;
  final bool? isDueToday;
  final String? titerValue;
  final String? adminNotes;
  final String? reviewedBy;
  final String? reviewedAt;
  final DoseConfigModel? doseConfig;

  const DoseModel({
    required this.id,
    required this.doseNumber,
    required this.status,
    this.rawStatus,
    this.appliedDate,
    this.dueDate,
    this.daysUntilDue,
    this.isOverdue,
    this.isDueToday,
    this.titerValue,
    this.adminNotes,
    this.reviewedBy,
    this.reviewedAt,
    this.doseConfig,
  });

  factory DoseModel.fromJson(Map<String, dynamic> json) {
    final rawStatus = json['status'] as String?;
    return DoseModel(
      id: json['id'] as String,
      doseNumber: json['dose_number'] as int? ?? 0,
      status: DoseStatus.fromWire(rawStatus),
      rawStatus: rawStatus,
      appliedDate: json['applied_date'] as String?,
      dueDate: json['due_date'] as String?,
      daysUntilDue: json['days_until_due'] as int?,
      isOverdue: json['is_overdue'] as bool?,
      isDueToday: json['is_due_today'] as bool?,
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
      'status': rawStatus ?? status.wireValue,
      'applied_date': appliedDate,
      'due_date': dueDate,
      'days_until_due': daysUntilDue,
      'is_overdue': isOverdue,
      'is_due_today': isDueToday,
      'titer_value': titerValue,
      'admin_notes': adminNotes,
      'reviewed_by': reviewedBy,
      'reviewed_at': reviewedAt,
      'dose_config': doseConfig?.toJson(),
    };
  }

  DoseModel copyWith({
    DoseStatus? status,
    String? appliedDate,
    String? dueDate,
    int? daysUntilDue,
    bool? isOverdue,
    bool? isDueToday,
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
      rawStatus: status == null ? rawStatus : status.wireValue,
      appliedDate: clearAppliedDate ? null : (appliedDate ?? this.appliedDate),
      dueDate: dueDate ?? this.dueDate,
      daysUntilDue: daysUntilDue ?? this.daysUntilDue,
      isOverdue: isOverdue ?? this.isOverdue,
      isDueToday: isDueToday ?? this.isDueToday,
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
  final VaccineStatus status;
  final String? rawStatus;
  final VaccineInfoModel? vaccine;
  final List<DoseModel> doses;

  const StudentVaccineModel({
    required this.id,
    required this.status,
    this.rawStatus,
    this.vaccine,
    required this.doses,
  });

  factory StudentVaccineModel.fromJson(Map<String, dynamic> json) {
    final rawStatus = json['status'] as String?;
    return StudentVaccineModel(
      id: json['id'] as String,
      status: VaccineStatus.fromWire(rawStatus),
      rawStatus: rawStatus,
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
      'status': rawStatus ?? status.wireValue,
      'vaccine': vaccine?.toJson(),
      'doses': doses.map((d) => d.toJson()).toList(),
    };
  }

  StudentVaccineModel copyWith({
    VaccineStatus? status,
    List<DoseModel>? doses,
  }) {
    return StudentVaccineModel(
      id: id,
      status: status ?? this.status,
      rawStatus: status == null ? rawStatus : status.wireValue,
      vaccine: vaccine,
      doses: doses ?? this.doses,
    );
  }

  String get vaccineName => vaccine?.name ?? 'Vacuna';
}

class SchemeOverviewModel {
  final int totalVaccines;
  final int approvedVaccines;
  final int pendingVaccines;
  final int deniedVaccines;
  final int inReviewVaccines;
  final bool isUpToDate;
  final bool isComplete;
  final bool isCertifiable;
  final String? evaluatedOn;
  final int schemeVersion;
  final List<StudentVaccineModel> vaccines;

  const SchemeOverviewModel({
    required this.totalVaccines,
    required this.approvedVaccines,
    required this.pendingVaccines,
    required this.deniedVaccines,
    required this.inReviewVaccines,
    required this.vaccines,
    this.isUpToDate = false,
    this.isComplete = false,
    this.isCertifiable = false,
    this.evaluatedOn,
    this.schemeVersion = 0,
  });

  factory SchemeOverviewModel.fromJson(Map<String, dynamic> json) {
    final vaccines = ((json['vaccines'] as List<dynamic>?) ?? [])
        .map((v) => StudentVaccineModel.fromJson(v as Map<String, dynamic>))
        .toList();
    return SchemeOverviewModel(
      totalVaccines: json['total_vaccines'] as int? ?? vaccines.length,
      approvedVaccines: json['approved_vaccines'] as int? ?? 0,
      pendingVaccines: json['pending_vaccines'] as int? ?? 0,
      deniedVaccines: json['denied_vaccines'] as int? ?? 0,
      inReviewVaccines: json['in_review_vaccines'] as int? ?? 0,
      vaccines: vaccines,
      isUpToDate: json['is_up_to_date'] as bool? ?? false,
      isComplete: json['is_complete'] as bool? ?? false,
      isCertifiable: json['is_certifiable'] as bool? ?? false,
      evaluatedOn: json['evaluated_on'] as String?,
      schemeVersion: json['scheme_version'] as int? ?? 0,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'total_vaccines': totalVaccines,
      'approved_vaccines': approvedVaccines,
      'pending_vaccines': pendingVaccines,
      'denied_vaccines': deniedVaccines,
      'in_review_vaccines': inReviewVaccines,
      'is_up_to_date': isUpToDate,
      'is_complete': isComplete,
      'is_certifiable': isCertifiable,
      'evaluated_on': evaluatedOn,
      'scheme_version': schemeVersion,
      'vaccines': vaccines.map((v) => v.toJson()).toList(),
    };
  }
}
