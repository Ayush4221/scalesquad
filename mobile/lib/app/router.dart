import 'package:flutter/material.dart';

import '../features/introduction/views/introduction_page.dart';
import '../features/introduction/views/mission_page.dart';

abstract final class AppRouter {
  static const home = '/';
  static const mission = '/mission';

  static Route<void> generate(RouteSettings settings) =>
      MaterialPageRoute<void>(
        settings: settings,
        builder: (context) => switch (settings.name) {
          mission => const MissionPage(),
          _ => IntroductionPage(
            onExploreMission: () => Navigator.of(context).pushNamed(mission),
          ),
        },
      );
}
