type GenericPromptInput = {
  prompt: string;
  sessionId?: string;
};

export function buildGenericGeneratePrompt(input: GenericPromptInput): string {
  return [
    'You are assisting a knowledge hub API.',
    'Respond to the user request below.',
    'Return plain text only.',
    input.sessionId ? `Session ID: ${input.sessionId}` : null,
    'User request:',
    input.prompt,
  ]
    .filter((part): part is string => Boolean(part))
    .join('\n\n');
}
