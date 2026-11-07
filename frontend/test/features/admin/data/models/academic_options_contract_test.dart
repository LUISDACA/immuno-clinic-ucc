import 'package:flutter_test/flutter_test.dart';
import 'package:immuno_clinic_app/features/admin/data/models/admin_models.dart';

void main() {
  test('parses the canonical programs and campuses response', () {
    final options = AcademicOptions.fromJson({
      'programs': ['Medicina', 'Enfermería'],
      'campuses': ['Bogotá', 'Cali'],
    });

    expect(options.programs, ['Medicina', 'Enfermería']);
    expect(options.campuses, ['Bogotá', 'Cali']);
  });

  test('does not expose mutable option lists', () {
    final options = AcademicOptions.fromJson({
      'programs': ['Medicina'],
      'campuses': ['Bogotá'],
    });

    expect(() => options.programs.add('arbitrary'), throwsUnsupportedError);
    expect(() => options.campuses.add('arbitrary'), throwsUnsupportedError);
  });
}
