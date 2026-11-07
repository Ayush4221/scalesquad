import 'package:flutter/material.dart';

import '../theme/app_colors.g.dart';

enum AppGlyph {
  arrowLeft('arrow_left'),
  arrowRight('arrow_right'),
  traffic('traffic'),
  data('data'),
  operations('operations'),
  shield('shield'),
  users('users'),
  chat('chat'),
  headphones('headphones'),
  mic('mic');

  const AppGlyph(this.asset);
  final String asset;
}

/// Rasterized Lucide artwork; its source and ISC licence live in the repository.
class AppIcon extends StatelessWidget {
  const AppIcon(
    this.glyph, {
    super.key,
    this.color = AppColors.text,
    this.size = 24,
  });
  final AppGlyph glyph;
  final Color color;
  final double size;

  @override
  Widget build(BuildContext context) => ExcludeSemantics(
    child: Image.asset(
      'assets/icons/${glyph.asset}.png',
      width: size,
      height: size,
      color: color,
      filterQuality: FilterQuality.high,
    ),
  );
}
