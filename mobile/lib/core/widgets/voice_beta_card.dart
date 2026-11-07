import 'package:flutter/material.dart';

import '../constants/app_strings.dart';

import '../theme/app_colors.g.dart';
import 'app_icon.dart';
import 'squad_button.dart';

class VoiceBetaCard extends StatelessWidget {
  const VoiceBetaCard({super.key});
  @override
  Widget build(BuildContext context) => const Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      const Row(
        children: [
          AppIcon(AppGlyph.headphones, size: 18),
          SizedBox(width: 8),
          Expanded(
            child: Text(
              AppStrings.squadVoice,
              style: TextStyle(fontWeight: FontWeight.w600),
            ),
          ),
          DecoratedBox(
            decoration: BoxDecoration(
              color: AppColors.raised,
              borderRadius: BorderRadius.all(Radius.circular(5)),
            ),
            child: Padding(
              padding: EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              child: Text(AppStrings.beta, style: TextStyle(fontSize: 11)),
            ),
          ),
        ],
      ),
      const SizedBox(height: 8),
      const Text(
        AppStrings.comingSoonTextChatWillStay,
        style: TextStyle(color: AppColors.muted, fontSize: 12),
      ),
      const SizedBox(height: 12),
      const SquadButton(
        label: AppStrings.joinVoice,
        secondary: true,
        glyph: AppGlyph.mic,
      ),
    ],
  );
}
