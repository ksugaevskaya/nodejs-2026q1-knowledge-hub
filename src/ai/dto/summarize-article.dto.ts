import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { SummaryMaxLength } from '../ai.types';

export class SummarizeArticleDto {
  @ApiPropertyOptional({
    enum: ['short', 'medium', 'detailed'],
    default: 'medium',
  })
  @IsOptional()
  @IsIn(['short', 'medium', 'detailed'])
  maxLength?: SummaryMaxLength = 'medium';
}
