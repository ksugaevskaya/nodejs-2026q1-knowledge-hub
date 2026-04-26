import {
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from 'src/prisma/prisma.service';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service';
import { UserRole } from 'src/users/entities/user.entity';

vi.mock('bcrypt', () => ({
  hash: vi.fn(),
  compare: vi.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;

  const prismaMock = {
    user: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  };

  const jwtServiceMock = {
    signAsync: vi.fn(),
    verifyAsync: vi.fn(),
  };

  const baseUser: User = {
    id: '8cb04d24-5be9-4a1f-b557-9c4d79db5ad7',
    login: 'jane',
    password: 'hashed-password',
    role: UserRole.EDITOR,
    createdAt: new Date('2026-01-01T10:00:00.000Z'),
    updatedAt: new Date('2026-01-01T10:00:00.000Z'),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    process.env.JWT_SECRET_KEY = 'access-secret';
    process.env.JWT_SECRET_REFRESH_KEY = 'refresh-secret';
    process.env.TOKEN_EXPIRE_TIME = '15m';
    process.env.TOKEN_REFRESH_EXPIRE_TIME = '7d';

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
        {
          provide: JwtService,
          useValue: jwtServiceMock,
        },
        {
          provide: AuthService,
          useFactory: (prisma: PrismaService, jwtService: JwtService) =>
            new AuthService(prisma, jwtService),
          inject: [PrismaService, JwtService],
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateTokens', () => {
    it('signs both access and refresh tokens with the configured secrets', async () => {
      jwtServiceMock.signAsync
        .mockResolvedValueOnce('access-token')
        .mockResolvedValueOnce('refresh-token');

      await expect(service.generateTokens(baseUser)).resolves.toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });

      expect(jwtServiceMock.signAsync).toHaveBeenNthCalledWith(
        1,
        {
          userId: baseUser.id,
          login: baseUser.login,
          role: baseUser.role,
        },
        {
          secret: 'access-secret',
          expiresIn: '15m',
        },
      );
      expect(jwtServiceMock.signAsync).toHaveBeenNthCalledWith(
        2,
        {
          userId: baseUser.id,
          login: baseUser.login,
          role: baseUser.role,
        },
        {
          secret: 'refresh-secret',
          expiresIn: '7d',
        },
      );
    });
  });

  describe('signUp', () => {
    it('creates a viewer account with a hashed password', async () => {
      prismaMock.user.findFirst.mockResolvedValue(null);
      vi.mocked(bcrypt.hash).mockResolvedValue('secure-hash' as never);
      prismaMock.user.create.mockResolvedValue({
        id: baseUser.id,
        login: 'new-user',
        role: UserRole.VIEWER,
      });

      await expect(
        service.signUp({
          login: 'new-user',
          password: 'plain-password',
        }),
      ).resolves.toEqual({
        id: baseUser.id,
        login: 'new-user',
        role: UserRole.VIEWER,
      });

      expect(prismaMock.user.findFirst).toHaveBeenCalledWith({
        where: { login: 'new-user' },
      });
      expect(bcrypt.hash).toHaveBeenCalledWith('plain-password', 10);
      expect(prismaMock.user.create).toHaveBeenCalledWith({
        data: {
          login: 'new-user',
          password: 'secure-hash',
          role: UserRole.VIEWER,
        },
        select: {
          id: true,
          login: true,
          role: true,
        },
      });
    });

    it('rejects duplicate logins before hashing', async () => {
      prismaMock.user.findFirst.mockResolvedValue(baseUser);

      await expect(
        service.signUp({
          login: baseUser.login,
          password: 'plain-password',
        }),
      ).rejects.toThrow(new BadRequestException('Login is already taken'));

      expect(bcrypt.hash).not.toHaveBeenCalled();
      expect(prismaMock.user.create).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('returns a token pair when credentials are valid', async () => {
      prismaMock.user.findFirst.mockResolvedValue(baseUser);
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
      const generateTokensSpy = vi
        .spyOn(service, 'generateTokens')
        .mockResolvedValue({
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
        });

      await expect(
        service.login({
          login: baseUser.login,
          password: 'plain-password',
        }),
      ).resolves.toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });

      expect(bcrypt.compare).toHaveBeenCalledWith(
        'plain-password',
        baseUser.password,
      );
      expect(generateTokensSpy).toHaveBeenCalledWith(baseUser);
    });

    it('rejects unknown users', async () => {
      prismaMock.user.findFirst.mockResolvedValue(null);

      await expect(
        service.login({
          login: 'missing-user',
          password: 'plain-password',
        }),
      ).rejects.toThrow(new ForbiddenException('Invalid credentials'));

      expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    it('rejects invalid passwords', async () => {
      prismaMock.user.findFirst.mockResolvedValue(baseUser);
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

      await expect(
        service.login({
          login: baseUser.login,
          password: 'wrong-password',
        }),
      ).rejects.toThrow(new ForbiddenException('Invalid credentials'));
    });
  });

  describe('logout', () => {
    it('requires a refresh token', async () => {
      await expect(service.logout({})).rejects.toThrow(
        new UnauthorizedException('Refresh token is required'),
      );
    });

    it('verifies the token and completes without returning a body', async () => {
      jwtServiceMock.verifyAsync.mockResolvedValue({
        exp: Math.floor(Date.now() / 1000) + 60,
      });

      await expect(
        service.logout({ refreshToken: 'logout-token' }),
      ).resolves.toBeUndefined();

      expect(jwtServiceMock.verifyAsync).toHaveBeenCalledWith('logout-token', {
        secret: 'refresh-secret',
      });
    });

    it('rejects invalid refresh tokens', async () => {
      jwtServiceMock.verifyAsync.mockRejectedValue(new Error('invalid token'));

      await expect(
        service.logout({ refreshToken: 'bad-token' }),
      ).rejects.toThrow(
        new ForbiddenException('Invalid or expired refresh token'),
      );
    });
  });

  describe('refresh', () => {
    it('requires a refresh token', async () => {
      await expect(service.refresh({})).rejects.toThrow(
        new UnauthorizedException('Refresh token is required'),
      );
    });

    it('rejects tokens that were previously blacklisted by logout', async () => {
      const token = 'blacklisted-token';
      jwtServiceMock.verifyAsync.mockResolvedValueOnce({
        exp: Math.floor(Date.now() / 1000) + 60,
      });

      await service.logout({ refreshToken: token });

      await expect(service.refresh({ refreshToken: token })).rejects.toThrow(
        new ForbiddenException('Invalid or expired refresh token'),
      );

      expect(jwtServiceMock.verifyAsync).toHaveBeenCalledTimes(1);
    });

    it('returns a fresh token pair for a valid refresh token', async () => {
      jwtServiceMock.verifyAsync.mockResolvedValue({
        userId: baseUser.id,
      });
      prismaMock.user.findFirst.mockResolvedValue(baseUser);
      const generateTokensSpy = vi
        .spyOn(service, 'generateTokens')
        .mockResolvedValue({
          accessToken: 'new-access-token',
          refreshToken: 'new-refresh-token',
        });

      await expect(
        service.refresh({ refreshToken: 'refresh-token' }),
      ).resolves.toEqual({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      });

      expect(jwtServiceMock.verifyAsync).toHaveBeenCalledWith('refresh-token', {
        secret: 'refresh-secret',
      });
      expect(prismaMock.user.findFirst).toHaveBeenCalledWith({
        where: { id: baseUser.id },
      });
      expect(generateTokensSpy).toHaveBeenCalledWith(baseUser);
    });

    it('rejects refresh tokens for deleted users', async () => {
      jwtServiceMock.verifyAsync.mockResolvedValue({
        userId: baseUser.id,
      });
      prismaMock.user.findFirst.mockResolvedValue(null);

      await expect(
        service.refresh({ refreshToken: 'deleted-user-token' }),
      ).rejects.toThrow(
        new ForbiddenException('Invalid or expired refresh token'),
      );
    });

    it('rejects invalid refresh tokens', async () => {
      jwtServiceMock.verifyAsync.mockRejectedValue(new Error('jwt malformed'));

      await expect(
        service.refresh({ refreshToken: 'bad-token' }),
      ).rejects.toThrow(
        new ForbiddenException('Invalid or expired refresh token'),
      );
    });
  });
});
