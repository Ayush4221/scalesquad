import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.g.dart';
import '../../../core/widgets/app_icon.dart';
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
  Widget build(BuildContext context) => IntrinsicHeight(
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final role in SquadRole.values)
          Expanded(
            child: Padding(
              padding: EdgeInsets.only(
                right: role == SquadRole.operations ? 0 : 8,
              ),
              child: Semantics(
                selected: selected == role,
                button: true,
                label: '${role.label} role',
                onTap: () => onSelected(role),
                child: ExcludeSemantics(
                  child: Material(
                    color: selected == role
                        ? AppColors.limeTint
                        : AppColors.ink,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                      side: BorderSide(
                        color: selected == role
                            ? AppColors.lime
                            : AppColors.line,
                      ),
                    ),
                    clipBehavior: Clip.antiAlias,
                    child: InkWell(
                      onTap: () => onSelected(role),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 18,
                        ),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            AppIcon(
                              switch (role) {
                                SquadRole.traffic => AppGlyph.traffic,
                                SquadRole.data => AppGlyph.data,
                                SquadRole.operations => AppGlyph.operations,
                              },
                              color: selected == role
                                  ? AppColors.lime
                                  : AppColors.muted,
                            ),
                            const SizedBox(height: 10),
                            Text(
                              role.label,
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                                color: selected == role
                                    ? AppColors.lime
                                    : AppColors.muted,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
      ],
    ),
  );
}
