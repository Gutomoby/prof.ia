/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // URL do backend FastAPI (lida do .env.local)
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  },
};

module.exports = nextConfig;
