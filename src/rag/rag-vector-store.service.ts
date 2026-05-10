import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { QdrantClient } from '@qdrant/js-client-rest';
import { RagVectorPoint } from './rag.types';

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
