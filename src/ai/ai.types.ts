export type SummaryMaxLength = 'short' | 'medium' | 'detailed';

export type AnalysisTask = 'review' | 'bugs' | 'optimize' | 'explain';

export type AnalysisSeverity = 'info' | 'warning' | 'error';

export type AiUsageSnapshot = {
  totalRequests: number;
  requestsByEndpoint: Record<string, number>;
  totalPromptTokens: number;
  totalCandidatesTokens: number;
  totalTokens: number;
  cache: {
    hits: number;
    misses: number;
    hitRatio: number;
  };
  retries: {
    total: number;
    byEndpoint: Record<string, number>;
  };
  upstreamFailures: {
    total: number;
    byEndpoint: Record<string, number>;
  };
  latency: {
    totalMs: number;
    averageMs: number;
    byEndpoint: Record<
      string,
      {
        totalMs: number;
        averageMs: number;
      }
    >;
  };
};

export type GeminiUsageMetadata = {
  promptTokens?: number;
  candidatesTokens?: number;
  totalTokens?: number;
};

export type AiRequestMetrics = {
  latencyMs?: number;
  cacheHit?: boolean;
  retryCount?: number;
  upstreamFailure?: boolean;
};

export type GeminiGenerateTextOptions = {
  cacheKey?: string;
  endpointName: string;
};

export type CachedAiResponse<T> = {
  value: T;
  expiresAt: number;
};

export type AiContextTurn = {
  prompt: string;
  response: string;
};
