import '../../../../core/models/domain_enums.dart';

class EvidenceFileModel {
  final String id;
  final String originalFilename;
  final int fileSize;
  final String mimeType;
  final String uploadedAt;

  const EvidenceFileModel({
    required this.id,
    required this.originalFilename,
    required this.fileSize,
    required this.mimeType,
    required this.uploadedAt,
  });

  factory EvidenceFileModel.fromJson(Map<String, dynamic> json) {
    return EvidenceFileModel(
      id: json['id']?.toString() ?? '',
      originalFilename:
          json['original_filename']?.toString() ?? 'documento.pdf',
      fileSize: (json['file_size'] as num?)?.toInt() ?? 0,
      mimeType: json['mime_type']?.toString() ?? 'application/pdf',
      uploadedAt: json['uploaded_at']?.toString() ?? '',
    );
  }
}

class EvidenceBatchModel {
  final String id;
  final EvidenceBatchStatus status;
  final String? rawStatus;
  final String? notes;
  final String? doseId;
  final String createdAt;
  final List<EvidenceFileModel> files;

  const EvidenceBatchModel({
    required this.id,
    required this.status,
    this.rawStatus,
    required this.createdAt,
    this.notes,
    this.doseId,
    this.files = const [],
  });

  factory EvidenceBatchModel.fromJson(Map<String, dynamic> json) {
    final rawStatus = json['status']?.toString();
    return EvidenceBatchModel(
      id: json['id']?.toString() ?? '',
      status: EvidenceBatchStatus.fromWire(rawStatus),
      rawStatus: rawStatus,
      notes: json['notes']?.toString(),
      doseId: json['dose_id']?.toString(),
      createdAt: json['created_at']?.toString() ?? '',
      files: ((json['files'] as List<dynamic>?) ?? const [])
          .map(
            (file) => EvidenceFileModel.fromJson(file as Map<String, dynamic>),
          )
          .toList(),
    );
  }
}

class EvidencePageModel {
  final List<EvidenceBatchModel> items;
  final int page;
  final int size;
  final int total;
  final int pages;
  final bool hasNext;
  final bool hasPrevious;

  const EvidencePageModel({
    required this.items,
    required this.page,
    required this.size,
    required this.total,
    required this.pages,
    required this.hasNext,
    required this.hasPrevious,
  });

  factory EvidencePageModel.fromJson(Map<String, dynamic> json) {
    final items = ((json['items'] as List<dynamic>?) ?? const [])
        .map(
          (item) => EvidenceBatchModel.fromJson(item as Map<String, dynamic>),
        )
        .toList();
    final page = json['page'] as int? ?? 1;
    final size = json['size'] as int? ?? json['page_size'] as int? ?? 20;
    final total = json['total'] as int? ?? items.length;
    final pages = json['pages'] as int? ?? json['total_pages'] as int? ?? 1;
    return EvidencePageModel(
      items: items,
      page: page,
      size: size,
      total: total,
      pages: pages,
      hasNext: json['has_next'] as bool? ?? page < pages,
      hasPrevious: json['has_previous'] as bool? ?? page > 1,
    );
  }
}
