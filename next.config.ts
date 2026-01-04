import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    // Exclude binary files and native modules from Webpack processing
    config.module.rules.push({
      test: /\.node$/,
      use: 'node-loader',
      type: 'javascript/auto',
    });

    // Exclude native modules from being processed
    config.externals = config.externals || [];
    if (!isServer) {
      config.externals.push({
        'fsevents': 'commonjs fsevents',
        'fs': 'commonjs fs',
        'path': 'commonjs path',
        'os': 'commonjs os',
      });
    }

    // Add fallbacks for Node.js modules in client-side
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        os: false,
        crypto: false,
        stream: false,
        util: false,
        buffer: false,
        events: false,
        assert: false,
        constants: false,
        domain: false,
        punycode: false,
        querystring: false,
        string_decoder: false,
        sys: false,
        timers: false,
        tty: false,
        url: false,
        vm: false,
        zlib: false,
      };
    }

    if (process.env.NODE_ENV === "development") {
      config.module.rules.push({
        test: /\.(jsx|tsx)$/,
        exclude: /node_modules/,
        enforce: "pre",
        use: "@dyad-sh/nextjs-webpack-component-tagger",
      });
    }
    return config;
  },
  // Ensure external packages are properly configured
  serverExternalPackages: ['@modelcontextprotocol/sdk'],
};

export default nextConfig;
