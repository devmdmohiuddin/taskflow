import { AbilityFactory } from './ability.factory';
import { Action } from './action.enum';
import { WorkspaceRole } from '@prisma/client';

describe('AbilityFactory', () => {
  const factory = new AbilityFactory({} as any); // not calling DB

  it('OWNER can delete workspace, MEMBER cannot', () => {
    const wsId = 'ws_1';
    const ownerAbility = factory.build({
      id: 'u1',
      memberships: [{ workspaceId: wsId, role: WorkspaceRole.OWNER }],
    });
    const memberAbility = factory.build({
      id: 'u2',
      memberships: [{ workspaceId: wsId, role: WorkspaceRole.MEMBER }],
    });

    const ws = { __typename: 'Workspace' as const, id: wsId };
    expect(ownerAbility.can(Action.Delete,  ws as any)).toBe(true);
    expect(memberAbility.can(Action.Delete, ws as any)).toBe(false);
    expect(memberAbility.can(Action.Read,   ws as any)).toBe(true);
  });

  it('GUEST cannot create tasks', () => {
    const wsId = 'ws_1';
    const guest = factory.build({
      id: 'u',
      memberships: [{ workspaceId: wsId, role: WorkspaceRole.GUEST }],
    });
    expect(
      guest.can(Action.Create, { __typename: 'Task', workspaceId: wsId } as any),
    ).toBe(false);
    expect(
      guest.can(Action.Read, { __typename: 'Task', workspaceId: wsId } as any),
    ).toBe(true);
  });
});
