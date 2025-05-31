import type { NextConfig } from "next";

// Bundle Analyzer配置
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

const nextConfig: NextConfig = {
  // 禁用Turbopack (可能导致开发服务器问题)
  // turbopack: {
  //   rules: {
  //     '*.svg': {
  //       loaders: ['@svgr/webpack'],
  //       as: '*.js',
  //     },
  //   },
  // },
  
  // 实验性功能 (简化)
  experimental: {
    // 开发环境包导入优化
    optimizePackageImports: ['@/components/ui'],
    // 禁用PPR避免问题
    ppr: false,
  },
  
  // 服务器外部包配置
  serverExternalPackages: [],
  
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
