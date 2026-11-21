import 'package:flutter/material.dart';

import '../core/constants/app_strings.dart';
import '../core/theme/app_colors.g.dart';
import '../core/theme/app_tokens.dart';
import '../core/widgets/brand_mark.dart';
import '../core/widgets/page_body.dart';
import '../core/widgets/squad_button.dart';

class RecoveryPage extends StatelessWidget {
  const RecoveryPage({super.key, required this.onReturnHome});
  final VoidCallback onReturnHome;

  @override
  Widget build(BuildContext context) => Scaffold(
    body: PageBody(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const BrandMark(),
          const SizedBox(height: AppTokens.space3xl),
          Text(
            AppStrings.homeRecoveryTitle,
            style: Theme.of(context).textTheme.headlineMedium,
          ),
          const SizedBox(height: AppTokens.spaceLg),
          const Text(
            AppStrings.homeRecoveryDescription,
            style: TextStyle(color: AppColors.muted),
          ),
          const SizedBox(height: AppTokens.space2xl),
          SquadButton(label: AppStrings.returnHome, onPressed: onReturnHome),
        ],
      ),
    ),
  );
}
