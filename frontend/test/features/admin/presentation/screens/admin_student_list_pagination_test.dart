import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

import 'package:immuno_clinic_app/features/admin/data/datasources/admin_remote_ds.dart';
import 'package:immuno_clinic_app/features/admin/data/models/admin_models.dart';
import 'package:immuno_clinic_app/features/admin/presentation/providers/admin_provider.dart';
import 'package:immuno_clinic_app/features/admin/presentation/screens/admin_student_list_screen.dart';

class _MockAdminRemoteDataSource extends Mock
    implements AdminRemoteDataSource {}

void main() {
  testWidgets('refresh is accessible and retains page and active filters', (
    tester,
  ) async {
    final dataSource = _MockAdminRemoteDataSource();
    final student = AdminStudentListItem(
      id: 'student-1',
      email: 'student@example.test',
      firstName: 'Synthetic',
      lastName: 'Student',
      isActive: false,
      semester: 3,
      vaccinationStatus: 'pending',
    );

    when(
      () => dataSource.listStudents(
        page: any(named: 'page'),
        pageSize: 20,
        search: any(named: 'search'),
        isActive: any(named: 'isActive'),
        semester: any(named: 'semester'),
        vaccinationStatus: any(named: 'vaccinationStatus'),
      ),
    ).thenAnswer((invocation) async {
      final page = invocation.namedArguments[#page] as int;
      return PaginatedResponse(
        items: [student],
        total: 40,
        page: page,
        pageSize: 20,
        totalPages: 2,
      );
    });

    final notifier = AdminStudentListNotifier(dataSource);
    await tester.pumpWidget(
      ProviderScope(
        overrides: [adminStudentListProvider.overrideWith((ref) => notifier)],
        child: const MaterialApp(
          home: AdminStudentListScreen(
            initialActiveFilter: false,
            initialVaccinationStatus: 'pending',
            initialSemester: 3,
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Página 1 de 2'), findsOneWidget);
    expect(find.byTooltip('Actualizar lista'), findsOneWidget);
    expect(find.byTooltip('Página anterior'), findsOneWidget);
    expect(find.byTooltip('Página siguiente'), findsOneWidget);
    await tester.tap(find.byIcon(Icons.chevron_right));
    await tester.pumpAndSettle();
    expect(find.text('Página 2 de 2'), findsOneWidget);

    await tester.tap(find.byTooltip('Actualizar lista'));
    await tester.pumpAndSettle();

    expect(find.text('Página 2 de 2'), findsOneWidget);
    verify(
      () => dataSource.listStudents(
        page: 2,
        pageSize: 20,
        search: null,
        isActive: false,
        semester: 3,
        vaccinationStatus: 'pending',
      ),
    ).called(2);
  });

  testWidgets('student list and expanded row fit a narrow 320x568 viewport', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(320, 568);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final dataSource = _MockAdminRemoteDataSource();
    final student = AdminStudentListItem(
      id: 'synthetic-student',
      email:
          'student-with-a-deliberately-long-synthetic-address-for-mobile-layout@example.test',
      firstName:
          'Nombre sintético de prueba para verificar el reflujo en móviles',
      lastName: 'Apellido extendido de prueba',
      isActive: true,
      semester: 3,
      program: 'Programa sintético',
      campus: 'Campus de prueba',
      vaccinationStatus: 'pending',
    );
    when(
      () => dataSource.listStudents(
        page: any(named: 'page'),
        pageSize: 20,
        search: any(named: 'search'),
        isActive: any(named: 'isActive'),
        semester: any(named: 'semester'),
        vaccinationStatus: any(named: 'vaccinationStatus'),
      ),
    ).thenAnswer((invocation) async {
      final page = invocation.namedArguments[#page] as int;
      return PaginatedResponse(
        items: [student],
        total: 21,
        page: page,
        pageSize: 20,
        totalPages: 2,
      );
    });

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          adminStudentListProvider.overrideWith(
            (ref) => AdminStudentListNotifier(dataSource),
          ),
        ],
        child: const MaterialApp(home: AdminStudentListScreen()),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('21 resultados'), findsOneWidget);
    expect(find.text('Página 1 de 2'), findsOneWidget);
    expect(tester.takeException(), isNull, reason: 'list and filter layout');

    await tester.tap(find.byType(ExpansionTile));
    await tester.pumpAndSettle();
    final email = find.text(
      'student-with-a-deliberately-long-synthetic-address-for-mobile-layout@example.test',
    );
    final name = find.text(
      'Nombre sintético de prueba para verificar el reflujo en móviles Apellido extendido de prueba',
    );
    await tester.ensureVisible(email);
    await tester.pumpAndSettle();
    expect(tester.getSize(email).height, greaterThan(12));
    expect(tester.getSize(name).height, greaterThan(18));
    expect(tester.takeException(), isNull, reason: 'expanded student row');
  });
}
