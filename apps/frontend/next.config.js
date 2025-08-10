// Next.js config with API rewrites to backend
// Prefer using env NEXT_PUBLIC_API_BASE; fallback to current backend URL
const BACKEND = process.env.NEXT_PUBLIC_API_BASE || 'https://backend-gb3720bnp-cikupis-projects.vercel.app';

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${BACKEND}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
