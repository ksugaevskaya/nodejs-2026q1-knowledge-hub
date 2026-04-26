import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Query,
  HttpCode,
  Put,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { ArticlesService } from './articles.service';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { SortOrder } from '../common/types';
import { ArticleStatus } from '@prisma/client';
import { Roles } from 'src/auth/roles-decorator';
import { UserRole } from 'src/users/entities/user.entity';
import { AuthenticatedRequest } from 'src/auth/auth-user.interface';
import { ParseUuidPipe } from 'src/common/pipes/parse-uuid.pipe';

@Controller('article')
export class ArticlesController {
  constructor(private readonly articlesService: ArticlesService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.EDITOR)
  create(
    @Body() createArticleDto: CreateArticleDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.articlesService.create(createArticleDto, req.user);
  }

  @Get()
  getAll(
    @Query('status') status: ArticleStatus,
    @Query('categoryId') categoryId: string,
    @Query('tag') tag: string,
    @Query('sortBy') sortBy?: string,
    @Query('order') order?: SortOrder,
  ) {
    return this.articlesService.getAll(status, categoryId, tag, sortBy, order);
  }

  @Get(':id')
  getOne(@Param('id', new ParseUuidPipe('articleId')) id: string) {
    return this.articlesService.getOne(id);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN, UserRole.EDITOR)
  update(
    @Param('id', new ParseUuidPipe('id')) id: string,
    @Body() updateArticleDto: UpdateArticleDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.articlesService.update(id, updateArticleDto, req.user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.ADMIN)
  remove(@Param('id', new ParseUuidPipe('id')) id: string) {
    return this.articlesService.remove(id);
  }
}
