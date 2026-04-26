import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { LoginDto } from 'src/auth/dto/login';
import { LogoutDto } from 'src/auth/dto/logout';
import { RefreshDto } from 'src/auth/dto/refresh';
import { SignupDto } from 'src/auth/dto/signup';
import { CreateArticleDto } from 'src/articles/dto/create-article.dto';
import { UpdateArticleDto } from 'src/articles/dto/update-article.dto';
import { ArticleStatus } from 'src/articles/entities/article.entity';
import { CreateCategoryDto } from 'src/categories/dto/create-category.dto';
import { UpdateCategoryDto } from 'src/categories/dto/update-category.dto';
import { CreateCommentDto } from 'src/comments/dto/create-comment.dto';
import { CreateUserDto } from 'src/users/dto/create-user.dto';
import { UpdatePasswordDto } from 'src/users/dto/update-user-password.dto';
import { UserRole } from 'src/users/entities/user.entity';

const validUuid = '8cb04d24-5be9-4a1f-b557-9c4d79db5ad7';

const getInvalidProperties = async (dto: object) => {
  const errors = await validate(dto);
  return errors.map((error) => error.property);
};

describe('DTO validation', () => {
  describe('auth dto rules', () => {
    it('accepts valid signup and login payloads', async () => {
      const signupDto = Object.assign(new SignupDto(), {
        login: 'reader',
        password: 'secret',
      });
      const loginDto = Object.assign(new LoginDto(), {
        login: 'reader',
        password: 'secret',
      });

      await expect(validate(signupDto)).resolves.toHaveLength(0);
      await expect(validate(loginDto)).resolves.toHaveLength(0);
    });

    it('rejects empty auth passwords', async () => {
      const signupDto = Object.assign(new SignupDto(), {
        login: 'reader',
        password: '',
      });
      const loginDto = Object.assign(new LoginDto(), {
        login: 'reader',
        password: '',
      });

      await expect(getInvalidProperties(signupDto)).resolves.toContain(
        'password',
      );
      await expect(getInvalidProperties(loginDto)).resolves.toContain(
        'password',
      );
    });

    it('accepts missing optional refresh and logout tokens but rejects non-strings', async () => {
      const refreshDto = new RefreshDto();
      const logoutDto = new LogoutDto();
      const invalidRefreshDto = Object.assign(new RefreshDto(), {
        refreshToken: 123,
      });
      const invalidLogoutDto = Object.assign(new LogoutDto(), {
        refreshToken: 123,
      });

      await expect(validate(refreshDto)).resolves.toHaveLength(0);
      await expect(validate(logoutDto)).resolves.toHaveLength(0);
      await expect(getInvalidProperties(invalidRefreshDto)).resolves.toContain(
        'refreshToken',
      );
      await expect(getInvalidProperties(invalidLogoutDto)).resolves.toContain(
        'refreshToken',
      );
    });
  });

  describe('user dto rules', () => {
    it('accepts a valid create user payload', async () => {
      const dto = Object.assign(new CreateUserDto(), {
        login: 'editor-user',
        password: 'secret123',
        role: UserRole.EDITOR,
      });

      await expect(validate(dto)).resolves.toHaveLength(0);
    });

    it('rejects short passwords and unknown roles on create user', async () => {
      const dto = Object.assign(new CreateUserDto(), {
        login: 'editor-user',
        password: '123',
        role: 'owner',
      });

      await expect(getInvalidProperties(dto)).resolves.toEqual(
        expect.arrayContaining(['password', 'role']),
      );
    });

    it('accepts optional update password fields when valid', async () => {
      const dto = Object.assign(new UpdatePasswordDto(), {
        oldPassword: 'old-secret',
        newPassword: 'new-secret',
        role: UserRole.ADMIN,
      });

      await expect(validate(dto)).resolves.toHaveLength(0);
    });

    it('rejects empty update password values and invalid roles', async () => {
      const dto = Object.assign(new UpdatePasswordDto(), {
        oldPassword: '',
        newPassword: '',
        role: 'owner',
      });

      await expect(getInvalidProperties(dto)).resolves.toEqual(
        expect.arrayContaining(['oldPassword', 'newPassword', 'role']),
      );
    });
  });

  describe('article dto rules', () => {
    it('accepts a valid create article payload', async () => {
      const dto = Object.assign(new CreateArticleDto(), {
        title: 'Testing NestJS',
        content: 'Useful content',
        status: ArticleStatus.PUBLISHED,
        authorId: validUuid,
        categoryId: validUuid,
        tags: ['nestjs', 'vitest'],
      });

      await expect(validate(dto)).resolves.toHaveLength(0);
    });

    it('rejects invalid status, uuids, and non-string tags on create article', async () => {
      const dto = Object.assign(new CreateArticleDto(), {
        title: 'Testing NestJS',
        content: 'Useful content',
        status: 'live',
        authorId: 'bad-id',
        categoryId: 'bad-id',
        tags: ['nestjs', 123],
      });

      await expect(getInvalidProperties(dto)).resolves.toEqual(
        expect.arrayContaining(['status', 'authorId', 'categoryId', 'tags']),
      );
    });

    it('accepts a valid partial update article payload', async () => {
      const dto = Object.assign(new UpdateArticleDto(), {
        status: ArticleStatus.ARCHIVED,
        authorId: validUuid,
        categoryId: validUuid,
        tags: ['archive'],
      });

      await expect(validate(dto)).resolves.toHaveLength(0);
    });

    it('rejects invalid update article enum values and uuids', async () => {
      const dto = Object.assign(new UpdateArticleDto(), {
        status: 'live',
        authorId: 'bad-id',
        categoryId: 'bad-id',
      });

      await expect(getInvalidProperties(dto)).resolves.toEqual(
        expect.arrayContaining(['status', 'authorId', 'categoryId']),
      );
    });
  });

  describe('comment dto rules', () => {
    it('accepts a valid create comment payload', async () => {
      const dto = Object.assign(new CreateCommentDto(), {
        content: 'Great article',
        articleId: validUuid,
        authorId: validUuid,
      });

      await expect(validate(dto)).resolves.toHaveLength(0);
    });

    it('rejects empty content and invalid uuids on create comment', async () => {
      const dto = Object.assign(new CreateCommentDto(), {
        content: '',
        articleId: 'bad-id',
        authorId: 'bad-id',
      });

      await expect(getInvalidProperties(dto)).resolves.toEqual(
        expect.arrayContaining(['content', 'articleId', 'authorId']),
      );
    });
  });

  describe('category dto rules', () => {
    it('accepts a valid create category payload', async () => {
      const dto = Object.assign(new CreateCategoryDto(), {
        name: 'Backend',
        description: 'Server-side topics',
      });

      await expect(validate(dto)).resolves.toHaveLength(0);
    });

    it('rejects empty create category fields', async () => {
      const dto = Object.assign(new CreateCategoryDto(), {
        name: '',
        description: '',
      });

      await expect(getInvalidProperties(dto)).resolves.toEqual(
        expect.arrayContaining(['name', 'description']),
      );
    });

    it('treats update category as a partial dto while still validating provided fields', async () => {
      const validDto = Object.assign(new UpdateCategoryDto(), {
        name: 'Updated backend',
      });
      const invalidDto = Object.assign(new UpdateCategoryDto(), {
        description: '',
      });

      await expect(validate(validDto)).resolves.toHaveLength(0);
      await expect(getInvalidProperties(invalidDto)).resolves.toContain(
        'description',
      );
    });
  });
});
