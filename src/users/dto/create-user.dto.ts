import { IsString, IsEnum, MinLength, IsOptional } from 'class-validator';
import { UserRole } from '../entities/user.entity';

export class CreateUserDto {
  @IsString()
  login: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}
