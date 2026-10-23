import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Gold Cleaning",
    short_name: "Gold",
    description: "Bookings, calendar and checkout for Peninsula Gold Cleaning.",
    start_url: "/today",
    display: "standalone",
    background_color: "#f5f4f0",
    theme_color: "#0b1f3b",
    icons: [
      { src: "/icon.png", sizes: "512x512", type: "image/png" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
