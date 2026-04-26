import {
  ArgumentsHost,
  BadRequestException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { HttpExceptionFilter } from './http-exception.filter';

describe('HttpExceptionFilter', () => {
  const createHost = () => {
    const json = vi.fn();
    const status = vi.fn().mockReturnValue({ json });

    return {
      status,
      json,
      host: {
        switchToHttp: () => ({
          getResponse: () => ({
            status,
          }),
        }),
      } as ArgumentsHost,
    };
  };

  it('normalizes standard Nest http exceptions', () => {
    const filter = new HttpExceptionFilter();
    const { host, status, json } = createHost();
    const exception = new BadRequestException('Invalid userId format');

    filter.catch(exception, host);

    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(json).toHaveBeenCalledWith({
      statusCode: HttpStatus.BAD_REQUEST,
      message: 'Invalid userId format',
      error: 'Bad Request',
    });
  });

  it('preserves string exception responses and fills the standard error label', () => {
    const filter = new HttpExceptionFilter();
    const { host, json } = createHost();
    const exception = new HttpException('Only a string body', HttpStatus.CONFLICT);

    filter.catch(exception, host);

    expect(json).toHaveBeenCalledWith({
      statusCode: HttpStatus.CONFLICT,
      message: 'Only a string body',
      error: 'Conflict',
    });
  });

  it('preserves custom object exception responses', () => {
    const filter = new HttpExceptionFilter();
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

  it('falls back to a 500 body for unknown errors', () => {
    const filter = new HttpExceptionFilter();
    const { host, status, json } = createHost();

    filter.catch(new Error('boom'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(json).toHaveBeenCalledWith({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      error: 'Internal Server Error',
    });
  });
});
