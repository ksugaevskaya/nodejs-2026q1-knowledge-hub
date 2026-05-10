import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { ArticlesModule } from '../articles/articles.module';
import { PrismaService } from '../prisma/prisma.service';
import { RagController } from './rag.controller';
import { RagChunkingService } from './rag-chunking.service';
import { RagService } from './rag.service';
import { RagVectorStoreService } from './rag-vector-store.service';

@Module({
  imports: [ArticlesModule, AiModule],
  controllers: [RagController],
  providers: [
    RagService,
    RagChunkingService,
    RagVectorStoreService,
    PrismaService,
  ],
  exports: [RagService],
})
export class RagModule {}
