import 'package:flutter/material.dart';

import '../core/constants/app_assets.dart';
import '../core/constants/app_strings.dart';
import '../core/theme/app_colors.g.dart';
import '../core/theme/app_tokens.dart';

/// A finite brand introduction, never a network-loading indicator.
class StartupGate extends StatefulWidget {
  const StartupGate({super.key, required this.child});
  final Widget child;

  @override
  State<StartupGate> createState() => _StartupGateState();
}

enum _StartupPhase { idle, animating, ready }

class _StartupGateState extends State<StartupGate>
    with SingleTickerProviderStateMixin {
  late final controller =
      AnimationController(vsync: this, duration: AppTokens.splash)
        ..addStatusListener((status) {
          if (status == AnimationStatus.completed) finish();
        });
  _StartupPhase phase = _StartupPhase.idle;

  void finish() {
    if (mounted && phase != _StartupPhase.ready) {
      controller.stop();
      setState(() => phase = _StartupPhase.ready);
    }
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (phase == _StartupPhase.ready) return;
    if (MediaQuery.disableAnimationsOf(context)) {
      // A preference change during startup also ends the intro immediately.
      controller.stop();
      WidgetsBinding.instance.addPostFrameCallback((_) => finish());
    } else if (phase == _StartupPhase.idle) {
      phase = _StartupPhase.animating;
      controller.forward();
    }
  }

  @override
  void dispose() {
    controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (phase == _StartupPhase.ready) return widget.child;
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(AppTokens.spaceXl),
          child: Column(
            children: [
              Expanded(
                child: Center(
                  child: SingleChildScrollView(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        AnimatedBuilder(
                          animation: controller,
                          child: Image.asset(
                            AppAssets.brandMark,
                            width: 112,
                            height: 112,
                            excludeFromSemantics: true,
                          ),
                          builder: (context, child) => Transform.scale(
                            scale:
                                0.88 +
                                0.12 *
                                    AppTokens.enterCurve.transform(
                                      controller.value,
                                    ),
                            child: child,
                          ),
                        ),
                        const SizedBox(height: AppTokens.spaceXl),
                        const Text(
                          AppStrings.appName,
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontFamily: AppTokens.fontBrand,
                            fontSize: 28,
                            height: 1.2,
                          ),
                        ),
                        const SizedBox(height: AppTokens.spaceMd),
                        const Text(
                          AppStrings.splashTagline,
                          textAlign: TextAlign.center,
                          style: TextStyle(color: AppColors.muted),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              TextButton(
                onPressed: finish,
                child: const Text(AppStrings.skipIntro),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
