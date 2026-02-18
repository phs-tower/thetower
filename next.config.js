/** @type {import('next').NextConfig} */
const fs = require("fs");
const path = require("path");

const computeStaffYears = () => {
  try {
    const contentDir = path.join(__dirname, "content");
    return fs
      .readdirSync(contentDir)
      .map(file => /^(\d{4})\.json$/i.exec(file)?.[1])
      .filter(Boolean)
      .map(year => parseInt(year, 10))
      .sort((a, b) => b - a);
  } catch {
    return [];
  }
};

const staffYears = computeStaffYears();

const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        hostname: 'lh5.googleusercontent.com',
        protocol: 'https'
      },
      { hostname: 'yusjougmsdnhcsksadaw.supabase.co', protocol: 'https' }
    ],
  },
  pageExtensions: ['ts', 'tsx', 'md', 'mdx'],
  env: {
    NEXT_PUBLIC_STAFF_YEARS: JSON.stringify(staffYears),
  },
  async redirects() {
    return [
      {
        source: '/',
        destination: '/home',
        permanent: true,
      },
    ]
  },
}
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
})

module.exports = withBundleAnalyzer(nextConfig)
