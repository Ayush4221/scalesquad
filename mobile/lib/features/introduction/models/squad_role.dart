import '../../../core/constants/app_strings.dart';

enum SquadRole {
  traffic(
    AppStrings.traffic,
    AppStrings.readTheSurge,
    AppStrings.understandIncomingDemandAndTheRetries,
  ),
  data(
    AppStrings.data,
    AppStrings.protectEveryPass,
    AppStrings.thinkAboutIdentityAndConsistencyOne,
  ),
  operations(
    AppStrings.operations,
    AppStrings.keepTheSystemMoving,
    AppStrings.balanceCapacityReliabilityAndBudgetA,
  );

  const SquadRole(this.label, this.heading, this.description);
  final String label;
  final String heading;
  final String description;
}
