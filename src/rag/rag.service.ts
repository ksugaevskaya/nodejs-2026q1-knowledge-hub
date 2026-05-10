import { ArticleStatus, RagMessageRole } from '@prisma/client';
import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
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
    const isFullReindex = !dto.articleIds || dto.articleIds.length === 0;

    let indexedArticles = 0;
    let indexedChunks = 0;

    for (const article of articles) {
      const points = await this.buildArticlePoints(article);

      if (points.length === 0) {
        await this.vectorStoreService.replaceArticleChunks(article.id, points);
        indexedArticles += 1;
        continue;
      }

      const currentHash = points[0].payload.contentHash;
      const currentState = await this.vectorStoreService.getArticleIndexState(
        article.id,
      );

      if (
        currentState &&
        currentState.contentHash === currentHash &&
        currentState.chunkCount === points.length
      ) {
        continue;
      }

      await this.vectorStoreService.replaceArticleChunks(article.id, points);
      indexedArticles += 1;
      indexedChunks += points.length;
    }

    if (isFullReindex) {
      const dbArticleIds = new Set(articles.map((article) => article.id));
      const indexedArticleIds =
        await this.vectorStoreService.listIndexedArticleIds();
      const staleArticleIds = indexedArticleIds.filter(
        (articleId) => !dbArticleIds.has(articleId),
      );

      for (const staleArticleId of staleArticleIds) {
        await this.vectorStoreService.deleteArticleChunks(staleArticleId);
      }
    }

    this.logger.log({
      event: 'rag_reindex_completed',
      indexedArticles,
      indexedChunks,
      vectorCollection: this.vectorStoreService.getCollectionName(),
    });

    return {
      indexedArticles,
      indexedChunks,
      vectorCollection: this.vectorStoreService.getCollectionName(),
    };
  }

  async search(
    dto: RagSearchRequestDto,
  ): Promise<{ results: RagSearchResult[] }> {
    const limit = dto.limit ?? 5;
    const normalizedQuery = dto.query.trim();
    const filters = {
      articleStatus: dto.articleStatus,
      categoryId: dto.categoryId,
      tags: dto.tags?.map((tag) => tag.trim()).filter(Boolean),
    };

    const semanticResults = await this.semanticSearch(
      normalizedQuery,
      filters,
      Math.max(limit * 3, 10),
      'ragSearch',
    );
    const lexicalResults = await this.lexicalSearch(
      normalizedQuery,
      filters,
      Math.max(limit * 3, 10),
    );
    const results = this.mergeHybridResults(
      semanticResults,
      lexicalResults,
      limit,
    );

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

    const semanticResults = await this.semanticSearch(
      question,
      {},
      15,
      'ragChatRetrieve',
    );
    const lexicalResults = await this.lexicalSearch(question, {}, 15);
    const retrievedChunks = this.mergeHybridResults(
      semanticResults,
      lexicalResults,
      5,
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
    const contentHash = this.createArticleContentHash(article, chunks);
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
          sourceText: chunk.sourceText,
          status: article.status,
          categoryId: article.categoryId,
          categoryName: article.categoryName,
          tags: article.tags,
          updatedAt: article.updatedAt.toISOString(),
          contentHash,
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

  private async semanticSearch(
    query: string,
    filters: {
      articleStatus?: ArticleStatus;
      categoryId?: string;
      tags?: string[];
    },
    limit: number,
    endpointName: string,
  ): Promise<RagSearchResult[]> {
    const embedding = await this.geminiService.embedText(query, {
      endpointName,
      taskType: 'RETRIEVAL_QUERY',
    });

    return this.vectorStoreService.search(embedding, limit, filters);
  }

  private async lexicalSearch(
    query: string,
    filters: {
      articleStatus?: ArticleStatus;
      categoryId?: string;
      tags?: string[];
    },
    limit: number,
  ): Promise<RagSearchResult[]> {
    const queryTokens = this.tokenize(query);
    if (queryTokens.length === 0) {
      return [];
    }

    const articles = await this.loadArticles(undefined, false);
    const filteredArticles = articles.filter((article) =>
      this.matchesFilters(article, filters),
    );
    const candidates: RagSearchResult[] = [];

    for (const article of filteredArticles) {
      const chunks = this.chunkingService.chunkArticle(article);

      for (const chunk of chunks) {
        const lexicalScore = this.computeLexicalScore(
          queryTokens,
          chunk.sourceText,
        );

        if (lexicalScore <= 0) {
          continue;
        }

        candidates.push({
          articleId: article.id,
          articleTitle: article.title,
          chunk: chunk.text,
          similarity: lexicalScore,
          lexicalScore,
          sourceText: chunk.sourceText,
        });
      }
    }

    return candidates
      .sort((left, right) => right.similarity - left.similarity)
      .slice(0, limit);
  }

  private mergeHybridResults(
    semanticResults: RagSearchResult[],
    lexicalResults: RagSearchResult[],
    limit: number,
  ): RagSearchResult[] {
    const merged = new Map<string, RagSearchResult>();

    for (const [index, result] of semanticResults.entries()) {
      const key = this.createResultKey(result);
      const reciprocalRank = 1 / (index + 1);
      const current = merged.get(key);

      merged.set(key, {
        ...(current ?? result),
        articleId: result.articleId,
        articleTitle: result.articleTitle,
        chunk: result.chunk,
        sourceText: result.sourceText ?? current?.sourceText,
        similarity: result.similarity,
        lexicalScore: current?.lexicalScore,
        rerankScore: (current?.rerankScore ?? 0) + reciprocalRank,
      });
    }

    for (const [index, result] of lexicalResults.entries()) {
      const key = this.createResultKey(result);
      const reciprocalRank = 1 / (index + 1);
      const current = merged.get(key);

      merged.set(key, {
        ...(current ?? result),
        articleId: result.articleId,
        articleTitle: result.articleTitle,
        chunk: result.chunk,
        sourceText: result.sourceText ?? current?.sourceText,
        similarity: current?.similarity ?? result.similarity,
        lexicalScore: result.lexicalScore ?? result.similarity,
        rerankScore: (current?.rerankScore ?? 0) + reciprocalRank,
      });
    }

    return Array.from(merged.values())
      .map((result) => ({
        ...result,
        rerankScore: this.computeRerankScore(result),
      }))
      .sort((left, right) => (right.rerankScore ?? 0) - (left.rerankScore ?? 0))
      .slice(0, limit);
  }

  private computeRerankScore(result: RagSearchResult): number {
    const semanticScore = result.similarity;
    const lexicalScore = result.lexicalScore ?? 0;
    const hybridScore = result.rerankScore ?? 0;

    return semanticScore * 0.45 + lexicalScore * 0.35 + hybridScore * 0.2;
  }

  private computeLexicalScore(
    queryTokens: string[],
    sourceText: string,
  ): number {
    const sourceTokens = new Set(this.tokenize(sourceText));
    const matchedTokens = queryTokens.filter((token) =>
      sourceTokens.has(token),
    );

    if (matchedTokens.length === 0) {
      return 0;
    }

    return matchedTokens.length / queryTokens.length;
  }

  private tokenize(value: string): string[] {
    return value
      .toLowerCase()
      .split(/[^a-z0-9]+/i)
      .map((token) => token.trim())
      .filter((token) => token.length > 1);
  }

  private matchesFilters(
    article: RagArticleRecord,
    filters: {
      articleStatus?: ArticleStatus;
      categoryId?: string;
      tags?: string[];
    },
  ): boolean {
    if (filters.articleStatus && article.status !== filters.articleStatus) {
      return false;
    }

    if (filters.categoryId && article.categoryId !== filters.categoryId) {
      return false;
    }

    if (filters.tags && filters.tags.length > 0) {
      const articleTags = new Set(article.tags);
      for (const tag of filters.tags) {
        if (!articleTags.has(tag)) {
          return false;
        }
      }
    }

    return true;
  }

  private createResultKey(result: RagSearchResult): string {
    return `${result.articleId}:${result.chunk}`;
  }

  private createArticleContentHash(
    article: RagArticleRecord,
    chunks: Array<{
      text: string;
    }>,
  ): string {
    return createHash('sha256')
      .update(
        JSON.stringify({
          title: article.title,
          content: article.content,
          status: article.status,
          categoryId: article.categoryId,
          categoryName: article.categoryName,
          tags: article.tags,
          chunks: chunks.map((chunk) => chunk.text),
        }),
      )
      .digest('hex');
  }
}
