import { Injectable } from '@nestjs/common';

type RateLimitState = {
  windowStartedAt: number;
  requestCount: number;
};

export type AiRateLimitResult = {
  allowed: boolean;
  retryAfterSec: number;
  remaining: number;
};

@Injectable()
export class AiRateLimitService {
  private readonly requests = new Map<string, RateLimitState>();
  private readonly limitPerMinute = this.resolveLimitPerMinute();
  private readonly windowMs = 60_000;

  check(key: string): AiRateLimitResult {
    const now = Date.now();
    const current = this.requests.get(key);

    if (!current || now - current.windowStartedAt >= this.windowMs) {
      this.requests.set(key, {
        windowStartedAt: now,
        requestCount: 1,
      });

      return {
        allowed: true,
        retryAfterSec: 0,
        remaining: Math.max(this.limitPerMinute - 1, 0),
      };
    }

    if (current.requestCount >= this.limitPerMinute) {
      const retryAfterMs = current.windowStartedAt + this.windowMs - now;

      return {
        allowed: false,
        retryAfterSec: Math.max(Math.ceil(retryAfterMs / 1000), 1),
        remaining: 0,
      };
    }

    current.requestCount += 1;

    return {
      allowed: true,
      retryAfterSec: 0,
      remaining: Math.max(this.limitPerMinute - current.requestCount, 0),
    };
  }

  private resolveLimitPerMinute(): number {
    const parsed = Number.parseInt(process.env.AI_RATE_LIMIT_RPM ?? '20', 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 20;
  }
}
