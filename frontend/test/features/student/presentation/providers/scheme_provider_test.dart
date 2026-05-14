import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:immuno_clinic_app/features/student/data/cache/scheme_cache.dart';
import 'package:immuno_clinic_app/features/student/data/datasources/scheme_remote_ds.dart';
import 'package:immuno_clinic_app/features/student/presentation/providers/scheme_provider.dart';

class MockSchemeRemoteDataSource extends Mock
    implements SchemeRemoteDataSource {}

void main() {
  late MockSchemeRemoteDataSource mockDataSource;
  late SharedPreferences prefs;

  const userId = 'student-1';

  final schemeJson = {
    'total_vaccines': 1,
    'approved_vaccines': 0,
    'pending_vaccines': 0,
    'denied_vaccines': 1,
    'in_review_vaccines': 0,
    'vaccines': [
      {
        'id': 'vaccine-1',
        'status': 'denied',
        'vaccine': {
          'name': 'Hepatitis B',
          'code': 'hep-b',
          'has_titer': false,
          'has_titer_value': false,
          'is_annual': false,
        },
        'doses': [
          {
            'id': 'dose-1',
            'dose_number': 1,
            'status': 'denied',
            'applied_date': null,
            'titer_value': null,
            'admin_notes': 'Fecha incorrecta',
            'reviewed_by': null,
            'reviewed_at': null,
            'dose_config': {
              'id': 'dose-config-1',
              'label': 'Primera dosis',
              'is_required': true,
              'dose_type': 'standard',
              'dose_number': 1,
            },
          },
        ],
      },
    ],
  };

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    prefs = await SharedPreferences.getInstance();
    mockDataSource = MockSchemeRemoteDataSource();
  });

  SchemeNotifier createNotifier({String? id = userId}) {
    return SchemeNotifier(mockDataSource, prefs, id);
  }

  DioException dioError({int? statusCode}) {
    return DioException(
      requestOptions: RequestOptions(path: '/scheme/'),
      response: statusCode == null
          ? null
          : Response(
              requestOptions: RequestOptions(path: '/scheme/'),
              statusCode: statusCode,
              data: {'detail': 'Error de prueba'},
            ),
    );
  }

  test('saves successful loads in a user-scoped cache key', () async {
    when(
      () => mockDataSource.getMyScheme(),
    ).thenAnswer((_) async => schemeJson);

    await createNotifier().loadScheme();

    final cacheKey = SchemeCache.keyForUser(userId);
    expect(cacheKey, isNotNull);
    expect(prefs.getString(cacheKey!), isNotNull);
    expect(prefs.getString(SchemeCache.legacyKey), isNull);
  });

  test('uses user-scoped cache when a network error occurs', () async {
    await prefs.setString(
      SchemeCache.keyForUser(userId)!,
      jsonEncode(schemeJson),
    );
    when(() => mockDataSource.getMyScheme()).thenThrow(dioError());

    final notifier = createNotifier();
    await notifier.loadScheme();

    expect(notifier.state.isOffline, true);
    expect(notifier.state.error, isNull);
    expect(notifier.state.overview?.totalVaccines, 1);
  });

  test('does not use offline cache for 401 or 403 responses', () async {
    await prefs.setString(
      SchemeCache.keyForUser(userId)!,
      jsonEncode(schemeJson),
    );

    for (final statusCode in [401, 403]) {
      when(
        () => mockDataSource.getMyScheme(),
      ).thenThrow(dioError(statusCode: statusCode));

      final notifier = createNotifier();
      await notifier.loadScheme(forceRefresh: true);

      expect(notifier.state.isOffline, false);
      expect(notifier.state.overview, isNull);
      expect(notifier.state.error, 'Error de prueba');
    }
  });

  test('does not read or write cache without a user id', () async {
    await prefs.setString(SchemeCache.legacyKey, jsonEncode(schemeJson));
    when(() => mockDataSource.getMyScheme()).thenThrow(dioError());

    final notifier = createNotifier(id: null);
    await notifier.loadScheme();

    expect(notifier.state.isOffline, false);
    expect(notifier.state.overview, isNull);
    expect(notifier.state.error, isNotNull);
    expect(prefs.getString(SchemeCache.legacyKey), isNull);
  });

  test(
    'does not write cache after a successful load without a user id',
    () async {
      when(
        () => mockDataSource.getMyScheme(),
      ).thenAnswer((_) async => schemeJson);

      final notifier = createNotifier(id: null);
      await notifier.loadScheme();

      expect(notifier.state.overview?.totalVaccines, 1);
      expect(
        prefs.getKeys().where((key) => key.startsWith('cached_student_scheme')),
        isEmpty,
      );
    },
  );

  test('updates user-scoped cache after a successful dose update', () async {
    // After the dose update the server returns the refreshed scheme with
    // the dose now in_review and an applied_date.
    final schemeJsonAfterUpdate = {
      'total_vaccines': 1,
      'approved_vaccines': 0,
      'pending_vaccines': 0,
      'denied_vaccines': 0,
      'in_review_vaccines': 1,
      'vaccines': [
        {
          'id': 'vaccine-1',
          'status': 'in_review',
          'vaccine': {
            'name': 'Hepatitis B',
            'code': 'hep-b',
            'has_titer': false,
            'has_titer_value': false,
            'is_annual': false,
          },
          'doses': [
            {
              'id': 'dose-1',
              'dose_number': 1,
              'status': 'in_review',
              'applied_date': '2026-05-01',
              'titer_value': null,
              'admin_notes': null,
              'reviewed_by': null,
              'reviewed_at': null,
              'dose_config': {
                'id': 'dose-config-1',
                'label': 'Primera dosis',
                'is_required': true,
                'dose_type': 'standard',
                'dose_number': 1,
              },
            },
          ],
        },
      ],
    };

    var getMySchemeCallCount = 0;
    when(() => mockDataSource.getMyScheme()).thenAnswer((_) async {
      getMySchemeCallCount++;
      return getMySchemeCallCount == 1 ? schemeJson : schemeJsonAfterUpdate;
    });
    when(
      () => mockDataSource.updateDose(
        'dose-1',
        appliedDate: '2026-05-01',
        clearAppliedDate: false,
        titerValue: null,
        clearTiterValue: false,
      ),
    ).thenAnswer((_) async {});

    final notifier = createNotifier();
    await notifier.loadScheme();
    final updated = await notifier.updateDose(
      'dose-1',
      appliedDate: '2026-05-01',
    );

    final cached =
        jsonDecode(prefs.getString(SchemeCache.keyForUser(userId)!)!)
            as Map<String, dynamic>;
    final vaccines = cached['vaccines'] as List<dynamic>;
    final vaccine = vaccines.single as Map<String, dynamic>;
    final doses = vaccine['doses'] as List<dynamic>;
    final dose = doses.single as Map<String, dynamic>;

    expect(updated, true);
    expect(cached['in_review_vaccines'], 1);
    expect(vaccine['status'], 'in_review');
    expect(dose['applied_date'], '2026-05-01');
    expect(dose['status'], 'in_review');
  });
}
