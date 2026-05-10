import { ArticleStatus } from '@prisma/client';

export type RagArticleRecord = {
  id: string;
  title: string;
  content: string;
  status: ArticleStatus;
  categoryId: string | null;
  categoryName: string | null;
  tags: string[];
  updatedAt: Date;
};

export type RagChunk = {
  articleId: string;
  chunkIndex: number;
  text: string;
  sourceText: string;
};

export type RagVectorPayload = {
  articleId: string;
  articleTitle: string;
  chunk: string;
  chunkIndex: number;
  status: ArticleStatus;
  categoryId: string | null;
  categoryName: string | null;
  tags: string[];
  updatedAt: string;
};

export type RagVectorPoint = {
  id: string;
  vector: number[];
  payload: RagVectorPayload;
};

export type RagSearchFilters = {
  articleStatus?: ArticleStatus;
  categoryId?: string;
  tags?: string[];
};

export type RagSearchResult = {
  articleId: string;
  articleTitle: string;
  chunk: string;
  similarity: number;
};
