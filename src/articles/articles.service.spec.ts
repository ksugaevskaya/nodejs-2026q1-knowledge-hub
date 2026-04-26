import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ArticleStatus } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthUser } from 'src/auth/auth-user.interface';
import { ArticlesService } from './articles.service';
import { UserRole } from 'src/users/entities/user.entity';

describe('ArticlesService', () => {
  let service: ArticlesService;

  const prismaMock = {
    article: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  };

  const articleId = '8cb04d24-5be9-4a1f-b557-9c4d79db5ad7';
  const authorId = '7d43f7c4-e296-4ba1-9d93-c41d73e86e13';
  const otherAuthorId = '4d1ff86f-f7c5-4269-87c4-86158c515914';
  const categoryId = '0e27ba0e-f361-4be9-9a49-b06d860f8ad0';
  const now = new Date('2026-02-15T09:30:00.000Z');

  const adminUser: AuthUser = {
    userId: '5f761d7d-bc8f-44ff-8a3d-5268bfa5b983',
    login: 'admin',
    role: UserRole.ADMIN,
  };

  const editorUser: AuthUser = {
    userId: authorId,
    login: 'editor',
    role: UserRole.EDITOR,
  };

  const mappedArticleRecord = {
    id: articleId,
    title: 'Article title',
    content: 'Body',
    status: ArticleStatus.published,
    authorId,
    categoryId,
    createdAt: now,
    updatedAt: now,
    articleTags: [{ tag: { name: 'nestjs' } }, { tag: { name: 'testing' } }],
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
        {
          provide: ArticlesService,
          useFactory: (prisma: PrismaService) => new ArticlesService(prisma),
          inject: [PrismaService],
        },
      ],
    }).compile();

    service = module.get<ArticlesService>(ArticlesService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('prevents editors from creating articles for another author', async () => {
      await expect(
        service.create(
          {
            title: 'Article title',
            content: 'Body',
            status: ArticleStatus.draft,
            authorId: otherAuthorId,
          },
          editorUser,
        ),
      ).rejects.toThrow(
        new ForbiddenException('Editors can create only their own articles'),
      );

      expect(prismaMock.article.create).not.toHaveBeenCalled();
    });

    it('forces editor-created articles to use the current user as author', async () => {
      prismaMock.article.create.mockResolvedValue({
        ...mappedArticleRecord,
        status: ArticleStatus.draft,
      });

      await expect(
        service.create(
          {
            title: 'Article title',
            content: 'Body',
            status: ArticleStatus.draft,
            authorId,
            categoryId,
            tags: ['nestjs', 'testing'],
          },
          editorUser,
        ),
      ).resolves.toEqual({
        id: articleId,
        title: 'Article title',
        content: 'Body',
        status: ArticleStatus.draft,
        authorId,
        categoryId,
        tags: ['nestjs', 'testing'],
        createdAt: now.getTime(),
        updatedAt: now.getTime(),
      });

      expect(prismaMock.article.create).toHaveBeenCalledWith({
        data: {
          title: 'Article title',
          content: 'Body',
          status: ArticleStatus.draft,
          authorId,
          categoryId,
          articleTags: {
            create: [
              {
                tag: {
                  connectOrCreate: {
                    where: { name: 'nestjs' },
                    create: { name: 'nestjs' },
                  },
                },
              },
              {
                tag: {
                  connectOrCreate: {
                    where: { name: 'testing' },
                    create: { name: 'testing' },
                  },
                },
              },
            ],
          },
        },
        include: {
          articleTags: {
            include: {
              tag: true,
            },
          },
        },
      });
    });

    it('allows admins to create articles with an arbitrary author or null author', async () => {
      prismaMock.article.create.mockResolvedValue({
        ...mappedArticleRecord,
        authorId: null,
        articleTags: [],
      });

      await service.create(
        {
          title: 'Article title',
          content: 'Body',
          status: ArticleStatus.published,
        },
        adminUser,
      );

      expect(prismaMock.article.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            authorId: null,
            articleTags: undefined,
          }),
        }),
      );
    });
  });

  describe('getAll', () => {
    it('passes status, category, tag, and descending sort filters to prisma', async () => {
      prismaMock.article.findMany.mockResolvedValue([mappedArticleRecord]);

      await expect(
        service.getAll(
          ArticleStatus.published,
          categoryId,
          'nestjs',
          'createdAt',
          'desc',
        ),
      ).resolves.toEqual([
        {
          id: articleId,
          title: 'Article title',
          content: 'Body',
          status: ArticleStatus.published,
          authorId,
          categoryId,
          tags: ['nestjs', 'testing'],
          createdAt: now.getTime(),
          updatedAt: now.getTime(),
        },
      ]);

      expect(prismaMock.article.findMany).toHaveBeenCalledWith({
        orderBy: {
          createdAt: 'desc',
        },
        where: {
          status: ArticleStatus.published,
          categoryId,
          articleTags: {
            some: {
              tag: {
                name: 'nestjs',
              },
            },
          },
        },
        include: {
          articleTags: {
            include: {
              tag: true,
            },
          },
        },
      });
    });

    it('returns an empty tag list when articleTags are missing', async () => {
      prismaMock.article.findMany.mockResolvedValue([
        {
          ...mappedArticleRecord,
          articleTags: undefined,
        },
      ]);

      await expect(service.getAll()).resolves.toEqual([
        {
          id: articleId,
          title: 'Article title',
          content: 'Body',
          status: ArticleStatus.published,
          authorId,
          categoryId,
          tags: [],
          createdAt: now.getTime(),
          updatedAt: now.getTime(),
        },
      ]);
    });
  });

  describe('getOne', () => {
    it('rejects invalid uuids before querying prisma', async () => {
      await expect(service.getOne('bad-id')).rejects.toThrow(
        new BadRequestException('Invalid articleId format'),
      );

      expect(prismaMock.article.findUnique).not.toHaveBeenCalled();
    });

    it('returns a mapped article when found', async () => {
      prismaMock.article.findUnique.mockResolvedValue(mappedArticleRecord);

      await expect(service.getOne(articleId)).resolves.toEqual({
        id: articleId,
        title: 'Article title',
        content: 'Body',
        status: ArticleStatus.published,
        authorId,
        categoryId,
        tags: ['nestjs', 'testing'],
        createdAt: now.getTime(),
        updatedAt: now.getTime(),
      });

      expect(prismaMock.article.findUnique).toHaveBeenCalledWith({
        where: { id: articleId },
        include: {
          articleTags: {
            include: {
              tag: true,
            },
          },
        },
      });
    });

    it('throws not found when the article does not exist', async () => {
      prismaMock.article.findUnique.mockResolvedValue(null);

      await expect(service.getOne(articleId)).rejects.toThrow(
        new NotFoundException('Article not found'),
      );
    });
  });

  describe('update', () => {
    it('rejects invalid uuids before querying prisma', async () => {
      await expect(
        service.update('bad-id', { title: 'Updated' }, adminUser),
      ).rejects.toThrow(new BadRequestException('Invalid id format'));

      expect(prismaMock.article.findUnique).not.toHaveBeenCalled();
    });

    it('throws not found when the target article does not exist', async () => {
      prismaMock.article.findUnique.mockResolvedValue(null);

      await expect(
        service.update(articleId, { title: 'Updated' }, adminUser),
      ).rejects.toThrow(new NotFoundException('Article not found'));
    });

    it('prevents editors from updating another author’s article', async () => {
      prismaMock.article.findUnique.mockResolvedValue({
        id: articleId,
        authorId: otherAuthorId,
      });

      await expect(
        service.update(articleId, { title: 'Updated' }, editorUser),
      ).rejects.toThrow(
        new ForbiddenException('Editors can update only their own articles'),
      );
    });

    it('prevents editors from reassigning article ownership', async () => {
      prismaMock.article.findUnique.mockResolvedValue({
        id: articleId,
        authorId,
      });

      await expect(
        service.update(
          articleId,
          { authorId: otherAuthorId },
          editorUser,
        ),
      ).rejects.toThrow(
        new ForbiddenException('Editors cannot reassign article ownership'),
      );
    });

    it('forces editor updates to keep ownership on the current user and rewrites tags', async () => {
      prismaMock.article.findUnique.mockResolvedValue({
        id: articleId,
        authorId,
      });
      prismaMock.article.update.mockResolvedValue({
        ...mappedArticleRecord,
        title: 'Updated title',
        status: ArticleStatus.archived,
      });

      await expect(
        service.update(
          articleId,
          {
            title: 'Updated title',
            status: ArticleStatus.archived,
            authorId,
            tags: ['refactor'],
          },
          editorUser,
        ),
      ).resolves.toEqual({
        id: articleId,
        title: 'Updated title',
        content: 'Body',
        status: ArticleStatus.archived,
        authorId,
        categoryId,
        tags: ['nestjs', 'testing'],
        createdAt: now.getTime(),
        updatedAt: now.getTime(),
      });

      expect(prismaMock.article.update).toHaveBeenCalledWith({
        where: { id: articleId },
        data: {
          title: 'Updated title',
          status: ArticleStatus.archived,
          authorId,
          articleTags: {
            deleteMany: {},
            create: [
              {
                tag: {
                  connectOrCreate: {
                    where: { name: 'refactor' },
                    create: { name: 'refactor' },
                  },
                },
              },
            ],
          },
        },
        include: {
          articleTags: {
            include: {
              tag: true,
            },
          },
        },
      });
    });

    it('lets admins update without overriding authorId', async () => {
      prismaMock.article.findUnique.mockResolvedValue({
        id: articleId,
        authorId,
      });
      prismaMock.article.update.mockResolvedValue({
        ...mappedArticleRecord,
        authorId: otherAuthorId,
      });

      await service.update(
        articleId,
        {
          authorId: otherAuthorId,
          categoryId: null,
        },
        adminUser,
      );

      expect(prismaMock.article.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            authorId: otherAuthorId,
            categoryId: null,
          },
        }),
      );
    });
  });

  describe('remove', () => {
    it('rejects invalid uuids before querying prisma', async () => {
      await expect(service.remove('bad-id')).rejects.toThrow(
        new BadRequestException('Invalid id format'),
      );

      expect(prismaMock.article.findUnique).not.toHaveBeenCalled();
    });

    it('throws not found when the target article does not exist', async () => {
      prismaMock.article.findUnique.mockResolvedValue(null);

      await expect(service.remove(articleId)).rejects.toThrow(
        new NotFoundException('Article not found'),
      );
    });

    it('deletes the article when it exists', async () => {
      prismaMock.article.findUnique.mockResolvedValue({
        id: articleId,
      });
      prismaMock.article.delete.mockResolvedValue(undefined);

      await expect(service.remove(articleId)).resolves.toBeUndefined();

      expect(prismaMock.article.delete).toHaveBeenCalledWith({
        where: { id: articleId },
      });
    });
  });
});
