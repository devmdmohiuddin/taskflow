// src/events/task-deleted.event.ts
export class TaskDeletedEvent {
  static readonly eventName = 'task.deleted' as const;

  constructor(
    public readonly taskId: string, // not the full Task — it's gone
    public readonly workspaceId: string,
    public readonly actorUserId: string,
  ) {}
}
