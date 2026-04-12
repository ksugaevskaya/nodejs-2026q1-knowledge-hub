import 'dotenv/config';
import { PrismaClient, ArticleStatus, Role } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({
  adapter,
});

async function main() {
  await prisma.user.create({
    data: {
      login: 'admin',
      password: 'admin123!',
      role: Role.ADMIN,
    },
  });

  const editor = await prisma.user.create({
    data: {
      login: 'editor',
      password: 'editor123!',
      role: Role.EDITOR,
    },
  });

  const technology = await prisma.category.create({
    data: {
      name: 'Technology',
      description: 'All about tech',
    },
  });

  const ai = await prisma.category.create({
    data: {
      name: 'AI',
      description: 'All about AI',
    },
  });

  const science = await prisma.category.create({
    data: {
      name: 'Science',
      description: 'All about science',
    },
  });

  const techTag = await prisma.tag.create({
    data: {
      name: 'tech',
    },
  });

  const aiTag = await prisma.tag.create({
    data: {
      name: 'ai',
    },
  });

  const scienceTag = await prisma.tag.create({
    data: {
      name: 'science',
    },
  });

  const jsTag = await prisma.tag.create({
    data: {
      name: 'js',
    },
  });

  const nodeTag = await prisma.tag.create({
    data: {
      name: 'node',
    },
  });

  const backendTag = await prisma.tag.create({
    data: {
      name: 'backend',
    },
  });

  const futureTag = await prisma.tag.create({
    data: {
      name: 'future',
    },
  });

  const researchTag = await prisma.tag.create({
    data: {
      name: 'research',
    },
  });

  const nodeArticle = await prisma.article.create({
    data: {
      title: 'Node.js in 2026',
      content:
        'You should learn Node.js fundamentals, modules, and working with APIs.',
      status: ArticleStatus.DRAFT,
      authorId: editor.id,
      categoryId: technology.id,
    },
  });

  await prisma.articleTag.createMany({
    data: [
      { articleId: nodeArticle.id, tagId: nodeTag.id },
      { articleId: nodeArticle.id, tagId: jsTag.id },
      { articleId: nodeArticle.id, tagId: backendTag.id },
    ],
  });

  const aiArticle = await prisma.article.create({
    data: {
      title: 'How AI changes everyday work',
      content:
        'Artificial intelligence is becoming part of daily work, learning, and communication.',
      status: ArticleStatus.PUBLISHED,
      authorId: editor.id,
      categoryId: ai.id,
    },
  });

  await prisma.articleTag.createMany({
    data: [
      { articleId: aiArticle.id, tagId: aiTag.id },
      { articleId: aiArticle.id, tagId: futureTag.id },
      { articleId: aiArticle.id, tagId: techTag.id },
    ],
  });

  const scienceArticle = await prisma.article.create({
    data: {
      title: 'Why science still matters',
      content:
        'Scientific research helps people better understand the world and make informed decisions.',
      status: ArticleStatus.PUBLISHED,
      authorId: editor.id,
      categoryId: science.id,
    },
  });

  await prisma.articleTag.createMany({
    data: [
      { articleId: scienceArticle.id, tagId: scienceTag.id },
      { articleId: scienceArticle.id, tagId: researchTag.id },
    ],
  });

  const archivedArticle = await prisma.article.create({
    data: {
      title: 'Trends in Web Development',
      content: 'Some web development trends become less relevant over time.',
      status: ArticleStatus.ARCHIVED,
      authorId: editor.id,
      categoryId: technology.id,
    },
  });

  await prisma.articleTag.createMany({
    data: [
      { articleId: archivedArticle.id, tagId: techTag.id },
      { articleId: archivedArticle.id, tagId: jsTag.id },
    ],
  });

  const draftScienceArticle = await prisma.article.create({
    data: {
      title: 'The future of space research',
      content:
        'Space research continues to grow and opens new opportunities for science and technology.',
      status: ArticleStatus.DRAFT,
      authorId: editor.id,
      categoryId: science.id,
    },
  });

  await prisma.articleTag.createMany({
    data: [
      { articleId: draftScienceArticle.id, tagId: scienceTag.id },
      { articleId: draftScienceArticle.id, tagId: futureTag.id },
      { articleId: draftScienceArticle.id, tagId: researchTag.id },
    ],
  });

  await prisma.comment.create({
    data: {
      content: 'Good article, thanks for sharing!',
      authorId: editor.id,
      articleId: nodeArticle.id,
    },
  });

  await prisma.comment.create({
    data: {
      content: 'Interesting perspective on science.',
      authorId: editor.id,
      articleId: scienceArticle.id,
    },
  });

  await prisma.comment.create({
    data: {
      content: 'Very helpful!',
      authorId: editor.id,
      articleId: aiArticle.id,
    },
  });
}

main();
