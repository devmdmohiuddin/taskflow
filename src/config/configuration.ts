import { AppConfigShape } from './app.config';
import { JwtConfigShape } from './jwt.config';

export type Configuration = {
  app: AppConfigShape;
  jwt: JwtConfigShape;
  NODE_ENV: 'development' | 'production' | 'test';
  PORT: number;
  DATABASE_URL: string;
  COOKIE_SECRET: string;
  JWT_ACCESS_SECRET: string;
  JWT_REFRESH_SECRET: string;
  JWT_ACCESS_EXPIRES_IN: string;
  JWT_REFRESH_EXPIRES_IN: string;
};
