import { HttpStatus } from '@nestjs/common';
import { AppError } from './app-error';

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(HttpStatus.NOT_FOUND, message);
  }
}
