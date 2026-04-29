import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { createTestApp, signupAndLogin } from './helpers/setup-app';

describe('Auth (e2e)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    ({ app } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  it('signs up, returns user from /auth/me, logs out', async () => {
    const { auth } = await signupAndLogin(app, 'auth-test@test.com');

    const me = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: auth,
    });
    expect(me.statusCode).toBe(200);
    expect(me.json().data.email).toBe('auth-test@test.com');
  });

  it('rejects unauthenticated requests to protected routes', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
    });
    expect(res.statusCode).toBe(401);
  });

  it('rejects weak passwords on signup', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: { email: 'weak@test.com', password: '123', name: 'weak' },
    });
    expect(res.statusCode).toBe(400);
  });
});