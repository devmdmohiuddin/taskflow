// src/events/task-assigned.event.ts
import { Task } from '@prisma/client';

export class TaskAssignedEvent {
  static readonly eventName = 'task.assigned' as const;

  constructor(
    public readonly task: Task,
    public readonly workspaceId: string,
    public readonly actorUserId: string,
    public readonly previousAssigneeId: string | null, // null = was unassigned before
    public readonly newAssigneeId: string,
  ) {}
}
