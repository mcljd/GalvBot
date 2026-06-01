import type { NextConfig } from "next";

// Opt-in static export for GitHub Pages. Enabled by setting STATIC_EXPORT=true
// (the Pages workflow does this). Normal `next dev` / `next build` / Vercel
// deploys are unaffected and keep the full server (incl. the /api/scan route).
const isStaticExport = process.env.STATIC_EXPORT === "true";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  ...(isStaticExport
    ? {
        output: "export",
        basePath: basePath || undefined,
        images: { unoptimized: true },
        trailingSlash: true,
      }
    : {}),
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
