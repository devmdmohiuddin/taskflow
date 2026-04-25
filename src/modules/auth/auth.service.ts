import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { UsersService } from '../users/users.service';
import { PrismaService } from '../../database/prisma.service';
import { SignupDto } from './dto/signup.dto';
import { JwtPayload } from './types/jwt-payload';
import { Configuration } from '../../config/configuration';

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface SafeUser {
  id: string;
  email: string;
  name: string;
}

interface RequestMeta {
  ip?: string;
  ua?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Configuration, true>,
    private readonly prisma: PrismaService,
  ) {}

  async signup(
    dto: SignupDto,
    meta: RequestMeta,
  ): Promise<TokenPair & { user: SafeUser }> {
    const user = await this.users.create(dto);
    const tokens = await this.issueTokens(user, meta);
    return { ...tokens, user: this.toSafeUser(user) };
  }

  async login(
    email: string,
    password: string,
    meta: RequestMeta,
  ): Promise<TokenPair & { user: SafeUser }> {
    const user = await this.users.findByEmail(email);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const ok = await this.users.verifyPassword(user, password);
    if (!ok) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.issueTokens(user, meta);
    return { ...tokens, user: this.toSafeUser(user) };
  }

  async refresh(
    rawRefreshToken: string,
    meta: RequestMeta,
  ): Promise<TokenPair> {
    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(rawRefreshToken, {
        secret: this.config.getOrThrow('jwt.refreshSecret', { infer: true }),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Wrong token type');
    }

    const tokenHash = this.hashToken(rawRefreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (!stored || stored.userId !== payload.sub) {
      // Token reuse detected — revoke ALL tokens for this user as defense
      await this.prisma.refreshToken.updateMany({
        where: { userId: payload.sub, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new ForbiddenException('Refresh token reuse detected');
    }

    if (stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired or revoked');
    }

    // Rotate: revoke old, issue new
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const user = await this.users.findByIdOrThrow(payload.sub);
    return this.issueTokens(user, meta);
  }

  async logout(rawRefreshToken: string): Promise<void> {
    if (!rawRefreshToken) return;
    const tokenHash = this.hashToken(rawRefreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async logoutAll(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  // ───── private helpers ─────

  private async issueTokens(user: User, meta: RequestMeta): Promise<TokenPair> {
    const basePayload = { sub: user.id, email: user.email };

    const accessToken = await this.jwt.signAsync(
      { ...basePayload, type: 'access' },
      {
        secret: this.config.getOrThrow('jwt.accessSecret', { infer: true }),
        expiresIn: this.config.getOrThrow('jwt.accessExpiresIn', {
          infer: true,
        }),
      },
    );

    const refreshToken = await this.jwt.signAsync(
      { ...basePayload, type: 'refresh' },
      {
        secret: this.config.getOrThrow('jwt.refreshSecret', { infer: true }),
        expiresIn: this.config.getOrThrow('jwt.refreshExpiresIn', {
          infer: true,
        }),
      },
    );

    const tokenHash = this.hashToken(refreshToken);
    const decoded = await this.jwt.verifyAsync<{ exp: number }>(refreshToken, {
      secret: this.config.getOrThrow('jwt.refreshSecret', { infer: true }),
    });

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(decoded.exp * 1000),
        ipAddress: meta.ip,
        userAgent: meta.ua,
      },
    });

    return { accessToken, refreshToken };
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private toSafeUser(user: User): SafeUser {
    return { id: user.id, email: user.email, name: user.name };
  }

  // Reuse this in AuthService.signup/login so callers also use bcrypt verify
  // (kept for completeness; UsersService is the source of truth)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async _verify(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }
}
