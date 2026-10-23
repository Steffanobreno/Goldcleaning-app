import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The app is dynamic everywhere (every screen reads the login), so we use the
  // classic rendering model instead of Cache Components.
  cacheComponents: false,
  serverExternalPackages: ["postgres"],
  // Quote requests can carry up to 5 photos (already shrunk), and client CSV imports.
  // staleTimes: going back to a screen seen in the last 30 seconds is instant (saving
  // anything refreshes it anyway).
  experimental: { serverActions: { bodySizeLimit: "4mb" }, staleTimes: { dynamic: 30 } },
  // The booking page may be shown inside the business website (iframe); nothing else may.
  async headers() {
    const site = "https://peninsulagoldcleaning.com https://*.peninsulagoldcleaning.com https://*.lovable.app https://*.lovableproject.com";
    return [
      { source: "/:path*", headers: [{ key: "Content-Security-Policy", value: "frame-ancestors 'self'" }] },
      { source: "/book", headers: [{ key: "Content-Security-Policy", value: `frame-ancestors 'self' ${site}` }] },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
