import { loadEnvConfig } from '@next/env';
import type { NextConfig } from 'next';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd(), '../..');

// Next.js only reads .env files from apps/dashboard. Locally the shared values live in the
// repo-root .env, so load that too. Variables already set (Docker, Kubernetes) always win.
loadEnvConfig(repoRoot);

const nextConfig: NextConfig = {
  // Builds a self-contained server (.next/standalone) with only the node_modules it needs,
  // which is what the Docker image ships (Phase 7).
  output: 'standalone',
  // In a monorepo, trace files from the repo root so workspace packages are included.
  outputFileTracingRoot: repoRoot,
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    root: repoRoot,
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
};

export default nextConfig;
