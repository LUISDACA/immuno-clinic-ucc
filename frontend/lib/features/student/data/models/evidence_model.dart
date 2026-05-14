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
  final String status;
  final String? notes;
  final String createdAt;
  final List<EvidenceFileModel> files;

  const EvidenceBatchModel({
    required this.id,
    required this.status,
    required this.createdAt,
    this.notes,
    this.files = const [],
  });

  factory EvidenceBatchModel.fromJson(Map<String, dynamic> json) {
    return EvidenceBatchModel(
      id: json['id']?.toString() ?? '',
      status: json['status']?.toString() ?? 'uploaded',
      notes: json['notes']?.toString(),
      createdAt: json['created_at']?.toString() ?? '',
      files: ((json['files'] as List<dynamic>?) ?? const [])
          .map(
            (file) => EvidenceFileModel.fromJson(file as Map<String, dynamic>),
          )
          .toList(),
    );
  }
}
