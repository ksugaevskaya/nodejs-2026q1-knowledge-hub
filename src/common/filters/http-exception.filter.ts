import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { STATUS_CODES } from 'http';

type ErrorBody = {
  statusCode: number;
  message: string | string[];
  error: string;
};

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      response
        .status(status)
        .json(this.buildHttpExceptionBody(exception, status));
      return;
    }

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      error:
        STATUS_CODES[HttpStatus.INTERNAL_SERVER_ERROR] ??
        'Internal Server Error',
    });
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
}
