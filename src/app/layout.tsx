import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { ServiceWorkerProvider } from "@/components/providers/ServiceWorkerProvider";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { CurrencyProvider } from "@/components/ui/CurrencyToggle";
import { ToastProvider } from "@/components/ui/Toast";
import "./globals.css";

const geistSans = localFont({
  variable: "--font-geist-sans",
  display: "swap",
  src: [
    {
      path: "../fonts/geist-latin.woff2",
      weight: "100 900",
      style: "normal",
    },
    {
      path: "../fonts/geist-latin-ext.woff2",
      weight: "100 900",
      style: "normal",
    },
  ],
});

const geistMono = localFont({
  variable: "--font-geist-mono",
  display: "swap",
  src: [
    {
      path: "../fonts/geist-mono-latin.woff2",
      weight: "100 900",
      style: "normal",
    },
    {
      path: "../fonts/geist-mono-latin-ext.woff2",
      weight: "100 900",
      style: "normal",
    },
  ],
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
        <AuthProvider>
          <ServiceWorkerProvider>
            <CurrencyProvider>
              <ToastProvider>
                {children}
              </ToastProvider>
            </CurrencyProvider>
          </ServiceWorkerProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
