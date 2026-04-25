import { Test } from '@nestjs/testing';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import fastifyCookie from '@fastify/cookie';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';

describe('Auth flow (e2e)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );

    await app.register(fastifyCookie, {
      secret:
        process.env.COOKIE_SECRET ??
        'test-cookie-secret-at-least-32-chars-long',
    });

    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalInterceptors(new TransformInterceptor());

    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('signup → me → logout', async () => {
    const email = `test-${Date.now()}@example.com`;

    // 1. Signup
    const signup = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: { email, name: 'Test User', password: 'StrongPass1' },
    });
    expect(signup.statusCode).toBe(201);

    const signupBody = signup.json().data;
    expect(signupBody.accessToken).toBeDefined();
    expect(signupBody.user.email).toBe(email);

    // 2. Hit /auth/me with the access token
    const me = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/me',
      headers: { authorization: `Bearer ${signupBody.accessToken}` },
    });
    expect(me.statusCode).toBe(200);
    expect(me.json().data.email).toBe(email);

    // 3. Logout with the refresh cookie AND the access token
    const cookies = signup.cookies as Array<{ name: string; value: string }>;
    const refreshCookie = cookies.find((c) => c.name === 'refresh_token');
    expect(refreshCookie).toBeDefined();

    const logout = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
      headers: { authorization: `Bearer ${signupBody.accessToken}` },
      cookies: { refresh_token: refreshCookie!.value },
    });
    expect(logout.statusCode).toBe(204);
  });

  it('rejects unauthenticated requests', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/me',
    });
    expect(res.statusCode).toBe(401);
  });

  it('rejects weak passwords on signup', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: {
        email: 'weak@example.com',
        name: 'Weak',
        password: 'short',
      },
    });
    expect(res.statusCode).toBe(400);
  });
});