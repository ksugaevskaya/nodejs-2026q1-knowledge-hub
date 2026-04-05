import { IsOptional, IsString, IsUUID, IsArray, IsEnum } from 'class-validator';
import { ArticleStatus } from '../entities/article.entity';

export class UpdateArticleDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsEnum(ArticleStatus)
  status?: ArticleStatus;

  @IsOptional()
  @IsUUID('4')
  categoryId?: string | null;

  @IsOptional()
  @IsUUID('4')
  authorId?: string | null;

  @IsOptional()
  @IsArray()
  tags?: string[];
}
