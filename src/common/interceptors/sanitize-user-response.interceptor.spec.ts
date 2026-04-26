import { CallHandler, ExecutionContext } from '@nestjs/common';
import { of } from 'rxjs';
import { firstValueFrom } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { SanitizeUserResponseInterceptor } from './sanitize-user-response.interceptor';

describe('SanitizeUserResponseInterceptor', () => {
  const interceptor = new SanitizeUserResponseInterceptor();
  const context = {} as ExecutionContext;

  const runIntercept = (data: unknown) =>
    firstValueFrom(
      interceptor.intercept(context, {
        handle: () => of(data),
      } as CallHandler),
    );

  it('removes password fields from plain objects', async () => {
    await expect(
      runIntercept({
        id: '1',
        login: 'user',
        password: 'secret',
      }),
    ).resolves.toEqual({
      id: '1',
      login: 'user',
    });
  });

  it('removes password fields recursively from nested objects and arrays', async () => {
    await expect(
      runIntercept({
        password: 'top-secret',
        profile: {
          login: 'user',
          password: 'nested-secret',
        },
        members: [
          {
            id: '1',
            password: 'array-secret',
          },
          {
            id: '2',
            child: {
              password: 'deep-secret',
              keep: true,
            },
          },
        ],
      }),
    ).resolves.toEqual({
      profile: {
        login: 'user',
      },
      members: [
        {
          id: '1',
        },
        {
          id: '2',
          child: {
            keep: true,
          },
        },
      ],
    });
  });

  it('leaves primitives unchanged', async () => {
    await expect(runIntercept('plain string')).resolves.toBe('plain string');
    await expect(runIntercept(42)).resolves.toBe(42);
    await expect(runIntercept(null)).resolves.toBeNull();
  });

  it('preserves Date instances while sanitizing sibling fields', async () => {
    const createdAt = new Date('2026-04-01T10:00:00.000Z');

    await expect(
      runIntercept({
        createdAt,
        password: 'secret',
      }),
    ).resolves.toEqual({
      createdAt,
    });
  });
});
