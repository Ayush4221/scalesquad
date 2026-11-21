/** Bounds browser reads/optional cleanup; does not retry or cancel mutations. */
export function withDeadline<T>(work: Promise<T>, milliseconds: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Operation timed out')), milliseconds);
    work.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}
