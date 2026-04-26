import {
  CallHandler,
  ExecutionContext,
  Injectable,
  LoggerService,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { sanitizeLogData } from '../logging/sanitize-log-data';

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: LoggerService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const startedAt = Date.now();

    this.logger.log(
      {
        event: 'request',
        method: request.method,
        url: request.originalUrl ?? request.url,
        query: sanitizeLogData(request.query),
        body: sanitizeLogData(request.body),
      },
      RequestLoggingInterceptor.name,
    );

    return next.handle().pipe(
      finalize(() => {
        this.logger.log(
          {
            event: 'response',
            method: request.method,
            url: request.originalUrl ?? request.url,
            statusCode: response.statusCode,
            responseTimeMs: Date.now() - startedAt,
          },
          RequestLoggingInterceptor.name,
        );
      }),
    );
  }
}
