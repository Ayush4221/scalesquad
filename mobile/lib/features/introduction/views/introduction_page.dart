import 'package:flutter/material.dart';

import '../../../app/router.dart';
import '../../../core/theme/app_colors.g.dart';
import '../../../core/widgets/app_icon.dart';
import '../../../core/widgets/brand_mark.dart';
import '../../../core/widgets/squad_button.dart';
import '../../../core/widgets/surface_card.dart';

class IntroductionPage extends StatelessWidget {
  const IntroductionPage({super.key});
  @override
  Widget build(BuildContext context) => Scaffold(
    body: SafeArea(
      child: SingleChildScrollView(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 560),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(24, 24, 24, 32),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Row(
                    children: [
                      Expanded(child: BrandMark()),
                      SizedBox(width: 12),
                      DecoratedBox(
                        decoration: BoxDecoration(
                          color: AppColors.raised,
                          borderRadius: BorderRadius.all(Radius.circular(6)),
                        ),
                        child: Padding(
                          padding: EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 6,
                          ),
                          child: Text(
                            'DEV',
                            style: TextStyle(fontSize: 10, letterSpacing: 1.5),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 44),
                  const Text(
                    'A COOPERATIVE SYSTEMS GAME',
                    style: TextStyle(
                      fontSize: 10,
                      color: AppColors.muted,
                      letterSpacing: 1.8,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 18),
                  Text.rich(
                    const TextSpan(
                      children: [
                        TextSpan(text: 'Same squad.\nNew incident.\n'),
                        TextSpan(
                          text: 'Your next move.',
                          style: TextStyle(color: AppColors.lime),
                        ),
                      ],
                    ),
                    style: Theme.of(context).textTheme.headlineLarge,
                  ),
                  const SizedBox(height: 20),
                  const Text(
                    'Three engineers. Different clues. One system to save.',
                    style: TextStyle(
                      fontSize: 18,
                      height: 1.5,
                      color: AppColors.muted,
                    ),
                  ),
                  const SizedBox(height: 28),
                  SquadButton(
                    label: 'Explore the mission',
                    onPressed: () =>
                        Navigator.of(context).pushNamed(AppRouter.mission),
                  ),
                  const SizedBox(height: 12),
                  const Text(
                    'Android preview · Account sign-in is coming next.',
                    style: TextStyle(fontSize: 11, color: AppColors.subtle),
                  ),
                  const SizedBox(height: 34),
                  const SurfaceCard(accent: true, child: _MissionPreview()),
                  const SizedBox(height: 28),
                  Text(
                    'Win by thinking together.',
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  const SizedBox(height: 16),
                  const _Feature(
                    glyph: AppGlyph.users,
                    title: 'Bring your squad',
                    description: 'Three roles make three perspectives. Every player has a part to play.',
                  ),
                  const _Feature(
                    glyph: AppGlyph.chat,
                    title: 'Connect the clues',
                    description: 'Trade what you know. A useful detail can change the whole plan.',
                  ),
                  const _Feature(
                    glyph: AppGlyph.shield,
                    title: 'Prove the repair',
                    description: 'Compare your fix against the same incident. Let the results do the talking.',
                  ),
                  const SizedBox(height: 12),
                  const Divider(),
                  const SizedBox(height: 12),
                  const Text(
                    'Built for squads who like asking “what if?”.',
                    style: TextStyle(color: AppColors.subtle, fontSize: 12),
                  ),
                ],
              ),
            ),
          ),
        ),
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
      const Text(
        'MISSION PREVIEW / 01',
        style: TextStyle(
          fontSize: 10,
          letterSpacing: 1.6,
          color: AppColors.lime,
        ),
      ),
      const SizedBox(height: 14),
      Text('CampusPass', style: Theme.of(context).textTheme.titleLarge),
      const SizedBox(height: 10),
      const Text(
        'The gates are open. The crowd is building. Can your squad keep every check-in correct?',
        style: TextStyle(color: AppColors.muted),
      ),
      const SizedBox(height: 24),
      const Wrap(
        spacing: 16,
        runSpacing: 12,
        children: [
          _Goal(glyph: AppGlyph.traffic, text: 'Handle the surge'),
          _Goal(glyph: AppGlyph.data, text: 'Protect each pass'),
          _Goal(glyph: AppGlyph.operations, text: 'Stay within budget'),
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
      AppIcon(glyph, color: AppColors.lime, size: 18),
      const SizedBox(width: 8),
      Flexible(child: Text(text, style: const TextStyle(fontSize: 12))),
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
    padding: const EdgeInsets.only(bottom: 20),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: AppColors.raised,
            borderRadius: BorderRadius.circular(12),
          ),
          child: AppIcon(glyph, color: AppColors.lime, size: 20),
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 4),
              Text(
                description,
                style: const TextStyle(color: AppColors.muted, fontSize: 13),
              ),
            ],
          ),
        ),
      ],
    ),
  );
}
