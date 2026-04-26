import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { ParseUuidPipe } from './parse-uuid.pipe';

describe('ParseUuidPipe', () => {
  it('returns the original value for a valid uuid', () => {
    const pipe = new ParseUuidPipe();
    const value = '8cb04d24-5be9-4a1f-b557-9c4d79db5ad7';

    expect(pipe.transform(value)).toBe(value);
  });

  it('uses the default field name in the validation error', () => {
    const pipe = new ParseUuidPipe();

    expect(() => pipe.transform('bad-id')).toThrow(
      new BadRequestException('Invalid id format'),
    );
  });

  it('uses the custom field name in the validation error', () => {
    const pipe = new ParseUuidPipe('userId');

    expect(() => pipe.transform('bad-id')).toThrow(
      new BadRequestException('Invalid userId format'),
    );
  });
});
