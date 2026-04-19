import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { CreateCommentDto } from './dto/create-comment.dto';
import { validate as isUuid } from 'uuid';

import { SortOrder } from '../common/types';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuthUser } from 'src/auth/auth-user.interface';
import { UserRole } from 'src/users/entities/user.entity';

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

  async create(createCommentDto: CreateCommentDto, currentUser: AuthUser) {
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

    const isAdmin = currentUser.role === UserRole.ADMIN;
    if (
      !isAdmin &&
      createCommentDto.authorId &&
      createCommentDto.authorId !== currentUser.userId
    ) {
      throw new ForbiddenException(
        'Editors can create only their own comments',
      );
    }

    const createdComment = await this.prisma.comment.create({
      data: {
        content: createCommentDto.content,
        articleId: createCommentDto.articleId,
        authorId: isAdmin
          ? (createCommentDto.authorId ?? null)
          : currentUser.userId,
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

  async remove(id: string, currentUser: AuthUser) {
    if (!isUuid(id)) {
      throw new BadRequestException('Invalid commentId format');
    }

    const comment = await this.prisma.comment.findUnique({
      where: { id },
    });

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    if (
      currentUser.role !== UserRole.ADMIN &&
      comment.authorId !== currentUser.userId
    ) {
      throw new ForbiddenException(
        'Editors can delete only their own comments',
      );
    }

    await this.prisma.comment.delete({
      where: { id },
    });
  }
}
