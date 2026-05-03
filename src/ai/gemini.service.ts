import { Injectable } from '@nestjs/common';
import { GeminiGenerateTextOptions, GeminiUsageMetadata } from './ai.types';
import { AiCacheService } from './internal/ai-cache.service';
import { AiUsageTrackerService } from './internal/ai-usage-tracker.service';

type GeminiGenerateTextResult = {
  text: string;
  usage?: GeminiUsageMetadata;
  cached: boolean;
};

@Injectable()
export class GeminiService {
  constructor(
    private readonly cacheService: AiCacheService,
    private readonly usageTracker: AiUsageTrackerService,
  ) {}

  async generateText(
    prompt: string,
    options: GeminiGenerateTextOptions,
  ): Promise<GeminiGenerateTextResult> {
    const cached = options.cacheKey
      ? this.cacheService.get<GeminiGenerateTextResult>(options.cacheKey)
      : undefined;

    if (cached) {
      this.usageTracker.recordRequest(options.endpointName, cached.usage);
      return {
        ...cached,
        cached: true,
      };
    }

    const result = await this.callGemini(prompt);
    this.usageTracker.recordRequest(options.endpointName, result.usage);

    if (options.cacheKey) {
      this.cacheService.set(options.cacheKey, result);
    }

    return {
      ...result,
      cached: false,
    };
  }

  private async callGemini(prompt: string): Promise<GeminiGenerateTextResult> {
    void prompt;

    return {
      text: '',
      usage: undefined,
      cached: false,
    };
  }
}
