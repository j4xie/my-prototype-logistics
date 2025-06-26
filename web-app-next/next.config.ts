import type { NextConfig } from "next";

// Bundle Analyzer配置
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

const nextConfig: NextConfig = {
  // 简化配置，移除有问题的experimental选项
    experimental: {
    // 仅保留必要的优化
      optimizePackageImports: ['@/components/ui'],
    // 移除导致警告的esmExternals配置
  },

  // 服务器外部包配置
  serverExternalPackages: [],

  // 修复webpack配置，解决模块加载问题
  webpack: (config, { buildId, dev, isServer }) => {
    // 开发模式下的稳定性配置
    if (dev) {
      // 添加模块解析配置
      config.resolve = {
        ...config.resolve,
        fallback: {
          ...config.resolve?.fallback,
          fs: false,
          path: false,
          crypto: false,
        },
      };

      // 简化缓存配置，避免文件冲突
      config.cache = {
        type: 'memory', // 使用内存缓存避免文件权限问题
      };
    }

    // 添加模块解析别名
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': require('path').resolve(__dirname, 'src'),
      };

    return config;
  },

  // 开发服务器配置
  ...(process.env.NODE_ENV === 'development' && {
    onDemandEntries: {
      // 页面保持时间
      maxInactiveAge: 25 * 1000,
      // 同时保持的页面数
      pagesBufferLength: 2,
    },
  }),

  // TypeScript配置
  typescript: {
    // 忽略构建错误（仅在开发阶段）
    ignoreBuildErrors: process.env.NODE_ENV === 'development',
  },

  // ESLint配置
  eslint: {
    // 忽略构建错误（仅在开发阶段）
    ignoreDuringBuilds: process.env.NODE_ENV === 'development',
  },

  // 图片优化配置
  images: {
    domains: ['localhost'],
    unoptimized: process.env.NODE_ENV === 'development',
  },

  // 输出配置
  output: 'standalone',

  // 生产环境优化
  ...(process.env.NODE_ENV === 'production' && {
    compress: true,
  poweredByHeader: false,
  }),
};

export default withBundleAnalyzer(nextConfig);
