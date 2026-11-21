import 'package:flutter/material.dart';

import 'dart:ui' show Tristate;

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:scalesquad_mobile/app/app.dart';
import 'package:scalesquad_mobile/app/router.dart';
import 'package:scalesquad_mobile/app/startup_gate.dart';
import 'package:scalesquad_mobile/core/constants/app_strings.dart';
import 'package:scalesquad_mobile/core/theme/app_theme.dart';
import 'package:scalesquad_mobile/core/widgets/squad_button.dart';

void phone(WidgetTester tester, Size size) {
  tester.view.physicalSize = size;
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
}

Future<void> openMission(WidgetTester tester) async {
  await tester.pumpWidget(const ScaleSquadApp());
  await tester.pumpAndSettle();
  await tester.scrollUntilVisible(find.text(AppStrings.exploreTheMission), 200);
  await tester.tap(find.text(AppStrings.exploreTheMission));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('a reduced motion change finishes the active splash once', (
    tester,
  ) async {
    await tester.pumpWidget(const ScaleSquadApp());
    await tester.pump(const Duration(milliseconds: 100));
    tester.platformDispatcher.accessibilityFeaturesTestValue =
        const FakeAccessibilityFeatures(disableAnimations: true);
    addTearDown(tester.platformDispatcher.clearAccessibilityFeaturesTestValue);
    await tester.pumpAndSettle();
    expect(find.text(AppStrings.skipIntro), findsNothing);
    tester.platformDispatcher.clearAccessibilityFeaturesTestValue();
    await tester.pumpAndSettle();
    expect(find.text(AppStrings.heroIntroduction), findsOneWidget);
    expect(find.text(AppStrings.skipIntro), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets(
    'button coalesces press changes and safely disposes queued updates',
    (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: appTheme,
          home: Scaffold(
            body: SquadButton(label: 'Go', onPressed: () {}),
          ),
        ),
      );
      final states = tester
          .widget<FilledButton>(find.byType(FilledButton))
          .statesController!;
      states.update(WidgetState.pressed, true);
      states.update(WidgetState.pressed, false);
      states.update(WidgetState.pressed, true);
      await tester.pump();
      await tester.pump();
      expect(
        tester.widget<AnimatedScale>(find.byType(AnimatedScale)).scale,
        0.985,
      );
      states.update(WidgetState.pressed, false);
      await tester.pumpWidget(const SizedBox());
      await tester.pump();
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets('splash finishes once and back does not replay it', (
    tester,
  ) async {
    phone(tester, const Size(390, 844));
    await tester.pumpWidget(const ScaleSquadApp());
    expect(find.text(AppStrings.skipIntro), findsOneWidget);
    await tester.tap(find.text(AppStrings.skipIntro));
    await tester.pumpAndSettle();
    await tester.tap(find.text(AppStrings.exploreTheMission));
    await tester.pumpAndSettle();
    await tester.pageBack();
    await tester.pumpAndSettle();
    expect(find.text(AppStrings.heroIntroduction), findsOneWidget);
    expect(find.text(AppStrings.skipIntro), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('automatic splash completion and early disposal are safe', (
    tester,
  ) async {
    await tester.pumpWidget(const ScaleSquadApp());
    await tester.pumpAndSettle();
    expect(find.text(AppStrings.heroIntroduction), findsOneWidget);
    await tester.pumpWidget(
      const MaterialApp(home: StartupGate(child: SizedBox())),
    );
    await tester.pump(const Duration(milliseconds: 100));
    await tester.pumpWidget(const SizedBox());
    await tester.pump(const Duration(seconds: 2));
    expect(tester.takeException(), isNull);
  });

  testWidgets('reduced motion skips splash and removes route motion', (
    tester,
  ) async {
    phone(tester, const Size(390, 844));
    tester.platformDispatcher.accessibilityFeaturesTestValue =
        const FakeAccessibilityFeatures(disableAnimations: true);
    addTearDown(tester.platformDispatcher.clearAccessibilityFeaturesTestValue);
    await tester.pumpWidget(const ScaleSquadApp());
    await tester.pump();
    expect(find.text(AppStrings.skipIntro), findsNothing);
    await tester.tap(find.text(AppStrings.exploreTheMission));
    await tester.pumpAndSettle();
    expect(find.text(AppStrings.meetYourSquad), findsOneWidget);
    expect(find.byType(SlideTransition), findsNothing);
  });

  testWidgets(
    'all roles select, announce selection, and reset on a new visit',
    (tester) async {
      phone(tester, const Size(390, 844));
      final semantics = tester.ensureSemantics();
      try {
        await openMission(tester);
        for (final choice in [
          (AppStrings.data, AppStrings.protectEveryPass),
          (AppStrings.operations, AppStrings.keepTheSystemMoving),
          (AppStrings.traffic, AppStrings.readTheSurge),
          (AppStrings.data, AppStrings.protectEveryPass),
        ]) {
          await tester.tap(
            find.bySemanticsLabel(AppStrings.roleLabel(choice.$1)),
          );
          await tester.pumpAndSettle();
          expect(find.text(choice.$2), findsOneWidget);
          expect(
            tester
                .getSemantics(
                  find.bySemanticsLabel(AppStrings.roleLabel(choice.$1)),
                )
                .flagsCollection
                .isSelected,
            Tristate.isTrue,
          );
        }
        await tester.pageBack();
        await tester.pumpAndSettle();
        await tester.tap(find.text(AppStrings.exploreTheMission));
        await tester.pumpAndSettle();
        expect(find.text(AppStrings.readTheSurge), findsOneWidget);
      } finally {
        semantics.dispose();
      }
    },
  );

  for (final size in [
    const Size(320, 640),
    const Size(844, 390),
    const Size(1280, 800),
  ]) {
    testWidgets('all content reachable at $size with 200 percent text', (
      tester,
    ) async {
      phone(tester, size);
      tester.platformDispatcher.textScaleFactorTestValue = 2;
      addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
      await openMission(tester);
      for (final label in [
        AppStrings.traffic,
        AppStrings.data,
        AppStrings.operations,
      ]) {
        final role = find.bySemanticsLabel(AppStrings.roleLabel(label));
        await tester.scrollUntilVisible(role, 150);
        await tester.tap(role);
        await tester.pumpAndSettle();
      }
      await tester.scrollUntilVisible(find.text(AppStrings.joinVoice), 200);
      expect(
        tester
            .widget<FilledButton>(
              find.widgetWithText(FilledButton, AppStrings.joinVoice),
            )
            .onPressed,
        isNull,
      );
      expect(find.text(AppStrings.repairRunCompare), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  }

  testWidgets('unknown route offers a working safe home action', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: appTheme,
        initialRoute: '/unavailable',
        onGenerateRoute: AppRouter.generate,
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text(AppStrings.homeRecoveryTitle), findsOneWidget);
    await tester.tap(find.text(AppStrings.returnHome));
    await tester.pumpAndSettle();
    expect(find.text(AppStrings.exploreTheMission), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('busy primary control ignores pointer and keyboard activation', (
    tester,
  ) async {
    var taps = 0;
    await tester.pumpWidget(
      MaterialApp(
        theme: appTheme,
        home: Scaffold(
          body: SquadButton(
            label: AppStrings.exploreTheMission,
            busy: true,
            onPressed: () => taps++,
          ),
        ),
      ),
    );
    await tester.tap(find.text(AppStrings.working));
    await tester.sendKeyEvent(LogicalKeyboardKey.tab);
    await tester.sendKeyEvent(LogicalKeyboardKey.enter);
    expect(taps, 0);
    await tester.pumpWidget(const SizedBox());
  });

  testWidgets('home and mission meet tap-target and text-contrast guidelines', (
    tester,
  ) async {
    phone(tester, const Size(390, 844));
    final semantics = tester.ensureSemantics();
    try {
      await tester.pumpWidget(const ScaleSquadApp());
      await tester.pumpAndSettle();
      await expectLater(tester, meetsGuideline(androidTapTargetGuideline));
      await expectLater(tester, meetsGuideline(textContrastGuideline));
      await tester.tap(find.text(AppStrings.exploreTheMission));
      await tester.pumpAndSettle();
      await expectLater(tester, meetsGuideline(androidTapTargetGuideline));
      await expectLater(tester, meetsGuideline(textContrastGuideline));
    } finally {
      semantics.dispose();
    }
  });
}
