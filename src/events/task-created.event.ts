// src/events/task-created.event.ts
import { Task } from '@prisma/client';

export class TaskCreatedEvent {
  static readonly eventName = 'task.created' as const;

  constructor(
    public readonly task: Task,
    public readonly workspaceId: string,
    public readonly actorUserId: string,
  ) {}
}
