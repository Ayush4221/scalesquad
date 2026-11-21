import 'package:flutter/material.dart';

import '../../../core/constants/app_strings.dart';
import '../../../core/theme/app_colors.g.dart';
import '../../../core/theme/app_tokens.dart';
import '../../../core/widgets/app_icon.dart';
import '../../../core/widgets/page_body.dart';
import '../../../core/widgets/surface_card.dart';
import '../../../core/widgets/voice_beta_card.dart';
import '../controllers/introduction_controller.dart';
import '../models/squad_role.dart';
import 'role_selector.dart';

class MissionPage extends StatefulWidget {
  const MissionPage({super.key});
  @override
  State<MissionPage> createState() => _MissionPageState();
}

class _MissionPageState extends State<MissionPage> {
  final controller = IntroductionController();

  @override
  void dispose() {
    controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      toolbarHeight: MediaQuery.textScalerOf(context).scale(20) > 28 ? 104 : 64,
      title: const Text(AppStrings.meetYourSquad),
      leading: IconButton(
        tooltip: AppStrings.back,
        icon: const AppIcon(AppGlyph.arrowLeft),
        onPressed: () => Navigator.of(context).maybePop(),
      ),
    ),
    body: PageBody(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            AppStrings.missionHeadline,
            style: Theme.of(context).textTheme.headlineMedium,
          ),
          const SizedBox(height: AppTokens.spaceLg),
          const Text(
            AppStrings.exploreEachPerspectiveYourRealRole,
            style: TextStyle(color: AppColors.muted),
          ),
          const SizedBox(height: AppTokens.spaceXl),
          ListenableBuilder(
            listenable: controller,
            builder: (context, _) => Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                RoleSelector(
                  selected: controller.selectedRole,
                  onSelected: controller.selectRole,
                ),
                const SizedBox(height: AppTokens.spaceXl),
                SurfaceCard(
                  accent: true,
                  child: Semantics(
                    liveRegion: true,
                    child: AnimatedSwitcher(
                      duration: AppTokens.motionOf(context, AppTokens.short),
                      switchInCurve: AppTokens.enterCurve,
                      switchOutCurve: Curves.easeInCubic,
                      child: _RoleDetail(
                        key: ValueKey(controller.selectedRole),
                        role: controller.selectedRole,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: AppTokens.space2xl),
          Text(
            AppStrings.aboutTheMission,
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: AppTokens.spaceMd),
          const Text(
            AppStrings.theGatesAreOpenTheCrowd,
            style: TextStyle(color: AppColors.muted),
          ),
          const SizedBox(height: AppTokens.space2xl),
          Text(
            AppStrings.fromClueToComeback,
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: AppTokens.spaceXl),
          const _Step(
            number: AppStrings.briefStepNumber,
            title: AppStrings.readYourBrief,
            text: AppStrings.youSeeFactsYourTeammatesDont,
          ),
          const _Step(
            number: AppStrings.discussionStepNumber,
            title: AppStrings.talkItThrough,
            text: AppStrings.buildASharedPicturePrivateClues,
          ),
          const _Step(
            number: AppStrings.repairStepNumber,
            title: AppStrings.repairRunCompare,
            text: AppStrings.changeTheSystemTogetherAndTest,
          ),
          const Divider(),
          const SizedBox(height: AppTokens.spaceXl),
          const VoiceBetaCard(),
        ],
      ),
    ),
  );
}

class _RoleDetail extends StatelessWidget {
  const _RoleDetail({super.key, required this.role});
  final SquadRole role;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      AppIcon(switch (role) {
        SquadRole.traffic => AppGlyph.traffic,
        SquadRole.data => AppGlyph.data,
        SquadRole.operations => AppGlyph.operations,
      }, size: 40),
      const SizedBox(height: AppTokens.spaceXl),
      Text(role.heading, style: Theme.of(context).textTheme.headlineMedium),
      const SizedBox(height: AppTokens.spaceMd),
      Text(role.description),
    ],
  );
}

class _Step extends StatelessWidget {
  const _Step({required this.number, required this.title, required this.text});
  final String number;
  final String title;
  final String text;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: AppTokens.spaceXl),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        ExcludeSemantics(
          child: Text(
            number,
            style: Theme.of(context).textTheme.titleMedium
                ?.copyWith(color: AppColors.lime),
          ),
        ),
        const SizedBox(width: AppTokens.spaceLg),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: AppTokens.spaceXs),
              Text(text, style: const TextStyle(color: AppColors.muted)),
            ],
          ),
        ),
      ],
    ),
  );
}
