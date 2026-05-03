import { Injectable } from '@nestjs/common';
import {
  AiRequestMetrics,
  AiUsageSnapshot,
  GeminiUsageMetadata,
} from '../ai.types';

@Injectable()
export class AiUsageTrackerService {
  private totalRequests = 0;
  private readonly requestsByEndpoint = new Map<string, number>();
  private totalPromptTokens = 0;
  private totalCandidatesTokens = 0;
  private totalTokens = 0;
  private cacheHits = 0;
  private cacheMisses = 0;
  private totalRetries = 0;
  private totalUpstreamFailures = 0;
  private totalLatencyMs = 0;
  private readonly retriesByEndpoint = new Map<string, number>();
  private readonly upstreamFailuresByEndpoint = new Map<string, number>();
  private readonly latencyByEndpoint = new Map<string, number>();

  recordRequest(
    endpointName: string,
    usage?: GeminiUsageMetadata,
    metrics?: AiRequestMetrics,
  ): void {
    this.totalRequests += 1;
    this.requestsByEndpoint.set(
      endpointName,
      (this.requestsByEndpoint.get(endpointName) ?? 0) + 1,
    );
    this.recordMetrics(endpointName, metrics);

    if (usage) {
      this.totalPromptTokens += usage.promptTokens ?? 0;
      this.totalCandidatesTokens += usage.candidatesTokens ?? 0;
      this.totalTokens += usage.totalTokens ?? 0;
    }
  }

  snapshot(): AiUsageSnapshot {
    return {
      totalRequests: this.totalRequests,
      requestsByEndpoint: Object.fromEntries(this.requestsByEndpoint.entries()),
      totalPromptTokens: this.totalPromptTokens,
      totalCandidatesTokens: this.totalCandidatesTokens,
      totalTokens: this.totalTokens,
      cache: {
        hits: this.cacheHits,
        misses: this.cacheMisses,
        hitRatio: this.getCacheHitRatio(),
      },
      retries: {
        total: this.totalRetries,
        byEndpoint: Object.fromEntries(this.retriesByEndpoint.entries()),
      },
      upstreamFailures: {
        total: this.totalUpstreamFailures,
        byEndpoint: Object.fromEntries(this.upstreamFailuresByEndpoint.entries()),
      },
      latency: {
        totalMs: this.totalLatencyMs,
        averageMs: this.getAverageLatency(
          this.totalLatencyMs,
          this.totalRequests,
        ),
        byEndpoint: this.buildLatencySnapshot(),
      },
    };
  }

  private recordMetrics(
    endpointName: string,
    metrics?: AiRequestMetrics,
  ): void {
    if (!metrics) {
      return;
    }

    if (metrics.cacheHit === true) {
      this.cacheHits += 1;
    }

    if (metrics.cacheHit === false) {
      this.cacheMisses += 1;
    }

    if (metrics.retryCount && metrics.retryCount > 0) {
      this.totalRetries += metrics.retryCount;
      this.retriesByEndpoint.set(
        endpointName,
        (this.retriesByEndpoint.get(endpointName) ?? 0) + metrics.retryCount,
      );
    }

    if (metrics.upstreamFailure) {
      this.totalUpstreamFailures += 1;
      this.upstreamFailuresByEndpoint.set(
        endpointName,
        (this.upstreamFailuresByEndpoint.get(endpointName) ?? 0) + 1,
      );
    }

    if (metrics.latencyMs !== undefined && metrics.latencyMs >= 0) {
      this.totalLatencyMs += metrics.latencyMs;
      this.latencyByEndpoint.set(
        endpointName,
        (this.latencyByEndpoint.get(endpointName) ?? 0) + metrics.latencyMs,
      );
    }
  }

  private getCacheHitRatio(): number {
    const total = this.cacheHits + this.cacheMisses;

    if (total === 0) {
      return 0;
    }

    return this.cacheHits / total;
  }

  private buildLatencySnapshot(): Record<
    string,
    {
      totalMs: number;
      averageMs: number;
    }
  > {
    const snapshot: Record<
      string,
      {
        totalMs: number;
        averageMs: number;
      }
    > = {};

    for (const [endpointName, totalMs] of this.latencyByEndpoint.entries()) {
      const requestCount = this.requestsByEndpoint.get(endpointName) ?? 0;

      snapshot[endpointName] = {
        totalMs,
        averageMs: this.getAverageLatency(totalMs, requestCount),
      };
    }

    return snapshot;
  }

  private getAverageLatency(totalMs: number, requestCount: number): number {
    if (requestCount <= 0) {
      return 0;
    }

    return totalMs / requestCount;
  }
}
