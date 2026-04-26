import { describe, expect, it } from 'vitest';
import { sanitizeLogData } from './sanitize-log-data';

describe('sanitizeLogData', () => {
  it('redacts password and token fields recursively', () => {
    expect(
      sanitizeLogData({
        password: 'secret',
        accessToken: 'access-token',
        nested: {
          refreshToken: 'refresh-token',
          keep: true,
        },
        items: [
          {
            authorization: 'Bearer abc',
          },
        ],
      }),
    ).toEqual({
      password: '[REDACTED]',
      accessToken: '[REDACTED]',
      nested: {
        refreshToken: '[REDACTED]',
        keep: true,
      },
      items: [
        {
          authorization: '[REDACTED]',
        },
      ],
    });
  });

  it('preserves primitives and dates', () => {
    const date = new Date('2026-04-26T10:00:00.000Z');

    expect(sanitizeLogData('value')).toBe('value');
    expect(sanitizeLogData(5)).toBe(5);
    expect(sanitizeLogData(null)).toBeNull();
    expect(sanitizeLogData(date)).toBe(date);
  });
});
