import { IsOptional, IsString, MinLength } from 'class-validator';

export class GenerateDto {
  @IsString()
  @MinLength(1)
  prompt: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  sessionId?: string;
}
