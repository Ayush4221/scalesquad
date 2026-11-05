import { AppError } from '@scalesquad/shared';
export class RateLimiter {
  private readonly buckets = new Map<string, { tokens: number; updated: number }>();
  constructor(
    private readonly burst: number,
    private readonly refillPerSecond: number,
    private readonly now = () => Date.now(),
  ) {}
  take(key: string) {
    const now = this.now();
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
    if (this.buckets.size > 10000) this.cleanup();
  }
  cleanup() {
    const before = this.now() - Math.max(60000, (this.burst / this.refillPerSecond) * 1000);
    for (const [key, value] of this.buckets) if (value.updated < before) this.buckets.delete(key);
  }
  get size() {
    return this.buckets.size;
  }
}
