import { Controller, Post, Body, HttpStatus, HttpCode } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SignupDto } from './dto/signup';
import { LoginDto } from './dto/login';
import { RefreshDto } from './dto/refresh';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  signUp(@Body() data: SignupDto) {
    return this.authService.signUp(data);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() data: LoginDto) {
    return this.authService.login(data);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() data: RefreshDto) {
    return this.authService.refresh(data);
  }
}
