import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Project } from '@prisma/client';
import { ForbiddenError, subject } from '@casl/ability';
import { accessibleBy } from '@casl/prisma';
import { PrismaService } from '../../database/prisma.service';
import { AbilityFactory } from '../../casl/ability.factory';
import { Action } from '../../casl/action.enum';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ListProjectsQueryDto } from './dto/list-projects.query';

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly abilityFactory: AbilityFactory,
  ) {}

  async create(userId: string, workspaceId: string, dto: CreateProjectDto) {
    const ability = await this.abilityFactory.createForUser(userId);

    // Subject for create check is "a Project that would belong to this workspace".
    // Cast is safe: CASL only reads the fields referenced in our conditions (workspaceId).
    ForbiddenError.from(ability).throwUnlessCan(
      Action.Create,
      subject('Project', { workspaceId } as Project),
    );

    try {
      return await this.prisma.project.create({
        data: {
          name: dto.name,
          key: dto.key,
          description: dto.description,
          visibility: dto.visibility,
          workspaceId,
        },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException(
          `Project key "${dto.key}" already exists in this workspace`,
        );
      }
      throw e;
    }
  }

  async findAll(userId: string, workspaceId: string, q: ListProjectsQueryDto) {
    const ability = await this.abilityFactory.createForUser(userId);

    const where: Prisma.ProjectWhereInput = {
      AND: [
        accessibleBy(ability, Action.Read).Project,
        { workspaceId },
        q.includeArchived ? {} : { archivedAt: null },
        q.search
          ? {
              OR: [
                { name: { contains: q.search, mode: 'insensitive' } },
                { key: { contains: q.search, mode: 'insensitive' } },
              ],
            }
          : {},
      ],
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.project.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: q.skip,
        take: q.take,
      }),
      this.prisma.project.count({ where }),
    ]);

    return { items, total, skip: q.skip, take: q.take };
  }

  async findOne(userId: string, projectId: string) {
    const ability = await this.abilityFactory.createForUser(userId);
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) throw new NotFoundException();
    ForbiddenError.from(ability)
      .setMessage('Project not found')
      .throwUnlessCan(Action.Read, subject('Project', project));
    return project;
  }

  async update(userId: string, projectId: string, dto: UpdateProjectDto) {
    const ability = await this.abilityFactory.createForUser(userId);
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) throw new NotFoundException();
    ForbiddenError.from(ability).throwUnlessCan(
      Action.Update,
      subject('Project', project),
    );
    return this.prisma.project.update({ where: { id: projectId }, data: dto });
  }

  async archive(userId: string, projectId: string) {
    const ability = await this.abilityFactory.createForUser(userId);
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) throw new NotFoundException();
    ForbiddenError.from(ability).throwUnlessCan(
      Action.Update,
      subject('Project', project),
    );
    return this.prisma.project.update({
      where: { id: projectId },
      data: { archivedAt: new Date() },
    });
  }

  async remove(userId: string, projectId: string) {
    const ability = await this.abilityFactory.createForUser(userId);
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) throw new NotFoundException();
    ForbiddenError.from(ability).throwUnlessCan(
      Action.Delete,
      subject('Project', project),
    );
    await this.prisma.project.delete({ where: { id: projectId } });
    return { id: projectId, deleted: true };
  }
}
