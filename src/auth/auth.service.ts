import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { SignupDto } from './dto/signup';
import * as bcrypt from 'bcrypt';
import { UserRole } from 'src/users/entities/user.entity';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async signUp(data: SignupDto) {
    const existingUser = this.prisma.user.findFirst({
      where: {
        login: data.login,
      },
    });

    if (existingUser) {
      throw new BadRequestException('Login is already taken');
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);

    const user = this.prisma.user.create({
      data: {
        login: data.login,
        password: hashedPassword,
        role: data.role || UserRole.VIEWER,
      },
      select: {
        id: true,
        login: true,
        role: true,
      },
    });

    return user;
  }
}
