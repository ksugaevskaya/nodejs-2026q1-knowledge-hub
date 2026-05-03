import { AiContextTurn } from '../ai.types';

type GenericPromptInput = {
  prompt: string;
  sessionId?: string;
  contextTurns?: AiContextTurn[];
};

export function buildGenericGeneratePrompt(input: GenericPromptInput): string {
  const contextBlock =
    input.contextTurns && input.contextTurns.length > 0
      ? [
          'Recent conversation context:',
          ...input.contextTurns.flatMap((turn, index) => [
            `Turn ${index + 1} user: ${turn.prompt}`,
            `Turn ${index + 1} assistant: ${turn.response}`,
          ]),
        ].join('\n')
      : null;

  return [
    'You are assisting a knowledge hub API.',
    'Respond to the user request below.',
    'Return plain text only.',
    input.sessionId ? `Session ID: ${input.sessionId}` : null,
    contextBlock,
    'User request:',
    input.prompt,
  ]
    .filter((part): part is string => Boolean(part))
    .join('\n\n');
}
