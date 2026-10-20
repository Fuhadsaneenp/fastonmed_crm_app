import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // Shared hosting exposes host CPU count, not this account's process quota.
  experimental: { cpus: 2, imgOptConcurrency: 1 },
  allowedDevOrigins: ["192.168.0.101", "192.168.1.22", "127.0.0.1", "localhost"],
};

export default nextConfig;
