function configuredAllowedOrigins() {
  const configured = process.env.ALLOWED_ORIGINS?.split(",") ?? [];
  const canonical = process.env.AUTH_URL ? [new URL(process.env.AUTH_URL).host] : [];

  return [...new Set([...configured, ...canonical].map((origin) => origin.trim()).filter(Boolean))];
}

/**
 * Server Action body limit.
 *
 * A submitted issue carries at most `MAX_UPLOADS_PER_ITEM` files of
 * `MAX_UPLOAD_BYTES` each, and the limit applies to the whole multipart body, so
 * it must cover every file plus the text fields and multipart overhead. Next's
 * default is 1 MB, which would silently reject any real image attachment.
 *
 * The numbers below duplicate `lib/uploads/limits.ts` because this config file is
 * plain JavaScript and cannot import TypeScript; keep them in sync.
 */
function serverActionBodySizeLimit() {
  const count = Number(process.env.MAX_UPLOADS_PER_ITEM ?? "");
  const uploads = Number.isInteger(count) && count >= 1 && count <= 10 ? count : 3;

  const bytes = Number(process.env.MAX_UPLOAD_BYTES ?? "");
  const perFile =
    Number.isInteger(bytes) && bytes >= 1024 && bytes <= 25 * 1024 * 1024 ? bytes : 5 * 1024 * 1024;

  const overhead = 1024 * 1024;
  return Math.max(uploads * perFile + overhead, 2 * 1024 * 1024);
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
      // A Server Action request carries every selected file in one body, so the
      // default 1 MB cap would reject any real image attachment.
      bodySizeLimit: serverActionBodySizeLimit(),
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
