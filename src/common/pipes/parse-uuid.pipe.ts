import { Injectable, PipeTransform } from '@nestjs/common';
import { validate as isUuid } from 'uuid';
import { ValidationError } from '../errors';

@Injectable()
export class ParseUuidPipe implements PipeTransform<string, string> {
  constructor(private readonly fieldName = 'id') {}

  transform(value: string): string {
    if (!isUuid(value)) {
      throw new ValidationError(`Invalid ${this.fieldName} format`);
    }

    return value;
  }
}
