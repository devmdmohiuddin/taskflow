// src/config/app.config.ts
import { registerAs } from '@nestjs/config';

export interface AppConfigShape {
  nodeEnv: string;
  port: number;
  isProduction: boolean;
}

export const appConfig = registerAs(
  'app',
  (): AppConfigShape => ({
    nodeEnv: process.env.NODE_ENV ?? 'development',
    port: parseInt(process.env.PORT ?? '3000', 10),
    isProduction: process.env.NODE_ENV === 'production',
  }),
);
