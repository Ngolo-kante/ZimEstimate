import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ServiceWorkerProvider } from "@/components/providers/ServiceWorkerProvider";
import { CurrencyProvider } from "@/components/ui/CurrencyToggle";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ZimEstimate - Construction Cost Estimation",
  description: "Build smarter estimates for your Zimbabwe construction projects with AI-powered tools, real-time pricing, and professional BOQ generation.",
  keywords: ["construction", "estimation", "BOQ", "Zimbabwe", "building costs", "materials"],
  authors: [{ name: "ZimEstimate" }],
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "ZimEstimate",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: "website",
    locale: "en_ZW",
    url: "https://zimestimate.co.zw",
    siteName: "ZimEstimate",
    title: "ZimEstimate - Construction Cost Estimation",
    description: "Build smarter estimates for your Zimbabwe construction projects",
  },
};

export const viewport: Viewport = {
  themeColor: "#14213D",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ServiceWorkerProvider>
          <CurrencyProvider>
            {children}
          </CurrencyProvider>
        </ServiceWorkerProvider>
      </body>
    </html>
  );
}
