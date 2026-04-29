import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { createTestApp, signupAndLogin } from './helpers/setup-app';

describe('Workspaces isolation (e2e)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    ({ app } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  it('user B cannot see user A\'s workspace', async () => {
    const userA = await signupAndLogin(app, 'a@test.com');
    const userB = await signupAndLogin(app, 'b@test.com');

    // A creates a workspace
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/workspaces',
      headers: userA.auth,
      payload: { name: 'A Corp', slug: 'a-corp' },
    });
    expect(created.statusCode).toBe(201);
    const workspaceId = (created.json() as { data: { id: string } }).data.id;

    // B's list is empty
    const listB = await app.inject({
      method: 'GET',
      url: '/api/v1/workspaces',
      headers: userB.auth,
    });
    expect(listB.json().data).toHaveLength(0);

    // B's direct GET returns 404 (NOT 403 — don't leak existence)
    const getB = await app.inject({
      method: 'GET',
      url: `/api/v1/workspaces/${workspaceId}`,
      headers: userB.auth,
    });
    expect(getB.statusCode).toBe(404);

    // B cannot delete it
    const delB = await app.inject({
      method: 'DELETE',
      url: `/api/v1/workspaces/${workspaceId}`,
      headers: userB.auth,
    });
    expect(delB.statusCode).toBe(404);
  });

  it('admin can add a member but cannot remove the owner', async () => {
    const owner  = await signupAndLogin(app, 'owner@test.com');
    const admin  = await signupAndLogin(app, 'admin@test.com');

    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/workspaces',
      headers: owner.auth,
      payload: { name: 'Org', slug: 'org' },
    });
    const wsId = (created.json() as { data: { id: string } }).data.id;

    // Owner adds admin
    await app.inject({
      method: 'POST',
      url: `/api/v1/workspaces/${wsId}/members`,
      headers: owner.auth,
      payload: { email: 'admin@test.com', role: 'ADMIN' },
    });

    // Admin tries to remove the owner — must fail
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/workspaces/${wsId}/members/${owner.userId}`,
      headers: admin.auth,
    });
    expect(res.statusCode).toBe(403);
  });
});
