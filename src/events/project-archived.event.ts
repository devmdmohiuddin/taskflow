// src/events/project-archived.event.ts
import { Project } from '@prisma/client';

export class ProjectArchivedEvent {
  static readonly eventName = 'project.archived' as const;

  constructor(
    public readonly project: Project,
    public readonly workspaceId: string,
    public readonly actorUserId: string,
  ) {}
}
