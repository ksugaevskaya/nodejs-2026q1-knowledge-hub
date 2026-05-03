import {
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
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
  private readonly apiKey = process.env.GEMINI_API_KEY;
  private readonly baseUrl =
    process.env.GEMINI_API_BASE_URL ??
    'https://generativelanguage.googleapis.com';
  private readonly model = process.env.GEMINI_MODEL ?? 'gemini-2.0-flash';

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
    if (!this.apiKey) {
      throw new InternalServerErrorException('AI service is not configured');
    }

    let response: Response;

    try {
      response = await fetch(
        `${this.baseUrl}/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: prompt,
                  },
                ],
              },
            ],
          }),
        },
      );
    } catch {
      throw new ServiceUnavailableException('AI service is unavailable');
    }

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new InternalServerErrorException(
          'AI service authentication failed',
        );
      }

      throw new ServiceUnavailableException('AI service is unavailable');
    }

    const data = (await response.json()) as GeminiGenerateContentResponse;
    const text = this.extractText(data);

    if (!text) {
      throw new ServiceUnavailableException(
        'AI service returned an empty response',
      );
    }

    return {
      text,
      usage: this.extractUsage(data),
      cached: false,
    };
  }

  private extractText(response: GeminiGenerateContentResponse): string {
    const parts =
      response.candidates?.flatMap(
        (candidate) =>
          candidate.content?.parts?.map((part) => part.text ?? '') ?? [],
      ) ?? [];

    return parts.join('\n').trim();
  }

  private extractUsage(
    response: GeminiGenerateContentResponse,
  ): GeminiUsageMetadata | undefined {
    if (!response.usageMetadata) {
      return undefined;
    }

    return {
      promptTokens: response.usageMetadata.promptTokenCount,
      candidatesTokens: response.usageMetadata.candidatesTokenCount,
      totalTokens: response.usageMetadata.totalTokenCount,
    };
  }
}

type GeminiGenerateContentResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
};
