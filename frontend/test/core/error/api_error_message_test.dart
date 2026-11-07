import 'package:flutter_test/flutter_test.dart';
import 'package:immuno_clinic_app/core/error/api_error_message.dart';

void main() {
  test(
    'prefers the canonical safe message while retaining legacy detail support',
    () {
      expect(
        apiErrorMessageFromData({
          'code': 'INVALID_REQUEST',
          'message': 'La solicitud no es válida.',
          'detail': 'legacy detail',
          'details': {
            'field_errors': [
              {
                'loc': ['body', 'field'],
                'type': 'missing',
              },
            ],
          },
        }),
        'La solicitud no es válida.',
      );
      expect(apiErrorMessageFromData({'detail': 'legacy only'}), 'legacy only');
    },
  );

  test('does not stringify optional structured data as a user message', () {
    expect(
      apiErrorMessageFromData({
        'code': 'INVALID_REQUEST',
        'details': {'field_errors': []},
      }),
      isNull,
    );
  });
}
