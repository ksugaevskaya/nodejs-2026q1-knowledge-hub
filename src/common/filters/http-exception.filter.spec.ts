import {
  ArgumentsHost,
  BadRequestException,
  HttpException,
  HttpStatus,
  LoggerService,
} from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { ForbiddenError, NotFoundError } from '../errors';
import { HttpExceptionFilter } from './http-exception.filter';

describe('HttpExceptionFilter', () => {
  const createHost = () => {
    const json = vi.fn();
    const status = vi.fn().mockReturnValue({ json });
    const request = {
      method: 'GET',
      originalUrl: '/users/123',
      url: '/users/123',
    };

    return {
      status,
      json,
      request,
      host: {
        switchToHttp: () => ({
          getRequest: () => request,
          getResponse: () => ({
            status,
          }),
        }),
      } as ArgumentsHost,
    };
  };

  const createLogger = (): LoggerService & {
    error: ReturnType<typeof vi.fn>;
  } => ({
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    verbose: vi.fn(),
  });

  it('normalizes standard Nest http exceptions', () => {
    const logger = createLogger();
    const filter = new HttpExceptionFilter(logger);
    const { host, status, json } = createHost();
    const exception = new BadRequestException('Invalid userId format');

    filter.catch(exception, host);

    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(json).toHaveBeenCalledWith({
      statusCode: HttpStatus.BAD_REQUEST,
      message: 'Invalid userId format',
      error: 'Bad Request',
    });
    expect(logger.error).toHaveBeenCalledWith(
      {
        event: 'exception',
        method: 'GET',
        url: '/users/123',
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Invalid userId format',
      },
      expect.any(String),
      HttpExceptionFilter.name,
    );
  });

  it('preserves string exception responses and fills the standard error label', () => {
    const filter = new HttpExceptionFilter(createLogger());
    const { host, json } = createHost();
    const exception = new HttpException(
      'Only a string body',
      HttpStatus.CONFLICT,
    );

    filter.catch(exception, host);

    expect(json).toHaveBeenCalledWith({
      statusCode: HttpStatus.CONFLICT,
      message: 'Only a string body',
      error: 'Conflict',
    });
  });

  it('preserves custom object exception responses', () => {
    const filter = new HttpExceptionFilter(createLogger());
    const { host, json } = createHost();
    const exception = new HttpException(
      {
        statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        message: ['title must not be empty'],
        error: 'Validation failed',
      },
      HttpStatus.UNPROCESSABLE_ENTITY,
    );

    filter.catch(exception, host);

    expect(json).toHaveBeenCalledWith({
      statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
      message: ['title must not be empty'],
      error: 'Validation failed',
    });
  });

  it('returns the required 500 body for unknown errors and logs the stack', () => {
    const logger = createLogger();
    const filter = new HttpExceptionFilter(logger);
    const { host, status, json } = createHost();

    filter.catch(new Error('boom'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(json).toHaveBeenCalledWith({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'An unexpected error occurred',
      error: 'Internal Server Error',
    });
    expect(logger.error).toHaveBeenCalledWith(
      {
        event: 'exception',
        method: 'GET',
        url: '/users/123',
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'boom',
      },
      expect.any(String),
      HttpExceptionFilter.name,
    );
  });

  it('maps custom app errors to their declared status codes', () => {
    const filter = new HttpExceptionFilter(createLogger());
    const { host, status, json } = createHost();
    const exception = new ForbiddenError('Forbidden area');

    filter.catch(exception, host);

    expect(status).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
    expect(json).toHaveBeenCalledWith({
      statusCode: HttpStatus.FORBIDDEN,
      message: 'Forbidden area',
      error: 'Forbidden',
    });
  });

  it('maps custom not found errors to 404 responses', () => {
    const filter = new HttpExceptionFilter(createLogger());
    const { host, status, json } = createHost();

    filter.catch(new NotFoundError('Article not found'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(json).toHaveBeenCalledWith({
      statusCode: HttpStatus.NOT_FOUND,
      message: 'Article not found',
      error: 'Not Found',
    });
  });
});
