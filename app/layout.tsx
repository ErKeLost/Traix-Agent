import type { Metadata } from "next";
import "./globals.css";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { cn } from "@/lib/utils";

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-sans",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Trading Terminal",
  description: "Crypto candlestick terminal with realtime market data pipeline.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className={cn(
        "dark h-full overflow-hidden antialiased",
        "font-sans",
        plexSans.variable,
        plexMono.variable,
      )}
    >
      <body className="h-full overflow-hidden bg-[var(--bg-primary)] text-foreground">{children}</body>
    </html>
  );
}
