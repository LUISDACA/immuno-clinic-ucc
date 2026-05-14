import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

import 'package:immuno_clinic_app/features/admin/data/datasources/admin_remote_ds.dart';
import 'package:immuno_clinic_app/features/admin/data/models/admin_models.dart';
import 'package:immuno_clinic_app/features/admin/presentation/providers/admin_provider.dart';

class MockAdminRemoteDataSource extends Mock implements AdminRemoteDataSource {}

void main() {
  late MockAdminRemoteDataSource mockDataSource;
  late AdminStudentListNotifier notifier;

  setUp(() {
    mockDataSource = MockAdminRemoteDataSource();
    notifier = AdminStudentListNotifier(mockDataSource);
  });

  group('AdminStudentListNotifier', () {
    final mockStudent = AdminStudentListItem(
      id: '1',
      firstName: 'Test',
      lastName: 'Student',
      email: 'test@example.com',
      program: 'Medicina',
      campus: 'Santa Marta',
      isActive: true,
      vaccinationStatus: 'pending',
      semester: 1,
    );

    final mockResponse = PaginatedResponse<AdminStudentListItem>(
      items: [mockStudent],
      total: 1,
      page: 1,
      pageSize: 20,
      totalPages: 1,
    );

    test('initial state is correct', () {
      expect(notifier.state.isLoading, false);
      expect(notifier.state.students.isEmpty, true);
    });

    test('load fetches students successfully', () async {
      when(() => mockDataSource.listStudents(
            page: 1,
            search: any(named: 'search'),
            isActive: any(named: 'isActive'),
            semester: any(named: 'semester'),
            vaccinationStatus: any(named: 'vaccinationStatus'),
          )).thenAnswer((_) async => mockResponse);

      final loadFuture = notifier.load(page: 1);
      
      expect(notifier.state.isLoading, true);
      
      await loadFuture;

      expect(notifier.state.isLoading, false);
      expect(notifier.state.students.length, 1);
      expect(notifier.state.students.first.id, '1');
      expect(notifier.state.total, 1);
      expect(notifier.state.page, 1);
      
      verify(() => mockDataSource.listStudents(page: 1)).called(1);
    });

    test('load handles error gracefully', () async {
      final dioError = DioException(
        requestOptions: RequestOptions(path: '/admin/students'),
        response: Response(
          requestOptions: RequestOptions(path: '/admin/students'),
          data: {'detail': 'Error loading students'},
          statusCode: 500,
        ),
      );

      when(() => mockDataSource.listStudents(
            page: 1,
            search: any(named: 'search'),
            isActive: any(named: 'isActive'),
            semester: any(named: 'semester'),
            vaccinationStatus: any(named: 'vaccinationStatus'),
          )).thenThrow(dioError);

      await notifier.load(page: 1);

      expect(notifier.state.isLoading, false);
      expect(notifier.state.error, 'Error loading students');
      expect(notifier.state.students.isEmpty, true);
    });

    test('deactivate successfully calls ds and reloads', () async {
      when(() => mockDataSource.deactivateStudent('1'))
          .thenAnswer((_) async => {});
          
      when(() => mockDataSource.listStudents(
            page: 1,
            search: any(named: 'search'),
            isActive: any(named: 'isActive'),
            semester: any(named: 'semester'),
            vaccinationStatus: any(named: 'vaccinationStatus'),
          )).thenAnswer((_) async => mockResponse);

      final result = await notifier.deactivate('1');

      expect(result, true);
      verify(() => mockDataSource.deactivateStudent('1')).called(1);
      // Verify reload is called (2 times total in a real flow, 1 here since state.page is 1)
      verify(() => mockDataSource.listStudents(page: 1)).called(1);
    });
  });
}
