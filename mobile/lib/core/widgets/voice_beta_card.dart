import 'package:flutter/material.dart';

import '../constants/app_strings.dart';

import '../theme/app_colors.g.dart';
import '../theme/app_tokens.dart';
import 'app_icon.dart';
import 'squad_button.dart';

class VoiceBetaCard extends StatelessWidget {
  const VoiceBetaCard({super.key});
  @override
  Widget build(BuildContext context) => const Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Row(
        children: [
          AppIcon(AppGlyph.headphones, size: 18),
          SizedBox(width: AppTokens.spaceSm),
          Expanded(
            child: Text(
              AppStrings.squadVoice,
              style: TextStyle(fontWeight: FontWeight.w600),
            ),
          ),
          DecoratedBox(
            decoration: BoxDecoration(
              color: AppColors.raised,
              borderRadius: BorderRadius.all(
                Radius.circular(AppTokens.spaceSm),
              ),
            ),
            child: Padding(
              padding: EdgeInsets.symmetric(
                horizontal: AppTokens.spaceSm,
                vertical: AppTokens.spaceXs,
              ),
              child: Text(AppStrings.beta, style: TextStyle(fontSize: 13)),
            ),
          ),
        ],
      ),
      SizedBox(height: AppTokens.spaceSm),
      Text(
        AppStrings.comingSoonTextChatWillStay,
        style: TextStyle(color: AppColors.muted, fontSize: 13),
      ),
      SizedBox(height: AppTokens.spaceMd),
      SquadButton(
        label: AppStrings.joinVoice,
        secondary: true,
        glyph: AppGlyph.mic,
      ),
    ],
  );
}
