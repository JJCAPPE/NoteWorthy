/** @type {import('next').NextConfig} */
const nextConfig = {
  // For App Router's API routes, this increases allowed form data size
  experimental: {
    serverActions: {
      bodySizeLimit: '100mb',
    },
  },
  // Updated property name as per warning
  serverExternalPackages: [],
  // Set page data size limit
  productionBrowserSourceMaps: true,
  poweredByHeader: false,
}

module.exports = nextConfig
