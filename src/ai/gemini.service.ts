import {
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  GeminiEmbedTextOptions,
  GeminiGenerateTextOptions,
  GeminiUsageMetadata,
} from './ai.types';
import { AiCacheService } from './internal/ai-cache.service';
import { AiUsageTrackerService } from './internal/ai-usage-tracker.service';

type GeminiGenerateTextResult = {
  text: string;
  usage?: GeminiUsageMetadata;
  cached: boolean;
};

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private readonly apiKey = process.env.GEMINI_API_KEY;
  private readonly baseUrl =
    process.env.GEMINI_API_BASE_URL ??
    'https://generativelanguage.googleapis.com';
  private readonly model = process.env.GEMINI_MODEL ?? 'gemini-flash-latest';
  private readonly embeddingModel =
    process.env.GEMINI_EMBEDDING_MODEL ?? 'text-embedding-004';
  private readonly requestTimeoutMs = 10_000;
  private readonly maxRateLimitRetries = 3;

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
      this.usageTracker.recordRequest(options.endpointName, cached.usage, {
        cacheHit: true,
        latencyMs: 0,
      });
      return {
        ...cached,
        cached: true,
      };
    }

    const startedAt = Date.now();
    let result: GeminiGenerateTextResult;
    let retryCount = 0;

    try {
      const geminiResult = await this.callGemini(prompt);
      result = geminiResult.result;
      retryCount = geminiResult.retryCount;
    } catch (error) {
      this.usageTracker.recordRequest(options.endpointName, undefined, {
        cacheHit: Boolean(options.cacheKey) ? false : undefined,
        retryCount,
        upstreamFailure: true,
        latencyMs: Date.now() - startedAt,
      });
      throw error;
    }

    this.usageTracker.recordRequest(options.endpointName, result.usage, {
      cacheHit: Boolean(options.cacheKey) ? false : undefined,
      retryCount,
      latencyMs: Date.now() - startedAt,
    });

    if (options.cacheKey) {
      this.cacheService.set(options.cacheKey, result);
    }

    return {
      ...result,
      cached: false,
    };
  }

  async embedText(
    text: string,
    options: GeminiEmbedTextOptions,
  ): Promise<number[]> {
    if (!this.apiKey) {
      throw new InternalServerErrorException('AI service is not configured');
    }

    const startedAt = Date.now();
    let retryCount = 0;

    try {
      const embeddingResult = await this.callGeminiEmbedding(text, options);
      retryCount = embeddingResult.retryCount;

      this.usageTracker.recordRequest(options.endpointName, undefined, {
        retryCount,
        upstreamFailure: false,
        latencyMs: Date.now() - startedAt,
      });

      return embeddingResult.embedding;
    } catch (error) {
      this.usageTracker.recordRequest(options.endpointName, undefined, {
        retryCount,
        upstreamFailure: true,
        latencyMs: Date.now() - startedAt,
      });
      throw error;
    }
  }

  private async callGemini(
    prompt: string,
  ): Promise<{ result: GeminiGenerateTextResult; retryCount: number }> {
    if (!this.apiKey) {
      throw new InternalServerErrorException('AI service is not configured');
    }

    let retryCount = 0;

    for (let attempt = 0; attempt <= this.maxRateLimitRetries; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        this.requestTimeoutMs,
      );

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
            signal: controller.signal,
          },
        );
      } catch (error) {
        clearTimeout(timeout);

        if (error instanceof Error && error.name === 'AbortError') {
          this.logger.error({
            event: 'gemini_request_timeout',
            baseUrl: this.baseUrl,
            model: this.model,
            timeoutMs: this.requestTimeoutMs,
          });
          throw new ServiceUnavailableException('AI request timed out');
        }

        this.logger.error(
          {
            event: 'gemini_request_failed',
            baseUrl: this.baseUrl,
            model: this.model,
            message:
              error instanceof Error ? error.message : 'Unknown fetch error',
          },
          error instanceof Error ? error.stack : undefined,
        );
        throw new ServiceUnavailableException('AI network request failed');
      } finally {
        clearTimeout(timeout);
      }

      if (!response.ok) {
        const responseText = await response.text();
        const bodyExcerpt = responseText.slice(0, 500);

        this.logger.warn({
          event: 'gemini_upstream_error',
          baseUrl: this.baseUrl,
          model: this.model,
          statusCode: response.status,
          bodyExcerpt,
          attempt: attempt + 1,
        });

        if (response.status === 401 || response.status === 403) {
          throw new InternalServerErrorException(
            'AI service authentication failed',
          );
        }

        if (response.status === 429) {
          if (attempt < this.maxRateLimitRetries) {
            retryCount += 1;
            await this.sleep(this.getBackoffDelayMs(attempt));
            continue;
          }

          throw new ServiceUnavailableException(
            'AI upstream rate limit exceeded',
          );
        }

        throw new ServiceUnavailableException(
          `AI upstream request failed with status ${response.status}`,
        );
      }

      const data = (await response.json()) as GeminiGenerateContentResponse;
      const text = this.extractText(data);

      if (!text) {
        throw new ServiceUnavailableException(
          'AI service returned an empty response',
        );
      }

      return {
        result: {
          text,
          usage: this.extractUsage(data),
          cached: false,
        },
        retryCount,
      };
    }

    throw new ServiceUnavailableException('AI upstream rate limit exceeded');
  }

  private async callGeminiEmbedding(
    text: string,
    options: GeminiEmbedTextOptions,
  ): Promise<{ embedding: number[]; retryCount: number }> {
    let retryCount = 0;

    for (let attempt = 0; attempt <= this.maxRateLimitRetries; attempt += 1) {
      const response = await this.performRequest(
        `${this.baseUrl}/v1beta/models/${this.embeddingModel}:embedContent?key=${this.apiKey}`,
        {
          model: `models/${this.embeddingModel}`,
          content: {
            parts: [
              {
                text,
              },
            ],
          },
          taskType: options.taskType ?? 'RETRIEVAL_DOCUMENT',
        },
        {
          event: 'gemini_embedding_request_failed',
          model: this.embeddingModel,
        },
      );

      if (!response.ok) {
        const shouldRetry = await this.handleErrorResponse(
          response,
          this.embeddingModel,
          attempt,
        );

        if (shouldRetry) {
          retryCount += 1;
          continue;
        }
      }

      const data = (await response.json()) as GeminiEmbedContentResponse;
      const embedding = data.embedding?.values;

      if (!embedding || embedding.length === 0) {
        throw new ServiceUnavailableException(
          'AI service returned an empty embedding',
        );
      }

      return {
        embedding,
        retryCount,
      };
    }

    throw new ServiceUnavailableException('AI upstream rate limit exceeded');
  }

  private async performRequest(
    url: string,
    body: object,
    context: {
      event: string;
      model: string;
    },
  ): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.requestTimeoutMs);

    try {
      return await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        this.logger.error({
          event: 'gemini_request_timeout',
          baseUrl: this.baseUrl,
          model: context.model,
          timeoutMs: this.requestTimeoutMs,
        });
        throw new ServiceUnavailableException('AI request timed out');
      }

      this.logger.error(
        {
          event: context.event,
          baseUrl: this.baseUrl,
          model: context.model,
          message:
            error instanceof Error ? error.message : 'Unknown fetch error',
        },
        error instanceof Error ? error.stack : undefined,
      );
      throw new ServiceUnavailableException('AI network request failed');
    } finally {
      clearTimeout(timeout);
    }
  }

  private async handleErrorResponse(
    response: Response,
    model: string,
    attempt: number,
  ): Promise<boolean> {
    const responseText = await response.text();
    const bodyExcerpt = responseText.slice(0, 500);

    this.logger.warn({
      event: 'gemini_upstream_error',
      baseUrl: this.baseUrl,
      model,
      statusCode: response.status,
      bodyExcerpt,
      attempt: attempt + 1,
    });

    if (response.status === 401 || response.status === 403) {
      throw new InternalServerErrorException(
        'AI service authentication failed',
      );
    }

    if (response.status === 429) {
      if (attempt < this.maxRateLimitRetries) {
        await this.sleep(this.getBackoffDelayMs(attempt));
        return true;
      }

      throw new ServiceUnavailableException('AI upstream rate limit exceeded');
    }

    throw new ServiceUnavailableException(
      `AI upstream request failed with status ${response.status}`,
    );
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

  private getBackoffDelayMs(attempt: number): number {
    return 500 * 2 ** attempt;
  }

  private async sleep(delayMs: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
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

type GeminiEmbedContentResponse = {
  embedding?: {
    values?: number[];
  };
};
