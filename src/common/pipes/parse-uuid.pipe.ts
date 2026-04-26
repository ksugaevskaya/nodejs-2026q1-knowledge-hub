import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { validate as isUuid } from 'uuid';

@Injectable()
export class ParseUuidPipe implements PipeTransform<string, string> {
  constructor(private readonly fieldName = 'id') {}

  transform(value: string): string {
    if (!isUuid(value)) {
      throw new BadRequestException(`Invalid ${this.fieldName} format`);
    }

    return value;
  }
}
