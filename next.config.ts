import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config) => {
    // Konva optionally requires the native `canvas` package for server-side
    // rendering. We only ever render Konva on the client, so stub it out to
    // avoid a "Can't resolve 'canvas'" build error.
    config.resolve = config.resolve ?? {};
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      canvas: false,
    };
    return config;
  },
};

export default nextConfig;
