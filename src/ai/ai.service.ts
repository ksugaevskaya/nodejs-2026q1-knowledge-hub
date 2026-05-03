import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import {
  buildAnalyzeArticlePrompt,
  buildSummarizeArticlePrompt,
  buildTranslateArticlePrompt,
} from './prompts/article-prompts';
import { buildGenericGeneratePrompt } from './prompts/generic-prompts';
import { AnalyzeArticleDto } from './dto/analyze-article.dto';
import { SummarizeArticleDto } from './dto/summarize-article.dto';
import { TranslateArticleDto } from './dto/translate-article.dto';
import { GenerateDto } from './dto/generate.dto';
import { GeminiService } from './gemini.service';
import { AiCacheService } from './internal/ai-cache.service';
import { AiContextService } from './internal/ai-context.service';
import { AiRateLimitService } from './internal/ai-rate-limit.service';
import { AiUsageTrackerService } from './internal/ai-usage-tracker.service';
import { ArticlesService } from 'src/articles/articles.service';
import {
  validateAnalyzeResponse,
  validateTranslateResponse,
} from './response-validators';

type ArticleRecord = {
  id: string;
  title: string;
  content: string;
  updatedAt: number | Date;
};

@Injectable()
export class AiService {
  constructor(
    private readonly articlesService: ArticlesService,
    private readonly geminiService: GeminiService,
    private readonly cacheService: AiCacheService,
    private readonly contextService: AiContextService,
    private readonly rateLimitService: AiRateLimitService,
    private readonly usageTracker: AiUsageTrackerService,
  ) {}

  async summarizeArticle(articleId: string, dto: SummarizeArticleDto) {
    const article = await this.getArticle(articleId);
    const maxLength = dto.maxLength ?? 'medium';
    const prompt = buildSummarizeArticlePrompt(article, maxLength);
    const cacheKey = this.cacheService.createKey([
      'summarize',
      article.id,
      maxLength,
      this.normalizeUpdatedAt(article.updatedAt),
    ]);
    const result = await this.geminiService.generateText(prompt, {
      endpointName: 'summarizeArticle',
      cacheKey,
    });
    const summary = result.text.trim();

    return {
      articleId: article.id,
      summary,
      originalLength: article.content.length,
      summaryLength: summary.length,
    };
  }

  async translateArticle(articleId: string, dto: TranslateArticleDto) {
    const article = await this.getArticle(articleId);
    const prompt = buildTranslateArticlePrompt({
      ...article,
      sourceLanguage: dto.sourceLanguage,
      targetLanguage: dto.targetLanguage,
    });
    const cacheKey = this.cacheService.createKey([
      'translate',
      article.id,
      dto.targetLanguage,
      dto.sourceLanguage ?? null,
      this.normalizeUpdatedAt(article.updatedAt),
    ]);
    const result = await this.geminiService.generateText(prompt, {
      endpointName: 'translateArticle',
      cacheKey,
    });
    const parsed = this.parseJsonResponse<{
      translatedText?: string;
      detectedLanguage?: string;
    }>(result.text, 'translation');
    const validated = validateTranslateResponse(parsed);

    return {
      articleId: article.id,
      translatedText: validated.translatedText,
      detectedLanguage: validated.detectedLanguage,
    };
  }

  async analyzeArticle(articleId: string, dto: AnalyzeArticleDto) {
    const article = await this.getArticle(articleId);
    const task = dto.task ?? 'review';
    const prompt = buildAnalyzeArticlePrompt({
      ...article,
      task,
    });
    const result = await this.geminiService.generateText(prompt, {
      endpointName: 'analyzeArticle',
    });
    const parsed = this.parseJsonResponse<{
      analysis?: string;
      suggestions?: unknown;
      severity?: string;
    }>(result.text, 'analysis');
    const validated = validateAnalyzeResponse(parsed);

    return {
      articleId: article.id,
      analysis: validated.analysis,
      suggestions: validated.suggestions,
      severity: validated.severity,
    };
  }

  async generate(dto: GenerateDto) {
    const normalizedPrompt = dto.prompt.trim();
    const contextTurns = dto.sessionId
      ? this.contextService.getRecentContext(dto.sessionId)
      : [];
    const prompt = buildGenericGeneratePrompt({
      prompt: normalizedPrompt,
      sessionId: dto.sessionId,
      contextTurns,
    });
    const result = await this.geminiService.generateText(prompt, {
      endpointName: 'generate',
    });
    const text = result.text.trim();

    if (dto.sessionId) {
      this.contextService.appendTurn(dto.sessionId, {
        prompt: normalizedPrompt,
        response: text,
      });
    }

    return {
      text,
      sessionId: dto.sessionId ?? null,
    };
  }

  getUsage() {
    return this.usageTracker.snapshot();
  }

  checkRateLimit(key: string) {
    return this.rateLimitService.check(key);
  }

  private async getArticle(articleId: string): Promise<ArticleRecord> {
    const article = await this.articlesService.getOne(articleId);

    return {
      id: article.id,
      title: article.title,
      content: article.content,
      updatedAt: article.updatedAt,
    };
  }

  private normalizeUpdatedAt(updatedAt: number | Date): number {
    return updatedAt instanceof Date ? updatedAt.getTime() : updatedAt;
  }

  private parseJsonResponse<T>(value: string, context: string): T {
    const jsonCandidate = this.extractJsonObject(value.trim());

    try {
      return JSON.parse(jsonCandidate) as T;
    } catch {
      throw new ServiceUnavailableException(
        `AI ${context} response could not be parsed`,
      );
    }
  }

  private extractJsonObject(value: string): string {
    const fencedMatch = value.match(/```json\s*([\s\S]*?)```/i);

    if (fencedMatch) {
      return fencedMatch[1].trim();
    }

    const start = value.indexOf('{');
    const end = value.lastIndexOf('}');

    if (start !== -1 && end !== -1 && end > start) {
      return value.slice(start, end + 1);
    }

    return value;
  }
}
