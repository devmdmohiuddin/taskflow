import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma, Task, WorkspaceRole } from '@prisma/client';
import { ForbiddenError, subject } from '@casl/ability';
import { accessibleBy } from '@casl/prisma';
import { PrismaService } from '../../database/prisma.service';
import { AbilityFactory } from '../../casl/ability.factory';
import { Action } from '../../casl/action.enum';
import {
  TaskCreatedEvent,
  TaskUpdatedEvent,
  TaskAssignedEvent,
  TaskDeletedEvent,
} from '../../events';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { ListTasksQueryDto } from './dto/list-tasks.query';

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly abilityFactory: AbilityFactory,
    private readonly events: EventEmitter2,
  ) {}

  async create(userId: string, projectId: string, dto: CreateTaskDto) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, workspaceId: true, archivedAt: true },
    });
    if (!project) throw new NotFoundException('Project not found');
    if (project.archivedAt)
      throw new BadRequestException('Project is archived');

    const ability = await this.abilityFactory.createForUser(userId);
    ForbiddenError.from(ability).throwUnlessCan(
      Action.Create,
      subject('Task', { workspaceId: project.workspaceId } as Task),
    );

    if (dto.assigneeId) {
      await this.assertWorkspaceMember(dto.assigneeId, project.workspaceId);
    }

    const task = await this.prisma.task.create({
      data: {
        title: dto.title,
        description: dto.description,
        status: dto.status,
        priority: dto.priority,
        dueDate: dto.dueDate,
        projectId,
        workspaceId: project.workspaceId, // denormalized
        createdById: userId,
        assigneeId: dto.assigneeId,
      },
      include: {
        assignee: { select: { id: true, email: true, name: true } },
        createdBy: { select: { id: true, email: true, name: true } },
      },
    });

    this.events.emit(
      TaskCreatedEvent.eventName,
      new TaskCreatedEvent(task, task.workspaceId, userId),
    );

    // If created with an assignee, that's also an assignment event.
    if (task.assigneeId) {
      this.events.emit(
        TaskAssignedEvent.eventName,
        new TaskAssignedEvent(
          task,
          task.workspaceId,
          userId,
          null,
          task.assigneeId,
        ),
      );
    }

    return task;
  }

  async findAll(userId: string, workspaceId: string, q: ListTasksQueryDto) {
    const ability = await this.abilityFactory.createForUser(userId);

    const where: Prisma.TaskWhereInput = {
      AND: [
        accessibleBy(ability, Action.Read).Task,
        { workspaceId },
        q.projectId ? { projectId: q.projectId } : {},
        q.assigneeId ? { assigneeId: q.assigneeId } : {},
        q.status?.length ? { status: { in: q.status } } : {},
        q.priority?.length ? { priority: { in: q.priority } } : {},
        q.search
          ? {
              OR: [
                { title: { contains: q.search, mode: 'insensitive' } },
                { description: { contains: q.search, mode: 'insensitive' } },
              ],
            }
          : {},
      ],
    };

    const orderBy: Prisma.TaskOrderByWithRelationInput =
      q.sort === 'priority' ? { priority: q.order } : { [q.sort!]: q.order };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.task.findMany({
        where,
        orderBy,
        skip: q.skip,
        take: q.take,
        include: {
          assignee: { select: { id: true, email: true, name: true } },
          project: { select: { id: true, key: true, name: true } },
        },
      }),
      this.prisma.task.count({ where }),
    ]);

    return { items, total, skip: q.skip, take: q.take };
  }

  async findOne(userId: string, taskId: string) {
    const ability = await this.abilityFactory.createForUser(userId);
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: {
        assignee: { select: { id: true, email: true, name: true } },
        createdBy: { select: { id: true, email: true, name: true } },
        project: {
          select: { id: true, key: true, name: true, workspaceId: true },
        },
      },
    });
    if (!task) throw new NotFoundException();
    ForbiddenError.from(ability)
      .setMessage('Task not found')
      .throwUnlessCan(Action.Read, subject('Task', task));
    return task;
  }

  async update(userId: string, taskId: string, dto: UpdateTaskDto) {
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException();

    const ability = await this.abilityFactory.createForUser(userId);

    // Special case: assignee can always update status of their own task,
    // even if they wouldn't otherwise have Update on Task.
    const isAssigneeStatusOnly =
      task.assigneeId === userId &&
      Object.keys(dto).length === 1 &&
      dto.status !== undefined;

    if (!isAssigneeStatusOnly) {
      ForbiddenError.from(ability).throwUnlessCan(
        Action.Update,
        subject('Task', task),
      );
    }

    if (dto.assigneeId) {
      await this.assertWorkspaceMember(dto.assigneeId, task.workspaceId);
    }

    // Compute which fields actually changed BEFORE the write,
    // using the pre-update snapshot vs the incoming DTO.
    const changedFields = (Object.keys(dto) as (keyof Task)[]).filter(
      (key) => dto[key as keyof UpdateTaskDto] !== task[key],
    );

    const updated = await this.prisma.task.update({
      where: { id: taskId },
      data: dto,
      include: {
        assignee: { select: { id: true, email: true, name: true } },
        createdBy: { select: { id: true, email: true, name: true } },
      },
    });

    this.events.emit(
      TaskUpdatedEvent.eventName,
      new TaskUpdatedEvent(updated, updated.workspaceId, userId, changedFields),
    );

    // Reassignment is its own event in addition to the update.
    if (changedFields.includes('assigneeId') && updated.assigneeId) {
      this.events.emit(
        TaskAssignedEvent.eventName,
        new TaskAssignedEvent(
          updated,
          updated.workspaceId,
          userId,
          task.assigneeId, // previous (from the pre-update snapshot)
          updated.assigneeId, // new
        ),
      );
    }

    return updated;
  }

  async remove(userId: string, taskId: string) {
    const ability = await this.abilityFactory.createForUser(userId);
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException();
    ForbiddenError.from(ability).throwUnlessCan(
      Action.Delete,
      subject('Task', task),
    );
    await this.prisma.task.delete({ where: { id: taskId } });

    this.events.emit(
      TaskDeletedEvent.eventName,
      new TaskDeletedEvent(taskId, task.workspaceId, userId),
    );

    return { id: taskId, deleted: true };
  }

  private async assertWorkspaceMember(userId: string, workspaceId: string) {
    const m = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
    if (!m) throw new BadRequestException('Assignee is not a workspace member');
    if (m.role === WorkspaceRole.GUEST) {
      throw new BadRequestException('Cannot assign tasks to GUEST');
    }
  }
}
