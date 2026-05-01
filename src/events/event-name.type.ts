// src/events/event-name.type.ts
import { TaskCreatedEvent } from './task-created.event';
import { TaskUpdatedEvent } from './task-updated.event';
import { TaskAssignedEvent } from './task-assigned.event';
import { TaskDeletedEvent } from './task-deleted.event';
import { ProjectCreatedEvent } from './project-created.event';
import { ProjectArchivedEvent } from './project-archived.event';
import { WorkspaceMemberAddedEvent } from './workspace-member-added.event';

export type DomainEventMap = {
  [TaskCreatedEvent.eventName]: TaskCreatedEvent;
  [TaskUpdatedEvent.eventName]: TaskUpdatedEvent;
  [TaskAssignedEvent.eventName]: TaskAssignedEvent;
  [TaskDeletedEvent.eventName]: TaskDeletedEvent;
  [ProjectCreatedEvent.eventName]: ProjectCreatedEvent;
  [ProjectArchivedEvent.eventName]: ProjectArchivedEvent;
  [WorkspaceMemberAddedEvent.eventName]: WorkspaceMemberAddedEvent;
};
