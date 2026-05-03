import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { GeminiService } from './gemini.service';
import { AiCacheService } from './internal/ai-cache.service';
import { AiRateLimitService } from './internal/ai-rate-limit.service';
import { AiUsageTrackerService } from './internal/ai-usage-tracker.service';
import { ArticlesModule } from 'src/articles/articles.module';

@Module({
  imports: [ArticlesModule],
  controllers: [AiController],
  providers: [
    AiService,
    GeminiService,
    AiCacheService,
    AiRateLimitService,
    AiUsageTrackerService,
  ],
  exports: [AiService, GeminiService],
})
export class AiModule {}
