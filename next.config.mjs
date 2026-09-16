/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      { source: "/v1/world/manifest.json", destination: "/api/v1/world/manifest" },
      { source: "/api/v1/world/manifest.json", destination: "/api/v1/world/manifest" },
    ];
  },
  async headers() {
    return [
      {
        source: "/api/v1/world/manifest.json",
        headers: [
          { key: "Cache-Control", value: "public, max-age=30, stale-while-revalidate=60" },
          { key: "Access-Control-Allow-Origin", value: "*" },
        ],
      },
    ];
  },
};

export default nextConfig;
