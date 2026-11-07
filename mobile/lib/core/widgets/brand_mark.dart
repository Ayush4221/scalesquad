import 'package:flutter/material.dart';

import '../constants/app_strings.dart';

import '../theme/app_colors.g.dart';

class BrandMark extends StatelessWidget {
  const BrandMark({super.key});
  @override
  Widget build(BuildContext context) => Semantics(
    label: AppStrings.appName,
    child: ExcludeSemantics(
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Image.asset('assets/brand/squad_link.png', width: 34, height: 34),
          const SizedBox(width: 10),
          const Flexible(
            child: Text.rich(
              TextSpan(
                children: [
                  TextSpan(text: AppStrings.scale),
                  TextSpan(
                    text: AppStrings.squad,
                    style: TextStyle(color: AppColors.lime),
                  ),
                ],
              ),
              style: TextStyle(fontFamily: 'Bungee', fontSize: 16),
            ),
          ),
        ],
      ),
    ),
  );
}
