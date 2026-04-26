import { Injectable } from '@nestjs/common';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { validate as isUuid } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';
import { SortOrder } from '../common/types';
import { NotFoundError, ValidationError } from '../common/errors';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createCategoryDto: CreateCategoryDto) {
    return await this.prisma.category.create({
      data: {
        name: createCategoryDto.name,
        description: createCategoryDto.description,
      },
    });
  }

  async getAll(sortBy?: string, order?: SortOrder) {
    const orderByClause = sortBy
      ? { [sortBy]: order === 'desc' ? 'desc' : 'asc' }
      : undefined;

    return await this.prisma.category.findMany({
      orderBy: orderByClause,
    });
  }

  async getOne(id: string) {
    if (!isUuid(id)) {
      throw new ValidationError('Invalid categoryId format');
    }

    const category = await this.prisma.category.findUnique({
      where: { id },
    });

    if (!category) {
      throw new NotFoundError('Category not found');
    }

    return category;
  }

  async update(id: string, updateCategoryDto: UpdateCategoryDto) {
    if (!isUuid(id)) {
      throw new ValidationError('Invalid categoryId format');
    }

    const category = await this.prisma.category.findUnique({
      where: { id },
    });

    if (!category) {
      throw new NotFoundError('Category not found');
    }

    return await this.prisma.category.update({
      where: { id },
      data: {
        ...(updateCategoryDto.name && { name: updateCategoryDto.name }),
        ...(updateCategoryDto.description && {
          description: updateCategoryDto.description,
        }),
      },
    });
  }

  async remove(id: string) {
    if (!isUuid(id)) {
      throw new ValidationError('Invalid categoryId format');
    }

    const category = await this.prisma.category.findUnique({
      where: { id },
    });

    if (!category) {
      throw new NotFoundError('Category not found');
    }

    await this.prisma.category.delete({
      where: { id },
    });
  }
}
