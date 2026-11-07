import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

import 'package:immuno_clinic_app/features/auth/presentation/providers/auth_provider.dart';
import 'package:immuno_clinic_app/features/admin/data/datasources/admin_remote_ds.dart';
import 'package:immuno_clinic_app/features/admin/presentation/screens/admin_student_detail_screen.dart';

class _MockAdminRemoteDataSource extends Mock
    implements AdminRemoteDataSource {}

class _FakeAuthNotifier extends StateNotifier<AuthState>
    implements AuthNotifier {
  _FakeAuthNotifier()
    : super(
        const AuthState(
          isAuthenticated: true,
          role: 'admin',
          userId: 'admin-1',
        ),
      );

  @override
  Future<void> checkSession() async {}

  @override
  void cancelPendingSessionRestore() {}

  @override
  Future<void> login(String email, String password) async {}

  @override
  Future<void> logout() async {}

  @override
  void markPasswordChanged() {}
}

void main() {
  testWidgets('initial load failure is distinct from empty and can retry', (
    tester,
  ) async {
    final dataSource = _MockAdminRemoteDataSource();
    var profileAttempts = 0;

    when(() => dataSource.getStudentDetail('student-1')).thenAnswer((_) async {
      if (profileAttempts++ == 0) {
        throw StateError('sensitive response details');
      }
      return {
        'email': 'student@example.test',
        'profile': {'first_name': 'Ada', 'last_name': 'Example'},
      };
    });
    when(
      () => dataSource.getStudentScheme('student-1'),
    ).thenAnswer((_) async => <dynamic>[]);
    when(
      () => dataSource.getStudentEvidencePage('student-1', page: 1),
    ).thenAnswer(
      (_) async => {
        'items': <dynamic>[],
        'page': 1,
        'page_size': 20,
        'total': 0,
        'total_pages': 0,
        'has_next': false,
        'has_previous': false,
      },
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          adminRemoteDataSourceProvider.overrideWithValue(dataSource),
          authStateProvider.overrideWith((ref) => _FakeAuthNotifier()),
        ],
        child: const MaterialApp(
          home: AdminStudentDetailScreen(studentId: 'student-1'),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(
      find.text('No se pudo cargar la información del estudiante.'),
      findsOneWidget,
    );
    expect(find.text('Sin perfil'), findsNothing);
    expect(find.text('Sin evidencia subida'), findsNothing);
    expect(find.textContaining('sensitive response details'), findsNothing);
    expect(find.text('Reintentar'), findsOneWidget);

    await tester.tap(find.text('Reintentar'));
    await tester.pumpAndSettle();

    expect(
      find.text('No se pudo cargar la información del estudiante.'),
      findsNothing,
    );
    expect(find.text('student@example.test'), findsOneWidget);
    verify(() => dataSource.getStudentDetail('student-1')).called(2);
    verify(() => dataSource.getStudentScheme('student-1')).called(2);
    verify(
      () => dataSource.getStudentEvidencePage('student-1', page: 1),
    ).called(2);
  });

  testWidgets('failed reload removes previously loaded student data', (
    tester,
  ) async {
    final dataSource = _MockAdminRemoteDataSource();
    var detailAttempts = 0;
    when(() => dataSource.getStudentDetail('student-1')).thenAnswer((_) async {
      if (detailAttempts++ > 0) {
        throw StateError('stale private student response');
      }
      return {
        'email': 'student@example.test',
        'profile': {'first_name': 'Ada', 'last_name': 'Example'},
      };
    });
    when(() => dataSource.getStudentScheme('student-1')).thenAnswer(
      (_) async => [
        {
          'vaccine': {'name': 'Vacuna ejemplo'},
          'status': 'pending',
          'doses': [
            {
              'id': 'dose-1',
              'status': 'pending',
              'dose_number': 1,
              'dose_config': {'label': 'Dosis 1'},
            },
          ],
        },
      ],
    );
    when(
      () => dataSource.getStudentEvidencePage('student-1', page: 1),
    ).thenAnswer(
      (_) async => {
        'items': <dynamic>[],
        'page': 1,
        'page_size': 20,
        'total': 0,
        'total_pages': 0,
        'has_next': false,
        'has_previous': false,
      },
    );
    when(
      () => dataSource.reviewDose('dose-1', 'approved', notes: null),
    ).thenAnswer((_) async {});

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          adminRemoteDataSourceProvider.overrideWithValue(dataSource),
          authStateProvider.overrideWith((ref) => _FakeAuthNotifier()),
        ],
        child: const MaterialApp(
          home: AdminStudentDetailScreen(studentId: 'student-1'),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('student@example.test'), findsOneWidget);

    await tester.tap(find.text('Esquema'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Vacuna ejemplo'));
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('Aprobar'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Confirmar'));
    await tester.pumpAndSettle();

    expect(
      find.text('No se pudo cargar la información del estudiante.'),
      findsOneWidget,
    );
    expect(find.text('Ada Example'), findsNothing);
    expect(find.text('student@example.test'), findsNothing);
    expect(find.byTooltip('Descargar certificado'), findsNothing);
    expect(find.byTooltip('Editar perfil'), findsNothing);
    expect(find.byTooltip('Enviar mensaje'), findsNothing);
    verify(
      () => dataSource.reviewDose('dose-1', 'approved', notes: null),
    ).called(1);
  });

  testWidgets('student detail tabs and long student name fit 320x568', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(320, 568);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final dataSource = _MockAdminRemoteDataSource();
    const longStudentName =
        'Nombre sintético extenso para comprobar el reflujo del encabezado administrativo';
    const longVaccineName =
        'Vacuna sintética extensa para verificar el ajuste responsivo del encabezado del esquema';
    const longDoseLabel =
        'Etiqueta sintética extensa para verificar que el nombre completo de la dosis se ajuste en pantallas estrechas';
    when(() => dataSource.getStudentDetail('student-1')).thenAnswer(
      (_) async => {
        'email': 'student@example.test',
        'profile': {
          'first_name':
              'Nombre sintético extenso para comprobar el reflujo del',
          'last_name': 'encabezado administrativo',
        },
      },
    );
    when(() => dataSource.getStudentScheme('student-1')).thenAnswer(
      (_) async => [
        {
          'vaccine': {'name': longVaccineName},
          'status': 'in_review',
          'doses': [
            {
              'id': 'synthetic-dose',
              'status': 'in_review',
              'dose_number': 1,
              'admin_notes': 'Comentario sintético de revisión',
              'reviewed_by': 'admin-1',
              'dose_config': {'label': longDoseLabel},
            },
          ],
        },
      ],
    );
    when(
      () => dataSource.getStudentEvidencePage('student-1', page: 1),
    ).thenAnswer(
      (_) async => {
        'items': <dynamic>[],
        'page': 1,
        'page_size': 20,
        'total': 0,
        'total_pages': 0,
        'has_next': false,
        'has_previous': false,
      },
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          adminRemoteDataSourceProvider.overrideWithValue(dataSource),
          authStateProvider.overrideWith((ref) => _FakeAuthNotifier()),
        ],
        child: const MaterialApp(
          home: AdminStudentDetailScreen(studentId: 'student-1'),
        ),
      ),
    );
    await tester.pumpAndSettle();
    final appBarTitle = find.descendant(
      of: find.byType(AppBar),
      matching: find.text(longStudentName),
    );
    expect(appBarTitle, findsOneWidget);
    expect(tester.getSize(appBarTitle).height, greaterThan(20));
    expect(tester.takeException(), isNull, reason: 'profile tab');

    await tester.tap(find.text('Esquema'));
    await tester.pumpAndSettle();
    expect(
      tester
          .widget<ExpansionTile>(find.byType(ExpansionTile))
          .initiallyExpanded,
      isFalse,
    );
    final vaccineTitle = find.text(longVaccineName);
    expect(tester.getSize(vaccineTitle).height, greaterThan(18));
    await tester.tap(vaccineTitle);
    await tester.pumpAndSettle();

    final doseLabel = find.text(longDoseLabel);
    expect(tester.getSize(doseLabel).height, greaterThan(16));
    expect(find.text('Comentario sintético de revisión'), findsOneWidget);
    expect(tester.takeException(), isNull, reason: 'expanded review detail');

    await tester.tap(find.text('Evidencia'));
    await tester.pumpAndSettle();
    expect(find.text('Sin evidencia subida'), findsOneWidget);
    expect(find.text('Página 1 de 0'), findsOneWidget);
    expect(tester.takeException(), isNull, reason: 'empty evidence tab');
  });

  testWidgets('evidence batch and review actions fit 320x568', (tester) async {
    tester.view.physicalSize = const Size(320, 568);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final dataSource = _MockAdminRemoteDataSource();
    when(() => dataSource.getStudentDetail('student-1')).thenAnswer(
      (_) async => {
        'email': 'student@example.test',
        'profile': {'first_name': 'Ada', 'last_name': 'Example'},
      },
    );
    when(
      () => dataSource.getStudentScheme('student-1'),
    ).thenAnswer((_) async => <dynamic>[]);
    when(
      () => dataSource.getStudentEvidencePage('student-1', page: 1),
    ).thenAnswer(
      (_) async => {
        'items': [
          {
            'id': 'synthetic-batch',
            'created_at': '2026-10-31T12:00:00Z',
            'files': [
              {
                'id': 'synthetic-file',
                'original_filename':
                    'evidencia_sintetica_nombre_extenso_de_prueba.pdf',
              },
            ],
          },
        ],
        'page': 1,
        'page_size': 20,
        'total': 1,
        'total_pages': 1,
        'has_next': false,
        'has_previous': false,
      },
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          adminRemoteDataSourceProvider.overrideWithValue(dataSource),
          authStateProvider.overrideWith((ref) => _FakeAuthNotifier()),
        ],
        child: const MaterialApp(
          home: AdminStudentDetailScreen(studentId: 'student-1'),
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Evidencia'));
    await tester.pumpAndSettle();
    expect(find.text('1 archivo(s)'), findsOneWidget);
    expect(tester.takeException(), isNull, reason: 'evidence batch');

    await tester.tap(find.text('1 archivo(s)'));
    await tester.pumpAndSettle();
    expect(find.text('En revisión'), findsOneWidget);
    expect(find.text('Aprobar'), findsOneWidget);
    expect(find.text('Denegar'), findsOneWidget);
    expect(
      find.text('evidencia_sintetica_nombre_extenso_de_prueba.pdf'),
      findsOneWidget,
    );
    expect(tester.takeException(), isNull, reason: 'expanded evidence batch');
  });
}
