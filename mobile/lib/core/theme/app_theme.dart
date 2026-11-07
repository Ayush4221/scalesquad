import 'package:flutter/material.dart';

import 'app_colors.g.dart';

final appTheme = ThemeData(
  useMaterial3: true,
  brightness: Brightness.dark,
  fontFamily: 'Chivo',
  scaffoldBackgroundColor: AppColors.ink,
  colorScheme: const ColorScheme.dark(
    primary: AppColors.lime,
    onPrimary: AppColors.ink,
    secondary: AppColors.cobalt,
    onSecondary: AppColors.text,
    surface: AppColors.surface,
    onSurface: AppColors.text,
    error: AppColors.danger,
    outline: AppColors.line,
  ),
  appBarTheme: const AppBarTheme(
    backgroundColor: AppColors.ink,
    foregroundColor: AppColors.text,
    surfaceTintColor: Colors.transparent,
  ),
  dividerColor: AppColors.line,
  textTheme: const TextTheme(
    headlineLarge: TextStyle(
      fontSize: 42,
      height: 1.06,
      fontWeight: FontWeight.w800,
      letterSpacing: -1.5,
    ),
    headlineMedium: TextStyle(
      fontSize: 30,
      height: 1.15,
      fontWeight: FontWeight.w700,
      letterSpacing: -0.8,
    ),
    titleLarge: TextStyle(fontSize: 21, fontWeight: FontWeight.w700),
    titleMedium: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
    bodyLarge: TextStyle(fontSize: 16, height: 1.6),
    bodyMedium: TextStyle(fontSize: 14, height: 1.6),
    bodySmall: TextStyle(fontSize: 12, height: 1.5),
    labelLarge: TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
  ).apply(bodyColor: AppColors.text, displayColor: AppColors.text),
  inputDecorationTheme: InputDecorationTheme(
    filled: true,
    fillColor: AppColors.ink,
    labelStyle: const TextStyle(color: AppColors.muted),
    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
    enabledBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(12),
      borderSide: const BorderSide(color: AppColors.input),
    ),
    focusedBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(12),
      borderSide: const BorderSide(color: AppColors.lime, width: 2),
    ),
  ),
);
