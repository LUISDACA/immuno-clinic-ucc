import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:immuno_clinic_app/core/models/domain_enums.dart';
import 'package:immuno_clinic_app/features/student/presentation/providers/scheme_provider.dart';
import 'package:immuno_clinic_app/features/student/presentation/screens/scheme_detail_screen.dart';
import 'package:immuno_clinic_app/features/student/data/models/vaccine_model.dart';

class _SchemeNotifier extends StateNotifier<SchemeState>
    implements SchemeNotifier {
  _SchemeNotifier({SchemeState? initialState})
    : super(initialState ?? const SchemeState(error: 'No fue posible cargar.'));

  final forceRefreshCalls = <bool>[];

  @override
  Future<void> loadScheme({bool forceRefresh = false}) async {
    forceRefreshCalls.add(forceRefresh);
  }

  @override
  Future<bool> updateDose(
    String doseId, {
    String? appliedDate,
    bool clearAppliedDate = false,
    String? titerValue,
    bool clearTiterValue = false,
  }) async => false;
}

void main() {
  testWidgets('initial scheme error exposes a retry that forces a fresh read', (
    tester,
  ) async {
    final notifier = _SchemeNotifier();
    await tester.pumpWidget(
      ProviderScope(
        overrides: [schemeProvider.overrideWith((ref) => notifier)],
        child: const MaterialApp(home: SchemeDetailScreen()),
      ),
    );
    await tester.pump();

    expect(find.text('No fue posible cargar.'), findsOneWidget);
    final retry = find.widgetWithText(OutlinedButton, 'Reintentar');
    expect(retry, findsOneWidget);
    expect(notifier.forceRefreshCalls, [false]);

    await tester.tap(retry);
    await tester.pump();

    expect(notifier.forceRefreshCalls, [false, true]);
  });

  testWidgets(
    'successful empty scheme explains the empty state and refreshes',
    (tester) async {
      const emptyOverview = SchemeOverviewModel(
        totalVaccines: 0,
        approvedVaccines: 0,
        pendingVaccines: 0,
        deniedVaccines: 0,
        inReviewVaccines: 0,
        vaccines: [],
      );
      final notifier = _SchemeNotifier(
        initialState: const SchemeState(overview: emptyOverview),
      );
      await tester.pumpWidget(
        ProviderScope(
          overrides: [schemeProvider.overrideWith((ref) => notifier)],
          child: const MaterialApp(home: SchemeDetailScreen()),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Sin vacunas asignadas'), findsOneWidget);
      expect(find.text('Tu esquema aún no tiene vacunas.'), findsOneWidget);
      expect(notifier.forceRefreshCalls, [false]);

      await tester.drag(find.byType(ListView), const Offset(0, 240));
      await tester.pumpAndSettle();

      expect(notifier.forceRefreshCalls, [false, true]);
    },
  );

  testWidgets('scheme review details reflow at a narrow 320x568 viewport', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(320, 568);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    const dose = DoseModel(
      id: 'synthetic-dose',
      doseNumber: 1,
      status: DoseStatus.denied,
      adminNotes: 'Comentario sintético de revisión',
      doseConfig: DoseConfigModel(
        label: 'Primera dosis',
        isRequired: true,
        doseType: 'standard',
        doseNumber: 1,
      ),
    );
    const vaccine = StudentVaccineModel(
      id: 'synthetic-vaccine',
      status: VaccineStatus.denied,
      vaccine: VaccineInfoModel(
        name: 'Vacuna sintética de prueba',
        code: 'SYNTHETIC',
        hasTiter: false,
        hasTiterValue: false,
        isAnnual: false,
      ),
      doses: [dose],
    );
    const overview = SchemeOverviewModel(
      totalVaccines: 1,
      approvedVaccines: 0,
      pendingVaccines: 0,
      deniedVaccines: 1,
      inReviewVaccines: 0,
      vaccines: [vaccine],
    );
    final notifier = _SchemeNotifier(
      initialState: const SchemeState(overview: overview, vaccines: [vaccine]),
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [schemeProvider.overrideWith((ref) => notifier)],
        child: const MaterialApp(home: SchemeDetailScreen()),
      ),
    );
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull, reason: 'collapsed scheme card');

    await tester.tap(find.byType(ExpansionTile));
    await tester.pumpAndSettle();

    expect(find.text('Comentario sintético de revisión'), findsOneWidget);
    expect(tester.takeException(), isNull, reason: 'expanded dose details');
  });

  testWidgets('long vaccine names wrap in the student scheme at 320px', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(320, 568);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    const longName =
        'Vacuna sintética de prueba Vacuna sintética de prueba '
        'Vacuna sintética de prueba Vacuna sintética de prueba '
        'Vacuna sintética de prueba Vacuna sintética de prueba '
        'Vacuna sintética de prueba Vacuna sintética de prueba';
    const vaccine = StudentVaccineModel(
      id: 'synthetic-long-vaccine',
      status: VaccineStatus.approved,
      vaccine: VaccineInfoModel(
        name: longName,
        code: 'SYNTHETIC-LONG',
        hasTiter: false,
        hasTiterValue: false,
        isAnnual: false,
      ),
      doses: [],
    );
    const overview = SchemeOverviewModel(
      totalVaccines: 1,
      approvedVaccines: 1,
      pendingVaccines: 0,
      deniedVaccines: 0,
      inReviewVaccines: 0,
      vaccines: [vaccine],
    );
    final notifier = _SchemeNotifier(
      initialState: const SchemeState(overview: overview, vaccines: [vaccine]),
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [schemeProvider.overrideWith((ref) => notifier)],
        child: const MaterialApp(home: SchemeDetailScreen()),
      ),
    );
    await tester.pumpAndSettle();

    final title = find.text(longName);
    expect(title, findsOneWidget);
    expect(tester.getSize(title).height, greaterThan(20));
    expect(tester.takeException(), isNull);
  });
}
