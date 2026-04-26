import { LogLevel, LoggerService } from '@nestjs/common';
import { mkdirSync, renameSync, statSync, appendFileSync } from 'fs';
import { dirname, extname, join, basename } from 'path';
import { inspect } from 'util';

export type SupportedLogLevel = 'error' | 'warn' | 'log' | 'debug' | 'verbose';

type LoggerStream = {
  write: (chunk: string) => boolean;
};

type AppLoggerOptions = {
  environment: string;
  logLevels: LogLevel[];
  logFilePath: string;
  maxFileSizeKb: number;
  now?: () => Date;
  stdout?: LoggerStream;
  stderr?: LoggerStream;
};

type LogPayload = {
  timestamp: string;
  level: SupportedLogLevel;
  pid: number;
  context?: string;
  message: unknown;
  stack?: string;
  meta?: unknown[];
};

const LEVEL_PRIORITY: Record<SupportedLogLevel, number> = {
  error: 0,
  warn: 1,
  log: 2,
  debug: 3,
  verbose: 4,
};

const SUPPORTED_LEVELS = Object.keys(LEVEL_PRIORITY) as SupportedLogLevel[];

export function resolveLogLevels(level = process.env.LOG_LEVEL): LogLevel[] {
  const selectedLevel = SUPPORTED_LEVELS.includes(level as SupportedLogLevel)
    ? (level as SupportedLogLevel)
    : 'log';

  return SUPPORTED_LEVELS.filter(
    (candidate) => LEVEL_PRIORITY[candidate] <= LEVEL_PRIORITY[selectedLevel],
  ) as LogLevel[];
}

export function createAppLogger(): AppLogger {
  const maxFileSizeKb = Number.parseInt(
    process.env.LOG_MAX_FILE_SIZE ?? '1024',
    10,
  );

  return new AppLogger({
    environment: process.env.NODE_ENV ?? 'development',
    logLevels: resolveLogLevels(),
    logFilePath: join(process.cwd(), 'logs', 'app.log'),
    maxFileSizeKb:
      Number.isFinite(maxFileSizeKb) && maxFileSizeKb > 0
        ? maxFileSizeKb
        : 1024,
  });
}

export class AppLogger implements LoggerService {
  private readonly environment: string;
  private readonly logLevels: Set<LogLevel>;
  private readonly logFilePath: string;
  private readonly maxFileSizeBytes: number;
  private readonly now: () => Date;
  private readonly stdout: LoggerStream;
  private readonly stderr: LoggerStream;

  constructor(options: AppLoggerOptions) {
    this.environment = options.environment;
    this.logLevels = new Set(options.logLevels);
    this.logFilePath = options.logFilePath;
    this.maxFileSizeBytes = options.maxFileSizeKb * 1024;
    this.now = options.now ?? (() => new Date());
    this.stdout = options.stdout ?? process.stdout;
    this.stderr = options.stderr ?? process.stderr;
  }

  log(message: unknown, ...optionalParams: unknown[]): void {
    this.write('log', message, optionalParams);
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    const { context, meta, stack } = this.parseErrorParams(optionalParams);
    this.writeEntry('error', message, context, meta, stack);
  }

  warn(message: unknown, ...optionalParams: unknown[]): void {
    this.write('warn', message, optionalParams);
  }

  debug(message: unknown, ...optionalParams: unknown[]): void {
    this.write('debug', message, optionalParams);
  }

  verbose(message: unknown, ...optionalParams: unknown[]): void {
    this.write('verbose', message, optionalParams);
  }

  setLogLevels(levels: LogLevel[]): void {
    this.logLevels.clear();

    for (const level of levels) {
      this.logLevels.add(level);
    }
  }

  private write(
    level: SupportedLogLevel,
    message: unknown,
    optionalParams: unknown[],
  ): void {
    const { context, meta } = this.parseStandardParams(optionalParams);
    this.writeEntry(level, message, context, meta);
  }

  private writeEntry(
    level: SupportedLogLevel,
    message: unknown,
    context?: string,
    meta?: unknown[],
    stack?: string,
  ): void {
    if (!this.logLevels.has(level)) {
      return;
    }

    const payload: LogPayload = {
      timestamp: this.now().toISOString(),
      level,
      pid: process.pid,
      message,
    };

    if (context) {
      payload.context = context;
    }

    if (stack) {
      payload.stack = stack;
    }

    if (meta && meta.length > 0) {
      payload.meta = meta;
    }

    const line = this.format(payload);
    this.writeToStream(level, line);
    this.writeToFile(line);
  }

  private format(payload: LogPayload): string {
    if (this.environment === 'production') {
      return JSON.stringify(payload);
    }

    const parts = [
      payload.timestamp,
      payload.level.toUpperCase().padEnd(7, ' '),
      payload.context ? `[${payload.context}]` : '',
      this.stringifyForHumans(payload.message),
    ].filter(Boolean);

    const details = payload.meta?.length
      ? ` ${payload.meta.map((item) => this.stringifyForHumans(item)).join(' ')}`
      : '';
    const stack = payload.stack ? `\n${payload.stack}` : '';

    return `${parts.join(' ')}${details}${stack}`;
  }

  private stringifyForHumans(value: unknown): string {
    if (typeof value === 'string') {
      return value;
    }

    return inspect(value, {
      depth: 6,
      breakLength: Infinity,
      compact: true,
    });
  }

  private writeToStream(level: SupportedLogLevel, line: string): void {
    const stream =
      level === 'error' || level === 'warn' ? this.stderr : this.stdout;
    stream.write(`${line}\n`);
  }

  private writeToFile(line: string): void {
    mkdirSync(dirname(this.logFilePath), { recursive: true });

    const lineWithNewline = `${line}\n`;
    const nextSize =
      this.getCurrentFileSize() + Buffer.byteLength(lineWithNewline);

    if (nextSize > this.maxFileSizeBytes) {
      this.rotateLogFile();
    }

    appendFileSync(this.logFilePath, lineWithNewline, 'utf8');
  }

  private getCurrentFileSize(): number {
    try {
      return statSync(this.logFilePath).size;
    } catch {
      return 0;
    }
  }

  private rotateLogFile(): void {
    try {
      statSync(this.logFilePath);
    } catch {
      return;
    }

    const extension = extname(this.logFilePath);
    const fileName = basename(this.logFilePath, extension);
    const rotatedPath = join(
      dirname(this.logFilePath),
      `${fileName}-${this.buildRotationSuffix()}${extension}`,
    );

    renameSync(this.logFilePath, rotatedPath);
  }

  private buildRotationSuffix(): string {
    return this.now()
      .toISOString()
      .replace(/\.\d{3}Z$/, '')
      .replace(/:/g, '-');
  }

  private parseStandardParams(optionalParams: unknown[]): {
    context?: string;
    meta?: unknown[];
  } {
    if (optionalParams.length === 0) {
      return {};
    }

    const [firstParam, ...rest] = optionalParams;

    if (typeof firstParam === 'string') {
      return {
        context: firstParam,
        meta: rest,
      };
    }

    return {
      meta: optionalParams,
    };
  }

  private parseErrorParams(optionalParams: unknown[]): {
    context?: string;
    meta?: unknown[];
    stack?: string;
  } {
    if (optionalParams.length === 0) {
      return {};
    }

    if (
      optionalParams.length >= 2 &&
      typeof optionalParams[0] === 'string' &&
      typeof optionalParams[1] === 'string'
    ) {
      return {
        stack: optionalParams[0],
        context: optionalParams[1],
        meta: optionalParams.slice(2),
      };
    }

    if (typeof optionalParams[0] === 'string') {
      return {
        context: optionalParams[0],
        meta: optionalParams.slice(1),
      };
    }

    return {
      meta: optionalParams,
    };
  }
}
