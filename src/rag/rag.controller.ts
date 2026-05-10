import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ReindexRequestDto } from './dto/reindex-request.dto';
import { RagService } from './rag.service';

@Controller('ai/rag')
export class RagController {
  constructor(private readonly ragService: RagService) {}

  @Post('index')
  @HttpCode(HttpStatus.OK)
  reindex(@Body() dto: ReindexRequestDto) {
    return this.ragService.reindex(dto);
  }
}
