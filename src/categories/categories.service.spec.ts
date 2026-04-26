import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from 'src/prisma/prisma.service';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NotFoundError, ValidationError } from '../common/errors';
import { CategoriesService } from './categories.service';

describe('CategoriesService', () => {
  let service: CategoriesService;

  const prismaMock = {
    category: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  };

  const categoryId = '8cb04d24-5be9-4a1f-b557-9c4d79db5ad7';

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
        {
          provide: CategoriesService,
          useFactory: (prisma: PrismaService) => new CategoriesService(prisma),
          inject: [PrismaService],
        },
      ],
    }).compile();

    service = module.get<CategoriesService>(CategoriesService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('creates a category with the provided name and description', async () => {
      prismaMock.category.create.mockResolvedValue({
        id: categoryId,
        name: 'Backend',
        description: 'Server-side knowledge',
      });

      await expect(
        service.create({
          name: 'Backend',
          description: 'Server-side knowledge',
        }),
      ).resolves.toEqual({
        id: categoryId,
        name: 'Backend',
        description: 'Server-side knowledge',
      });

      expect(prismaMock.category.create).toHaveBeenCalledWith({
        data: {
          name: 'Backend',
          description: 'Server-side knowledge',
        },
      });
    });
  });

  describe('getAll', () => {
    it('returns categories without ordering when no sort is provided', async () => {
      prismaMock.category.findMany.mockResolvedValue([
        {
          id: categoryId,
          name: 'Backend',
          description: 'Server-side knowledge',
        },
      ]);

      await expect(service.getAll()).resolves.toEqual([
        {
          id: categoryId,
          name: 'Backend',
          description: 'Server-side knowledge',
        },
      ]);

      expect(prismaMock.category.findMany).toHaveBeenCalledWith({
        orderBy: undefined,
      });
    });

    it('builds a descending order clause when requested', async () => {
      prismaMock.category.findMany.mockResolvedValue([]);

      await service.getAll('name', 'desc');

      expect(prismaMock.category.findMany).toHaveBeenCalledWith({
        orderBy: {
          name: 'desc',
        },
      });
    });
  });

  describe('getOne', () => {
    it('rejects invalid uuids before querying prisma', async () => {
      await expect(service.getOne('bad-id')).rejects.toThrow(
        new ValidationError('Invalid categoryId format'),
      );

      expect(prismaMock.category.findUnique).not.toHaveBeenCalled();
    });

    it('returns the category when found', async () => {
      prismaMock.category.findUnique.mockResolvedValue({
        id: categoryId,
        name: 'Backend',
        description: 'Server-side knowledge',
      });

      await expect(service.getOne(categoryId)).resolves.toEqual({
        id: categoryId,
        name: 'Backend',
        description: 'Server-side knowledge',
      });

      expect(prismaMock.category.findUnique).toHaveBeenCalledWith({
        where: { id: categoryId },
      });
    });

    it('throws not found when prisma returns no category', async () => {
      prismaMock.category.findUnique.mockResolvedValue(null);

      await expect(service.getOne(categoryId)).rejects.toThrow(
        new NotFoundError('Category not found'),
      );
    });
  });

  describe('update', () => {
    it('rejects invalid uuids before querying prisma', async () => {
      await expect(
        service.update('bad-id', { name: 'Updated' }),
      ).rejects.toThrow(new ValidationError('Invalid categoryId format'));

      expect(prismaMock.category.findUnique).not.toHaveBeenCalled();
    });

    it('throws not found when the target category does not exist', async () => {
      prismaMock.category.findUnique.mockResolvedValue(null);

      await expect(
        service.update(categoryId, { name: 'Updated' }),
      ).rejects.toThrow(new NotFoundError('Category not found'));
    });

    it('updates only the provided fields', async () => {
      prismaMock.category.findUnique.mockResolvedValue({
        id: categoryId,
        name: 'Backend',
        description: 'Server-side knowledge',
      });
      prismaMock.category.update.mockResolvedValue({
        id: categoryId,
        name: 'Backend',
        description: 'Updated description',
      });

      await expect(
        service.update(categoryId, {
          description: 'Updated description',
        }),
      ).resolves.toEqual({
        id: categoryId,
        name: 'Backend',
        description: 'Updated description',
      });

      expect(prismaMock.category.update).toHaveBeenCalledWith({
        where: { id: categoryId },
        data: {
          description: 'Updated description',
        },
      });
    });
  });

  describe('remove', () => {
    it('rejects invalid uuids before querying prisma', async () => {
      await expect(service.remove('bad-id')).rejects.toThrow(
        new ValidationError('Invalid categoryId format'),
      );

      expect(prismaMock.category.findUnique).not.toHaveBeenCalled();
    });

    it('throws not found when the target category does not exist', async () => {
      prismaMock.category.findUnique.mockResolvedValue(null);

      await expect(service.remove(categoryId)).rejects.toThrow(
        new NotFoundError('Category not found'),
      );
    });

    it('deletes the category when it exists', async () => {
      prismaMock.category.findUnique.mockResolvedValue({
        id: categoryId,
        name: 'Backend',
        description: 'Server-side knowledge',
      });
      prismaMock.category.delete.mockResolvedValue(undefined);

      await expect(service.remove(categoryId)).resolves.toBeUndefined();

      expect(prismaMock.category.delete).toHaveBeenCalledWith({
        where: { id: categoryId },
      });
    });
  });
});
