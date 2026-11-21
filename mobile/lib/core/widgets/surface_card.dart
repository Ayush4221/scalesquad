import 'package:flutter/material.dart';

import '../theme/app_colors.g.dart';
import '../theme/app_tokens.dart';

class SurfaceCard extends StatelessWidget {
  const SurfaceCard({super.key, required this.child, this.accent = false});
  final Widget child;
  final bool accent;
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(AppTokens.spaceXl),
    decoration: BoxDecoration(
      color: accent ? AppColors.cobalt : AppColors.surface,
      borderRadius: BorderRadius.circular(AppTokens.panelRadius),
    ),
    child: child,
  );
}
