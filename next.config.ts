import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: { cpus: 1, webpackBuildWorker: false },
  output:'standalone',
  async headers() { return ['/', '/verify', '/sop'].map(source => ({ source, headers: [{ key: 'Cache-Control', value: 'no-store, max-age=0' }] })); },
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
