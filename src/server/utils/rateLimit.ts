import { AppError } from '@scalesquad/shared';
import { createHmac, randomBytes } from 'node:crypto';
import { rateLimitIp } from './clientIp';
type Bucket = { tokens: number; updated: number };

// Only the validated local development environment bypasses request quotas.
// Missing/unknown environments keep enforcement, as do production and tests.
export const rateLimitsEnabled = () => process.env.NODE_ENV !== 'development';

export class RateLimiter {
  private readonly buckets = new Map<string, Bucket>();
  private readonly overflow = new Map<number, Bucket>();
  private readonly hashKey = randomBytes(32);
  private readonly overflowPartitions = 1024;
  private nextCleanup = 0;
  constructor(
    private readonly burst: number,
    private readonly refillPerSecond: number,
    private readonly now = () => Date.now(),
    private readonly maxBuckets = 10000,
  ) {}
  take(key: string) {
    if (!rateLimitsEnabled()) return;
    key = rateLimitIp(key);
    const now = this.now();
    let overflowKey: number | undefined;
    if (!this.buckets.has(key) && this.buckets.size >= this.maxBuckets) {
      if (now >= this.nextCleanup) {
        this.cleanup();
        this.nextCleanup = now + 60000;
      }
      // Keep active quotas intact. New keys share bounded, unpredictable
      // partitions instead of a single full-map denial affecting every visitor.
      if (this.buckets.size >= this.maxBuckets)
        overflowKey =
          createHmac('sha256', this.hashKey).update(key).digest().readUInt32BE(0) %
          this.overflowPartitions;
    }
    const old = (overflowKey === undefined
      ? this.buckets.get(key)
      : this.overflow.get(overflowKey)) ?? { tokens: this.burst, updated: now };
    const tokens = Math.min(
      this.burst,
      old.tokens + (Math.max(0, now - old.updated) / 1000) * this.refillPerSecond,
    );
    const bucket = { tokens: tokens < 1 ? tokens : tokens - 1, updated: now };
    if (overflowKey === undefined) this.buckets.set(key, bucket);
    else this.overflow.set(overflowKey, bucket);
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
    for (const [key, value] of this.overflow)
      if (value.updated <= before) this.overflow.delete(key);
  }
  get size() {
    return this.buckets.size + this.overflow.size;
  }
}
