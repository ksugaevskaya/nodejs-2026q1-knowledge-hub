import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { Category } from './entities/category.entity';
import { randomUUID } from 'crypto';
import { validate as isUuid } from 'uuid';

@Injectable()
export class CategoriesService {
  private categories: Category[] = [];

  create(createCategoryDto: CreateCategoryDto) {
    const newCategory = {
      id: randomUUID(),
      name: createCategoryDto.name,
      description: createCategoryDto.description,
    };

    this.categories.push(newCategory);

    return newCategory;
  }

  getAll() {
    return this.categories;
  }

  getOne(id: string) {
    if (!isUuid(id)) {
      throw new BadRequestException('Invalid userId format');
    }

    const category = this.categories.find((item) => item.id === id);

    if (!category) {
      throw new NotFoundException("Category not found'");
    }
    return category;
  }

  update(id: string, updateCategoryDto: UpdateCategoryDto) {
    if (!isUuid(id)) {
      throw new BadRequestException('Invalid userId format');
    }

    const category = this.categories.find((item) => item.id === id);

    if (!category) {
      throw new NotFoundException("Category not found'");
    }

    if (updateCategoryDto.name) {
      category.name = updateCategoryDto.name;
    }

    if (updateCategoryDto.description) {
      category.description = updateCategoryDto.description;
    }
    return category;
  }

  remove(id: number) {
    return `This action removes a #${id} category`;
  }
}
