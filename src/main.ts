import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { ValidationPipe, VersioningType, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import fastifyHelmet from '@fastify/helmet';
import fastifyCookie from '@fastify/cookie';
import fastifyCompress from '@fastify/compress';
import { AppModule } from './app.module';
import { Configuration } from './config/configuration';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      trustProxy: true,
      logger: false,
      bodyLimit: 10 * 1024 * 1024, // 10MB
    }),
  );

  const config: ConfigService<Configuration, true> = app.get(ConfigService);

  // Security & infra plugins
  await app.register(fastifyHelmet, {
    contentSecurityPolicy: false, // we'll tune this later
  });
  await app.register(fastifyCookie, {
    secret: config.getOrThrow<string>('COOKIE_SECRET'),
  });
  await app.register(fastifyCompress);

  // Global config
  app.enableCors({
    origin: true,
    credentials: true,
  });
  app.setGlobalPrefix('api');
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.enableShutdownHooks();

  const port = config.getOrThrow('app.port', { infer: true });
  await app.listen(port, '0.0.0.0');
  Logger.log(`🚀 TaskFlow API running on http://localhost:${port}/api/v1`);
}

void bootstrap();
