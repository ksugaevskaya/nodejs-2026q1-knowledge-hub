import { AnalysisTask, SummaryMaxLength } from '../ai.types';

type ArticlePromptInput = {
  title: string;
  content: string;
};

type TranslatePromptInput = ArticlePromptInput & {
  targetLanguage: string;
  sourceLanguage?: string;
};

type AnalyzePromptInput = ArticlePromptInput & {
  task: AnalysisTask;
};

const SUMMARY_LENGTH_INSTRUCTIONS: Record<SummaryMaxLength, string> = {
  short: 'Keep the summary concise and limited to 2-3 sentences.',
  medium: 'Write a balanced summary in 1 short paragraph.',
  detailed:
    'Write a detailed summary in 2-3 paragraphs while staying focused on the core ideas.',
};

const ANALYSIS_TASK_INSTRUCTIONS: Record<AnalysisTask, string> = {
  review:
    'Provide an overall review of the article content with strengths, concerns, and actionable suggestions.',
  bugs: 'Focus on factual inconsistencies, ambiguous claims, contradictions, and possible mistakes.',
  optimize:
    'Focus on clarity, structure, readability, and ways to make the content more effective.',
  explain:
    'Explain the article content clearly for a reader who needs help understanding the topic.',
};

export function buildSummarizeArticlePrompt(
  input: ArticlePromptInput,
  maxLength: SummaryMaxLength,
): string {
  return [
    'You are assisting a knowledge hub API.',
    'Summarize the following article.',
    SUMMARY_LENGTH_INSTRUCTIONS[maxLength],
    'Return plain text only.',
    `Title: ${input.title}`,
    'Content:',
    input.content,
  ].join('\n\n');
}

export function buildTranslateArticlePrompt(
  input: TranslatePromptInput,
): string {
  return [
    'You are assisting a knowledge hub API.',
    `Translate the following article into ${input.targetLanguage}.`,
    input.sourceLanguage
      ? `The source language is ${input.sourceLanguage}.`
      : 'Detect the source language before translating.',
    'Return only the translated text.',
    `Title: ${input.title}`,
    'Content:',
    input.content,
  ].join('\n\n');
}

export function buildAnalyzeArticlePrompt(input: AnalyzePromptInput): string {
  return [
    'You are assisting a knowledge hub API.',
    ANALYSIS_TASK_INSTRUCTIONS[input.task],
    'Return a JSON object with keys: analysis, suggestions, severity.',
    'The severity value must be one of: info, warning, error.',
    'The suggestions value must be an array of short strings.',
    `Title: ${input.title}`,
    'Content:',
    input.content,
  ].join('\n\n');
}
