import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.g.dart';
import '../../../core/widgets/app_icon.dart';
import '../../../core/widgets/surface_card.dart';
import '../../../core/widgets/voice_beta_card.dart';
import '../controllers/introduction_controller.dart';
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
      title: const Text('Meet your squad'),
      leading: IconButton(
        tooltip: 'Back',
        icon: const AppIcon(AppGlyph.arrowLeft),
        onPressed: () => Navigator.of(context).pop(),
      ),
    ),
    body: SafeArea(
      top: false,
      child: SingleChildScrollView(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 560),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(24, 20, 24, 32),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'THREE ROLES. ONE SHARED REPAIR.',
                    style: TextStyle(
                      color: AppColors.lime,
                      fontSize: 10,
                      letterSpacing: 1.4,
                    ),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    'Different clues.\nBetter decisions.',
                    style: Theme.of(context).textTheme.headlineMedium,
                  ),
                  const SizedBox(height: 12),
                  const Text(
                    'Explore each perspective. Your real role and private clues reveal when a match begins.',
                    style: TextStyle(color: AppColors.muted),
                  ),
                  const SizedBox(height: 24),
                  ListenableBuilder(
                    listenable: controller,
                    builder: (context, _) => Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        RoleSelector(
                          selected: controller.selectedRole,
                          onSelected: controller.selectRole,
                        ),
                        const SizedBox(height: 16),
                        SurfaceCard(
                          child: Semantics(
                            liveRegion: true,
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  controller.selectedRole.heading,
                                  style: Theme.of(context).textTheme.titleLarge,
                                ),
                                const SizedBox(height: 10),
                                Text(
                                  controller.selectedRole.description,
                                  style: const TextStyle(
                                    color: AppColors.muted,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 30),
                  Text(
                    'From clue to comeback.',
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  const SizedBox(height: 18),
                  const _Step(
                    number: '01',
                    title: 'Read your brief',
                    text: 'You see facts your teammates don’t. Find the detail that matters.',
                  ),
                  const _Step(
                    number: '02',
                    title: 'Talk it through',
                    text: 'Build a shared picture. Private clues enter chat only when you choose to share them.',
                  ),
                  const _Step(
                    number: '03',
                    title: 'Repair. Run. Compare.',
                    text: 'Change the system together and test your repair against the same incident.',
                  ),
                  const SizedBox(height: 8),
                  const SurfaceCard(child: VoiceBetaCard()),
                ],
              ),
            ),
          ),
        ),
      ),
    ),
  );
}

class _Step extends StatelessWidget {
  const _Step({required this.number, required this.title, required this.text});
  final String number;
  final String title;
  final String text;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 20),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        ExcludeSemantics(
          child: Text(
            number,
            style: const TextStyle(
              fontSize: 15,
              color: AppColors.lime,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
        const SizedBox(width: 16),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 4),
              Text(
                text,
                style: const TextStyle(color: AppColors.muted, fontSize: 13),
              ),
            ],
          ),
        ),
      ],
    ),
  );
}
