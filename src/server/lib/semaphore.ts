import { AppError } from '@scalesquad/shared';
export class Semaphore {
  private active = 0;
  private readonly waiting: (() => void)[] = [];
  constructor(
    private readonly max = 2,
    private readonly maxWaiting = 16,
  ) {}
  async run<T>(task: () => Promise<T>): Promise<T> {
    if (this.active >= this.max) {
      if (this.waiting.length >= this.maxWaiting)
        throw new AppError('RATE_LIMITED', 429, 'Try again later');
      await new Promise<void>((resolve) => this.waiting.push(resolve));
    } else this.active++;
    try {
      return await task();
    } finally {
      const next = this.waiting.shift();
      if (next) next();
      else this.active--;
    }
  }
}
