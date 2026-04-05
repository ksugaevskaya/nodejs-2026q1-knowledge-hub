import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { ArticlesService } from '../articles/articles.service';
import { CommentsService } from '../comments/comments.service';

describe('UsersController', () => {
  let controller: UsersController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
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

    controller = module.get<UsersController>(UsersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
