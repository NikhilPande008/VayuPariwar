/**
 * Root Next.js App Router layout defining document metadata and global styles.
 */
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VayuPariwar — Urban Air Quality Assistant for Indian Families",
  description:
    "Real-time Indian NAQI, deterministic Safe-Window planning, SmogShift impact simulation, and personalized multi-generational family guidance.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
