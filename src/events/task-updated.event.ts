// src/events/task-updated.event.ts
import { Task } from '@prisma/client';

export class TaskUpdatedEvent {
  static readonly eventName = 'task.updated' as const;

  constructor(
    public readonly task: Task,
    public readonly workspaceId: string,
    public readonly actorUserId: string,
    // Which fields actually changed in this update — listeners can decide
    // whether they care (e.g. notification listener only fires on status changes).
    public readonly changedFields: (keyof Task)[],
  ) {}
}
