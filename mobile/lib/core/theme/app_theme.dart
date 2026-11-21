import 'package:flutter/material.dart';

import 'app_colors.g.dart';
import 'app_tokens.dart';

final appTheme = ThemeData(
  useMaterial3: true,
  brightness: Brightness.dark,
  fontFamily: AppTokens.fontBody,
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
  iconButtonTheme: IconButtonThemeData(
    style: ButtonStyle(
      animationDuration: Duration.zero,
      minimumSize: const WidgetStatePropertyAll(Size(48, 48)),
      side: WidgetStateProperty.resolveWith(
        (states) => BorderSide(
          color: states.contains(WidgetState.focused)
              ? AppColors.lime
              : AppColors.ink,
          width: 2,
        ),
      ),
    ),
  ),
  textButtonTheme: TextButtonThemeData(
    style: ButtonStyle(
      animationDuration: Duration.zero,
      minimumSize: const WidgetStatePropertyAll(Size(48, 48)),
      side: WidgetStateProperty.resolveWith(
        (states) => BorderSide(
          color: states.contains(WidgetState.focused)
              ? AppColors.lime
              : AppColors.ink,
          width: 2,
        ),
      ),
    ),
  ),
  textTheme: const TextTheme(
    headlineLarge: TextStyle(
      fontSize: 44,
      height: 1.08,
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
    bodyLarge: TextStyle(fontSize: 18, height: 1.5),
    bodyMedium: TextStyle(fontSize: 16, height: 1.5),
    bodySmall: TextStyle(fontSize: 13, height: 1.5),
    labelLarge: TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
  ).apply(bodyColor: AppColors.text, displayColor: AppColors.text),
  inputDecorationTheme: InputDecorationTheme(
    filled: true,
    fillColor: AppColors.ink,
    labelStyle: const TextStyle(color: AppColors.muted),
    border: OutlineInputBorder(
      borderRadius: BorderRadius.circular(AppTokens.controlRadius),
    ),
    enabledBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(AppTokens.controlRadius),
      borderSide: const BorderSide(color: AppColors.input),
    ),
    focusedBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(AppTokens.controlRadius),
      borderSide: const BorderSide(color: AppColors.lime, width: 2),
    ),
  ),
);
