import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["mysql2", "mongodb", "bcryptjs"],
  poweredByHeader: false,
  reactStrictMode: true,
};

export default nextConfig;
