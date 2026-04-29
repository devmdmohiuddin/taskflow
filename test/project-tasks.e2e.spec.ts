import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { createTestApp, signupAndLogin } from './helpers/setup-app';

describe('Projects & Tasks (e2e)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    ({ app } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  it('full project + task flow', async () => {
    const owner = await signupAndLogin(app, 'p@test.com');

    const ws = await app.inject({
      method: 'POST',
      url: '/api/v1/workspaces',
      headers: owner.auth,
      payload: { name: 'P Corp', slug: 'p-corp' },
    });
    const wsId = (ws.json() as { data: { id: string } }).data.id;

    const proj = await app.inject({
      method: 'POST',
      url: `/api/v1/workspaces/${wsId}/projects`,
      headers: owner.auth,
      payload: { name: 'Engineering', key: 'ENG' },
    });
    expect(proj.statusCode).toBe(201);
    const projId = (proj.json() as { data: { id: string } }).data.id;

    // Duplicate key in same workspace fails
    const dup = await app.inject({
      method: 'POST',
      url: `/api/v1/workspaces/${wsId}/projects`,
      headers: owner.auth,
      payload: { name: 'Eng2', key: 'ENG' },
    });
    expect(dup.statusCode).toBe(409);

    const task = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projId}/tasks`,
      headers: owner.auth,
      payload: {
        title: 'Set up CI',
        priority: 'HIGH',
        status: 'TODO',
      },
    });
    expect(task.statusCode).toBe(201);
    const taskId = (task.json() as { data: { id: string } }).data.id;

    // List tasks in workspace
    const list = await app.inject({
      method: 'GET',
      url: `/api/v1/workspaces/${wsId}/tasks`,
      headers: owner.auth,
    });
    expect(list.json().data.items).toHaveLength(1);

    // Update status
    const upd = await app.inject({
      method: 'PATCH',
      url: `/api/v1/tasks/${taskId}`,
      headers: owner.auth,
      payload: { status: 'IN_PROGRESS' },
    });
    expect(upd.json().data.status).toBe('IN_PROGRESS');
  });

  it('workspace member from different workspace cannot read tasks', async () => {
    const a = await signupAndLogin(app, 'a2@test.com');
    const b = await signupAndLogin(app, 'b2@test.com');

    const ws = await app.inject({
      method: 'POST',
      url: '/api/v1/workspaces',
      headers: a.auth,
      payload: { name: 'X', slug: 'x-corp' },
    });
    const wsId = (ws.json() as { data: { id: string } }).data.id;

    const list = await app.inject({
      method: 'GET',
      url: `/api/v1/workspaces/${wsId}/tasks`,
      headers: b.auth,
    });
    // Either 404 (preferred) or empty list — but NEVER another workspace's data
    expect([200, 404]).toContain(list.statusCode);
    if (list.statusCode === 200) {
      expect(list.json().data.items).toHaveLength(0);
    }
  });
});
