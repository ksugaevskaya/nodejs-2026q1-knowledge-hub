import {
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UserRole } from 'src/users/entities/user.entity';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  let guard: RolesGuard;

  const reflectorMock = {
    getAllAndOverride: vi.fn(),
  };

  const createContext = (user?: { role: UserRole }) => ({
    getHandler: vi.fn(),
    getClass: vi.fn(),
    switchToHttp: () => ({
      getRequest: () => ({
        user,
      }),
    }),
  });

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: Reflector,
          useValue: reflectorMock,
        },
        {
          provide: RolesGuard,
          useFactory: (reflector: Reflector) => new RolesGuard(reflector),
          inject: [Reflector],
        },
      ],
    }).compile();

    guard = module.get<RolesGuard>(RolesGuard);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('allows access when no roles metadata is defined', () => {
    reflectorMock.getAllAndOverride.mockReturnValue(undefined);

    expect(guard.canActivate(createContext() as never)).toBe(true);
  });

  it('rejects requests without an authenticated user when roles are required', () => {
    reflectorMock.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);

    expect(() => guard.canActivate(createContext() as never)).toThrow(
      UnauthorizedException,
    );
  });

  it('rejects users whose role is not included in the allowed roles', () => {
    reflectorMock.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);

    expect(() =>
      guard.canActivate(createContext({ role: UserRole.EDITOR }) as never),
    ).toThrow(new ForbiddenException('Access denied'));
  });

  it('allows users whose role matches the required metadata', () => {
    reflectorMock.getAllAndOverride.mockReturnValue([
      UserRole.ADMIN,
      UserRole.EDITOR,
    ]);

    expect(
      guard.canActivate(createContext({ role: UserRole.EDITOR }) as never),
    ).toBe(true);
  });
});
