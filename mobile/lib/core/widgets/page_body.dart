import 'package:flutter/material.dart';

import '../theme/app_tokens.dart';

/// One scrollable, safe, width-limited layout for every preview screen.
class PageBody extends StatelessWidget {
  const PageBody({super.key, required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) => SafeArea(
    child: SingleChildScrollView(
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: AppTokens.contentWidth),
          child: Padding(
            padding: const EdgeInsets.all(AppTokens.spaceXl),
            child: SizedBox(width: double.infinity, child: child),
          ),
        ),
      ),
    ),
  );
}
