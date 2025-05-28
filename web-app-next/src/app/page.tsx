/**
 * @module HomePage
 * @description 食品溯源系统 - 首页 (Phase-3)
 * @version 2.0.0
 * @author 食品溯源系统开发团队
 */

'use client';

import { Button } from '@/components/ui/button';
import { useState } from 'react';

export default function HomePage() {
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-16">
        {/* 头部标题 */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
            食品溯源系统
            <span className="block text-2xl md:text-3xl text-[#1890FF] mt-2">
              Phase-3 技术栈现代化
            </span>
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            基于 Next.js 14 + TypeScript + Tailwind CSS 的现代化重构
          </p>
        </div>

        {/* 技术栈展示 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {[
            { name: 'Next.js 14', desc: 'App Router + SSR/SSG', color: 'bg-black text-white' },
            { name: 'TypeScript', desc: '类型安全开发', color: 'bg-blue-600 text-white' },
            { name: 'Tailwind CSS', desc: '原子化CSS框架', color: 'bg-cyan-500 text-white' },
            { name: 'Zustand', desc: '轻量状态管理', color: 'bg-orange-500 text-white' },
          ].map((tech, index) => (
            <div key={index} className="bg-white rounded-lg shadow-sm p-6 text-center">
              <div className={`inline-block px-3 py-1 rounded-full text-sm font-medium mb-3 ${tech.color}`}>
                {tech.name}
              </div>
              <p className="text-gray-600 text-sm">{tech.desc}</p>
            </div>
          ))}
        </div>

        {/* 组件演示区域 */}
        <div className="bg-white rounded-lg shadow-sm p-8 mb-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">
            现代化组件演示
          </h2>
          
          <div className="space-y-8">
            {/* 按钮组件演示 */}
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Button 组件</h3>
              <div className="flex flex-wrap gap-4 items-center">
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
                <Button variant="ghost">
                  Ghost
                </Button>
                <Button 
                  variant="primary" 
                  loading={loading}
                  onClick={handleAsyncAction}
                >
                  {loading ? '加载中...' : `异步操作 (${count})`}
                </Button>
              </div>
            </div>

            {/* 功能特性展示 */}
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4">现代化特性</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm">TypeScript 类型安全</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm">React 18 并发特性</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm">Tailwind CSS 原子化样式</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm">WCAG 2.1 AA 可访问性</span>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span className="text-sm">Zustand 状态管理</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span className="text-sm">React Query 数据获取</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span className="text-sm">App Router 路由系统</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span className="text-sm">SSR/SSG 性能优化</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 性能指标 */}
        <div className="bg-white rounded-lg shadow-sm p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">
            性能提升目标
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              { metric: '首屏加载', current: '~5秒', target: '<2秒', improvement: '60%' },
              { metric: '构建速度', current: '~45秒', target: '<5秒', improvement: '90%' },
              { metric: '热重载', current: '~3秒', target: '<200ms', improvement: '95%' },
              { metric: 'Lighthouse', current: '~70', target: '>90', improvement: '29%' },
            ].map((item, index) => (
              <div key={index} className="text-center">
                <div className="text-sm text-gray-600 mb-2">{item.metric}</div>
                <div className="text-lg font-semibold text-gray-900 mb-1">
                  {item.current} → {item.target}
                </div>
                <div className="text-sm text-green-600 font-medium">
                  提升 {item.improvement}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 底部信息 */}
        <div className="text-center mt-16 text-gray-600">
          <p className="text-sm">
            Phase-3 技术栈现代化 - TASK-P3-001 前端框架迁移评估与选型
          </p>
          <p className="text-xs mt-2">
            基于 Next.js 14 + TypeScript + Zustand + React Query
          </p>
        </div>
      </div>
    </div>
  );
}
