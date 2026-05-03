import { Injectable } from '@nestjs/common';
import { AiUsageSnapshot, GeminiUsageMetadata } from '../ai.types';

@Injectable()
export class AiUsageTrackerService {
  private totalRequests = 0;
  private readonly requestsByEndpoint = new Map<string, number>();
  private totalPromptTokens = 0;
  private totalCandidatesTokens = 0;
  private totalTokens = 0;

  recordRequest(endpointName: string, usage?: GeminiUsageMetadata): void {
    this.totalRequests += 1;
    this.requestsByEndpoint.set(
      endpointName,
      (this.requestsByEndpoint.get(endpointName) ?? 0) + 1,
    );

    if (!usage) {
      return;
    }

    this.totalPromptTokens += usage.promptTokens ?? 0;
    this.totalCandidatesTokens += usage.candidatesTokens ?? 0;
    this.totalTokens += usage.totalTokens ?? 0;
  }

  snapshot(): AiUsageSnapshot {
    return {
      totalRequests: this.totalRequests,
      requestsByEndpoint: Object.fromEntries(this.requestsByEndpoint.entries()),
      totalPromptTokens: this.totalPromptTokens,
      totalCandidatesTokens: this.totalCandidatesTokens,
      totalTokens: this.totalTokens,
    };
  }
}
