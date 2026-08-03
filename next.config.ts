import type { NextConfig } from "next";

const securityHeaders = [
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    // Google Identity Services signs in through a popup and posts the result
    // back to the opener. Strict "same-origin" severs that channel, so the
    // popup completes and the page never hears about it. "same-origin-allow-popups"
    // is the setting Google documents for this, and still blocks cross-origin
    // windows from reaching into ours.
    key: "Cross-Origin-Opener-Policy",
    value: "same-origin-allow-popups",
  },
];

const nextConfig: NextConfig = {
  transpilePackages: ['@phosphor-icons/react'],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
