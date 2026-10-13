import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  allowedDevOrigins: ["192.168.0.101", "192.168.1.22", "127.0.0.1", "localhost"],
};

export default nextConfig;
