import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { CachedAiResponse } from '../ai.types';

@Injectable()
export class AiCacheService {
  private readonly store = new Map<string, CachedAiResponse<unknown>>();
  private readonly ttlMs = this.resolveTtlMs();

  get<T>(key: string): T | undefined {
    const cached = this.store.get(key);

    if (!cached) {
      return undefined;
    }

    if (cached.expiresAt <= Date.now()) {
      this.store.delete(key);
      return undefined;
    }

    return cached.value as T;
  }

  set<T>(key: string, value: T): void {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  createKey(parts: unknown[]): string {
    return createHash('sha256').update(JSON.stringify(parts)).digest('hex');
  }

  private resolveTtlMs(): number {
    const ttlSec = Number.parseInt(process.env.AI_CACHE_TTL_SEC ?? '300', 10);
    const normalizedTtlSec =
      Number.isFinite(ttlSec) && ttlSec > 0 ? ttlSec : 300;

    return normalizedTtlSec * 1000;
  }
}
