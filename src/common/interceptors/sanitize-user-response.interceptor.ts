import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class SanitizeUserResponseInterceptor implements NestInterceptor {
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    return next.handle().pipe(map((data) => this.stripPassword(data)));
  }

  private stripPassword(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.stripPassword(item));
    }

    if (!this.isPlainObject(value)) {
      return value;
    }

    const sanitizedEntries = Object.entries(value)
      .filter(([key]) => key !== 'password')
      .map(([key, nestedValue]) => [key, this.stripPassword(nestedValue)]);

    return Object.fromEntries(sanitizedEntries);
  }

  private isPlainObject(value: unknown): value is Record<string, unknown> {
    return (
      value !== null && typeof value === 'object' && !(value instanceof Date)
    );
  }
}
