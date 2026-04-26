import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  LoggerService,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { STATUS_CODES } from 'http';

type ErrorBody = {
  statusCode: number;
  message: string | string[];
  error: string;
};

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: LoggerService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse<Response>();
    const request = http.getRequest<Request>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      this.logException(exception, status, request);
      response
        .status(status)
        .json(this.buildHttpExceptionBody(exception, status));
      return;
    }

    const status = this.resolveStatusCode(exception);
    const body =
      status === HttpStatus.INTERNAL_SERVER_ERROR
        ? this.buildInternalServerErrorBody()
        : this.buildCustomErrorBody(exception, status);

    this.logException(exception, status, request);
    response.status(status).json(body);
  }

  private buildHttpExceptionBody(
    exception: HttpException,
    status: number,
  ): ErrorBody {
    const exceptionResponse = exception.getResponse();

    if (typeof exceptionResponse === 'string') {
      return {
        statusCode: status,
        message: exceptionResponse,
        error: STATUS_CODES[status] ?? 'Error',
      };
    }

    const responseObject = exceptionResponse as Partial<ErrorBody>;

    return {
      statusCode: responseObject.statusCode ?? status,
      message: responseObject.message ?? exception.message,
      error: responseObject.error ?? STATUS_CODES[status] ?? 'Error',
    };
  }

  private buildCustomErrorBody(exception: unknown, status: number): ErrorBody {
    if (this.isErrorWithStatusCode(exception)) {
      return {
        statusCode: status,
        message: exception.message,
        error: STATUS_CODES[status] ?? 'Error',
      };
    }

    return this.buildInternalServerErrorBody();
  }

  private buildInternalServerErrorBody(): ErrorBody {
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'An unexpected error occurred',
      error:
        STATUS_CODES[HttpStatus.INTERNAL_SERVER_ERROR] ??
        'Internal Server Error',
    };
  }

  private resolveStatusCode(exception: unknown): number {
    if (this.isErrorWithStatusCode(exception)) {
      return exception.statusCode;
    }

    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private logException(
    exception: unknown,
    status: number,
    request: Request,
  ): void {
    const error = this.asError(exception);

    this.logger.error(
      {
        event: 'exception',
        method: request.method,
        url: request.originalUrl ?? request.url,
        statusCode: status,
        message: error.message,
      },
      error.stack,
      HttpExceptionFilter.name,
    );
  }

  private isErrorWithStatusCode(
    exception: unknown,
  ): exception is Error & { statusCode: number } {
    return (
      exception instanceof Error &&
      'statusCode' in exception &&
      typeof exception.statusCode === 'number'
    );
  }

  private asError(exception: unknown): Error {
    if (exception instanceof Error) {
      return exception;
    }

    const message =
      typeof exception === 'string'
        ? exception
        : 'Non-error value thrown during request processing';

    return new Error(message);
  }
}
