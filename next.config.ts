import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output:'standalone',
  outputFileTracingRoot: process.cwd(),
  outputFileTracingExcludes:{'/*':['./data/runtime/**','./data/uploads/**','./.env*','./.codex-finalizer/**']},
  distDir:process.env.NEXT_BUILD_DIR || '.next',
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  serverExternalPackages: ['better-sqlite3'],
};

export default nextConfig;
