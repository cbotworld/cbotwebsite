/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      { source: '/edition-200-combis', destination: '/combis', permanent: true },
      { source: '/editions/200th-combis', destination: '/combis', permanent: true },
      { source: '/edition-test-combis', destination: '/combis', permanent: true },
      { source: '/edition-200-schedule', destination: '/schedule', permanent: true },
      { source: '/editions/200th-schedule', destination: '/schedule', permanent: true },
      { source: '/edition-test-schedule', destination: '/schedule', permanent: true },
    ];
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'api.dicebear.com',
      },
    ],
  },
};

export default nextConfig;
