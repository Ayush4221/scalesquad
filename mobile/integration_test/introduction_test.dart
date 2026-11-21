import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:scalesquad_mobile/main.dart' as app;

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  testWidgets(
    'Android preview explores the mission without requesting accounts or capture',
    (tester) async {
      app.main();
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.text('Explore the mission'));
      await tester.tap(find.text('Explore the mission'));
      await tester.pumpAndSettle();
      await tester.tap(find.bySemanticsLabel('Data role'));
      await tester.pump();
      expect(find.text('Protect every pass.'), findsOneWidget);
      await tester.scrollUntilVisible(find.text('Join voice'), 200);
      expect(
        tester
            .widget<FilledButton>(
              find.widgetWithText(FilledButton, 'Join voice'),
            )
            .onPressed,
        isNull,
      );
      await tester.tap(find.byTooltip('Back'));
      await tester.pumpAndSettle();
      expect(find.text('Explore the mission'), findsOneWidget);
    },
  );
}
