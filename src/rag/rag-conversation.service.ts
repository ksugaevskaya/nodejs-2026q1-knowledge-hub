import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { RagMessageRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type RagConversationMessageRecord = {
  role: RagMessageRole;
  content: string;
  createdAt: Date;
};

@Injectable()
export class RagConversationService {
  private readonly maxMessages = this.readPositiveIntegerEnv(
    'RAG_CONVERSATION_MAX_MESSAGES',
    20,
  );

  constructor(private readonly prisma: PrismaService) {}

  async getRecentMessages(
    conversationId: string,
  ): Promise<RagConversationMessageRecord[]> {
    const messages = await this.prisma.ragConversationMessage.findMany({
      where: {
        conversationId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: this.maxMessages,
    });

    return messages.reverse();
  }

  async appendMessage(
    conversationId: string,
    role: RagMessageRole,
    content: string,
  ): Promise<void> {
    await this.prisma.ragConversation.upsert({
      where: {
        id: conversationId,
      },
      update: {},
      create: {
        id: conversationId,
      },
    });

    await this.prisma.ragConversationMessage.create({
      data: {
        conversationId,
        role,
        content,
      },
    });

    await this.trimConversation(conversationId);
  }

  private async trimConversation(conversationId: string): Promise<void> {
    const messages = await this.prisma.ragConversationMessage.findMany({
      where: {
        conversationId,
      },
      orderBy: [
        {
          createdAt: 'desc',
        },
        {
          id: 'desc',
        },
      ],
      skip: this.maxMessages,
      select: {
        id: true,
      },
    });

    if (messages.length === 0) {
      return;
    }

    await this.prisma.ragConversationMessage.deleteMany({
      where: {
        id: {
          in: messages.map((message) => message.id),
        },
      },
    });
  }

  private readPositiveIntegerEnv(name: string, fallback: number): number {
    const value = process.env[name];
    if (!value) {
      return fallback;
    }

    const parsed = Number.parseInt(value, 10);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new InternalServerErrorException(
        `${name} must be a positive integer`,
      );
    }

    return parsed;
  }
}
