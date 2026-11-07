import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:immuno_clinic_app/features/shared/presentation/widgets/local_paged_list.dart';

void main() {
  Widget list(int count) => MaterialApp(
    home: Scaffold(
      body: LocalPagedList(
        itemCount: count,
        itemBuilder: (_, index) => Text('Synthetic row ${index + 1}'),
      ),
    ),
  );

  testWidgets(
    'all import rows are accessible across local pages without changing the response',
    (tester) async {
      await tester.pumpWidget(list(45));
      expect(find.text('Página 1 de 3 · 45 filas'), findsOneWidget);
      expect(find.text('Synthetic row 21'), findsNothing);
      await tester.tap(find.text('Siguiente'));
      await tester.pumpAndSettle();
      expect(find.text('Synthetic row 21'), findsOneWidget);
      await tester.tap(find.text('Siguiente'));
      await tester.pumpAndSettle();
      expect(find.text('Synthetic row 45'), findsOneWidget);
      expect(
        tester
            .widget<TextButton>(find.widgetWithText(TextButton, 'Siguiente'))
            .onPressed,
        isNull,
      );
      await tester.tap(find.text('Anterior'));
      await tester.pumpAndSettle();
      expect(find.text('Synthetic row 21'), findsOneWidget);
    },
  );
  testWidgets(
    'shrinking results returns to a valid page and empty results remain navigable',
    (tester) async {
      await tester.pumpWidget(list(21));
      await tester.tap(find.text('Siguiente'));
      await tester.pumpAndSettle();
      await tester.pumpWidget(list(1));
      expect(find.text('Página 1 de 1 · 1 filas'), findsOneWidget);
      expect(find.text('Synthetic row 1'), findsOneWidget);
      await tester.pumpWidget(list(0));
      expect(find.text('Página 1 de 1 · 0 filas'), findsOneWidget);
      expect(
        tester
            .widget<TextButton>(find.widgetWithText(TextButton, 'Anterior'))
            .onPressed,
        isNull,
      );
      expect(
        tester
            .widget<TextButton>(find.widgetWithText(TextButton, 'Siguiente'))
            .onPressed,
        isNull,
      );
    },
  );
}
