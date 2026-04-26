import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles-decorator';
import { UserRole } from 'src/users/entities/user.entity';
import { ForbiddenError, UnauthorizedError } from '../common/errors';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedError('Unauthorized');
    }

    if (!requiredRoles.includes(user.role)) {
      throw new ForbiddenError('Access denied');
    }

    return true;
  }
}
