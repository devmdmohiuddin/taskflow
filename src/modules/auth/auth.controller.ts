import {
  Body,
  Controller,
  Post,
  HttpCode,
  HttpStatus,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import type { AuthenticatedUser } from './types/jwt-payload';
import type { Configuration } from '../../config/configuration';

const REFRESH_COOKIE = 'refresh_token';

@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService<Configuration, true>,
  ) {}

  @Public()
  @Post('signup')
  async signup(
    @Body() dto: SignupDto,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const result = await this.auth.signup(dto, this.meta(req));
    this.setRefreshCookie(res, result.refreshToken);
    return { user: result.user, accessToken: result.accessToken };
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const result = await this.auth.login(
      dto.email,
      dto.password,
      this.meta(req),
    );
    this.setRefreshCookie(res, result.refreshToken);
    return { user: result.user, accessToken: result.accessToken };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const token = this.readRefreshCookie(req);
    if (!token) throw new UnauthorizedException('Missing refresh token');

    const tokens = await this.auth.refresh(token, this.meta(req));
    this.setRefreshCookie(res, tokens.refreshToken);
    return { accessToken: tokens.accessToken };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const token = this.readRefreshCookie(req);
    if (token) await this.auth.logout(token);
    this.clearRefreshCookie(res);
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logoutAll(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    await this.auth.logoutAll(user.id);
    this.clearRefreshCookie(res);
  }

  @UseGuards(JwtAuthGuard)
  @Post('me')
  @HttpCode(HttpStatus.OK)
  me(@CurrentUser() user: AuthenticatedUser) {
    return user;
  }

  // ───── helpers ─────

  private meta(req: FastifyRequest) {
    return {
      ip: req.ip,
      ua: req.headers['user-agent'] ?? undefined,
    };
  }

  private setRefreshCookie(res: FastifyReply, token: string): void {
    void res.setCookie(REFRESH_COOKIE, token, {
      httpOnly: true,
      secure: this.config.get('app.isProduction', { infer: true }),
      sameSite: 'lax',
      path: '/api/v1/auth',
      signed: true,
      maxAge: 7 * 24 * 60 * 60,
    });
  }

  private clearRefreshCookie(res: FastifyReply): void {
    void res.clearCookie(REFRESH_COOKIE, { path: '/api/v1/auth' });
  }

  private readRefreshCookie(req: FastifyRequest): string | null {
    const raw = req.cookies?.[REFRESH_COOKIE];
    if (!raw) return null;
    const unsigned = req.unsignCookie(raw);
    return unsigned.valid ? unsigned.value : null;
  }
}
