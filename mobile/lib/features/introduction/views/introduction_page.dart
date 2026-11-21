import 'package:flutter/material.dart';

import '../../../core/constants/app_strings.dart';
import '../../../core/theme/app_colors.g.dart';
import '../../../core/theme/app_tokens.dart';
import '../../../core/widgets/app_icon.dart';
import '../../../core/widgets/brand_mark.dart';
import '../../../core/widgets/page_body.dart';
import '../../../core/widgets/squad_button.dart';
import '../../../core/widgets/surface_card.dart';

class IntroductionPage extends StatelessWidget {
  const IntroductionPage({super.key, required this.onExploreMission});
  final VoidCallback onExploreMission;

  @override
  Widget build(BuildContext context) => Scaffold(
    body: PageBody(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Expanded(child: BrandMark()),
              SizedBox(width: AppTokens.spaceMd),
              Text(
                AppStrings.dev,
                style: TextStyle(color: AppColors.muted, fontSize: 13),
              ),
            ],
          ),
          const SizedBox(height: AppTokens.space2xl),
          Text(
            AppStrings.heroIntroduction,
            style: Theme.of(context).textTheme.headlineLarge,
          ),
          const SizedBox(height: AppTokens.spaceLg),
          Text(
            AppStrings.threeEngineersDifferentCluesOneSystem,
            style: Theme.of(context).textTheme.bodyLarge
                ?.copyWith(color: AppColors.muted),
          ),
          const SizedBox(height: AppTokens.spaceXl),
          const SurfaceCard(accent: true, child: _MissionPreview()),
          const SizedBox(height: AppTokens.spaceXl),
          SquadButton(
            label: AppStrings.exploreTheMission,
            onPressed: onExploreMission,
          ),
          const SizedBox(height: AppTokens.spaceMd),
          Text(
            AppStrings.androidPreviewAccountSignInIs,
            style: Theme.of(context).textTheme.bodySmall
                ?.copyWith(color: AppColors.subtle),
          ),
          const SizedBox(height: AppTokens.space3xl),
          Text(
            AppStrings.winByThinkingTogether,
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: AppTokens.spaceXl),
          const _Feature(
            glyph: AppGlyph.users,
            title: AppStrings.bringYourSquad,
            description: AppStrings.threeRolesMakeThreePerspectivesEvery,
          ),
          const _Feature(
            glyph: AppGlyph.chat,
            title: AppStrings.connectTheClues,
            description: AppStrings.tradeWhatYouKnowAUseful,
          ),
          const _Feature(
            glyph: AppGlyph.shield,
            title: AppStrings.proveTheRepair,
            description: AppStrings.compareYourFixAgainstTheSame,
          ),
          const Divider(),
          const SizedBox(height: AppTokens.spaceLg),
          Text(
            AppStrings.aCooperativeSystemsGame,
            style: Theme.of(context).textTheme.bodySmall
                ?.copyWith(color: AppColors.subtle),
          ),
          const SizedBox(height: AppTokens.spaceXs),
          Text(
            AppStrings.builtForSquadsWhoLikeAsking,
            style: Theme.of(context).textTheme.bodySmall
                ?.copyWith(color: AppColors.subtle),
          ),
        ],
      ),
    ),
  );
}

class _MissionPreview extends StatelessWidget {
  const _MissionPreview();

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Row(
        children: [
          const AppIcon(AppGlyph.shield, size: 20),
          const SizedBox(width: AppTokens.spaceSm),
          Expanded(
            child: Text(
              AppStrings.campuspass,
              style: Theme.of(context).textTheme.titleMedium,
            ),
          ),
        ],
      ),
      const SizedBox(height: AppTokens.spaceLg),
      Text(
        AppStrings.keepEveryCheckInCorrect,
        style: Theme.of(context).textTheme.headlineMedium,
      ),
      const SizedBox(height: AppTokens.spaceLg),
      const Wrap(
        spacing: AppTokens.spaceLg,
        runSpacing: AppTokens.spaceMd,
        children: [
          _Goal(glyph: AppGlyph.traffic, text: AppStrings.handleTheSurge),
          _Goal(glyph: AppGlyph.data, text: AppStrings.protectEachPass),
          _Goal(glyph: AppGlyph.operations, text: AppStrings.stayWithinBudget),
        ],
      ),
    ],
  );
}

class _Goal extends StatelessWidget {
  const _Goal({required this.glyph, required this.text});
  final AppGlyph glyph;
  final String text;

  @override
  Widget build(BuildContext context) => Row(
    mainAxisSize: MainAxisSize.min,
    children: [
      AppIcon(glyph, size: 18),
      const SizedBox(width: AppTokens.spaceSm),
      Flexible(child: Text(text, style: Theme.of(context).textTheme.bodySmall)),
    ],
  );
}

class _Feature extends StatelessWidget {
  const _Feature({
    required this.glyph,
    required this.title,
    required this.description,
  });
  final AppGlyph glyph;
  final String title;
  final String description;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: AppTokens.spaceXl),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        AppIcon(glyph, color: AppColors.lime, size: 24),
        const SizedBox(width: AppTokens.spaceLg),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: AppTokens.spaceXs),
              Text(description, style: const TextStyle(color: AppColors.muted)),
            ],
          ),
        ),
      ],
    ),
  );
}
