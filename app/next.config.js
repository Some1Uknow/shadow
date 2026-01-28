/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone', // Required for Docker deployment

  // Turbopack configuration (Next.js 16+)
  // Empty config to silence the warning - Turbopack handles Node.js polyfills automatically
  turbopack: {},

  // Webpack configuration (used for production builds)
  webpack: (config, { isServer }) => {
    // Handle WASM files for Noir/Barretenberg
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };

    // Fallbacks for Node.js modules in browser
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      };
    }

    return config;
  },
};

module.exports = nextConfig;

