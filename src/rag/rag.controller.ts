import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { ParseUuidPipe } from '../common/pipes/parse-uuid.pipe';
import { RagChatRequestDto } from './dto/rag-chat-request.dto';
import { ReindexRequestDto } from './dto/reindex-request.dto';
import { RagSearchRequestDto } from './dto/rag-search-request.dto';
import { RagService } from './rag.service';

@Controller('ai/rag')
export class RagController {
  constructor(private readonly ragService: RagService) {}

  @Post('index')
  @HttpCode(HttpStatus.OK)
  reindex(@Body() dto: ReindexRequestDto) {
    return this.ragService.reindex(dto);
  }

  @Post('search')
  @HttpCode(HttpStatus.OK)
  search(@Body() dto: RagSearchRequestDto) {
    return this.ragService.search(dto);
  }

  @Post('chat')
  @HttpCode(HttpStatus.OK)
  chat(@Body() dto: RagChatRequestDto) {
    return this.ragService.chat(dto);
  }

  @Delete('index/articles/:articleId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteIndexedArticle(
    @Param('articleId', new ParseUuidPipe('articleId')) articleId: string,
  ): Promise<void> {
    await this.ragService.deleteIndexedArticle(articleId);
  }
}
