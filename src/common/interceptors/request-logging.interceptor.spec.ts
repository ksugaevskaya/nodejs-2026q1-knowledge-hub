import { CallHandler, ExecutionContext, LoggerService } from '@nestjs/common';
import { of, throwError, firstValueFrom } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { RequestLoggingInterceptor } from './request-logging.interceptor';

describe('RequestLoggingInterceptor', () => {
  it('logs incoming requests and outgoing responses with redaction', async () => {
    const logger = createLogger();
    const interceptor = new RequestLoggingInterceptor(logger);
    const context = createHttpContext({
      method: 'POST',
      originalUrl: '/auth/login?trace=true',
      url: '/auth/login?trace=true',
      query: { trace: 'true', accessToken: 'secret-token' },
      body: { login: 'user', password: 'secret' },
      statusCode: 201,
    });

    await firstValueFrom(
      interceptor.intercept(context, {
        handle: () => of({ ok: true }),
      } as CallHandler),
    );

    expect(logger.log).toHaveBeenCalledTimes(2);
    expect(logger.log).toHaveBeenNthCalledWith(
      1,
      {
        event: 'request',
        method: 'POST',
        url: '/auth/login?trace=true',
        query: { trace: 'true', accessToken: '[REDACTED]' },
        body: { login: 'user', password: '[REDACTED]' },
      },
      RequestLoggingInterceptor.name,
    );
    expect(logger.log).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        event: 'response',
        method: 'POST',
        url: '/auth/login?trace=true',
        statusCode: 201,
      }),
      RequestLoggingInterceptor.name,
    );
  });

  it('logs outgoing responses even when the request fails', async () => {
    const logger = createLogger();
    const interceptor = new RequestLoggingInterceptor(logger);
    const context = createHttpContext({
      method: 'GET',
      originalUrl: '/articles/1',
      url: '/articles/1',
      query: {},
      body: undefined,
      statusCode: 404,
    });

    await expect(
      firstValueFrom(
        interceptor.intercept(context, {
          handle: () => throwError(() => new Error('boom')),
        } as CallHandler),
      ),
    ).rejects.toThrow('boom');

    expect(logger.log).toHaveBeenCalledTimes(2);
    expect(logger.log).toHaveBeenLastCalledWith(
      expect.objectContaining({
        event: 'response',
        statusCode: 404,
      }),
      RequestLoggingInterceptor.name,
    );
  });
});

function createLogger(): LoggerService & {
  log: ReturnType<typeof vi.fn>;
} {
  return {
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    verbose: vi.fn(),
  };
}

function createHttpContext(requestResponse: {
  method: string;
  originalUrl: string;
  url: string;
  query: Record<string, unknown>;
  body: unknown;
  statusCode: number;
}): ExecutionContext {
  return {
    getType: () => 'http',
    switchToHttp: () => ({
      getRequest: () => ({
        method: requestResponse.method,
        originalUrl: requestResponse.originalUrl,
        url: requestResponse.url,
        query: requestResponse.query,
        body: requestResponse.body,
      }),
      getResponse: () => ({
        statusCode: requestResponse.statusCode,
      }),
    }),
  } as ExecutionContext;
}
