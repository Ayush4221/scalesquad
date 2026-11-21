import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:scalesquad_mobile/app/app.dart';
import 'package:scalesquad_mobile/core/theme/app_theme.dart';
import 'package:scalesquad_mobile/core/widgets/squad_button.dart';
import 'package:scalesquad_mobile/core/widgets/brand_mark.dart';
import 'package:scalesquad_mobile/core/widgets/app_icon.dart';
import 'package:scalesquad_mobile/core/constants/app_assets.dart';
import 'package:scalesquad_mobile/app/recovery_page.dart';

Future<void> loadFonts() async {
  for (final font in ['Chivo', 'Bungee']) {
    final loader = FontLoader(font)
      ..addFont(rootBundle.load('assets/fonts/${font.toLowerCase()}.ttf'));
    await loader.load();
  }
}

Future<void> loadImages(WidgetTester tester) async {
  final context = tester.element(find.byType(Navigator).first);
  await tester.runAsync(() async {
    for (final asset in [
      AppAssets.brandMark,
      ...AppGlyph.values.map((glyph) => AppAssets.icon(glyph.asset)),
    ]) {
      await precacheImage(AssetImage(asset), context);
    }
  });
  await tester.pump();
}

void main() {
  setUpAll(loadFonts);
  testWidgets(
    'guest enters mission, explores roles, sees disabled voice and navigates back',
    (tester) async {
      tester.view.physicalSize = const Size(390, 844);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      await tester.pumpWidget(const ScaleSquadApp());
      await tester.pumpAndSettle();
      expect(find.textContaining('Same squad.'), findsOneWidget);
      await tester.tap(find.text('Explore the mission'));
      await tester.pumpAndSettle();
      expect(find.text('Meet your squad'), findsOneWidget);
      await tester.tap(find.bySemanticsLabel('Data role'));
      await tester.pump();
      expect(find.text('Protect every pass.'), findsOneWidget);
      await tester.tap(find.bySemanticsLabel('Operations role'));
      await tester.pump();
      expect(find.text('Keep the system moving.'), findsOneWidget);
      await tester.scrollUntilVisible(find.text('Join voice'), 250);
      final button = tester.widget<FilledButton>(
        find.widgetWithText(FilledButton, 'Join voice'),
      );
      expect(button.onPressed, isNull);
      expect(find.text('Beta'), findsOneWidget);
      await tester.tap(find.byTooltip('Back'));
      await tester.pumpAndSettle();
      expect(find.text('Explore the mission'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'small phone with large text keeps content scrollable and tappable',
    (tester) async {
      tester.view.physicalSize = const Size(320, 640);
      tester.view.devicePixelRatio = 1;
      tester.platformDispatcher.textScaleFactorTestValue = 2;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
      await tester.pumpWidget(const ScaleSquadApp());
      await tester.pumpAndSettle();
      await tester.scrollUntilVisible(find.text('Explore the mission'), 200);
      await tester.tap(find.text('Explore the mission'));
      await tester.pumpAndSettle();
      await tester.scrollUntilVisible(find.bySemanticsLabel('Data role'), 150);
      await tester.tap(find.bySemanticsLabel('Data role'));
      await tester.pump();
      expect(find.text('Protect every pass.'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets('loading locks button and reduced motion removes spinner', (
    tester,
  ) async {
    var taps = 0;
    await tester.pumpWidget(
      MaterialApp(
        theme: appTheme,
        home: MediaQuery(
          data: const MediaQueryData(disableAnimations: true),
          child: Scaffold(
            body: SquadButton(
              label: 'Continue',
              busy: true,
              onPressed: () => taps++,
            ),
          ),
        ),
      ),
    );
    await tester.tap(find.text('Working…'));
    expect(taps, 0);
    expect(find.byType(CircularProgressIndicator), findsNothing);
  });

  testWidgets('home visual baseline uses the approved assets and palette', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(
      const RepaintBoundary(key: Key('home-golden'), child: ScaleSquadApp()),
    );
    await tester.pumpAndSettle();
    await loadImages(tester);
    expect(tester.getSize(find.byType(BrandMark)).width, greaterThan(150));
    await expectLater(
      find.byKey(const Key('home-golden')),
      matchesGoldenFile('goldens/introduction.png'),
    );
  });

  for (final screen in ['splash', 'mission', 'recovery']) {
    testWidgets('$screen visual baseline', (tester) async {
      tester.view.physicalSize = const Size(390, 844);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      await tester.pumpWidget(
        RepaintBoundary(
          key: const Key('screen-golden'),
          child: screen == 'recovery'
              ? MaterialApp(
                  debugShowCheckedModeBanner: false,
                  theme: appTheme,
                  home: RecoveryPage(onReturnHome: () {}),
                )
              : const ScaleSquadApp(),
        ),
      );
      await loadImages(tester);
      if (screen == 'mission') {
        await tester.pumpAndSettle();
        await tester.tap(find.text('Explore the mission'));
        await tester.pumpAndSettle();
      } else if (screen != 'splash') {
        await tester.pumpAndSettle();
      }
      await expectLater(
        find.byKey(const Key('screen-golden')),
        matchesGoldenFile('goldens/$screen.png'),
      );
    });
  }
}
