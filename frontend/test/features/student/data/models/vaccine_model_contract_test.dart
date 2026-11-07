import 'package:flutter_test/flutter_test.dart';
import 'package:immuno_clinic_app/core/models/domain_enums.dart';
import 'package:immuno_clinic_app/features/student/data/models/vaccine_model.dart';
import 'package:immuno_clinic_app/features/student/data/models/evidence_model.dart';

void main() {
  test(
    'parses backend dose and vaccine status enums and serializes wire values',
    () {
      final dose = DoseModel.fromJson({
        'id': 'dose-1',
        'status': 'in_review',
        'applied_date': '2026-04-28',
        'is_overdue': true,
        'is_due_today': false,
      });
      final vaccine = StudentVaccineModel.fromJson({
        'id': 'assignment-1',
        'status': 'approved',
        'doses': [],
      });

      expect(dose.status, DoseStatus.inReview);
      expect(dose.toJson()['status'], 'in_review');
      expect(dose.appliedDate, '2026-04-28');
      expect(dose.toJson()['applied_date'], '2026-04-28');
      expect(dose.isOverdue, isTrue);
      expect(dose.isDueToday, isFalse);
      expect(dose.toJson()['is_overdue'], isTrue);
      expect(vaccine.status, VaccineStatus.approved);
      expect(vaccine.toJson()['status'], 'approved');
    },
  );

  test('retains unrecognized wire values without interpreting them', () {
    final dose = DoseModel.fromJson({'id': 'dose-1', 'status': 'future_state'});
    final vaccine = StudentVaccineModel.fromJson({
      'id': 'assignment-1',
      'status': 'future_state',
      'doses': [],
    });

    expect(dose.status, DoseStatus.unknown);
    expect(dose.toJson()['status'], 'future_state');
    expect(vaccine.status, VaccineStatus.unknown);
    expect(vaccine.toJson()['status'], 'future_state');
  });

  test(
    'parses canonical evidence statuses without assigning review outcomes',
    () {
      final page = EvidencePageModel.fromJson({
        'items': [
          {
            'id': 'batch-1',
            'status': 'uploaded',
            'dose_id': 'dose-1',
            'created_at': '2026-01-01T00:00:00Z',
          },
          {
            'id': 'batch-2',
            'status': 'reviewed',
            'created_at': '2026-01-02T00:00:00Z',
          },
        ],
        'page': 1,
        'size': 20,
        'total': 2,
        'pages': 1,
        'has_next': false,
        'has_previous': false,
        'page_size': 20,
        'total_pages': 1,
      });

      expect(page.items[0].status, EvidenceBatchStatus.uploaded);
      expect(page.items[0].doseId, 'dose-1');
      expect(page.items[1].status, EvidenceBatchStatus.reviewed);
      expect(page.total, 2);
      expect(page.hasNext, isFalse);
    },
  );
}
