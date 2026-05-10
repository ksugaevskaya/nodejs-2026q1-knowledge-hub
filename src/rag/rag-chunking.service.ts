import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { RagArticleRecord, RagChunk } from './rag.types';

@Injectable()
export class RagChunkingService {
  private readonly chunkSize = this.readPositiveIntegerEnv(
    'RAG_CHUNK_SIZE',
    800,
  );
  private readonly chunkOverlap = this.readNonNegativeIntegerEnv(
    'RAG_CHUNK_OVERLAP',
    200,
  );

  constructor() {
    if (this.chunkOverlap >= this.chunkSize) {
      throw new InternalServerErrorException(
        'RAG_CHUNK_OVERLAP must be smaller than RAG_CHUNK_SIZE',
      );
    }
  }

  chunkArticle(article: RagArticleRecord): RagChunk[] {
    const normalizedContent = this.normalizeContent(article.content);

    if (!normalizedContent) {
      return [];
    }

    const chunks: RagChunk[] = [];
    let start = 0;
    let chunkIndex = 0;

    while (start < normalizedContent.length) {
      let end = Math.min(start + this.chunkSize, normalizedContent.length);

      if (end < normalizedContent.length) {
        const adjustedEnd = this.findBoundary(normalizedContent, start, end);
        if (adjustedEnd > start) {
          end = adjustedEnd;
        }
      }

      const text = normalizedContent.slice(start, end).trim();

      if (text) {
        chunks.push({
          articleId: article.id,
          chunkIndex,
          text,
          sourceText: this.buildSourceText(article, text),
        });
        chunkIndex += 1;
      }

      if (end >= normalizedContent.length) {
        break;
      }

      start = Math.max(end - this.chunkOverlap, start + 1);

      while (
        start < normalizedContent.length &&
        /\s/.test(normalizedContent[start])
      ) {
        start += 1;
      }
    }

    return chunks;
  }

  private normalizeContent(content: string): string {
    return content
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  private buildSourceText(article: RagArticleRecord, chunk: string): string {
    const metadataLines = [
      `Title: ${article.title}`,
      article.categoryName ? `Category: ${article.categoryName}` : null,
      article.tags.length > 0 ? `Tags: ${article.tags.join(', ')}` : null,
      '',
      chunk,
    ].filter((line): line is string => line !== null);

    return metadataLines.join('\n');
  }

  private findBoundary(content: string, start: number, end: number): number {
    const minimumBoundary = start + Math.floor(this.chunkSize / 2);
    const newlineBoundary = content.lastIndexOf('\n', end);
    const spaceBoundary = content.lastIndexOf(' ', end);
    const boundary = Math.max(newlineBoundary, spaceBoundary);

    return boundary > minimumBoundary ? boundary : end;
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

  private readNonNegativeIntegerEnv(name: string, fallback: number): number {
    const value = process.env[name];
    if (!value) {
      return fallback;
    }

    const parsed = Number.parseInt(value, 10);
    if (!Number.isInteger(parsed) || parsed < 0) {
      throw new InternalServerErrorException(
        `${name} must be a non-negative integer`,
      );
    }

    return parsed;
  }
}
