import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { ArticlesService } from '../articles/articles.service';
import { CommentsService } from '../comments/comments.service';
import { UserRole } from './entities/user.entity';

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: ArticlesService,
          useValue: {},
        },
        {
          provide: CommentsService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a user with default role viewer', () => {
      const dto = {
        login: 'testuser',
        password: 'password123',
      };

      const result = service.create(dto);

      expect(result).toHaveProperty('id');
      expect(result.login).toBe('testuser');
      expect(result.role).toBe(UserRole.VIEWER);
    });

    it('should create a user with custom role', () => {
      const dto = {
        login: 'admin',
        password: 'password123',
        role: UserRole.ADMIN,
      };

      const result = service.create(dto);

      expect(result.role).toBe(UserRole.ADMIN);
    });
  });

  describe('getAll', () => {
    it('should return all users', () => {
      service.create({
        login: 'user1',
        password: 'pass1',
      });

      service.create({
        login: 'user2',
        password: 'pass2',
      });

      const users = service.getAll();

      expect(users).toHaveLength(2);
    });

    it('should sort users by login in ascending order', () => {
      service.create({
        login: 'zebra',
        password: 'pass1',
      });

      service.create({
        login: 'apple',
        password: 'pass2',
      });

      const sorted = service.getAll('login', 'asc');

      expect(sorted[0].login).toBe('apple');
      expect(sorted[1].login).toBe('zebra');
    });

    it('should sort users by login in descending order', () => {
      service.create({
        login: 'apple',
        password: 'pass1',
      });

      service.create({
        login: 'zebra',
        password: 'pass2',
      });

      const sorted = service.getAll('login', 'desc');

      expect(sorted[0].login).toBe('zebra');
      expect(sorted[1].login).toBe('apple');
    });
  });

  describe('getOne', () => {
    it('should get a user by id', () => {
      const created = service.create({
        login: 'testuser',
        password: 'password',
      });

      const found = service.getOne(created.id);

      expect(found.id).toBe(created.id);
      expect(found.login).toBe('testuser');
    });

    it('should throw NotFoundException if user not found', () => {
      expect(() => service.getOne('nonexistent-id')).toThrow();
    });
  });
});
