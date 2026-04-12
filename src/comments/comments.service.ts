import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { CreateCommentDto } from './dto/create-comment.dto';
import { validate as isUuid } from 'uuid';

import { SortOrder } from '../common/types';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class CommentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createCommentDto: CreateCommentDto) {
    try {
      this.prisma.article.findFirstOrThrow({
        where: {
          id: createCommentDto.articleId,
        },
      });
    } catch {
      throw new UnprocessableEntityException('Article not found');
    }

    return await this.prisma.comment.create({
      data: {
        content: createCommentDto.content,
        articleId: createCommentDto.articleId,
        authorId: createCommentDto.authorId,
      },
    });
  }

  async getAll(articleId: string, sortBy?: string, order?: SortOrder) {
    const orderByClause = sortBy
      ? { [sortBy]: order === 'desc' ? 'desc' : 'asc' }
      : undefined;

    if (!articleId) {
      throw new BadRequestException('ArticleId is required');
    }

    return await this.prisma.comment.findMany({
      orderBy: orderByClause,
      where: {
        articleId,
      },
    });
  }

  async getOne(id: string) {
    if (!isUuid(id)) {
      throw new BadRequestException('Invalid commentId format');
    }

    const comment = await this.prisma.comment.findUnique({
      where: {
        id,
      },
    });

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    return comment;
  }

  async remove(id: string) {
    if (!isUuid(id)) {
      throw new BadRequestException('Invalid commentId format');
    }

    const comment = await this.prisma.comment.findUnique({
      where: { id },
    });

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }
  }
}
