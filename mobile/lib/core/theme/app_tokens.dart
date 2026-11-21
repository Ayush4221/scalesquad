import 'package:flutter/material.dart';

// Hallmark · redesign: full · scope: app · genre: playful · theme: brand
// Keep the approved palette and assets; motion describes a change of state.
abstract final class AppTokens {
  static const fontBody = 'Chivo';
  static const fontBrand = 'Bungee';
  static const spaceXs = 4.0;
  static const spaceSm = 8.0;
  static const spaceMd = 12.0;
  static const spaceLg = 16.0;
  static const spaceXl = 24.0;
  static const space2xl = 32.0;
  static const space3xl = 48.0;
  static const contentWidth = 560.0;
  static const controlRadius = 16.0;
  static const panelRadius = 24.0;
  static const micro = Duration(milliseconds: 120);
  static const short = Duration(milliseconds: 220);
  static const splash = Duration(milliseconds: 850);
  static const enterCurve = Curves.easeOutCubic;

  static Duration motionOf(BuildContext context, Duration duration) =>
      MediaQuery.disableAnimationsOf(context) ? Duration.zero : duration;
}
