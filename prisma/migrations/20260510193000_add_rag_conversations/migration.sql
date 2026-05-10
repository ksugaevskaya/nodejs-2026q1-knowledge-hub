-- CreateEnum
CREATE TYPE "RagMessageRole" AS ENUM ('user', 'assistant');

-- CreateTable
CREATE TABLE "RagConversation" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RagConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RagConversationMessage" (
    "id" UUID NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" "RagMessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RagConversationMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RagConversationMessage_conversationId_createdAt_idx" ON "RagConversationMessage"("conversationId", "createdAt");

-- AddForeignKey
ALTER TABLE "RagConversationMessage" ADD CONSTRAINT "RagConversationMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "RagConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
