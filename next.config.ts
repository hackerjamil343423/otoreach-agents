import type { NextConfig } from "next";

/**
 * Security headers for production
 */
const securityHeaders = [
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on'
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload'
  },
  {
    key: 'X-Frame-Options',
    value: 'SAMEORIGIN'
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff'
  },
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block'
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin'
  },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self';",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline' 'unsafe-anchors';",
      "style-src 'self' 'unsafe-inline';",
      "img-src 'self' data: blob: https:;",
      "font-src 'self' data:;",
      "object-src 'none';",
      "base-uri 'self';",
      "form-action 'self';",
      "frame-ancestors 'none';",
      "upgrade-insecure-requests;"
    ].join(' ')
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()'
  }
]

const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true, // Enable React Strict Mode for production
  turbopack: {
    root: __dirname
  },
  pageExtensions: ['ts', 'tsx', 'js', 'jsx'],
  serverExternalPackages: ['@napi-rs/canvas'],
  logging: {
    fetches: {
      fullUrl: true
    }
  },
  experimental: {
    serverActions: {
      allowedOrigins: []
    }
  },
  // Add security headers
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders
      }
    ]
  }
};

export default nextConfig;
