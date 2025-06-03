import type { NextConfig } from "next";

// Bundle Analyzer配置
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

const nextConfig: NextConfig = {
  // 完全禁用Turbopack相关功能避免冲突
  // experimental: {
  //   optimizePackageImports: ['@/components/ui'],
  //   ppr: false,
  // },

  // 使用标准配置
  experimental: {},

  // 服务器外部包配置
  serverExternalPackages: [],

  // 添加webpack配置修复vendor chunks问题
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    // 确保vendor chunks正确生成
    if (!dev && isServer) {
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          ...config.optimization.splitChunks,
          cacheGroups: {
            ...config.optimization.splitChunks?.cacheGroups,
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendors',
              chunks: 'all',
              enforce: true,
            },
          },
        },
      };
    }

    return config;
  },

  // 构建优化 (简化)
  compiler: {
    // SWC编译器优化
    removeConsole: process.env.NODE_ENV === 'production',
  },

  // 图片优化 (简化)
  images: {
    formats: ['image/webp', 'image/avif'],
  },

  // 输出配置 (改为默认)
  // output: 'standalone',

  // 性能优化
  poweredByHeader: false,
  compress: true,
};

export default withBundleAnalyzer(nextConfig);
