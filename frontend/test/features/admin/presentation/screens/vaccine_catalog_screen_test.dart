import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

import 'package:immuno_clinic_app/features/admin/data/datasources/admin_remote_ds.dart';
import 'package:immuno_clinic_app/features/admin/presentation/screens/vaccine_catalog_screen.dart';

class _MockAdminRemoteDataSource extends Mock
    implements AdminRemoteDataSource {}

void _setMobileViewport(
  WidgetTester tester, {
  Size size = const Size(390, 844),
}) {
  tester.view.physicalSize = size;
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
}

final _vaccineJson = <String, dynamic>{
  'id': 'vaccine-1',
  'name': 'Vacuna sintética',
  'code': 'SYNTHETIC',
  'base_doses': 1,
  'has_booster': false,
  'has_titer': false,
  'has_titer_value': false,
  'is_annual': false,
  'applies_to': 'all',
  'is_active': true,
  'display_order': 1,
  'dose_configs': [
    {
      'dose_number': 1,
      'label': 'Primera dosis',
      'is_required': true,
      'applies_to': 'all',
      'dose_type': 'standard',
    },
  ],
};

void main() {
  testWidgets(
    'shows an explicit empty state when the catalog has no vaccines',
    (tester) async {
      final dataSource = _MockAdminRemoteDataSource();
      when(() => dataSource.listVaccines()).thenAnswer((_) async => []);

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            adminRemoteDataSourceProvider.overrideWithValue(dataSource),
          ],
          child: const MaterialApp(home: VaccineCatalogScreen()),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Aún no hay vacunas en el catálogo.'), findsOneWidget);
      expect(find.text('Nueva vacuna'), findsOneWidget);
      verify(() => dataSource.listVaccines()).called(1);

      await tester.drag(find.byType(ListView), const Offset(0, 350));
      await tester.pumpAndSettle();

      verify(() => dataSource.listVaccines()).called(1);
    },
  );

  testWidgets('wraps a long vaccine name at a narrow mobile width', (
    tester,
  ) async {
    _setMobileViewport(tester, size: const Size(320, 568));
    final dataSource = _MockAdminRemoteDataSource();
    final longName =
        'Vacuna sintetica con nombre largo para comprobar el reflujo en catalogo '
        'Vacuna sintetica con nombre largo para comprobar el reflujo en catalogo';
    when(() => dataSource.listVaccines()).thenAnswer(
      (_) async => [
        {..._vaccineJson, 'name': longName},
      ],
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          adminRemoteDataSourceProvider.overrideWithValue(dataSource),
        ],
        child: const MaterialApp(home: VaccineCatalogScreen()),
      ),
    );
    await tester.pumpAndSettle();

    final title = find.text(longName);
    expect(title, findsOneWidget);
    expect(tester.getSize(title).height, greaterThan(20));
    expect(tester.takeException(), isNull);
  });

  testWidgets('generic catalog read errors stop loading and can retry', (
    tester,
  ) async {
    final dataSource = _MockAdminRemoteDataSource();
    var reads = 0;
    when(() => dataSource.listVaccines()).thenAnswer((_) async {
      if (reads++ == 0) throw StateError('PRIVATE_DIAGNOSTIC');
      return [_vaccineJson];
    });

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          adminRemoteDataSourceProvider.overrideWithValue(dataSource),
        ],
        child: const MaterialApp(home: VaccineCatalogScreen()),
      ),
    );
    await tester.pumpAndSettle();

    expect(
      find.text('No se pudo cargar el catálogo. Intenta nuevamente.'),
      findsOneWidget,
    );
    expect(find.text('PRIVATE_DIAGNOSTIC'), findsNothing);
    expect(find.byType(CircularProgressIndicator), findsNothing);

    await tester.tap(find.text('Reintentar'));
    await tester.pumpAndSettle();

    expect(find.text('Vacuna sintética'), findsOneWidget);
    verify(() => dataSource.listVaccines()).called(2);
  });

  testWidgets('edit failure keeps the draft and does not replace the catalog', (
    tester,
  ) async {
    _setMobileViewport(tester);
    final dataSource = _MockAdminRemoteDataSource();
    when(
      () => dataSource.listVaccines(),
    ).thenAnswer((_) async => [_vaccineJson]);
    when(
      () => dataSource.updateVaccine('vaccine-1', any()),
    ).thenThrow(StateError('PRIVATE_DIAGNOSTIC'));

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          adminRemoteDataSourceProvider.overrideWithValue(dataSource),
        ],
        child: const MaterialApp(home: VaccineCatalogScreen()),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('Editar'));
    await tester.pumpAndSettle();
    final nameField = find.widgetWithText(TextFormField, 'Nombre');
    await tester.enterText(nameField, 'Nombre actualizado');
    await tester.ensureVisible(find.text('Guardar'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Guardar'));
    await tester.pumpAndSettle();

    expect(find.text('No se pudo actualizar la vacuna.'), findsOneWidget);
    expect(find.text('PRIVATE_DIAGNOSTIC'), findsNothing);
    expect(find.byType(Dialog), findsOneWidget);
    expect(find.text('Vacuna sintética'), findsOneWidget);
    verify(() => dataSource.listVaccines()).called(1);
  });

  testWidgets('confirmed edit reports refresh failure and retry reloads list', (
    tester,
  ) async {
    _setMobileViewport(tester);
    final dataSource = _MockAdminRemoteDataSource();
    var reads = 0;
    when(() => dataSource.listVaccines()).thenAnswer((_) async {
      reads++;
      if (reads == 2) throw StateError('PRIVATE_DIAGNOSTIC');
      return [_vaccineJson];
    });
    when(
      () => dataSource.updateVaccine('vaccine-1', any()),
    ).thenAnswer((_) async => <String, dynamic>{});

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          adminRemoteDataSourceProvider.overrideWithValue(dataSource),
        ],
        child: const MaterialApp(home: VaccineCatalogScreen()),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('Editar'));
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('Guardar'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Guardar'));
    await tester.pumpAndSettle();

    expect(
      find.text(
        'Los cambios se guardaron, pero no se pudo actualizar el catálogo.',
      ),
      findsOneWidget,
    );
    expect(
      find.text('No se pudo cargar el catálogo. Intenta nuevamente.'),
      findsOneWidget,
    );
    expect(find.text('PRIVATE_DIAGNOSTIC'), findsNothing);

    await tester.tap(find.text('Reintentar'));
    await tester.pumpAndSettle();
    expect(find.text('Vacuna sintética'), findsOneWidget);
    expect(
      find.text(
        'Los cambios se guardaron, pero no se pudo actualizar el catálogo.',
      ),
      findsNothing,
    );
    expect(reads, 3);
  });

  testWidgets('catalog editor remains usable at a narrow 320x568 viewport', (
    tester,
  ) async {
    _setMobileViewport(tester, size: const Size(320, 568));
    final dataSource = _MockAdminRemoteDataSource();
    when(
      () => dataSource.listVaccines(),
    ).thenAnswer((_) async => [_vaccineJson]);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          adminRemoteDataSourceProvider.overrideWithValue(dataSource),
        ],
        child: const MaterialApp(home: VaccineCatalogScreen()),
      ),
    );
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull, reason: 'catalog viewport');
    await tester.tap(find.byTooltip('Editar'));
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull, reason: 'editor initial layout');
    await tester.ensureVisible(find.text('Guardar'));
    await tester.pumpAndSettle();

    expect(find.byType(Dialog), findsOneWidget);
    expect(find.text('Guardar'), findsOneWidget);

    final doseType = find.byType(DropdownButtonFormField<String>).at(1);
    await tester.tap(doseType);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Refuerzo').last);
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull, reason: 'dose type dropdown');

    final doseApplicability = find
        .byType(DropdownButtonFormField<String>)
        .at(2);
    await tester.tap(doseApplicability);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Mujeres').last);
    await tester.pumpAndSettle();

    final layoutException = tester.takeException();
    expect(layoutException, isNull, reason: 'editor controls at narrow width');
    verify(() => dataSource.listVaccines()).called(1);
  });
}
