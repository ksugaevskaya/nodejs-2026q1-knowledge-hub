import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { QdrantClient } from '@qdrant/js-client-rest';
import { RagSearchFilters, RagSearchResult, RagVectorPoint } from './rag.types';

@Injectable()
export class RagVectorStoreService {
  private readonly logger = new Logger(RagVectorStoreService.name);
  private readonly provider = process.env.RAG_VECTOR_DB_PROVIDER ?? 'qdrant';
  private readonly url =
    process.env.RAG_VECTOR_DB_URL ?? 'http://vectordb:6333';
  private readonly collectionName =
    process.env.RAG_VECTOR_COLLECTION ?? 'knowledge_hub_articles';
  private readonly client = new QdrantClient({
    url: this.url,
    checkCompatibility: false,
  });

  getCollectionName(): string {
    return this.collectionName;
  }

  async replaceArticleChunks(
    articleId: string,
    points: RagVectorPoint[],
  ): Promise<void> {
    this.assertProvider();

    try {
      if (points.length === 0) {
        await this.deleteArticleChunks(articleId);
        return;
      }

      await this.ensureCollection(points[0].vector.length);
      await this.deleteArticleChunks(articleId);
      await this.client.upsert(this.collectionName, {
        wait: true,
        points,
      });
    } catch (error) {
      this.handleVectorError('replace_article_chunks_failed', error);
    }
  }

  async deleteArticleChunks(articleId: string): Promise<void> {
    this.assertProvider();

    try {
      const exists = await this.client.collectionExists(this.collectionName);
      if (!exists.exists) {
        return;
      }

      await this.client.delete(this.collectionName, {
        wait: true,
        filter: {
          must: [
            {
              key: 'articleId',
              match: {
                value: articleId,
              },
            },
          ],
        },
      });
    } catch (error) {
      this.handleVectorError('delete_article_chunks_failed', error);
    }
  }

  async search(
    vector: number[],
    limit: number,
    filters: RagSearchFilters,
  ): Promise<RagSearchResult[]> {
    this.assertProvider();

    try {
      const exists = await this.client.collectionExists(this.collectionName);
      if (!exists.exists) {
        return [];
      }

      const results = await this.client.search(this.collectionName, {
        vector,
        limit,
        filter: this.buildFilter(filters),
        with_payload: true,
      });

      return results
        .map((result) => {
          const payload = result.payload as
            | {
                articleId?: string;
                articleTitle?: string;
                chunk?: string;
              }
            | undefined;

          if (!payload?.articleId || !payload.articleTitle || !payload.chunk) {
            return null;
          }

          return {
            articleId: payload.articleId,
            articleTitle: payload.articleTitle,
            chunk: payload.chunk,
            similarity: result.score,
          };
        })
        .filter((result): result is RagSearchResult => result !== null);
    } catch (error) {
      this.handleVectorError('search_failed', error);
    }
  }

  private async ensureCollection(vectorSize: number): Promise<void> {
    const exists = await this.client.collectionExists(this.collectionName);
    if (exists.exists) {
      return;
    }

    await this.client.createCollection(this.collectionName, {
      vectors: {
        size: vectorSize,
        distance: 'Cosine',
      },
    });
  }

  private assertProvider(): void {
    if (this.provider !== 'qdrant') {
      throw new ServiceUnavailableException(
        `Unsupported vector DB provider: ${this.provider}`,
      );
    }
  }

  private buildFilter(filters: RagSearchFilters) {
    const must: Array<Record<string, unknown>> = [];

    if (filters.articleStatus) {
      must.push({
        key: 'status',
        match: {
          value: filters.articleStatus,
        },
      });
    }

    if (filters.categoryId) {
      must.push({
        key: 'categoryId',
        match: {
          value: filters.categoryId,
        },
      });
    }

    for (const tag of filters.tags ?? []) {
      must.push({
        key: 'tags',
        match: {
          value: tag,
        },
      });
    }

    return must.length > 0 ? { must } : undefined;
  }

  private handleVectorError(event: string, error: unknown): never {
    this.logger.error({
      event,
      provider: this.provider,
      url: this.url,
      message:
        error instanceof Error ? error.message : 'Unknown vector DB error',
    });

    throw new ServiceUnavailableException('Vector database is unavailable');
  }
}
