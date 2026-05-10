import { IsOptional, IsString, MinLength } from 'class-validator';

export class RagChatRequestDto {
  @IsString()
  @MinLength(1)
  question: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  conversationId?: string;
}
