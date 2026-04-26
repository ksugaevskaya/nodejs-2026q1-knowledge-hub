import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { SanitizeUserResponseInterceptor } from './common/interceptors/sanitize-user-response.interceptor';
import { createAppLogger } from './common/logging/app-logger';
import { RequestLoggingInterceptor } from './common/interceptors/request-logging.interceptor';
import 'dotenv/config';

async function bootstrap() {
  const logger = createAppLogger();
  const app = await NestFactory.create(AppModule, {
    logger,
    bufferLogs: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalInterceptors(
    new RequestLoggingInterceptor(logger),
    new SanitizeUserResponseInterceptor(),
  );
  app.useGlobalFilters(new HttpExceptionFilter(logger));

  const config = new DocumentBuilder()
    .setTitle('Knowledge Hub')
    .setDescription(
      'Knowledge hub service for managing articles, categories, and comments',
    )
    .setVersion('1.0.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('doc', app, document);

  const port = process.env.PORT || 4000;
  await app.listen(port);
}
bootstrap();
