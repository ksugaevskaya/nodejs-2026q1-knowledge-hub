import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { UserRole } from '../entities/user.entity';

export class UpdatePasswordDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  oldPassword?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  newPassword?: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}
