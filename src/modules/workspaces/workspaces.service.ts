import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, WorkspaceRole } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { AddMemberDto } from './dto/add-member.dto';

@Injectable()
export class WorkspacesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateWorkspaceDto) {
    try {
      return await this.prisma.workspace.create({
        data: {
          name: dto.name,
          slug: dto.slug,
          description: dto.description,
          members: {
            create: { userId, role: WorkspaceRole.OWNER },
          },
        },
        include: { members: { where: { userId } } },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException(`Slug "${dto.slug}" is already taken`);
      }
      throw e;
    }
  }

  async findAllForUser(userId: string) {
    const memberships = await this.prisma.workspaceMember.findMany({
      where: { userId },
      include: { workspace: true },
      orderBy: { joinedAt: 'desc' },
    });
    return memberships.map((m) => ({ ...m.workspace, role: m.role }));
  }

  async findOne(userId: string, workspaceId: string) {
    const membership = await this.assertMember(userId, workspaceId);

    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        members: {
          include: { user: { select: { id: true, email: true, name: true } } },
        },
      },
    });
    if (!workspace) throw new NotFoundException('Workspace not found');
    return { ...workspace, role: membership.role };
  }

  async update(userId: string, workspaceId: string, dto: UpdateWorkspaceDto) {
    await this.assertRole(userId, workspaceId, [
      WorkspaceRole.OWNER,
      WorkspaceRole.ADMIN,
    ]);
    return this.prisma.workspace.update({
      where: { id: workspaceId },
      data: dto,
    });
  }

  async remove(userId: string, workspaceId: string) {
    await this.assertRole(userId, workspaceId, [WorkspaceRole.OWNER]);
    await this.prisma.workspace.delete({ where: { id: workspaceId } });
    return { id: workspaceId, deleted: true };
  }

  async addMember(userId: string, workspaceId: string, dto: AddMemberDto) {
    await this.assertRole(userId, workspaceId, [
      WorkspaceRole.OWNER,
      WorkspaceRole.ADMIN,
    ]);

    if (dto.role === WorkspaceRole.OWNER) {
      throw new ForbiddenException(
        'Cannot directly add another OWNER. Transfer ownership instead.',
      );
    }

    const invitee = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true },
    });
    if (!invitee) throw new NotFoundException('User not found');

    try {
      return await this.prisma.workspaceMember.create({
        data: { workspaceId, userId: invitee.id, role: dto.role },
        include: { user: { select: { id: true, email: true, name: true } } },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException('User is already a member');
      }
      throw e;
    }
  }

  async removeMember(
    userId: string,
    workspaceId: string,
    targetUserId: string,
  ) {
    const callerMembership = await this.assertMember(userId, workspaceId);
    const targetMembership = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: targetUserId } },
    });
    if (!targetMembership) throw new NotFoundException('Member not found');

    const isSelfLeave = userId === targetUserId;

    if (isSelfLeave && targetMembership.role === WorkspaceRole.OWNER) {
      throw new ForbiddenException('Owner cannot leave. Transfer ownership first.');
    }

    if (!isSelfLeave) {
      if (
        callerMembership.role !== WorkspaceRole.OWNER &&
        callerMembership.role !== WorkspaceRole.ADMIN
      ) {
        throw new ForbiddenException();
      }
      if (
        callerMembership.role === WorkspaceRole.ADMIN &&
        (targetMembership.role === WorkspaceRole.OWNER ||
          targetMembership.role === WorkspaceRole.ADMIN)
      ) {
        throw new ForbiddenException('Admins cannot remove owners or other admins');
      }
    }

    await this.prisma.workspaceMember.delete({ where: { id: targetMembership.id } });
    return { userId: targetUserId, removed: true };
  }

  async updateMemberRole(
    userId: string,
    workspaceId: string,
    targetUserId: string,
    role: WorkspaceRole,
  ) {
    await this.assertRole(userId, workspaceId, [WorkspaceRole.OWNER]);

    if (role === WorkspaceRole.OWNER) {
      throw new ForbiddenException('Use the transfer-ownership endpoint to change owner.');
    }

    const target = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: targetUserId } },
    });
    if (!target) throw new NotFoundException('Member not found');
    if (target.role === WorkspaceRole.OWNER) {
      throw new ForbiddenException('Cannot demote owner directly');
    }

    return this.prisma.workspaceMember.update({
      where: { id: target.id },
      data: { role },
    });
  }

  /** Used by other modules (Projects, Tasks) to check workspace membership. */
  async getMembership(userId: string, workspaceId: string) {
    return this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
  }

  private async assertMember(userId: string, workspaceId: string) {
    const membership = await this.getMembership(userId, workspaceId);
    if (!membership) throw new NotFoundException('Workspace not found');
    return membership;
  }

  private async assertRole(
    userId: string,
    workspaceId: string,
    allowed: WorkspaceRole[],
  ) {
    const membership = await this.assertMember(userId, workspaceId);
    if (!allowed.includes(membership.role)) {
      throw new ForbiddenException(`Requires role: ${allowed.join(' or ')}`);
    }
    return membership;
  }
}