import { AppError } from '@scalesquad/shared';
export class RateLimiter {
  private readonly buckets = new Map<string, { tokens: number; updated: number }>();
  private nextCleanup = 0;
  constructor(
    private readonly burst: number,
    private readonly refillPerSecond: number,
    private readonly now = () => Date.now(),
    private readonly maxBuckets = 10000,
  ) {}
  take(key: string) {
    const now = this.now();
    if (!this.buckets.has(key) && this.buckets.size >= this.maxBuckets) {
      if (now >= this.nextCleanup) {
        this.cleanup();
        this.nextCleanup = now + 60000;
      }
      // Keep existing quotas intact. Evicting active buckets would let rotating
      // keys reset another client's limit; admitting them would grow memory forever.
      if (this.buckets.size >= this.maxBuckets)
        throw new AppError('RATE_LIMITED', 429, 'Try again later', { retryAfterSeconds: 60 });
    }
    const old = this.buckets.get(key) ?? { tokens: this.burst, updated: now };
    const tokens = Math.min(
      this.burst,
      old.tokens + (Math.max(0, now - old.updated) / 1000) * this.refillPerSecond,
    );
    this.buckets.set(key, { tokens: tokens < 1 ? tokens : tokens - 1, updated: now });
    if (tokens < 1) {
      const seconds = Math.ceil((1 - tokens) / this.refillPerSecond);
      throw new AppError('RATE_LIMITED', 429, `Try again in ${seconds} seconds`, {
        retryAfterSeconds: seconds,
      });
    }
  }
  cleanup() {
    const before = this.now() - Math.max(60000, (this.burst / this.refillPerSecond) * 1000);
    for (const [key, value] of this.buckets) if (value.updated <= before) this.buckets.delete(key);
  }
  get size() {
    return this.buckets.size;
  }
}
