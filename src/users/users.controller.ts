import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
  HttpCode,
  HttpStatus,
  Query,
  Req,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdatePasswordDto } from './dto/update-user-password.dto';
import { SortOrder } from '../common/types';
import { Roles } from 'src/auth/roles-decorator';
import { UserRole } from './entities/user.entity';
import { AuthenticatedRequest } from 'src/auth/auth-user.interface';
import { ParseUuidPipe } from 'src/common/pipes/parse-uuid.pipe';

@Controller('user')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  create(@Body() user: CreateUserDto) {
    return this.usersService.create(user);
  }

  @Get()
  getAll(@Query('sortBy') sortBy?: string, @Query('order') order?: SortOrder) {
    return this.usersService.getAll(sortBy, order);
  }

  @Get(':id')
  getOne(@Param('id', new ParseUuidPipe('userId')) id: string) {
    return this.usersService.getOne(id);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN)
  updatePassword(
    @Param('id', new ParseUuidPipe('userId')) id: string,
    @Body() updatePasswordDto: UpdatePasswordDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.usersService.updatePassword(id, updatePasswordDto, req.user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.ADMIN)
  remove(@Param('id', new ParseUuidPipe('userId')) id: string) {
    return this.usersService.remove(id);
  }
}
