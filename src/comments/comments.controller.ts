import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Query,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { SortOrder } from '../common/types';
import { Roles } from 'src/auth/roles-decorator';
import { UserRole } from 'src/users/entities/user.entity';
import { AuthenticatedRequest } from 'src/auth/auth-user.interface';
import { ParseUuidPipe } from 'src/common/pipes/parse-uuid.pipe';

@Controller('comment')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.EDITOR)
  create(
    @Body() createCommentDto: CreateCommentDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.commentsService.create(createCommentDto, req.user);
  }

  @Get()
  getAll(
    @Query('articleId') articleId: string,
    @Query('sortBy') sortBy?: string,
    @Query('order') order?: SortOrder,
  ) {
    return this.commentsService.getAll(articleId, sortBy, order);
  }

  @Get(':id')
  getOne(@Param('id', new ParseUuidPipe('commentId')) id: string) {
    return this.commentsService.getOne(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.ADMIN, UserRole.EDITOR)
  remove(
    @Param('id', new ParseUuidPipe('commentId')) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.commentsService.remove(id, req.user);
  }
}
