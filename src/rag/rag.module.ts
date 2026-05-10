import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { ArticlesModule } from '../articles/articles.module';
import { PrismaService } from '../prisma/prisma.service';
import { RagController } from './rag.controller';
import { RagService } from './rag.service';

@Module({
  imports: [ArticlesModule, AiModule],
  controllers: [RagController],
  providers: [RagService, PrismaService],
  exports: [RagService],
})
export class RagModule {}
