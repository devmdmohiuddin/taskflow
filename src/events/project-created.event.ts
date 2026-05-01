// src/events/project-created.event.ts
import { Project } from '@prisma/client';

export class ProjectCreatedEvent {
  static readonly eventName = 'project.created' as const;

  constructor(
    public readonly project: Project,
    public readonly workspaceId: string,
    public readonly actorUserId: string,
  ) {}
}
