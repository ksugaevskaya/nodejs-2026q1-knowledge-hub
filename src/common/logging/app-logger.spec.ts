import { mkdtempSync, readFileSync, readdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { AppLogger, resolveLogLevels } from './app-logger';

describe('AppLogger', () => {
  it('resolves log thresholds from LOG_LEVEL values', () => {
    expect(resolveLogLevels('log')).toEqual(['error', 'warn', 'log']);
    expect(resolveLogLevels('debug')).toEqual([
      'error',
      'warn',
      'log',
      'debug',
    ]);
    expect(resolveLogLevels('verbose')).toEqual([
      'error',
      'warn',
      'log',
      'debug',
      'verbose',
    ]);
    expect(resolveLogLevels('invalid')).toEqual(['error', 'warn', 'log']);
  });

  it('writes structured json logs in production mode', () => {
    const logFilePath = createLogFilePath();
    const stdout = createMemoryStream();
    const logger = new AppLogger({
      environment: 'production',
      logLevels: ['error', 'warn', 'log', 'debug', 'verbose'],
      logFilePath,
      maxFileSizeKb: 1024,
      now: () => new Date('2026-04-26T10:00:00.000Z'),
      stdout,
      stderr: createMemoryStream(),
    });

    logger.log({ event: 'boot' }, 'Bootstrap');

    expect(stdout.output).toHaveLength(1);
    expect(JSON.parse(stdout.output[0])).toEqual({
      timestamp: '2026-04-26T10:00:00.000Z',
      level: 'log',
      pid: process.pid,
      context: 'Bootstrap',
      message: { event: 'boot' },
    });
  });

  it('rotates the log file once the configured size is exceeded', () => {
    const logDir = createTempDir();
    const logFilePath = join(logDir, 'app.log');
    const logger = new AppLogger({
      environment: 'development',
      logLevels: ['error', 'warn', 'log'],
      logFilePath,
      maxFileSizeKb: 1,
      now: () => new Date('2026-04-26T10:00:00.000Z'),
      stdout: createMemoryStream(),
      stderr: createMemoryStream(),
    });

    logger.log('x'.repeat(1200), 'RotationTest');
    logger.log('second entry', 'RotationTest');

    expect(readdirSync(logDir).sort()).toEqual([
      'app-2026-04-26T10-00-00.log',
      'app.log',
    ]);
    expect(readFileSync(logFilePath, 'utf8')).toContain('second entry');
  });
});

function createTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'knowledge-hub-logger-'));
  return dir;
}

function createLogFilePath(): string {
  return join(createTempDir(), 'app.log');
}

function createMemoryStream(): {
  output: string[];
  write: (chunk: string) => true;
} {
  const output: string[] = [];

  return {
    output,
    write: (chunk: string) => {
      output.push(chunk.trimEnd());
      return true;
    },
  };
}
