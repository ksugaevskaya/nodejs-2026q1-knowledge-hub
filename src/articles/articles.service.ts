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

  async create(article: CreateArticleDto) {
    const { tags, ...articleData } = article;

    return await this.prisma.article.create({
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

    return await this.prisma.article.findMany({
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
  }

  async getOne(id: string) {
    if (!isUuid(id)) {
      throw new BadRequestException('Invalid articleId format');
    }

    const article = await this.prisma.article.findUnique({
      where: {
        id,
      },
    });

    if (!article) {
      throw new NotFoundException('Article not found');
    }

    return article;
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

    return await this.prisma.article.update({
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
