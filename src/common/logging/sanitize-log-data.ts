const REDACTED_VALUE = '[REDACTED]';
const SENSITIVE_KEY_PATTERN = /(password|token|authorization)/i;

export function sanitizeLogData(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeLogData(item));
  }

  if (!isPlainObject(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, nestedValue]) => [
      key,
      isSensitiveKey(key) ? REDACTED_VALUE : sanitizeLogData(nestedValue),
    ]),
  );
}

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERN.test(key);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    value !== null && typeof value === 'object' && !(value instanceof Date)
  );
}
