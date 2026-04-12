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

  private mapComment(comment: {
    id: string;
    content: string;
    articleId: string;
    authorId: string | null;
    createdAt: Date;
  }) {
    return {
      id: comment.id,
      content: comment.content,
      articleId: comment.articleId,
      authorId: comment.authorId,
      createdAt: comment.createdAt.getTime(),
    };
  }

  async create(createCommentDto: CreateCommentDto) {
    const article = await this.prisma.article.findUnique({
      where: {
        id: createCommentDto.articleId,
      },
      select: {
        id: true,
      },
    });

    if (!article) {
      throw new UnprocessableEntityException('Article not found');
    }

    const createdComment = await this.prisma.comment.create({
      data: {
        content: createCommentDto.content,
        articleId: createCommentDto.articleId,
        authorId: createCommentDto.authorId,
      },
    });

    return this.mapComment(createdComment);
  }

  async getAll(articleId: string, sortBy?: string, order?: SortOrder) {
    const orderByClause = sortBy
      ? { [sortBy]: order === 'desc' ? 'desc' : 'asc' }
      : undefined;

    if (!articleId) {
      throw new BadRequestException('ArticleId is required');
    }

    const comments = await this.prisma.comment.findMany({
      orderBy: orderByClause,
      where: {
        articleId,
      },
    });

    return comments.map((comment) => this.mapComment(comment));
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

    return this.mapComment(comment);
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

    await this.prisma.comment.delete({
      where: { id },
    });
  }
}
