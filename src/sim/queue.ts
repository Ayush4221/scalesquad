export function advanceQueue(
  backlog: number,
  arrivals: number,
  workers: number,
  maxBacklog: number,
) {
  const processed = Math.min(backlog + arrivals, Math.floor(workers));
  const waiting = Math.max(0, backlog + arrivals - processed);
  return {
    backlog: Math.min(waiting, maxBacklog),
    rejected: Math.max(0, waiting - maxBacklog),
    processed,
    waitSeconds: backlog / workers,
  };
}
