import { Injectable } from '@nestjs/common';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { validate as isUuid } from 'uuid';
import { SortOrder } from '../common/types';
import { PrismaService } from '../prisma/prisma.service';
import { ArticleStatus } from '@prisma/client';
import { AuthUser } from 'src/auth/auth-user.interface';
import { UserRole } from 'src/users/entities/user.entity';
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../common/errors';

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

  async create(article: CreateArticleDto, currentUser: AuthUser) {
    const { tags, ...articleData } = article;
    const isAdmin = currentUser.role === UserRole.ADMIN;

    if (
      !isAdmin &&
      article.authorId &&
      article.authorId !== currentUser.userId
    ) {
      throw new ForbiddenError('Editors can create only their own articles');
    }

    const createdArticle = await this.prisma.article.create({
      data: {
        ...articleData,
        authorId: isAdmin ? (article.authorId ?? null) : currentUser.userId,
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
      throw new ValidationError('Invalid articleId format');
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
      throw new NotFoundError('Article not found');
    }

    return this.mapArticle(article);
  }

  async update(
    id: string,
    updateArticleDto: UpdateArticleDto,
    currentUser: AuthUser,
  ) {
    if (!isUuid(id)) {
      throw new ValidationError('Invalid id format');
    }

    const article = await this.prisma.article.findUnique({
      where: { id },
    });

    if (!article) {
      throw new NotFoundError('Article not found');
    }

    const isAdmin = currentUser.role === UserRole.ADMIN;
    if (!isAdmin && article.authorId !== currentUser.userId) {
      throw new ForbiddenError('Editors can update only their own articles');
    }

    if (
      !isAdmin &&
      updateArticleDto.authorId !== undefined &&
      updateArticleDto.authorId !== currentUser.userId
    ) {
      throw new ForbiddenError('Editors cannot reassign article ownership');
    }

    const { tags, ...articleData } = updateArticleDto;

    const updatedArticle = await this.prisma.article.update({
      where: { id },
      data: {
        ...articleData,
        ...(!isAdmin && { authorId: currentUser.userId }),
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
      throw new ValidationError('Invalid id format');
    }

    const article = await this.prisma.article.findUnique({
      where: { id },
    });

    if (!article) {
      throw new NotFoundError('Article not found');
    }

    await this.prisma.article.delete({
      where: { id },
    });
  }
}
