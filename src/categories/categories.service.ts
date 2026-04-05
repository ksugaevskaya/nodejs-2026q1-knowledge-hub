import { Injectable } from '@nestjs/common';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { Category } from './entities/category.entity';
import { randomUUID } from 'crypto';

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

  findAll() {
    return `This action returns all categories`;
  }

  findOne(id: number) {
    return `This action returns a #${id} category`;
  }

  update(id: number, updateCategoryDto: UpdateCategoryDto) {
    return `This action updates a #${id} category`;
  }

  remove(id: number) {
    return `This action removes a #${id} category`;
  }
}
