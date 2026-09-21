import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: ["lucide-react", "@fullcalendar/react", "@fullcalendar/core"],
  },
};

export default nextConfig;
