import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { SignupDto } from './dto/signup';
import * as bcrypt from 'bcrypt';
import { UserRole } from 'src/users/entities/user.entity';
import { LoginDto } from './dto/login';
import { User } from '@prisma/client';
import { config } from 'dotenv';
import { JwtService } from '@nestjs/jwt';
import { RefreshDto } from './dto/refresh';
import { LogoutDto } from './dto/logout';
import { JwtPayload } from 'jsonwebtoken';

config();

const refreshTokenBlacklist = new Map<string, number>();

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async generateTokens(user: User) {
    const payload = {
      userId: user.id,
      login: user.login,
      role: user.role,
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: process.env.JWT_SECRET_KEY,
      expiresIn: process.env.TOKEN_EXPIRE_TIME,
    });

    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: process.env.JWT_SECRET_REFRESH_KEY,
      expiresIn: process.env.TOKEN_REFRESH_EXPIRE_TIME,
    });

    return {
      accessToken,
      refreshToken,
    };
  }

  async signUp(data: SignupDto) {
    const existingUser = await this.prisma.user.findFirst({
      where: {
        login: data.login,
      },
    });

    if (existingUser) {
      throw new BadRequestException('Login is already taken');
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);

    const user = await this.prisma.user.create({
      data: {
        login: data.login,
        password: hashedPassword,
        role: UserRole.VIEWER,
      },
      select: {
        id: true,
        login: true,
        role: true,
      },
    });

    return user;
  }

  async login(data: LoginDto) {
    const user = await this.prisma.user.findFirst({
      where: {
        login: data.login,
      },
    });

    if (!user) {
      throw new ForbiddenException('Invalid credentials');
    }

    const isPasswordMatched = await bcrypt.compare(
      data.password,
      user.password,
    );

    if (!isPasswordMatched) {
      throw new ForbiddenException('Invalid credentials');
    }

    return this.generateTokens(user);
  }

  async logout(data: LogoutDto) {
    if (!data.refreshToken) {
      throw new UnauthorizedException('Refresh token is required');
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(
        data.refreshToken,
        {
          secret: process.env.JWT_SECRET_REFRESH_KEY,
        },
      );

      if (payload.exp) {
        refreshTokenBlacklist.set(data.refreshToken, payload.exp * 1000);
      }
    } catch {
      throw new ForbiddenException('Invalid or expired refresh token');
    }
  }

  async refresh(data: RefreshDto) {
    if (!data.refreshToken) {
      throw new UnauthorizedException('Refresh token is required');
    }

    const blacklistedUntil = refreshTokenBlacklist.get(data.refreshToken);
    if (blacklistedUntil) {
      if (blacklistedUntil > Date.now()) {
        throw new ForbiddenException('Invalid or expired refresh token');
      }

      refreshTokenBlacklist.delete(data.refreshToken);
    }

    try {
      const payload = await this.jwtService.verifyAsync(data.refreshToken, {
        secret: process.env.JWT_SECRET_REFRESH_KEY,
      });

      const user = await this.prisma.user.findFirst({
        where: { id: payload.userId },
      });

      if (!user) {
        throw new ForbiddenException('Invalid refresh token');
      }

      return this.generateTokens(user);
    } catch {
      throw new ForbiddenException('Invalid or expired refresh token');
    }
  }
}
