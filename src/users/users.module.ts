import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { ArticlesModule } from '../articles/articles.module';
import { CommentsModule } from '../comments/comments.module';

@Module({
  imports: [ArticlesModule, CommentsModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
