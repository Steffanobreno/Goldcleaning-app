import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Woofers Dog Spa",
    short_name: "Woofers",
    description: "Scheduling, routes and checkout for Woofers Dog Spa.",
    start_url: "/today",
    display: "standalone",
    background_color: "#f3f5f8",
    theme_color: "#132039",
    icons: [
      { src: "/icon.png", sizes: "512x512", type: "image/png" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
