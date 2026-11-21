import 'package:flutter/material.dart';

import '../features/introduction/views/introduction_page.dart';
import '../features/introduction/views/mission_page.dart';
import '../core/theme/app_tokens.dart';
import 'recovery_page.dart';
import 'startup_gate.dart';

abstract final class AppRouter {
  static const home = '/';
  static const mission = '/mission';

  static Route<void> generate(RouteSettings settings) => PageRouteBuilder<void>(
    settings: settings,
    transitionDuration: AppTokens.short,
    reverseTransitionDuration: AppTokens.micro,
    pageBuilder: (context, animation, secondaryAnimation) =>
        switch (settings.name) {
          mission => const MissionPage(),
          home => StartupGate(
            child: IntroductionPage(
              onExploreMission: () => Navigator.of(context).pushNamed(mission),
            ),
          ),
          _ => RecoveryPage(
            onReturnHome: () =>
                Navigator.of(context)
                    .pushNamedAndRemoveUntil(home, (_) => false),
          ),
        },
    transitionsBuilder: (context, animation, secondaryAnimation, child) {
      if (MediaQuery.disableAnimationsOf(context)) return child;
      final curved = animation.drive(CurveTween(curve: AppTokens.enterCurve));
      return FadeTransition(
        opacity: curved,
        child: SlideTransition(
          position: Tween<Offset>(
            begin: const Offset(0.025, 0),
            end: Offset.zero,
          ).animate(curved),
          child: child,
        ),
      );
    },
  );
}
