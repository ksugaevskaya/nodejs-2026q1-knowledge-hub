import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { Article } from './entities/article.entity';
import { randomUUID } from 'crypto';
import { validate as isUuid } from 'uuid';

@Injectable()
export class ArticlesService {
  private articles: Article[] = [];

  create(article: CreateArticleDto) {
    const newArticle = {
      id: randomUUID(),
      title: article.title,
      content: article.content,
      status: article.status,
      authorId: article.authorId,
      categoryId: article.categoryId,
      tags: article.tags,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.articles.push(newArticle);

    return newArticle;
  }

  getAll(status: string, categoryId: string, tag: string) {
    let results = this.articles;

    if (status) {
      results = results.filter((item) => item.status === status);
    }

    if (categoryId) {
      results = results.filter((item) => item.categoryId === categoryId);
    }

    if (tag) {
      results = results.filter((item) => item.tags.includes(tag));
    }

    return results;
  }

  getOne(id: string) {
    if (!isUuid(id)) {
      throw new BadRequestException('Invalid userId format');
    }
    const article = this.articles.find((item) => item.id === id);

    if (!article) {
      throw new NotFoundException('Article not found');
    }

    return article;
  }

  update(id: string, updateArticleDto: UpdateArticleDto) {
    if (!isUuid(id)) {
      throw new BadRequestException('Invalid id format');
    }

    const article = this.articles.find((item) => item.id === id);

    if (!article) {
      throw new NotFoundException('Article not found');
    }

    if (updateArticleDto.title) {
      article.title = updateArticleDto.title;
    }

    if (updateArticleDto.content) {
      article.content = updateArticleDto.content;
    }

    if (updateArticleDto.status) {
      article.status = updateArticleDto.status;
    }

    if (updateArticleDto.categoryId) {
      article.categoryId = updateArticleDto.categoryId;
    }

    if (updateArticleDto.authorId) {
      article.authorId = updateArticleDto.authorId;
    }

    if (updateArticleDto.tags) {
      article.tags = updateArticleDto.tags;
    }

    article.updatedAt = Date.now();

    return article;
  }

  remove(id: string) {
    if (!isUuid(id)) {
      throw new BadRequestException('Invalid id format');
    }

    const articleIndex = this.articles.findIndex(
      (article) => article.id === id,
    );

    if (articleIndex === -1) {
      throw new NotFoundException('Article not found');
    }

    this.articles.splice(articleIndex, 1);
  }
}
