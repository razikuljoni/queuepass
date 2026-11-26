import { defineConfig } from '@playwright/test';

const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default defineConfig({
  testDir: './tests',
  timeout: 60000,
  retries: 0,
  workers: 1,
  use: { baseURL: process.env.BASE_URL || 'http://localhost:3000', trace: 'on-first-retry' },
  webServer: [
    {
      command: 'pnpm --filter @queuepass/api start',
      port: 3001,
      reuseExistingServer: true,
      timeout: 60000,
      env: {
        DATABASE_URL: process.env.DATABASE_URL || 'postgresql://queuepass_app:qp_app_dev@localhost:5432/queuepass',
        PUBLIC_DATABASE_URL: process.env.PUBLIC_DATABASE_URL || 'postgresql://queuepass_public:qp_pub_dev@localhost:5432/queuepass',
        JWT_SECRET: process.env.JWT_SECRET || 'dev-only-local-secret-change-me-in-production',
        SMS_PROVIDER: 'dev',
        REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
      },
    },
    {
      command: 'pnpm --filter @queuepass/web start -p 3000',
      port: 3000,
      reuseExistingServer: true,
      timeout: 60000,
      env: { NEXT_PUBLIC_API_URL: apiUrl },
    },
  ],
});
