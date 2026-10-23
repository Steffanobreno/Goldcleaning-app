import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Woofers Dog Spa", template: "%s · Woofers" },
  description: "Scheduling, routes and checkout for Woofers Dog Spa.",
  appleWebApp: { capable: true, title: "Woofers", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#132039",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
