import { Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './entities/user.entity';
import { randomUUID } from 'crypto';

@Injectable()
export class UsersService {
  private users: User[] = [];

  create(user: CreateUserDto) {
    const newUser: User = {
      id: randomUUID(),
      login: user.login,
      password: user.password,
      role: user.role,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.users.push(newUser);

    return;
  }

  findAll() {
    return `This action returns all users`;
  }

  findOne(id: number) {
    return `This action returns a #${id} user`;
  }

  update(id: number, updateUserDto: UpdateUserDto) {
    return `This action updates a #${id} user`;
  }

  remove(id: number) {
    return `This action removes a #${id} user`;
  }
}
