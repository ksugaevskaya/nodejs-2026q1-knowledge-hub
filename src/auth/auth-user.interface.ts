import { UserRole } from 'src/users/entities/user.entity';

export interface AuthUser {
  userId: string;
  login: string;
  role: UserRole;
}

export interface AuthenticatedRequest {
  headers: {
    authorization?: string;
  };
  user: AuthUser;
}
