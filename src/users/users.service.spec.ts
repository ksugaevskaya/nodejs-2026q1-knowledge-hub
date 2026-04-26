import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from 'src/prisma/prisma.service';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthUser } from 'src/auth/auth-user.interface';
import { UsersService } from './users.service';
import { UserRole } from './entities/user.entity';

describe('UsersService', () => {
  let service: UsersService;

  const prismaMock = {
    user: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    article: {
      updateMany: vi.fn(),
    },
    comment: {
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn(),
  };

  const userId = '8cb04d24-5be9-4a1f-b557-9c4d79db5ad7';
  const anotherUserId = '7d43f7c4-e296-4ba1-9d93-c41d73e86e13';
  const now = new Date('2026-02-01T12:00:00.000Z');

  const adminUser: AuthUser = {
    userId: '5f761d7d-bc8f-44ff-8a3d-5268bfa5b983',
    login: 'admin',
    role: UserRole.ADMIN,
  };

  const editorUser: AuthUser = {
    userId: '0e27ba0e-f361-4be9-9a49-b06d860f8ad0',
    login: 'editor',
    role: UserRole.EDITOR,
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    prismaMock.article.updateMany.mockReturnValue({
      kind: 'article-update-many',
    });
    prismaMock.comment.deleteMany.mockReturnValue({
      kind: 'comment-delete-many',
    });
    prismaMock.user.delete.mockReturnValue({
      kind: 'user-delete',
    });
    prismaMock.$transaction.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
        {
          provide: UsersService,
          useFactory: (prisma: PrismaService) => new UsersService(prisma),
          inject: [PrismaService],
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('creates a user with the default viewer role and maps timestamps', async () => {
      prismaMock.user.create.mockResolvedValue({
        id: userId,
        login: 'new-user',
        role: UserRole.VIEWER,
        createdAt: now,
        updatedAt: now,
      });

      await expect(
        service.create({
          login: 'new-user',
          password: 'secret123',
        }),
      ).resolves.toEqual({
        id: userId,
        login: 'new-user',
        role: UserRole.VIEWER,
        createdAt: now.getTime(),
        updatedAt: now.getTime(),
      });

      expect(prismaMock.user.create).toHaveBeenCalledWith({
        data: {
          login: 'new-user',
          password: 'secret123',
          role: UserRole.VIEWER,
        },
        select: {
          id: true,
          login: true,
          role: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    });

    it('passes through an explicit role', async () => {
      prismaMock.user.create.mockResolvedValue({
        id: userId,
        login: 'admin-user',
        role: UserRole.ADMIN,
        createdAt: now,
        updatedAt: now,
      });

      await service.create({
        login: 'admin-user',
        password: 'secret123',
        role: UserRole.ADMIN,
      });

      expect(prismaMock.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            role: UserRole.ADMIN,
          }),
        }),
      );
    });

    it('normalizes unique constraint failures into a bad request error', async () => {
      prismaMock.user.create.mockRejectedValue(
        new Error('Unique constraint failed on the fields: (`login`)'),
      );

      await expect(
        service.create({
          login: 'taken-user',
          password: 'secret123',
        }),
      ).rejects.toThrow(new BadRequestException('Login already exists'));
    });

    it('rethrows non-constraint create errors', async () => {
      const failure = new Error('database unavailable');
      prismaMock.user.create.mockRejectedValue(failure);

      await expect(
        service.create({
          login: 'new-user',
          password: 'secret123',
        }),
      ).rejects.toBe(failure);
    });
  });

  describe('getAll', () => {
    it('returns mapped users without ordering when no sort is provided', async () => {
      prismaMock.user.findMany.mockResolvedValue([
        {
          id: userId,
          login: 'alpha',
          role: UserRole.VIEWER,
          createdAt: now,
          updatedAt: now,
        },
      ]);

      await expect(service.getAll()).resolves.toEqual([
        {
          id: userId,
          login: 'alpha',
          role: UserRole.VIEWER,
          createdAt: now.getTime(),
          updatedAt: now.getTime(),
        },
      ]);

      expect(prismaMock.user.findMany).toHaveBeenCalledWith({
        select: {
          id: true,
          login: true,
          role: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: undefined,
      });
    });

    it('builds a descending order clause when requested', async () => {
      prismaMock.user.findMany.mockResolvedValue([]);

      await service.getAll('login', 'desc');

      expect(prismaMock.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: {
            login: 'desc',
          },
        }),
      );
    });
  });

  describe('getOne', () => {
    it('rejects invalid uuids before querying prisma', async () => {
      await expect(service.getOne('not-a-uuid')).rejects.toThrow(
        new BadRequestException('Invalid userId format'),
      );

      expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
    });

    it('returns a mapped user when found', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: userId,
        login: 'reader',
        role: UserRole.VIEWER,
        createdAt: now,
        updatedAt: now,
      });

      await expect(service.getOne(userId)).resolves.toEqual({
        id: userId,
        login: 'reader',
        role: UserRole.VIEWER,
        createdAt: now.getTime(),
        updatedAt: now.getTime(),
      });

      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { id: userId },
        select: {
          id: true,
          login: true,
          role: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    });

    it('throws not found when prisma returns no user', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(service.getOne(userId)).rejects.toThrow(
        new NotFoundException('User not found'),
      );
    });
  });

  describe('updatePassword', () => {
    it('rejects invalid uuids before checking permissions', async () => {
      await expect(
        service.updatePassword('bad-id', {}, adminUser),
      ).rejects.toThrow(new BadRequestException('Invalid userId format'));

      expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
    });

    it('allows only admins to update users', async () => {
      await expect(
        service.updatePassword(userId, { role: UserRole.VIEWER }, editorUser),
      ).rejects.toThrow(new ForbiddenException('Access denied'));

      expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
    });

    it('requires at least one password or role change', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: userId,
        login: 'reader',
        password: 'old-secret',
        role: UserRole.VIEWER,
      });

      await expect(service.updatePassword(userId, {}, adminUser)).rejects.toThrow(
        new BadRequestException(
          'At least one of oldPassword/newPassword or role is required',
        ),
      );
    });

    it('throws not found when the target user does not exist', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(
        service.updatePassword(userId, { role: UserRole.EDITOR }, adminUser),
      ).rejects.toThrow(new NotFoundException('User not found'));
    });

    it('requires both old and new password when changing a password', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: userId,
        login: 'reader',
        password: 'old-secret',
        role: UserRole.VIEWER,
      });

      await expect(
        service.updatePassword(
          userId,
          { oldPassword: 'old-secret' },
          adminUser,
        ),
      ).rejects.toThrow(
        new BadRequestException('Both oldPassword and newPassword are required'),
      );
    });

    it('rejects updates when the old password does not match', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: userId,
        login: 'reader',
        password: 'old-secret',
        role: UserRole.VIEWER,
      });

      await expect(
        service.updatePassword(
          userId,
          {
            oldPassword: 'wrong-secret',
            newPassword: 'next-secret',
          },
          adminUser,
        ),
      ).rejects.toThrow(new ForbiddenException('Old password is incorrect'));
    });

    it('updates password and role and maps timestamps', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: userId,
        login: 'reader',
        password: 'old-secret',
        role: UserRole.VIEWER,
      });
      prismaMock.user.update.mockResolvedValue({
        id: userId,
        login: 'reader',
        role: UserRole.EDITOR,
        createdAt: now,
        updatedAt: now,
      });

      await expect(
        service.updatePassword(
          userId,
          {
            oldPassword: 'old-secret',
            newPassword: 'next-secret',
            role: UserRole.EDITOR,
          },
          adminUser,
        ),
      ).resolves.toEqual({
        id: userId,
        login: 'reader',
        role: UserRole.EDITOR,
        createdAt: now.getTime(),
        updatedAt: now.getTime(),
      });

      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: {
          password: 'next-secret',
          role: UserRole.EDITOR,
        },
        select: {
          id: true,
          login: true,
          role: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    });
  });

  describe('remove', () => {
    it('rejects invalid uuids before querying prisma', async () => {
      await expect(service.remove('bad-id')).rejects.toThrow(
        new BadRequestException('Invalid userId format'),
      );

      expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
    });

    it('throws not found when the target user does not exist', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(service.remove(userId)).rejects.toThrow(
        new NotFoundException('User not found'),
      );
    });

    it('cleans up authored data inside a transaction before deleting the user', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: anotherUserId,
        login: 'to-remove',
        password: 'secret123',
        role: UserRole.EDITOR,
      });

      await expect(service.remove(anotherUserId)).resolves.toBeUndefined();

      expect(prismaMock.article.updateMany).toHaveBeenCalledWith({
        where: { authorId: anotherUserId },
        data: { authorId: null },
      });
      expect(prismaMock.comment.deleteMany).toHaveBeenCalledWith({
        where: { authorId: anotherUserId },
      });
      expect(prismaMock.user.delete).toHaveBeenCalledWith({
        where: { id: anotherUserId },
      });
      expect(prismaMock.$transaction).toHaveBeenCalledWith([
        { kind: 'article-update-many' },
        { kind: 'comment-delete-many' },
        { kind: 'user-delete' },
      ]);
    });
  });
});
