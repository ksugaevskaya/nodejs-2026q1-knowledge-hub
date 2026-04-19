import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { UserRole } from 'src/users/entities/user.entity';

export class SignupDto {
  @IsString()
  login: string;

  @IsString()
  @MinLength(1)
  password: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}
