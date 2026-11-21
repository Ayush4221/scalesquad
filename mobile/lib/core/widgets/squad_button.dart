import 'package:flutter/material.dart';

import '../constants/app_strings.dart';

import '../theme/app_colors.g.dart';
import '../theme/app_tokens.dart';
import 'app_icon.dart';

class SquadButton extends StatefulWidget {
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
  State<SquadButton> createState() => _SquadButtonState();
}

class _SquadButtonState extends State<SquadButton> {
  late final states = WidgetStatesController()..addListener(onStatesChanged);
  bool pressed = false;
  bool framePending = false;

  void onStatesChanged() {
    if (framePending || pressed == states.value.contains(WidgetState.pressed))
      return;
    framePending = true;
    // Material can publish disabled/focus changes during its own build.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      framePending = false;
      if (mounted) {
        setState(() => pressed = states.value.contains(WidgetState.pressed));
      }
    });
  }

  @override
  void dispose() {
    states.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final enabled = widget.onPressed != null && !widget.busy;
    final color = widget.secondary ? AppColors.text : AppColors.ink;
    return Semantics(
      liveRegion: widget.busy,
      child: AnimatedScale(
        scale: enabled && pressed ? 0.985 : 1,
        duration: AppTokens.motionOf(context, AppTokens.micro),
        curve: AppTokens.enterCurve,
        child: FilledButton(
          statesController: states,
          onPressed: enabled ? widget.onPressed : null,
          style:
              FilledButton.styleFrom(
                backgroundColor: widget.secondary
                    ? AppColors.raised
                    : AppColors.lime,
                foregroundColor: color,
                disabledBackgroundColor: AppColors.raised,
                disabledForegroundColor: AppColors.muted,
                minimumSize: const Size.fromHeight(56),
                padding: const EdgeInsets.symmetric(
                  horizontal: 18,
                  vertical: 14,
                ),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(AppTokens.controlRadius),
                ),
              ).copyWith(
                animationDuration: Duration.zero,
                side: WidgetStateProperty.resolveWith(
                  (states) => BorderSide(
                    color: states.contains(WidgetState.focused)
                        ? (widget.secondary ? AppColors.lime : AppColors.ink)
                        : (widget.secondary
                              ? AppColors.raised
                              : AppColors.lime),
                    width: 2,
                  ),
                ),
              ),
          child: Row(
            children: [
              Expanded(
                child: Text(widget.busy ? AppStrings.working : widget.label),
              ),
              const SizedBox(width: 12),
              if (widget.busy && !MediaQuery.disableAnimationsOf(context))
                const SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              else
                AppIcon(
                  widget.glyph,
                  color: enabled ? color : AppColors.muted,
                  size: 20,
                ),
            ],
          ),
        ),
      ),
    );
  }
}
