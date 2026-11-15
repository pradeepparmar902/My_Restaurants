import type { NextConfig } from 'next';

const isGithubActions = process.env.GITHUB_ACTIONS === 'true';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  ...(isGithubActions
    ? {
        output: 'export',
        basePath: '/My_Restaurants',
        assetPrefix: '/My_Restaurants/',
        images: {
          unoptimized: true,
        },
      }
    : {}),
};

export default nextConfig;
