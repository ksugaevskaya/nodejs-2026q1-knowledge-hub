import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { AnalysisTask } from '../ai.types';

export class AnalyzeArticleDto {
  @ApiPropertyOptional({
    enum: ['review', 'bugs', 'optimize', 'explain'],
    default: 'review',
  })
  @IsOptional()
  @IsIn(['review', 'bugs', 'optimize', 'explain'])
  task?: AnalysisTask = 'review';
}
