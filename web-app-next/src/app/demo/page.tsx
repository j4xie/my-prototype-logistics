/**
 * @module TechDemoPage
 * @description 食品溯源系统 - 技术栈演示页面 (Phase-3)
 * @version 2.0.0
 * @author 食品溯源系统开发团队
 */

'use client';

import { Button } from '@/components/ui/button';
import { useState } from 'react';

export default function TechDemoPage() {
  const [loading, setLoading] = useState(false);
  const [count, setCount] = useState(0);

  const handleAsyncAction = async () => {
    setLoading(true);
    // 模拟异步操作
    await new Promise(resolve => setTimeout(resolve, 2000));
    setLoading(false);
    setCount(prev => prev + 1);
  };

  return (
    <div className="flex flex-col min-h-screen max-w-[390px] mx-auto">
      <main className="flex-1 min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="container mx-auto px-4 py-16">
          {/* 头部标题 */}
          <div className="mb-16 text-center">
            <h1 className="mb-6 text-4xl font-bold text-gray-900 md:text-6xl">
              食品溯源系统
              <span className="mt-2 block text-2xl text-[#1890FF] md:text-3xl">
                Phase-3 技术栈现代化
              </span>
            </h1>
            <p className="mx-auto max-w-2xl text-lg text-gray-600">
              基于 Next.js 14 + TypeScript + Tailwind CSS 的现代化重构
            </p>
            
            {/* 返回首页按钮 */}
            <div className="mt-6">
              <Button 
                variant="primary" 
                onClick={() => window.location.href = '/'}
                className="mr-4"
              >
                返回首页
              </Button>
              <Button 
                variant="secondary" 
                onClick={() => window.location.href = '/login'}
              >
                前往登录
              </Button>
            </div>
          </div>

          {/* 技术栈展示 */}
          <div className="mb-16 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {[
              {
                name: 'Next.js 14',
                desc: 'App Router + SSR/SSG',
                color: 'bg-black text-white',
              },
              {
                name: 'TypeScript',
                desc: '类型安全开发',
                color: 'bg-blue-600 text-white',
              },
              {
                name: 'Tailwind CSS',
                desc: '原子化CSS框架',
                color: 'bg-cyan-500 text-white',
              },
              {
                name: 'Zustand',
                desc: '轻量状态管理',
                color: 'bg-orange-500 text-white',
              },
            ].map((tech, index) => (
              <div
                key={index}
                className="rounded-lg bg-white p-6 text-center shadow-sm"
              >
                <div
                  className={`mb-3 inline-block rounded-full px-3 py-1 text-sm font-medium ${tech.color}`}
                >
                  {tech.name}
                </div>
                <p className="text-sm text-gray-600">{tech.desc}</p>
              </div>
            ))}
          </div>

          {/* 组件演示区域 */}
          <div className="mb-16 rounded-lg bg-white p-8 shadow-sm">
            <h2 className="mb-8 text-center text-2xl font-bold text-gray-900">
              现代化组件演示
            </h2>

            <div className="space-y-8">
              {/* 按钮组件演示 */}
              <div>
                <h3 className="mb-4 text-lg font-semibold text-gray-800">
                  Button 组件
                </h3>
                <div className="flex flex-wrap items-center gap-4">
                  <Button variant="primary" size="small">
                    Primary Small
                  </Button>
                  <Button variant="secondary" size="medium">
                    Secondary Medium
                  </Button>
                  <Button variant="success" size="large">
                    Success Large
                  </Button>
                  <Button variant="danger" disabled>
                    Disabled
                  </Button>
                  <Button variant="ghost">Ghost</Button>
                  <Button
                    variant="primary"
                    loading={loading}
                    onClick={handleAsyncAction}
                  >
                    {loading ? '加载中...' : `异步操作 (${count})`}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => window.open('/ai-demo', '_blank')}
                  >
                    🤖 AI演示页面
                  </Button>
                </div>
              </div>

              {/* 功能特性展示 */}
              <div>
                <h3 className="mb-4 text-lg font-semibold text-gray-800">
                  现代化特性
                </h3>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <div className="h-2 w-2 rounded-full bg-green-500"></div>
                      <span className="text-sm">TypeScript 类型安全</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="h-2 w-2 rounded-full bg-green-500"></div>
                      <span className="text-sm">React 18 并发特性</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="h-2 w-2 rounded-full bg-green-500"></div>
                      <span className="text-sm">Tailwind CSS 原子化样式</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="h-2 w-2 rounded-full bg-green-500"></div>
                      <span className="text-sm">WCAG 2.1 AA 可访问性</span>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                      <span className="text-sm">Zustand 状态管理</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                      <span className="text-sm">React Query 数据获取</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                      <span className="text-sm">App Router 路由系统</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                      <span className="text-sm">SSR/SSG 性能优化</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 性能指标 */}
          <div className="rounded-lg bg-white p-8 shadow-sm">
            <h2 className="mb-8 text-center text-2xl font-bold text-gray-900">
              性能提升目标
            </h2>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
              {[
                {
                  metric: '首屏加载',
                  current: '~5秒',
                  target: '<2秒',
                  improvement: '60%',
                },
                {
                  metric: '构建速度',
                  current: '~45秒',
                  target: '<5秒',
                  improvement: '90%',
                },
                {
                  metric: '热重载',
                  current: '~3秒',
                  target: '<200ms',
                  improvement: '95%',
                },
                {
                  metric: 'Lighthouse',
                  current: '~70',
                  target: '>90',
                  improvement: '29%',
                },
              ].map((item, index) => (
                <div
                  key={index}
                  className="rounded-lg border border-gray-200 p-4 text-center"
                >
                  <h3 className="mb-2 text-sm font-medium text-gray-600">
                    {item.metric}
                  </h3>
                  <div className="mb-1 text-xs text-gray-500">
                    当前: {item.current}
                  </div>
                  <div className="mb-2 text-sm font-semibold text-green-600">
                    目标: {item.target}
                  </div>
                  <div className="text-lg font-bold text-blue-600">
                    提升 {item.improvement}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 底部信息 */}
          <div className="mt-16 text-center">
            <p className="text-gray-600">
              🚀 Phase-3 技术栈现代化 - 提升开发效率和用户体验
            </p>
            <div className="mt-4 space-x-4">
              <Button variant="ghost" onClick={() => window.location.href = '/preview'}>
                查看预览系统
              </Button>
              <Button variant="ghost" onClick={() => window.location.href = '/ai-demo'}>
                AI功能演示
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
