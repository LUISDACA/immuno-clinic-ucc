/// Wire enums whose values are defined by FastAPI's shared domain enums.
enum DoseStatus {
  inReview('in_review'),
  approved('approved'),
  denied('denied'),
  unknown('');

  const DoseStatus(this.wireValue);
  final String wireValue;

  static DoseStatus fromWire(String? value) => value == 'pending'
      ? DoseStatus.inReview
      : DoseStatus.values.firstWhere(
          (status) => status != DoseStatus.unknown && status.wireValue == value,
          orElse: () => DoseStatus.unknown,
        );
}

enum VaccineStatus {
  inReview('in_review'),
  approved('approved'),
  denied('denied'),
  unknown('');

  const VaccineStatus(this.wireValue);
  final String wireValue;

  static VaccineStatus fromWire(String? value) => value == 'pending'
      ? VaccineStatus.inReview
      : VaccineStatus.values.firstWhere(
          (status) =>
              status != VaccineStatus.unknown && status.wireValue == value,
          orElse: () => VaccineStatus.unknown,
        );
}

/// Includes FastAPI's states and previously declared client aliases. Alias
/// values are retained as raw wire data and carry no inferred review meaning.
enum EvidenceBatchStatus {
  inReview('in_review'),
  approved('approved'),
  denied('denied'),
  uploaded('uploaded'),
  underReview('under_review'),
  reviewed('reviewed'),
  legacyPending('pending'),
  unknown('');

  const EvidenceBatchStatus(this.wireValue);
  final String wireValue;

  static EvidenceBatchStatus fromWire(String? value) =>
      EvidenceBatchStatus.values.firstWhere(
        (status) =>
            status != EvidenceBatchStatus.unknown && status.wireValue == value,
        orElse: () => EvidenceBatchStatus.unknown,
      );
}
