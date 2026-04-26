import { UnprocessableEntityException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from 'src/prisma/prisma.service';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthUser } from 'src/auth/auth-user.interface';
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../common/errors';
import { CommentsService } from './comments.service';
import { UserRole } from 'src/users/entities/user.entity';

describe('CommentsService', () => {
  let service: CommentsService;

  const prismaMock = {
    article: {
      findUnique: vi.fn(),
    },
    comment: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
  };

  const commentId = '8cb04d24-5be9-4a1f-b557-9c4d79db5ad7';
  const articleId = '7d43f7c4-e296-4ba1-9d93-c41d73e86e13';
  const authorId = '4d1ff86f-f7c5-4269-87c4-86158c515914';
  const otherAuthorId = '0e27ba0e-f361-4be9-9a49-b06d860f8ad0';
  const now = new Date('2026-03-01T08:15:00.000Z');

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

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
        {
          provide: CommentsService,
          useFactory: (prisma: PrismaService) => new CommentsService(prisma),
          inject: [PrismaService],
        },
      ],
    }).compile();

    service = module.get<CommentsService>(CommentsService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('rejects comments for missing articles', async () => {
      prismaMock.article.findUnique.mockResolvedValue(null);

      await expect(
        service.create(
          {
            content: 'Nice article',
            articleId,
          },
          editorUser,
        ),
      ).rejects.toThrow(new UnprocessableEntityException('Article not found'));

      expect(prismaMock.comment.create).not.toHaveBeenCalled();
    });

    it('prevents editors from creating comments for another author', async () => {
      prismaMock.article.findUnique.mockResolvedValue({ id: articleId });

      await expect(
        service.create(
          {
            content: 'Nice article',
            articleId,
            authorId: otherAuthorId,
          },
          editorUser,
        ),
      ).rejects.toThrow(
        new ForbiddenError('Editors can create only their own comments'),
      );

      expect(prismaMock.comment.create).not.toHaveBeenCalled();
    });

    it('forces editor-created comments to use the current user as author', async () => {
      prismaMock.article.findUnique.mockResolvedValue({ id: articleId });
      prismaMock.comment.create.mockResolvedValue({
        id: commentId,
        content: 'Nice article',
        articleId,
        authorId,
        createdAt: now,
      });

      await expect(
        service.create(
          {
            content: 'Nice article',
            articleId,
            authorId,
          },
          editorUser,
        ),
      ).resolves.toEqual({
        id: commentId,
        content: 'Nice article',
        articleId,
        authorId,
        createdAt: now.getTime(),
      });

      expect(prismaMock.comment.create).toHaveBeenCalledWith({
        data: {
          content: 'Nice article',
          articleId,
          authorId,
        },
      });
    });

    it('lets admins create comments with a null author', async () => {
      prismaMock.article.findUnique.mockResolvedValue({ id: articleId });
      prismaMock.comment.create.mockResolvedValue({
        id: commentId,
        content: 'Official note',
        articleId,
        authorId: null,
        createdAt: now,
      });

      await service.create(
        {
          content: 'Official note',
          articleId,
        },
        adminUser,
      );

      expect(prismaMock.comment.create).toHaveBeenCalledWith({
        data: {
          content: 'Official note',
          articleId,
          authorId: null,
        },
      });
    });
  });

  describe('getAll', () => {
    it('requires an article id', async () => {
      await expect(service.getAll('')).rejects.toThrow(
        new ValidationError('ArticleId is required'),
      );

      expect(prismaMock.comment.findMany).not.toHaveBeenCalled();
    });

    it('passes order and article filters to prisma and maps results', async () => {
      prismaMock.comment.findMany.mockResolvedValue([
        {
          id: commentId,
          content: 'Nice article',
          articleId,
          authorId,
          createdAt: now,
        },
      ]);

      await expect(
        service.getAll(articleId, 'createdAt', 'desc'),
      ).resolves.toEqual([
        {
          id: commentId,
          content: 'Nice article',
          articleId,
          authorId,
          createdAt: now.getTime(),
        },
      ]);

      expect(prismaMock.comment.findMany).toHaveBeenCalledWith({
        orderBy: {
          createdAt: 'desc',
        },
        where: {
          articleId,
        },
      });
    });
  });

  describe('getOne', () => {
    it('rejects invalid uuids before querying prisma', async () => {
      await expect(service.getOne('bad-id')).rejects.toThrow(
        new ValidationError('Invalid commentId format'),
      );

      expect(prismaMock.comment.findUnique).not.toHaveBeenCalled();
    });

    it('returns a mapped comment when found', async () => {
      prismaMock.comment.findUnique.mockResolvedValue({
        id: commentId,
        content: 'Nice article',
        articleId,
        authorId,
        createdAt: now,
      });

      await expect(service.getOne(commentId)).resolves.toEqual({
        id: commentId,
        content: 'Nice article',
        articleId,
        authorId,
        createdAt: now.getTime(),
      });
    });

    it('throws not found when the comment does not exist', async () => {
      prismaMock.comment.findUnique.mockResolvedValue(null);

      await expect(service.getOne(commentId)).rejects.toThrow(
        new NotFoundError('Comment not found'),
      );
    });
  });

  describe('remove', () => {
    it('rejects invalid uuids before querying prisma', async () => {
      await expect(service.remove('bad-id', adminUser)).rejects.toThrow(
        new ValidationError('Invalid commentId format'),
      );

      expect(prismaMock.comment.findUnique).not.toHaveBeenCalled();
    });

    it('throws not found when the comment does not exist', async () => {
      prismaMock.comment.findUnique.mockResolvedValue(null);

      await expect(service.remove(commentId, adminUser)).rejects.toThrow(
        new NotFoundError('Comment not found'),
      );
    });

    it('prevents editors from deleting another author’s comment', async () => {
      prismaMock.comment.findUnique.mockResolvedValue({
        id: commentId,
        authorId: otherAuthorId,
      });

      await expect(service.remove(commentId, editorUser)).rejects.toThrow(
        new ForbiddenError('Editors can delete only their own comments'),
      );

      expect(prismaMock.comment.delete).not.toHaveBeenCalled();
    });

    it('allows editors to delete their own comments', async () => {
      prismaMock.comment.findUnique.mockResolvedValue({
        id: commentId,
        authorId,
      });
      prismaMock.comment.delete.mockResolvedValue(undefined);

      await expect(
        service.remove(commentId, editorUser),
      ).resolves.toBeUndefined();

      expect(prismaMock.comment.delete).toHaveBeenCalledWith({
        where: { id: commentId },
      });
    });

    it('allows admins to delete any comment', async () => {
      prismaMock.comment.findUnique.mockResolvedValue({
        id: commentId,
        authorId: otherAuthorId,
      });
      prismaMock.comment.delete.mockResolvedValue(undefined);

      await expect(
        service.remove(commentId, adminUser),
      ).resolves.toBeUndefined();

      expect(prismaMock.comment.delete).toHaveBeenCalledWith({
        where: { id: commentId },
      });
    });
  });
});
