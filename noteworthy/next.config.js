/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  transpilePackages: [
    "@heroui/button",
    "@heroui/card",
    "@heroui/divider",
    "@heroui/spacer",
    "@heroui/tabs",
    "@heroui/tooltip",
    "@heroui/dom-animation",
  ],
};

module.exports = nextConfig;
