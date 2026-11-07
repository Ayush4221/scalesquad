/** User-facing repair text. Keep wording out of rendering and transport code. */
export const repairStrings = {
  repairTheSystem: 'Repair the system',
  v: 'v',
  editor: 'Editor:',
  notAssigned: 'Not assigned',
  higherCapacityHandlesMoreRequestsAnd:
    'Higher capacity handles more requests and costs more credits.',
  writeCapacityLimitsHowManyCheck: 'Write capacity limits how many check-ins can be confirmed.',
  theSameKeyLetsTheServer:
    'The same key lets the server recognize a repeated request; a new identity starts a new attempt.',
  readCache: 'Read cache',
  cachedReadsCanBeFasterOnly:
    'Cached reads can be faster. Only the database can confirm admission.',
  oneIndivisibleCheckAndAcceptOperation: 'One indivisible check-and-accept operation.',
  simulationInProgressConfigurationIsLocked: 'Simulation in progress. Configuration is locked.',
  onlyTheActiveEditorCanChange:
    'Only the active editor can change the configuration during repair.',
  passControlTo: 'Pass control to',
  passControl: 'Pass control',
  reclaimControl: 'Reclaim control',
} as const;
