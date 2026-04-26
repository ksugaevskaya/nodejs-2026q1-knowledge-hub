import { INestApplication, LoggerService } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { registerProcessErrorHandlers } from './process-error-handlers';

describe('registerProcessErrorHandlers', () => {
  const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));
  const originalExit = process.exit;

  afterEach(() => {
    process.exit = originalExit;
  });

  it('logs uncaught exceptions, closes the app, and exits with code 1', async () => {
    const logger = createLogger();
    const app = createApp();
    const processRef = createProcessRef();

    registerProcessErrorHandlers(app, logger, processRef);
    processRef.handlers.uncaughtException?.(new Error('boom'));
    await flushPromises();

    expect(logger.error).toHaveBeenCalledWith(
      {
        event: 'uncaughtException',
        message: 'boom',
      },
      expect.any(String),
      'ProcessErrorHandler',
    );
    expect(app.close).toHaveBeenCalledTimes(1);
    expect(processRef.exit).toHaveBeenCalledWith(1);
  });

  it('logs unhandled rejections, closes the app, and exits with code 1', async () => {
    const logger = createLogger();
    const app = createApp();
    const processRef = createProcessRef();

    registerProcessErrorHandlers(app, logger, processRef);
    processRef.handlers.unhandledRejection?.('token refresh failed');
    await flushPromises();

    expect(logger.error).toHaveBeenCalledWith(
      {
        event: 'unhandledRejection',
        message: 'Unhandled unhandledRejection: token refresh failed',
      },
      expect.any(String),
      'ProcessErrorHandler',
    );
    expect(app.close).toHaveBeenCalledTimes(1);
    expect(processRef.exit).toHaveBeenCalledWith(1);
  });

  it('avoids running shutdown more than once', async () => {
    const logger = createLogger();
    const app = createApp();
    const processRef = createProcessRef();

    registerProcessErrorHandlers(app, logger, processRef);
    processRef.handlers.uncaughtException?.(new Error('first'));
    processRef.handlers.unhandledRejection?.(new Error('second'));
    await flushPromises();

    expect(app.close).toHaveBeenCalledTimes(1);
    expect(processRef.exit).toHaveBeenCalledTimes(1);
  });
});

function createLogger(): LoggerService & {
  error: ReturnType<typeof vi.fn>;
} {
  return {
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    verbose: vi.fn(),
  };
}

function createApp(): INestApplication & {
  close: ReturnType<typeof vi.fn>;
} {
  return {
    close: vi.fn().mockResolvedValue(undefined),
  } as INestApplication & {
    close: ReturnType<typeof vi.fn>;
  };
}

function createProcessRef(): {
  exit: ReturnType<typeof vi.fn>;
  handlers: Partial<
    Record<
      'uncaughtException' | 'unhandledRejection',
      (...args: unknown[]) => void
    >
  >;
  on: (
    event: 'uncaughtException' | 'unhandledRejection',
    listener: (...args: unknown[]) => void,
  ) => void;
} {
  const handlers: Partial<
    Record<
      'uncaughtException' | 'unhandledRejection',
      (...args: unknown[]) => void
    >
  > = {};

  return {
    exit: vi.fn(),
    handlers,
    on: (event, listener) => {
      handlers[event] = listener;
    },
  };
}
