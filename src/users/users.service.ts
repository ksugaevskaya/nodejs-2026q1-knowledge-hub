import { Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdatePasswordDto } from './dto/update-user-password.dto';
import { UserRole } from './entities/user.entity';
import { validate as isUuid } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';
import { SortOrder } from '../common/types';
import { AuthUser } from 'src/auth/auth-user.interface';
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../common/errors';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(user: CreateUserDto) {
    try {
      const newUser = await this.prisma.user.create({
        data: {
          login: user.login,
          password: user.password,
          role: user.role || UserRole.VIEWER,
        },
        select: {
          id: true,
          login: true,
          role: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return {
        id: newUser.id,
        login: newUser.login,
        role: newUser.role,
        createdAt: newUser.createdAt.getTime(),
        updatedAt: newUser.updatedAt.getTime(),
      };
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes('Unique constraint failed')
      ) {
        throw new ValidationError('Login already exists');
      }
      throw error;
    }
  }

  async getAll(sortBy?: string, order?: SortOrder) {
    const orderByClause = sortBy
      ? { [sortBy]: order === 'desc' ? 'desc' : 'asc' }
      : undefined;

    const allUsers = await this.prisma.user.findMany({
      select: {
        id: true,
        login: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: orderByClause,
    });

    return allUsers.map((user) => ({
      id: user.id,
      login: user.login,
      role: user.role,
      createdAt: user.createdAt.getTime(),
      updatedAt: user.updatedAt.getTime(),
    }));
  }

  async getOne(id: string) {
    if (!isUuid(id)) {
      throw new ValidationError('Invalid userId format');
    }

    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        login: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    return {
      id: user.id,
      login: user.login,
      role: user.role,
      createdAt: user.createdAt.getTime(),
      updatedAt: user.updatedAt.getTime(),
    };
  }

  async updatePassword(
    id: string,
    updatePasswordDto: UpdatePasswordDto,
    currentUser: AuthUser,
  ) {
    if (!isUuid(id)) {
      throw new ValidationError('Invalid userId format');
    }

    if (currentUser.role !== UserRole.ADMIN) {
      throw new ForbiddenError('Access denied');
    }

    const hasRoleUpdate = updatePasswordDto.role !== undefined;
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    const hasPasswordUpdate =
      updatePasswordDto.oldPassword !== undefined ||
      updatePasswordDto.newPassword !== undefined;

    if (!hasPasswordUpdate && !hasRoleUpdate) {
      throw new ValidationError(
        'At least one of oldPassword/newPassword or role is required',
      );
    }

    if (!user) {
      throw new NotFoundError('User not found');
    }

    if (
      hasPasswordUpdate &&
      (!updatePasswordDto.oldPassword || !updatePasswordDto.newPassword)
    ) {
      throw new ValidationError(
        'Both oldPassword and newPassword are required',
      );
    }

    if (
      updatePasswordDto.oldPassword &&
      user.password !== updatePasswordDto.oldPassword
    ) {
      throw new ForbiddenError('Old password is incorrect');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: {
        ...(updatePasswordDto.newPassword && {
          password: updatePasswordDto.newPassword,
        }),
        ...(updatePasswordDto.role && { role: updatePasswordDto.role }),
      },
      select: {
        id: true,
        login: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return {
      id: updatedUser.id,
      login: updatedUser.login,
      role: updatedUser.role,
      createdAt: updatedUser.createdAt.getTime(),
      updatedAt: updatedUser.updatedAt.getTime(),
    };
  }

  async remove(id: string) {
    if (!isUuid(id)) {
      throw new ValidationError('Invalid userId format');
    }

    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    await this.prisma.$transaction([
      this.prisma.article.updateMany({
        where: { authorId: id },
        data: { authorId: null },
      }),
      this.prisma.comment.deleteMany({
        where: { authorId: id },
      }),
      this.prisma.user.delete({
        where: { id },
      }),
    ]);
  }
}
