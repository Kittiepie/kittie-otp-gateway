import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

// Prisma 7 does not read .env files by itself. Locally the values live in the repo-root .env;
// in Docker/Kubernetes they come from real environment variables, which dotenv never overrides.
config({ path: ['.env', '../../.env'], quiet: true });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
