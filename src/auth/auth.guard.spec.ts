import { UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthGuard } from './auth.guard';

describe('AuthGuard', () => {
  let guard: AuthGuard;

  const jwtServiceMock = {
    verifyAsync: vi.fn(),
  };

  const reflectorMock = {
    getAllAndOverride: vi.fn(),
  };

  const createContext = (authorization?: string) => {
    const request = {
      headers: authorization ? { authorization } : {},
    };

    return {
      request,
      context: {
        getHandler: vi.fn(),
        getClass: vi.fn(),
        switchToHttp: () => ({
          getRequest: () => request,
        }),
      },
    };
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    process.env.JWT_SECRET_KEY = 'access-secret';

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: JwtService,
          useValue: jwtServiceMock,
        },
        {
          provide: Reflector,
          useValue: reflectorMock,
        },
        {
          provide: AuthGuard,
          useFactory: (jwtService: JwtService, reflector: Reflector) =>
            new AuthGuard(jwtService, reflector),
          inject: [JwtService, Reflector],
        },
      ],
    }).compile();

    guard = module.get<AuthGuard>(AuthGuard);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('allows public routes without reading the authorization header', async () => {
    reflectorMock.getAllAndOverride.mockReturnValue(true);
    const { context, request } = createContext();

    await expect(guard.canActivate(context as never)).resolves.toBe(true);

    expect(jwtServiceMock.verifyAsync).not.toHaveBeenCalled();
    expect(request).not.toHaveProperty('user');
  });

  it('rejects non-public routes when the bearer token is missing', async () => {
    reflectorMock.getAllAndOverride.mockReturnValue(false);
    const { context } = createContext();

    await expect(guard.canActivate(context as never)).rejects.toThrow(
      UnauthorizedException,
    );

    expect(jwtServiceMock.verifyAsync).not.toHaveBeenCalled();
  });

  it('rejects non-bearer authorization headers', async () => {
    reflectorMock.getAllAndOverride.mockReturnValue(false);
    const { context } = createContext('Basic abc123');

    await expect(guard.canActivate(context as never)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('attaches the verified jwt payload to the request user and allows access', async () => {
    reflectorMock.getAllAndOverride.mockReturnValue(false);
    jwtServiceMock.verifyAsync.mockResolvedValue({
      userId: '8cb04d24-5be9-4a1f-b557-9c4d79db5ad7',
      login: 'editor',
      role: 'editor',
    });
    const { context, request } = createContext('Bearer token-value');

    await expect(guard.canActivate(context as never)).resolves.toBe(true);

    expect(jwtServiceMock.verifyAsync).toHaveBeenCalledWith('token-value', {
      secret: 'access-secret',
    });
    expect(request.user).toEqual({
      userId: '8cb04d24-5be9-4a1f-b557-9c4d79db5ad7',
      login: 'editor',
      role: 'editor',
    });
  });

  it('rejects invalid jwt payloads as unauthorized', async () => {
    reflectorMock.getAllAndOverride.mockReturnValue(false);
    jwtServiceMock.verifyAsync.mockRejectedValue(new Error('jwt malformed'));
    const { context } = createContext('Bearer token-value');

    await expect(guard.canActivate(context as never)).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
