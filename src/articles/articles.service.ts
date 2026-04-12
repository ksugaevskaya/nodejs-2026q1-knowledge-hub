import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { validate as isUuid } from 'uuid';
import { SortOrder } from '../common/types';
import { PrismaService } from '../prisma/prisma.service';
import { ArticleStatus } from '@prisma/client';

@Injectable()
export class ArticlesService {
  constructor(private readonly prisma: PrismaService) {}

  private mapArticle(article: {
    id: string;
    title: string;
    content: string;
    status: ArticleStatus;
    authorId: string | null;
    categoryId: string | null;
    createdAt: Date;
    updatedAt: Date;
    articleTags?: { tag: { name: string } }[];
  }) {
    return {
      id: article.id,
      title: article.title,
      content: article.content,
      status: article.status,
      authorId: article.authorId,
      categoryId: article.categoryId,
      tags: article.articleTags?.map(({ tag }) => tag.name) ?? [],
      createdAt: article.createdAt.getTime(),
      updatedAt: article.updatedAt.getTime(),
    };
  }

  async create(article: CreateArticleDto) {
    const { tags, ...articleData } = article;

    const createdArticle = await this.prisma.article.create({
      data: {
        ...articleData,
        articleTags: tags
          ? {
              create: tags.map((tagName) => ({
                tag: {
                  connectOrCreate: {
                    where: { name: tagName },
                    create: { name: tagName },
                  },
                },
              })),
            }
          : undefined,
      },
      include: {
        articleTags: {
          include: {
            tag: true,
          },
        },
      },
    });

    return this.mapArticle(createdArticle);
  }

  async getAll(
    status?: ArticleStatus,
    categoryId?: string,
    tag?: string,
    sortBy?: string,
    order?: SortOrder,
  ) {
    const orderByClause = sortBy
      ? { [sortBy]: order === 'desc' ? 'desc' : 'asc' }
      : undefined;

    const articles = await this.prisma.article.findMany({
      orderBy: orderByClause,
      where: {
        ...(status && { status }),
        ...(categoryId && { categoryId }),
        ...(tag && {
          articleTags: {
            some: {
              tag: {
                name: tag,
              },
            },
          },
        }),
      },
      include: {
        articleTags: {
          include: {
            tag: true,
          },
        },
      },
    });

    return articles.map((article) => this.mapArticle(article));
  }

  async getOne(id: string) {
    if (!isUuid(id)) {
      throw new BadRequestException('Invalid articleId format');
    }

    const article = await this.prisma.article.findUnique({
      where: {
        id,
      },
      include: {
        articleTags: {
          include: {
            tag: true,
          },
        },
      },
    });

    if (!article) {
      throw new NotFoundException('Article not found');
    }

    return this.mapArticle(article);
  }

  async update(id: string, updateArticleDto: UpdateArticleDto) {
    if (!isUuid(id)) {
      throw new BadRequestException('Invalid id format');
    }

    const article = await this.prisma.article.findUnique({
      where: { id },
    });

    if (!article) {
      throw new NotFoundException('Article not found');
    }

    const { tags, ...articleData } = updateArticleDto;

    const updatedArticle = await this.prisma.article.update({
      where: { id },
      data: {
        ...articleData,
        ...(tags && {
          articleTags: {
            deleteMany: {},
            create: tags.map((tagName) => ({
              tag: {
                connectOrCreate: {
                  where: { name: tagName },
                  create: { name: tagName },
                },
              },
            })),
          },
        }),
      },
      include: {
        articleTags: {
          include: {
            tag: true,
          },
        },
      },
    });

    return this.mapArticle(updatedArticle);
  }

  async remove(id: string) {
    if (!isUuid(id)) {
      throw new BadRequestException('Invalid id format');
    }

    const article = await this.prisma.article.findUnique({
      where: { id },
    });

    if (!article) {
      throw new NotFoundException('Article not found');
    }

    await this.prisma.article.delete({
      where: { id },
    });
  }
}
