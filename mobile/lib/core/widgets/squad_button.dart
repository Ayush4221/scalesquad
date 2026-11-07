import 'package:flutter/material.dart';

import '../constants/app_strings.dart';

import '../theme/app_colors.g.dart';
import 'app_icon.dart';

class SquadButton extends StatelessWidget {
  const SquadButton({
    super.key,
    required this.label,
    this.onPressed,
    this.busy = false,
    this.secondary = false,
    this.glyph = AppGlyph.arrowRight,
  });
  final String label;
  final VoidCallback? onPressed;
  final bool busy;
  final bool secondary;
  final AppGlyph glyph;

  @override
  Widget build(BuildContext context) {
    final enabled = onPressed != null && !busy;
    final color = secondary ? AppColors.text : AppColors.ink;
    return Semantics(
      liveRegion: busy,
      child: FilledButton(
        onPressed: enabled ? onPressed : null,
        style: FilledButton.styleFrom(
          backgroundColor: secondary ? AppColors.raised : AppColors.lime,
          foregroundColor: color,
          disabledBackgroundColor: AppColors.raised,
          disabledForegroundColor: AppColors.muted,
          minimumSize: const Size.fromHeight(54),
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
        ),
        child: Row(
          children: [
            Expanded(child: Text(busy ? AppStrings.working : label)),
            const SizedBox(width: 12),
            if (busy && !MediaQuery.disableAnimationsOf(context))
              const SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(strokeWidth: 2),
              )
            else
              AppIcon(
                glyph,
                color: enabled ? color : AppColors.muted,
                size: 20,
              ),
          ],
        ),
      ),
    );
  }
}
