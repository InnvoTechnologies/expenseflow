import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { Providers } from "@/components/providers";
import { Analytics } from "@vercel/analytics/next"
import { PostHogProvider } from "@/hooks/PostHogProvider";
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ExpenseFlow - Personal Finance Tracker",
  description: "Track expenses, manage budgets, and achieve your financial goals",
  icons: {
    icon: [
      {
        url: '/favicon.ico',
      },
    ],
    shortcut: '/favicon.ico',
    apple: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`} suppressHydrationWarning>
        <Providers>
          <PostHogProvider>
          {children}
          </PostHogProvider>
        </Providers>
        <Analytics/>
        <Toaster 
          position="top-right"
          richColors
        />
      </body>
    </html>
  )
}