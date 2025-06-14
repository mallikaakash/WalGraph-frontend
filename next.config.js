/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  
  // Turbopack configuration
  turbopack: {
    rules: {
      '*.ttf': {
        loaders: ['file-loader'],
        as: '*.ttf',
      },
    },
  },
  
  // Webpack configuration
  webpack: (config, { isServer, dev, webpack }) => {
    // Fixes npm packages that depend on `fs` module
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    
    // Monaco Editor configuration - always apply
    config.module.rules.push({
      test: /\.ttf$/,
      type: 'asset/resource',
    });
    
    // Handle Monaco Editor workers
    config.module.rules.push({
      test: /monaco-editor.*\.js$/,
      type: 'javascript/auto',
    });
    
    config.externals.push('rdf-canonize-native');
    
    // Optimize chunks for Monaco Editor
    if (!isServer) {
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          ...config.optimization.splitChunks,
          cacheGroups: {
            ...config.optimization.splitChunks?.cacheGroups,
            monaco: {
              name: 'monaco-editor',
              chunks: 'all',
              test: /[\\/]node_modules[\\/]monaco-editor[\\/]/,
              priority: 20,
            },
          },
        },
      };
    }
    
    return config;
  },
};

module.exports = nextConfig; 