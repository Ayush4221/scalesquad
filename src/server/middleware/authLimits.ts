import { createHash } from 'node:crypto';
import { EmailSchema } from '@scalesquad/shared';
import { RateLimiter } from '../utils/rateLimit';
const per = (capacity: number, seconds: number) => new RateLimiter(capacity, capacity / seconds);
export class AuthLimits {
  private readonly registerIp = per(5, 3600);
  private readonly registerEmail = per(3, 86400);
  private readonly loginIp = per(10, 900);
  private readonly loginPair = per(5, 900);
  private readonly change = per(5, 3600);
  take(route: string, ip: string, userId: string | null, body: unknown) {
    const input =
      body && typeof body === 'object' && 'email' in body
        ? EmailSchema.safeParse(body.email)
        : null;
    const email = createHash('sha256')
      .update(input?.success ? input.data : 'invalid')
      .digest('hex');
    switch (route) {
      case 'authRegister':
        this.registerIp.take(ip);
        this.registerEmail.take(email);
        break;
      case 'authLogin':
        this.loginIp.take(ip);
        this.loginPair.take(`${email}:${ip}`);
        break;
      case 'authChange':
        this.change.take(userId ?? ip);
        break;
    }
  }
}
