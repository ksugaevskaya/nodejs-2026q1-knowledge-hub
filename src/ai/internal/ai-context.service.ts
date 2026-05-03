import { Injectable } from '@nestjs/common';
import { AiContextTurn } from '../ai.types';

@Injectable()
export class AiContextService {
  private readonly maxTurnsPerSession = 10;
  private readonly sessions = new Map<string, AiContextTurn[]>();

  getRecentContext(sessionId: string): AiContextTurn[] {
    const turns = this.sessions.get(sessionId) ?? [];
    return turns.map((turn) => ({ ...turn }));
  }

  appendTurn(sessionId: string, turn: AiContextTurn): void {
    const turns = this.sessions.get(sessionId) ?? [];
    const nextTurns = [...turns, turn].slice(-this.maxTurnsPerSession);

    this.sessions.set(sessionId, nextTurns);
  }

  clearSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }
}
