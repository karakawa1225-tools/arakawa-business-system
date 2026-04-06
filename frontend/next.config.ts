import type { NextConfig } from 'next';

/**
 * /api/* は `app/api/[[...path]]/route.ts` でバックエンドへプロキシする。
 * next.config の rewrites だと PATCH / PUT / DELETE が欠落する環境があるため使用しない。
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
};

export default nextConfig;
