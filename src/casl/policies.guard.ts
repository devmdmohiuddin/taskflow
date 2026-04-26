import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AbilityFactory, AppAbility } from './ability.factory';
import { CHECK_POLICIES_KEY, PolicyHandler } from './check-policies.decorator';
import type { FastifyRequest } from 'fastify';

interface AuthedRequest extends FastifyRequest {
  user: { id: string };
  ability?: AppAbility;
}

@Injectable()
export class PoliciesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly abilityFactory: AbilityFactory,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const handlers =
      this.reflector.getAllAndOverride<PolicyHandler[]>(CHECK_POLICIES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    if (handlers.length === 0) return true;

    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const ability = await this.abilityFactory.createForUser(req.user.id);
    req.ability = ability; // expose to controllers/services that want it

    const ok = handlers.every((h) =>
      typeof h === 'function' ? h(ability) : h.handle(ability),
    );

    if (!ok) throw new ForbiddenException();
    return true;
  }
}
