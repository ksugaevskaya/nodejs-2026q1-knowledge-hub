import { HttpStatus } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import {
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from './index';

describe('AppError types', () => {
  it('assigns a 404 status to NotFoundError', () => {
    const error = new NotFoundError('Category not found');

    expect(error).toBeInstanceOf(Error);
    expect(error.statusCode).toBe(HttpStatus.NOT_FOUND);
    expect(error.message).toBe('Category not found');
    expect(error.name).toBe('NotFoundError');
  });

  it('assigns a 400 status to ValidationError', () => {
    const error = new ValidationError('Invalid payload');

    expect(error.statusCode).toBe(HttpStatus.BAD_REQUEST);
    expect(error.message).toBe('Invalid payload');
  });

  it('assigns a 401 status to UnauthorizedError', () => {
    const error = new UnauthorizedError('Login required');

    expect(error.statusCode).toBe(HttpStatus.UNAUTHORIZED);
    expect(error.message).toBe('Login required');
  });

  it('assigns a 403 status to ForbiddenError', () => {
    const error = new ForbiddenError('Access denied');

    expect(error.statusCode).toBe(HttpStatus.FORBIDDEN);
    expect(error.message).toBe('Access denied');
  });
});
