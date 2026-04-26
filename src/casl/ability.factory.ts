import { Injectable } from '@nestjs/common';
import { AbilityBuilder, PureAbility } from '@casl/ability';
import { PrismaQuery, Subjects, createPrismaAbility } from '@casl/prisma';
import {
  Project,
  Task,
  User,
  Workspace,
  WorkspaceMember,
  WorkspaceRole,
} from '@prisma/client';
import { Action } from './action.enum';
import { PrismaService } from '../database/prisma.service';

export type AppSubjects =
  | Subjects<{
      Workspace: Workspace;
      WorkspaceMember: WorkspaceMember;
      Project: Project;
      Task: Task;
      User: User;
    }>
  | 'all';

export type AppAbility = PureAbility<[Action, AppSubjects], PrismaQuery>;

export interface UserContext {
  id: string;
  memberships: { workspaceId: string; role: WorkspaceRole }[];
}

@Injectable()
export class AbilityFactory {
  constructor(private readonly prisma: PrismaService) {}

  async createForUser(userId: string): Promise<AppAbility> {
    const memberships = await this.prisma.workspaceMember.findMany({
      where: { userId },
      select: { workspaceId: true, role: true },
    });
    return this.build({ id: userId, memberships });
  }

  build(user: UserContext): AppAbility {
    const { can, cannot, build } = new AbilityBuilder<AppAbility>(
      createPrismaAbility,
    );

    const ownerOf = ids(user, WorkspaceRole.OWNER);
    const adminOf = ids(user, WorkspaceRole.ADMIN);
    const memberOf = ids(user, WorkspaceRole.MEMBER);
    const guestOf = ids(user, WorkspaceRole.GUEST);
    const anyOf = [...ownerOf, ...adminOf, ...memberOf, ...guestOf];
    const writerOf = [...ownerOf, ...adminOf, ...memberOf];

    // Workspace
    can(Action.Create, 'Workspace');
    can(Action.Read, 'Workspace', { id: { in: anyOf } });
    can(Action.Update, 'Workspace', { id: { in: [...ownerOf, ...adminOf] } });
    can(Action.Delete, 'Workspace', { id: { in: ownerOf } });

    // WorkspaceMember
    can(Action.Read, 'WorkspaceMember', { workspaceId: { in: anyOf } });
    can(Action.Create, 'WorkspaceMember', {
      workspaceId: { in: [...ownerOf, ...adminOf] },
    });
    can(Action.Update, 'WorkspaceMember', { workspaceId: { in: ownerOf } });
    can(Action.Delete, 'WorkspaceMember', {
      workspaceId: { in: [...ownerOf, ...adminOf] },
    });
    can(Action.Delete, 'WorkspaceMember', { userId: user.id });

    // Project
    can(Action.Read, 'Project', { workspaceId: { in: anyOf } });
    can(Action.Create, 'Project', { workspaceId: { in: writerOf } });
    can(Action.Update, 'Project', { workspaceId: { in: writerOf } });
    can(Action.Delete, 'Project', {
      workspaceId: { in: [...ownerOf, ...adminOf] },
    });

    // Task
    can(Action.Read, 'Task', { workspaceId: { in: anyOf } });
    can(Action.Create, 'Task', { workspaceId: { in: writerOf } });
    can(Action.Update, 'Task', { workspaceId: { in: writerOf } });
    can(Action.Delete, 'Task', {
      workspaceId: { in: [...ownerOf, ...adminOf] },
    });
    can(Action.Delete, 'Task', { createdById: user.id });

    cannot([Action.Create, Action.Update, Action.Delete], 'Task', {
      workspaceId: { in: guestOf },
    });
    cannot([Action.Create, Action.Update, Action.Delete], 'Project', {
      workspaceId: { in: guestOf },
    });

    return build();
  }
}

function ids(user: UserContext, role: WorkspaceRole) {
  return user.memberships
    .filter((m) => m.role === role)
    .map((m) => m.workspaceId);
}
