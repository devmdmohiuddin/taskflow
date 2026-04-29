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
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ListProjectsQueryDto } from './dto/list-projects.query';

@Controller()
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Post('workspaces/:workspaceId/projects')
  create(
    @CurrentUser('id') userId: string,
    @Param('workspaceId') workspaceId: string,
    @Body() dto: CreateProjectDto,
  ) {
    return this.projects.create(userId, workspaceId, dto);
  }

  @Get('workspaces/:workspaceId/projects')
  findAll(
    @CurrentUser('id') userId: string,
    @Param('workspaceId') workspaceId: string,
    @Query() q: ListProjectsQueryDto,
  ) {
    return this.projects.findAll(userId, workspaceId, q);
  }

  @Get('projects/:id')
  findOne(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.projects.findOne(userId, id);
  }

  @Patch('projects/:id')
  update(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projects.update(userId, id, dto);
  }

  @Post('projects/:id/archive')
  archive(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.projects.archive(userId, id);
  }

  @Delete('projects/:id')
  remove(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.projects.remove(userId, id);
  }
}
