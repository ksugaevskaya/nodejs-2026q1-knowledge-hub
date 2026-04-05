import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateCommentDto } from './dto/create-comment.dto';
import { randomUUID } from 'crypto';
import { CommentType } from './entities/comment.entity';

@Injectable()
export class CommentsService {
  private comments: CommentType[] = [];

  create(createCommentDto: CreateCommentDto) {
    const newComment = {
      id: randomUUID(),
      content: createCommentDto.content,
      articleId: createCommentDto.articleId,
      authorId: createCommentDto.authorId,
      createdAt: Date.now(),
    };

    this.comments.push(newComment);
    return newComment;
  }

  getAll(articleId: string) {
    let result = this.comments;

    if (!articleId) {
      throw new BadRequestException('ArticleId is required');
    }

    if (articleId) {
      result = result.filter((item) => item.articleId === articleId);
    }

    return result;
  }

  remove(id: number) {
    return `This action removes a #${id} comment`;
  }
}
