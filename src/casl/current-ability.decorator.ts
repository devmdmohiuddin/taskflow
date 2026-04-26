import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { AppAbility } from './ability.factory';

export const CurrentAbility = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AppAbility => {
    const req = ctx
      .switchToHttp()
      .getRequest<FastifyRequest & { ability?: AppAbility }>();
    if (!req.ability) {
      throw new Error('Ability not set — is PoliciesGuard registered?');
    }
    return req.ability;
  },
);
