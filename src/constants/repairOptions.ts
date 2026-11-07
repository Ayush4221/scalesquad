/** Friendly labels for public configuration controls; actual choices come from the scenario. */
export const repairOptionLabels: Readonly<Record<string, string>> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  NO_RETRY: 'No retry',
  RETRY_SAME_KEY: 'Retry once, same key',
  RETRY_NEW_IDENTITY: 'Retry once, new identity',
  OFF: 'Off',
  ON_READS_ONLY: 'Cache reads only',
};
