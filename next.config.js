/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  
  // Turbopack configuration (stable)
  turbopack: {
    rules: {
      '*.ttf': {
        loaders: ['file-loader'],
        as: '*.ttf',
      },
    },
  },
  
  // Webpack configuration (only when NOT using Turbopack)
  webpack: (config, { isServer, dev, webpack }) => {
    // Skip webpack config entirely when using Turbopack
    if (process.env.TURBOPACK || (dev && process.argv.includes('--turbopack'))) {
      return config;
    }
    
    // Fixes npm packages that depend on `fs` module
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    
    // Monaco Editor configuration
    config.module.rules.push({
      test: /\.ttf$/,
      type: 'asset/resource',
    });
    
    config.externals.push('rdf-canonize-native');
    
    return config;
  },
};

module.exports = nextConfig; 