/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone', // Required for Docker deployment
  turbopack: {}, // silence turbopack warning when using webpack config

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
