export type SummaryMaxLength = 'short' | 'medium' | 'detailed';

export type AnalysisTask = 'review' | 'bugs' | 'optimize' | 'explain';

export type AnalysisSeverity = 'info' | 'warning' | 'error';

export type AiUsageSnapshot = {
  totalRequests: number;
  requestsByEndpoint: Record<string, number>;
  totalPromptTokens: number;
  totalCandidatesTokens: number;
  totalTokens: number;
};

export type GeminiUsageMetadata = {
  promptTokens?: number;
  candidatesTokens?: number;
  totalTokens?: number;
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
