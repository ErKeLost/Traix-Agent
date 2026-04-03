import type { Metadata } from "next";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

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
    <html lang="zh-CN" className={cn("h-full overflow-hidden antialiased", "font-sans", geist.variable)}>
      <body className="hero-theme-shell h-full overflow-hidden">{children}</body>
    </html>
  );
}
