import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { AiService } from './ai.service';
import { SummarizeArticleDto } from './dto/summarize-article.dto';
import { TranslateArticleDto } from './dto/translate-article.dto';
import { AnalyzeArticleDto } from './dto/analyze-article.dto';
import { ParseUuidPipe } from 'src/common/pipes/parse-uuid.pipe';
import { AuthenticatedRequest } from 'src/auth/auth-user.interface';
import { Response } from 'express';
import { GenerateDto } from './dto/generate.dto';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Get('usage')
  @HttpCode(HttpStatus.OK)
  getUsage() {
    return this.aiService.getUsage();
  }

  @Post('articles/:articleId/summarize')
  @HttpCode(HttpStatus.OK)
  summarizeArticle(
    @Param('articleId', new ParseUuidPipe('articleId')) articleId: string,
    @Body() dto: SummarizeArticleDto,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.enforceRateLimit('summarizeArticle', request, response);
    return this.aiService.summarizeArticle(articleId, dto);
  }

  @Post('articles/:articleId/translate')
  @HttpCode(HttpStatus.OK)
  translateArticle(
    @Param('articleId', new ParseUuidPipe('articleId')) articleId: string,
    @Body() dto: TranslateArticleDto,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.enforceRateLimit('translateArticle', request, response);
    return this.aiService.translateArticle(articleId, dto);
  }

  @Post('articles/:articleId/analyze')
  @HttpCode(HttpStatus.OK)
  analyzeArticle(
    @Param('articleId', new ParseUuidPipe('articleId')) articleId: string,
    @Body() dto: AnalyzeArticleDto,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.enforceRateLimit('analyzeArticle', request, response);
    return this.aiService.analyzeArticle(articleId, dto);
  }

  @Post('generate')
  @HttpCode(HttpStatus.OK)
  generate(
    @Body() dto: GenerateDto,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.enforceRateLimit('generate', request, response);
    return this.aiService.generate(dto);
  }

  private enforceRateLimit(
    endpointName: string,
    request: AuthenticatedRequest,
    response: Response,
  ): void {
    const identity =
      request.user?.userId ?? request.headers.authorization ?? 'anonymous';
    const result = this.aiService.checkRateLimit(identity);

    if (!result.allowed) {
      response.setHeader('Retry-After', String(result.retryAfterSec));
      throw new HttpException(
        'AI rate limit exceeded',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    response.setHeader('X-RateLimit-Remaining', String(result.remaining));
    response.setHeader('X-AI-Endpoint', endpointName);
  }
}
