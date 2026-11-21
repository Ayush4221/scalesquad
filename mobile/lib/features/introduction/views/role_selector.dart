import 'package:flutter/material.dart';

import '../../../core/constants/app_strings.dart';
import '../../../core/theme/app_colors.g.dart';
import '../../../core/theme/app_tokens.dart';
import '../models/squad_role.dart';

class RoleSelector extends StatelessWidget {
  const RoleSelector({
    super.key,
    required this.selected,
    required this.onSelected,
  });
  final SquadRole selected;
  final ValueChanged<SquadRole> onSelected;

  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, constraints) {
      final stacked =
          constraints.maxWidth <= 280 ||
          MediaQuery.textScalerOf(context).scale(14) > 18;
      final buttons = [
        for (final role in SquadRole.values)
          Semantics(
            selected: selected == role,
            button: true,
            label: AppStrings.roleLabel(role.label),
            onTap: () => onSelected(role),
            child: ExcludeSemantics(
              child: OutlinedButton(
                onPressed: () => onSelected(role),
                style: ButtonStyle(
                  animationDuration: Duration.zero,
                  minimumSize: const WidgetStatePropertyAll(Size(48, 52)),
                  padding: const WidgetStatePropertyAll(
                    EdgeInsets.symmetric(
                      horizontal: AppTokens.spaceSm,
                      vertical: AppTokens.spaceMd,
                    ),
                  ),
                  backgroundColor: WidgetStatePropertyAll(
                    selected == role ? AppColors.lime : AppColors.raised,
                  ),
                  foregroundColor: WidgetStatePropertyAll(
                    selected == role ? AppColors.ink : AppColors.text,
                  ),
                  side: WidgetStateProperty.resolveWith(
                    (states) => BorderSide(
                      color: states.contains(WidgetState.focused)
                          ? AppColors.text
                          : (selected == role
                                ? AppColors.lime
                                : AppColors.line),
                      width: 2,
                    ),
                  ),
                  shape: WidgetStatePropertyAll(
                    RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(
                        AppTokens.controlRadius,
                      ),
                    ),
                  ),
                ),
                child: Text(
                  role.label,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ),
          ),
      ];
      if (stacked) {
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            for (var i = 0; i < buttons.length; i++) ...[
              if (i > 0) const SizedBox(height: AppTokens.spaceSm),
              buttons[i],
            ],
          ],
        );
      }
      return Row(
        children: [
          for (var i = 0; i < buttons.length; i++) ...[
            if (i > 0) const SizedBox(width: AppTokens.spaceSm),
            Expanded(child: buttons[i]),
          ],
        ],
      );
    },
  );
}
