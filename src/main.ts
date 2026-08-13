import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import helmet from 'helmet';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  const isProduction = process.env.NODE_ENV === 'production';
  if (isProduction && !process.env.API_KEY) {
    throw new Error('API_KEY is required in production');
  }
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required');
  }

  app.use(helmet({ contentSecurityPolicy: isProduction }));
  const origins = (process.env.CORS_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (origins.length > 0) {
    app.enableCors({ origin: origins, credentials: false });
  }

  // Global validation pipe — enforces class-validator decorators on all DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`Mortgage Integration Agent running on port ${port}`);
  if (!isProduction) {
    console.log(`GraphQL Playground: http://localhost:${port}/graphql`);
  }
}

bootstrap();
