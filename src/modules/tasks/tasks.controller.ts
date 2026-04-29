import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { ListTasksQueryDto } from './dto/list-tasks.query';

@Controller()
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Post('projects/:projectId/tasks')
  create(
    @CurrentUser('id') userId: string,
    @Param('projectId') projectId: string,
    @Body() dto: CreateTaskDto,
  ) {
    return this.tasks.create(userId, projectId, dto);
  }

  @Get('workspaces/:workspaceId/tasks')
  findAll(
    @CurrentUser('id') userId: string,
    @Param('workspaceId') workspaceId: string,
    @Query() q: ListTasksQueryDto,
  ) {
    return this.tasks.findAll(userId, workspaceId, q);
  }

  @Get('tasks/:id')
  findOne(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.tasks.findOne(userId, id);
  }

  @Patch('tasks/:id')
  update(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.tasks.update(userId, id, dto);
  }

  @Delete('tasks/:id')
  remove(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.tasks.remove(userId, id);
  }
}
