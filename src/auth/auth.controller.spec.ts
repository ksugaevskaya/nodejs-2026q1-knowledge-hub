import { describe, expect, it, vi } from 'vitest';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  it('should be defined', () => {
    const controller = new AuthController({
      signUp: vi.fn(),
      login: vi.fn(),
      refresh: vi.fn(),
      logout: vi.fn(),
    } as unknown as AuthService);

    expect(controller).toBeDefined();
  });
});
