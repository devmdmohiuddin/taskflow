import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { WorkspacesService } from './workspaces.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';

@Controller('workspaces')
export class WorkspacesController {
  constructor(private readonly workspaces: WorkspacesService) {}

  @Post()
  create(@CurrentUser('id') userId: string, @Body() dto: CreateWorkspaceDto) {
    return this.workspaces.create(userId, dto);
  }

  @Get()
  findAll(@CurrentUser('id') userId: string) {
    return this.workspaces.findAllForUser(userId);
  }

  @Get(':id')
  findOne(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.workspaces.findOne(userId, id);
  }

  @Patch(':id')
  update(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateWorkspaceDto,
  ) {
    return this.workspaces.update(userId, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.workspaces.remove(userId, id);
  }

  @Post(':id/members')
  addMember(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: AddMemberDto,
  ) {
    return this.workspaces.addMember(userId, id, dto);
  }

  @Patch(':id/members/:userId')
  updateMemberRole(
    @CurrentUser('id') callerId: string,
    @Param('id') workspaceId: string,
    @Param('userId') targetUserId: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.workspaces.updateMemberRole(
      callerId,
      workspaceId,
      targetUserId,
      dto.role,
    );
  }

  @Delete(':id/members/:userId')
  removeMember(
    @CurrentUser('id') callerId: string,
    @Param('id') workspaceId: string,
    @Param('userId') targetUserId: string,
  ) {
    return this.workspaces.removeMember(callerId, workspaceId, targetUserId);
  }
}
