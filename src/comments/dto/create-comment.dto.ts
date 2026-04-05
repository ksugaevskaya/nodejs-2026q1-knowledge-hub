import { IsString, IsNotEmpty, IsUUID, IsOptional } from 'class-validator';

export class CreateCommentDto {
  @IsString()
  @IsNotEmpty()
  content: string;

  @IsUUID('4')
  articleId: string;

  @IsOptional()
  @IsUUID('4')
  authorId?: string | null;
}
