import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdatePasswordDto } from './dto/update-user-password.dto';
import { User } from './entities/user.entity';
import { randomUUID } from 'crypto';
import { validate as isUuid } from 'uuid';

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

    return {
      id: newUser.id,
      login: newUser.login,
      role: newUser.role,
      createdAt: newUser.createdAt,
      updatedAt: newUser.updatedAt,
    };
  }

  getAll() {
    const allUsers = this.users.map((user) => ({
      id: user.id,
      login: user.login,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    }));

    return allUsers;
  }

  getOne(id: string) {
    if (!isUuid(id)) {
      throw new BadRequestException('Invalid userId format');
    }

    const user = this.users.find((user) => user.id === id);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      id: user.id,
      login: user.login,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  updatePassword(id: string, updatePasswordDto: UpdatePasswordDto) {
    if (!isUuid(id)) {
      throw new BadRequestException('Invalid userId format');
    }

    const user = this.users.find((user) => user.id === id);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.password !== updatePasswordDto.oldPassword) {
      throw new ForbiddenException('Old password is incorrect');
    }

    user.password = updatePasswordDto.newPassword;

    return {
      id: user.id,
      login: user.login,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  remove(id: string) {
    if (!isUuid(id)) {
      throw new BadRequestException('Invalid userId format');
    }

    const userIndex = this.users.findIndex((user) => user.id === id);

    if (userIndex === -1) {
      throw new NotFoundException('User not found');
    }

    this.users.splice(userIndex, 1);
  }
}
