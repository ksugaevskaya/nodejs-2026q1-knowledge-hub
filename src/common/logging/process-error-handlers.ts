import { INestApplication, LoggerService } from '@nestjs/common';
import { inspect } from 'util';

type ProcessEventName = 'uncaughtException' | 'unhandledRejection';

type ProcessLike = {
  exit: (code: number) => never | void;
  on: (
    event: ProcessEventName,
    listener: (...args: unknown[]) => void,
  ) => unknown;
};

export function registerProcessErrorHandlers(
  app: INestApplication,
  logger: LoggerService,
  processRef: ProcessLike = process,
): void {
  let isShuttingDown = false;

  const shutdownFromError = async (
    event: ProcessEventName,
    reason: unknown,
  ): Promise<void> => {
    if (isShuttingDown) {
      return;
    }

    isShuttingDown = true;
    const error = toError(reason, event);

    logger.error(
      {
        event,
        message: error.message,
      },
      error.stack,
      'ProcessErrorHandler',
    );

    try {
      await app.close();
    } catch (shutdownError) {
      const closeError = toError(shutdownError, 'shutdown');

      logger.error(
        {
          event: 'shutdownFailure',
          message: closeError.message,
        },
        closeError.stack,
        'ProcessErrorHandler',
      );
    } finally {
      processRef.exit(1);
    }
  };

  processRef.on('uncaughtException', (error) => {
    void shutdownFromError('uncaughtException', error);
  });

  processRef.on('unhandledRejection', (reason) => {
    void shutdownFromError('unhandledRejection', reason);
  });
}

function toError(reason: unknown, source: string): Error {
  if (reason instanceof Error) {
    return reason;
  }

  const formattedReason =
    typeof reason === 'string' ? reason : inspect(reason, { depth: 5 });

  return new Error(`Unhandled ${source}: ${formattedReason}`);
}
