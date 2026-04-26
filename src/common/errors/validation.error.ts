import { HttpStatus } from '@nestjs/common';
import { AppError } from './app-error';

export class ValidationError extends AppError {
  constructor(message = 'Validation failed') {
    super(HttpStatus.BAD_REQUEST, message);
  }
}
