import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import fastifyCookie from '@fastify/cookie';
import { ConfigService } from '@nestjs/config';
import { AppModule } from '../../src/app.module';
import { AllExceptionsFilter } from '../../src/common/filters/all-exceptions.filter';
import { TransformInterceptor } from '../../src/common/interceptors/transform.interceptor';
import { PrismaService } from '../../src/database/prisma.service';

export async function createTestApp(): Promise<{
  app: NestFastifyApplication;
  prisma: PrismaService;
}> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter(),
  );

  const config = app.get(ConfigService);
  await app.register(fastifyCookie, {
    secret: config.getOrThrow<string>('COOKIE_SECRET'),
  });

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  await app.init();
  await app.getHttpAdapter().getInstance().ready();

  const prisma = app.get(PrismaService);
  await prisma.task.deleteMany();
  await prisma.project.deleteMany();
  await prisma.workspaceMember.deleteMany();
  await prisma.workspace.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();

  return { app, prisma };
}

export async function signupAndLogin(
  app: NestFastifyApplication,
  email: string,
  password = 'CorrectHorse9!',
) {
  await app.inject({
    method: 'POST',
    url: '/api/v1/auth/signup',
    payload: { email, password, name: email.split('@')[0] },
  });
  const login = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { email, password },
  });
  const body = login.json() as {
    data: { accessToken: string; user: { id: string } };
  };
  return {
    token: body.data.accessToken,
    userId: body.data.user.id,
    auth: { authorization: `Bearer ${body.data.accessToken}` },
  };
}

export async function signupAndLogin(
  app: NestFastifyApplication,
  email: string,
  password = 'CorrectHorse9!',
) {
  const signup = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/signup',
    payload: { email, password, name: email.split('@')[0] },
  });
  console.log('SIGNUP status:', signup.statusCode);
  console.log('SIGNUP body:', signup.body);

  const login = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { email, password },
  });
  console.log('LOGIN status:', login.statusCode);
  console.log('LOGIN body:', login.body);

  const body = login.json() as {
    data: { accessToken: string; user: { id: string } };
  };
  return {
    token: body.data.accessToken,
    userId: body.data.user.id,
    auth: { authorization: `Bearer ${body.data.accessToken}` },
  };
}
