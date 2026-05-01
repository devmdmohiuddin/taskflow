// src/events/workspace-member-added.event.ts
import { WorkspaceRole } from '@prisma/client';

export class WorkspaceMemberAddedEvent {
  static readonly eventName = 'workspace.member.added' as const;

  constructor(
    public readonly workspaceId: string,
    public readonly userId: string, // who was added
    public readonly role: WorkspaceRole,
    public readonly actorUserId: string, // who added them
  ) {}
}
