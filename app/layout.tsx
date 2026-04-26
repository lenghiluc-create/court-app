import "./globals.css";
import { Inter } from 'next/font/google';
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Hệ thống Quản lý Lịch xét xử - TAND KV9",
  description: "Phần mềm quản lý và đăng ký lịch xét xử trực tuyến Tòa án nhân dân Khu vực 9",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body>
        {children}
      </body>
    </html>
  )
}