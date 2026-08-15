import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { NodeEnvironment } from './config/env.validation';

async function bootstrap(): Promise<void> {
  // Env validation runs as ConfigModule resolves during AppModule creation;
  // an invalid or missing variable throws here, before any HTTP listener
  // or database connection is attempted.
  const app = await NestFactory.create(AppModule);

  // Global validation pipe — enforces class-validator decorators on all DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3000);
  const nodeEnv = configService.get<NodeEnvironment>(
    'NODE_ENV',
    NodeEnvironment.Development,
  );

  await app.listen(port);
  console.log(
    `Mortgage Integration Agent running on port ${port} (${nodeEnv})`,
  );
  if (nodeEnv === NodeEnvironment.Development) {
    console.log(`GraphQL Playground: http://localhost:${port}/graphql`);
  }
}

bootstrap();
