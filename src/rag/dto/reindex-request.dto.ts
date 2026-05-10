import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsOptional,
  IsUUID,
} from 'class-validator';

export class ReindexRequestDto {
  @IsOptional()
  @IsBoolean()
  onlyPublished?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  articleIds?: string[];
}
