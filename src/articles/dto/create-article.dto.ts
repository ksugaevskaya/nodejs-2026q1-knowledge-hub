import { IsString, IsOptional, IsUUID, IsArray, IsEnum } from 'class-validator';
import { ArticleStatus } from '../entities/article.entity';

export class CreateArticleDto {
  @IsString()
  title: string;

  @IsString()
  content: string;

  @IsEnum(ArticleStatus)
  status: ArticleStatus;

  @IsOptional()
  @IsUUID()
  authorId?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
