import { ServiceUnavailableException } from '@nestjs/common';
import { AnalysisSeverity } from './ai.types';

type TranslateResponse = {
  translatedText?: unknown;
  detectedLanguage?: unknown;
};

type AnalyzeResponse = {
  analysis?: unknown;
  suggestions?: unknown;
  severity?: unknown;
};

export function validateTranslateResponse(response: TranslateResponse): {
  translatedText: string;
  detectedLanguage: string;
} {
  const translatedText = requireNonEmptyString(
    response.translatedText,
    'AI translation response is invalid',
  );
  const detectedLanguage = requireNonEmptyString(
    response.detectedLanguage,
    'AI translation response is invalid',
  );

  return {
    translatedText,
    detectedLanguage,
  };
}

export function validateAnalyzeResponse(response: AnalyzeResponse): {
  analysis: string;
  suggestions: string[];
  severity: AnalysisSeverity;
} {
  return {
    analysis: requireNonEmptyString(
      response.analysis,
      'AI analysis response is invalid',
    ),
    suggestions: requireStringArray(
      response.suggestions,
      'AI analysis response is invalid',
    ),
    severity: requireSeverity(
      response.severity,
      'AI analysis response is invalid',
    ),
  };
}

function requireNonEmptyString(value: unknown, message: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new ServiceUnavailableException(message);
  }

  return value.trim();
}

function requireStringArray(value: unknown, message: string): string[] {
  if (!Array.isArray(value)) {
    throw new ServiceUnavailableException(message);
  }

  const normalized = value.map((item) => {
    if (typeof item !== 'string' || !item.trim()) {
      throw new ServiceUnavailableException(message);
    }

    return item.trim();
  });

  return normalized;
}

function requireSeverity(value: unknown, message: string): AnalysisSeverity {
  if (value === 'info' || value === 'warning' || value === 'error') {
    return value;
  }

  throw new ServiceUnavailableException(message);
}
