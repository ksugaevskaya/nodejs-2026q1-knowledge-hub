import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { QdrantClient } from '@qdrant/js-client-rest';
import {
  RagArticleIndexState,
  RagSearchFilters,
  RagSearchResult,
  RagVectorPoint,
} from './rag.types';

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
        filter: this.buildArticleIdFilter(articleId),
      });
    } catch (error) {
      this.handleVectorError('delete_article_chunks_failed', error);
    }
  }

  async removeArticleChunks(articleId: string): Promise<boolean> {
    this.assertProvider();

    try {
      const exists = await this.client.collectionExists(this.collectionName);
      if (!exists.exists) {
        return false;
      }

      const countResult = await this.client.count(this.collectionName, {
        exact: true,
        filter: this.buildArticleIdFilter(articleId),
      });

      if (countResult.count === 0) {
        return false;
      }

      await this.client.delete(this.collectionName, {
        wait: true,
        filter: this.buildArticleIdFilter(articleId),
      });

      return true;
    } catch (error) {
      this.handleVectorError('remove_article_chunks_failed', error);
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

      const mappedResults: Array<RagSearchResult | null> = results.map(
        (result) => {
          const payload = result.payload as
            | {
                articleId?: string;
                articleTitle?: string;
                chunk?: string;
                sourceText?: string;
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
            sourceText: payload.sourceText,
          };
        },
      );

      return mappedResults.filter(
        (result): result is RagSearchResult => result !== null,
      );
    } catch (error) {
      this.handleVectorError('search_failed', error);
    }
  }

  async getArticleIndexState(
    articleId: string,
  ): Promise<RagArticleIndexState | null> {
    this.assertProvider();

    try {
      const exists = await this.client.collectionExists(this.collectionName);
      if (!exists.exists) {
        return null;
      }

      const countResult = await this.client.count(this.collectionName, {
        exact: true,
        filter: this.buildArticleIdFilter(articleId),
      });

      if (countResult.count === 0) {
        return null;
      }

      const scrollResult = await this.client.scroll(this.collectionName, {
        filter: this.buildArticleIdFilter(articleId),
        with_payload: true,
        limit: 1,
      });

      const firstPoint = scrollResult.points[0];
      const payload = firstPoint?.payload as
        | {
            contentHash?: string;
          }
        | undefined;

      return {
        chunkCount: countResult.count,
        contentHash: payload?.contentHash ?? null,
      };
    } catch (error) {
      this.handleVectorError('get_article_index_state_failed', error);
    }
  }

  async listIndexedArticleIds(): Promise<string[]> {
    this.assertProvider();

    try {
      const exists = await this.client.collectionExists(this.collectionName);
      if (!exists.exists) {
        return [];
      }

      const articleIds = new Set<string>();
      let offset: string | number | Record<string, unknown> | undefined;

      while (true) {
        const scrollResult = await this.client.scroll(this.collectionName, {
          with_payload: true,
          limit: 100,
          offset,
        });

        for (const point of scrollResult.points) {
          const payload = point.payload as
            | {
                articleId?: string;
              }
            | undefined;

          if (payload?.articleId) {
            articleIds.add(payload.articleId);
          }
        }

        if (!scrollResult.next_page_offset) {
          break;
        }

        offset = scrollResult.next_page_offset;
      }

      return Array.from(articleIds);
    } catch (error) {
      this.handleVectorError('list_indexed_article_ids_failed', error);
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

  private buildArticleIdFilter(articleId: string) {
    return {
      must: [
        {
          key: 'articleId',
          match: {
            value: articleId,
          },
        },
      ],
    };
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
