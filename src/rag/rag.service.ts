import { ArticleStatus } from '@prisma/client';
import { Injectable, Logger } from '@nestjs/common';
import { v5 as uuidv5 } from 'uuid';
import { GeminiService } from '../ai/gemini.service';
import { PrismaService } from '../prisma/prisma.service';
import { ReindexRequestDto } from './dto/reindex-request.dto';
import { RagChunkingService } from './rag-chunking.service';
import { RagArticleRecord, RagVectorPoint } from './rag.types';
import { RagVectorStoreService } from './rag-vector-store.service';

const RAG_CHUNK_NAMESPACE = '4f1f5d7f-5e77-42ad-8ab0-0e7f81587cb8';

@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly geminiService: GeminiService,
    private readonly chunkingService: RagChunkingService,
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
    return this.prisma.article
      .findMany({
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
      })
      .then((articles) =>
        articles.map((article) => ({
          id: article.id,
          title: article.title,
          content: article.content,
          status: article.status,
          categoryId: article.categoryId,
          categoryName: article.category?.name ?? null,
          tags: article.articleTags.map(({ tag }) => tag.name),
          updatedAt: article.updatedAt,
        })),
      );
  }
}
