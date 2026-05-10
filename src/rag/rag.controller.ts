import { Controller } from '@nestjs/common';
import { RagService } from './rag.service';

@Controller('ai/rag')
export class RagController {
  constructor(private readonly ragService: RagService) {}
}
