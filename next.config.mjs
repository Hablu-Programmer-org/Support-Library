function configuredAllowedOrigins() {
  const configured = process.env.ALLOWED_ORIGINS?.split(",") ?? [];
  const canonical = process.env.AUTH_URL ? [new URL(process.env.AUTH_URL).host] : [];

  return [...new Set([...configured, ...canonical].map((origin) => origin.trim()).filter(Boolean))];
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  poweredByHeader: false,
  deploymentId: process.env.DEPLOYMENT_VERSION ?? process.env.NEXT_DEPLOYMENT_ID,
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
  serverExternalPackages: ["mongoose", "mongodb"],
  experimental: {
    serverActions: {
      allowedOrigins: configuredAllowedOrigins(),
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
