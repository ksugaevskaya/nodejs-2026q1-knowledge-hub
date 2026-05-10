import { ArticleStatus, RagMessageRole } from '@prisma/client';
import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4, v5 as uuidv5 } from 'uuid';
import { GeminiService } from '../ai/gemini.service';
import { NotFoundError } from '../common/errors';
import { PrismaService } from '../prisma/prisma.service';
import { RagChatRequestDto } from './dto/rag-chat-request.dto';
import { RagSearchRequestDto } from './dto/rag-search-request.dto';
import { ReindexRequestDto } from './dto/reindex-request.dto';
import { RagChunkingService } from './rag-chunking.service';
import { RagConversationService } from './rag-conversation.service';
import {
  RagArticleRecord,
  RagChatSource,
  RagSearchResult,
  RagVectorPoint,
} from './rag.types';
import { RagVectorStoreService } from './rag-vector-store.service';

const RAG_CHUNK_NAMESPACE = '4f1f5d7f-5e77-42ad-8ab0-0e7f81587cb8';

@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly geminiService: GeminiService,
    private readonly chunkingService: RagChunkingService,
    private readonly conversationService: RagConversationService,
    private readonly vectorStoreService: RagVectorStoreService,
  ) {}

  async reindex(dto: ReindexRequestDto) {
    const onlyPublished = dto.onlyPublished ?? true;
    const articles = await this.loadArticles(dto.articleIds, onlyPublished);

    let indexedChunks = 0;

    for (const article of articles) {
      const points = await this.buildArticlePoints(article);
      await this.vectorStoreService.replaceArticleChunks(article.id, points);
      indexedChunks += points.length;
    }

    this.logger.log({
      event: 'rag_reindex_completed',
      indexedArticles: articles.length,
      indexedChunks,
      vectorCollection: this.vectorStoreService.getCollectionName(),
    });

    return {
      indexedArticles: articles.length,
      indexedChunks,
      vectorCollection: this.vectorStoreService.getCollectionName(),
    };
  }

  async search(
    dto: RagSearchRequestDto,
  ): Promise<{ results: RagSearchResult[] }> {
    const limit = dto.limit ?? 5;
    const embedding = await this.geminiService.embedText(dto.query.trim(), {
      endpointName: 'ragSearch',
      taskType: 'RETRIEVAL_QUERY',
    });

    const results = await this.vectorStoreService.search(embedding, limit, {
      articleStatus: dto.articleStatus,
      categoryId: dto.categoryId,
      tags: dto.tags?.map((tag) => tag.trim()).filter(Boolean),
    });

    return {
      results,
    };
  }

  async chat(dto: RagChatRequestDto): Promise<{
    answer: string;
    sources: RagChatSource[];
    conversationId: string;
  }> {
    const question = dto.question.trim();
    const conversationId = dto.conversationId?.trim() || uuidv4();
    const previousMessages =
      await this.conversationService.getRecentMessages(conversationId);

    await this.conversationService.appendMessage(
      conversationId,
      RagMessageRole.user,
      question,
    );

    const embedding = await this.geminiService.embedText(question, {
      endpointName: 'ragChatRetrieve',
      taskType: 'RETRIEVAL_QUERY',
    });
    const retrievedChunks = await this.vectorStoreService.search(
      embedding,
      5,
      {},
    );
    const prompt = this.buildChatPrompt(
      question,
      previousMessages,
      retrievedChunks,
    );
    const generation = await this.geminiService.generateText(prompt, {
      endpointName: 'ragChatGenerate',
    });
    const answer = generation.text.trim();

    await this.conversationService.appendMessage(
      conversationId,
      RagMessageRole.assistant,
      answer,
    );

    return {
      answer,
      sources: retrievedChunks.map((chunk) => ({
        articleId: chunk.articleId,
        articleTitle: chunk.articleTitle,
        relevantChunk: chunk.chunk,
      })),
      conversationId,
    };
  }

  async deleteIndexedArticle(articleId: string): Promise<void> {
    const removed =
      await this.vectorStoreService.removeArticleChunks(articleId);

    if (!removed) {
      throw new NotFoundError('Article index entries not found');
    }
  }

  private async buildArticlePoints(
    article: RagArticleRecord,
  ): Promise<RagVectorPoint[]> {
    const chunks = this.chunkingService.chunkArticle(article);
    const points: RagVectorPoint[] = [];

    for (const chunk of chunks) {
      const embedding = await this.geminiService.embedText(chunk.sourceText, {
        endpointName: 'ragIndex',
        taskType: 'RETRIEVAL_DOCUMENT',
      });

      points.push({
        id: uuidv5(`${article.id}:${chunk.chunkIndex}`, RAG_CHUNK_NAMESPACE),
        vector: embedding,
        payload: {
          articleId: article.id,
          articleTitle: article.title,
          chunk: chunk.text,
          chunkIndex: chunk.chunkIndex,
          status: article.status,
          categoryId: article.categoryId,
          categoryName: article.categoryName,
          tags: article.tags,
          updatedAt: article.updatedAt.toISOString(),
        },
      });
    }

    return points;
  }

  private async loadArticles(
    articleIds: string[] | undefined,
    onlyPublished: boolean,
  ): Promise<RagArticleRecord[]> {
    const articles = await this.prisma.article.findMany({
      where: {
        ...(onlyPublished ? { status: ArticleStatus.published } : {}),
        ...(articleIds && articleIds.length > 0
          ? { id: { in: articleIds } }
          : {}),
      },
      include: {
        category: true,
        articleTags: {
          include: {
            tag: true,
          },
        },
      },
      orderBy: {
        updatedAt: 'asc',
      },
    });

    return articles.map((article) => ({
      id: article.id,
      title: article.title,
      content: article.content,
      status: article.status,
      categoryId: article.categoryId,
      categoryName: article.category?.name ?? null,
      tags: article.articleTags.map(({ tag }) => tag.name),
      updatedAt: article.updatedAt,
    }));
  }

  private buildChatPrompt(
    question: string,
    previousMessages: Array<{
      role: RagMessageRole;
      content: string;
    }>,
    retrievedChunks: RagSearchResult[],
  ): string {
    const conversationBlock =
      previousMessages.length > 0
        ? previousMessages
            .map(
              (message) =>
                `${message.role === RagMessageRole.user ? 'User' : 'Assistant'}: ${message.content}`,
            )
            .join('\n')
        : 'No prior conversation.';

    const sourcesBlock =
      retrievedChunks.length > 0
        ? retrievedChunks
            .map(
              (chunk, index) =>
                `[Source ${index + 1}] ${chunk.articleTitle} (${chunk.articleId})\n${chunk.chunk}`,
            )
            .join('\n\n')
        : 'No relevant source chunks were retrieved from the Knowledge Hub.';

    return [
      'You are a Knowledge Hub RAG assistant.',
      'Answer the user using only the provided Knowledge Hub sources and the recent conversation context.',
      'If the sources do not contain enough information, say that the answer could not be grounded in the Knowledge Hub.',
      'Do not invent article facts that are not present in the sources.',
      '',
      'Recent conversation:',
      conversationBlock,
      '',
      'Retrieved Knowledge Hub sources:',
      sourcesBlock,
      '',
      `Current user question: ${question}`,
      '',
      'Provide a concise grounded answer.',
    ].join('\n');
  }
}
