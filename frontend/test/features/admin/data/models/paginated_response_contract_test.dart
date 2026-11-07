import 'package:flutter_test/flutter_test.dart';
import 'package:immuno_clinic_app/features/admin/data/models/admin_models.dart';

void main() {
  test(
    'reads canonical page metadata and retains the existing model aliases',
    () {
      final response = PaginatedResponse<String>.fromJson({
        'items': [],
        'page': 2,
        'size': 10,
        'total': 21,
        'pages': 3,
        'has_next': true,
        'has_previous': true,
        'page_size': 10,
        'total_pages': 3,
      }, (_) => 'unused');

      expect(response.page, 2);
      expect(response.pageSize, 10);
      expect(response.totalPages, 3);
      expect(response.hasNext, isTrue);
      expect(response.hasPrevious, isTrue);
    },
  );

  test('continues to parse the legacy page_size and total_pages fields', () {
    final response = PaginatedResponse<String>.fromJson({
      'items': [],
      'page': 1,
      'page_size': 20,
      'total': 0,
      'total_pages': 0,
    }, (_) => 'unused');

    expect(response.pageSize, 20);
    expect(response.totalPages, 0);
    expect(response.hasNext, isFalse);
    expect(response.hasPrevious, isFalse);
  });
}
