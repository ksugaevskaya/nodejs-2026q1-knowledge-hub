import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
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
}
