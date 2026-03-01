/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Fix: "Unable to snapshot resolve dependencies" on macOS with npm workspaces
  webpack: (config, { isServer }) => {
    config.snapshot = {
      ...(config.snapshot ?? {}),
      managedPaths: [],
    }
    return config
  },
}

module.exports = nextConfig
