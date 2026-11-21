import 'package:flutter/material.dart';

import '../core/constants/app_strings.dart';

import '../core/theme/app_theme.dart';
import 'router.dart';

class ScaleSquadApp extends StatelessWidget {
  const ScaleSquadApp({super.key});

  @override
  Widget build(BuildContext context) => MaterialApp(
    title: AppStrings.developmentAppName,
    debugShowCheckedModeBanner: false,
    theme: appTheme,
    initialRoute: AppRouter.home,
    onGenerateRoute: AppRouter.generate,
  );
}
