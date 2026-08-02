import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
// The design tokens have always named Sora, Instrument Sans and IBM Plex Mono,
// but only Geist was ever loaded, so --font-heading fell back to system sans
// across the whole app. Loading them makes the type system real.
import { Sora, Instrument_Sans, IBM_Plex_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import { ServiceWorkerProvider } from "@/components/providers/ServiceWorkerProvider";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { CurrencyProvider } from "@/components/ui/CurrencyToggle";
import { ToastProvider } from "@/components/ui/Toast";
import "./globals.css";

const sora = Sora({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sora",
  display: "swap",
});

const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-instrument-sans",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
  display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://zimestimate.com";

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
  metadataBase: new URL(siteUrl),
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
    // Follows siteUrl rather than repeating it — these two disagreeing is how
    // canonical and og:url drift apart on a domain change.
    url: siteUrl,
    siteName: "ZimEstimate",
    title: "ZimEstimate - Construction Cost Estimation",
    description: "Build smarter estimates for your Zimbabwe construction projects",
    images: [
      {
        url: "/screenshots/home.png",
        width: 1280,
        height: 720,
        alt: "ZimEstimate home dashboard preview",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "ZimEstimate - Construction Cost Estimation",
    description: "Build smarter estimates for your Zimbabwe construction projects with real-time pricing and BOQ tools.",
    images: ["/screenshots/home.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#0B1F3B", // matches --color-primary — was a fourth, uncoordinated navy
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
    <html lang="en" className={`${sora.variable} ${instrumentSans.variable} ${plexMono.variable}`}>
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
                <Analytics />
              </ToastProvider>
            </CurrencyProvider>
          </ServiceWorkerProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
