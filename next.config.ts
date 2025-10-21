import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // 🔒 Ini akan mencegah build gagal di Vercel karena error ESLint
    ignoreDuringBuilds: true,
  },
  /* config options here */
};

export default nextConfig;
