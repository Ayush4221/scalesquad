export const runtimePolicy = Object.freeze({
  maxActiveMatchesPerHost: 3,
  maxActiveMembershipsPerUser: 10,
  maxMatchesPerDay: 10,
  inactiveMatchMs: 30 * 60 * 1000,
  maintenanceBatch: 100,
  chatReconciliationRetryMs: 60000,
});
