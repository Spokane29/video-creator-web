import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Video Creator - AI-Powered Video Generation",
  description: "Generate animated short-form videos using Google Gemini APIs",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
