import { Injectable } from '@nestjs/common';
import {
  buildAnalyzeArticlePrompt,
  buildSummarizeArticlePrompt,
  buildTranslateArticlePrompt,
} from './prompts/article-prompts';
import { AnalyzeArticleDto } from './dto/analyze-article.dto';
import { SummarizeArticleDto } from './dto/summarize-article.dto';
import { TranslateArticleDto } from './dto/translate-article.dto';
import { GeminiService } from './gemini.service';
import { AiCacheService } from './internal/ai-cache.service';
import { AiRateLimitService } from './internal/ai-rate-limit.service';
import { AiUsageTrackerService } from './internal/ai-usage-tracker.service';

type ArticlePromptPayload = {
  articleId: string;
  title: string;
  content: string;
  updatedAt: number | Date;
};

@Injectable()
export class AiService {
  constructor(
    private readonly geminiService: GeminiService,
    private readonly cacheService: AiCacheService,
    private readonly rateLimitService: AiRateLimitService,
    private readonly usageTracker: AiUsageTrackerService,
  ) {}

  async summarizeArticle(
    article: ArticlePromptPayload,
    dto: SummarizeArticleDto,
  ) {
    const maxLength = dto.maxLength ?? 'medium';
    const prompt = buildSummarizeArticlePrompt(article, maxLength);
    const cacheKey = this.cacheService.createKey([
      'summarize',
      article.articleId,
      maxLength,
      this.normalizeUpdatedAt(article.updatedAt),
    ]);

    return this.geminiService.generateText(prompt, {
      endpointName: 'summarizeArticle',
      cacheKey,
    });
  }

  async translateArticle(
    article: ArticlePromptPayload,
    dto: TranslateArticleDto,
  ) {
    const prompt = buildTranslateArticlePrompt({
      ...article,
      sourceLanguage: dto.sourceLanguage,
      targetLanguage: dto.targetLanguage,
    });
    const cacheKey = this.cacheService.createKey([
      'translate',
      article.articleId,
      dto.targetLanguage,
      dto.sourceLanguage ?? null,
      this.normalizeUpdatedAt(article.updatedAt),
    ]);

    return this.geminiService.generateText(prompt, {
      endpointName: 'translateArticle',
      cacheKey,
    });
  }

  async analyzeArticle(article: ArticlePromptPayload, dto: AnalyzeArticleDto) {
    const task = dto.task ?? 'review';
    const prompt = buildAnalyzeArticlePrompt({
      ...article,
      task,
    });

    return this.geminiService.generateText(prompt, {
      endpointName: 'analyzeArticle',
    });
  }

  getUsageSnapshot() {
    return this.usageTracker.snapshot();
  }

  checkRateLimit(key: string) {
    return this.rateLimitService.check(key);
  }

  private normalizeUpdatedAt(updatedAt: number | Date): number {
    return updatedAt instanceof Date ? updatedAt.getTime() : updatedAt;
  }
}
