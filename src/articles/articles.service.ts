import { Injectable } from '@nestjs/common';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { Article, ArticleStatus } from './entities/article.entity';
import { randomUUID } from 'crypto';

@Injectable()
export class ArticlesService {
  private articles: Article[] = [];

  create(article: CreateArticleDto) {
    const newArticle = {
      id: randomUUID(),
      title: article.title,
      content: article.content,
      status: ArticleStatus.DRAFT,
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

  findOne(id: number) {
    return `This action returns a #${id} article`;
  }

  update(id: number, updateArticleDto: UpdateArticleDto) {
    return `This action updates a #${id} article`;
  }

  remove(id: number) {
    return `This action removes a #${id} article`;
  }
}
