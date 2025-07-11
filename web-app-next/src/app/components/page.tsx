/**
 * @module ComponentsDemo
 * @description 食品溯源系统 - 组件库演示页面
 * @version 2.0.0
 * @author 食品溯源系统开发团队
 */

'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
  MobileNav,
  BottomTabBar,
  FluidContainer,
  Row,
  Column,
  PageLayout,
} from '@/components/ui';

// ==================== 布局组件演示 ====================

/**
 * 布局组件演示
 */
const LayoutComponentsDemo = () => {
  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle>布局组件</CardTitle>
      </CardHeader>
      <CardContent>
        <h3 className="mb-4 text-lg font-medium">FluidContainer 流式容器</h3>
        <FluidContainer className="mb-6 border border-dashed border-gray-300 bg-gray-50 p-4">
          <p className="text-center">流式容器示例 (max-width: 390px)</p>
        </FluidContainer>

        <h3 className="mb-4 text-lg font-medium">Row & Column 行列布局</h3>
        <Row className="mb-4 border border-dashed border-gray-300 bg-gray-50 p-2">
          <Column width={6} className="bg-blue-100 p-2">
            <div className="flex h-12 items-center justify-center">
              Column 1 (50%)
            </div>
          </Column>
          <Column width={6} className="bg-green-100 p-2">
            <div className="flex h-12 items-center justify-center">
              Column 2 (50%)
            </div>
          </Column>
        </Row>

        <Row className="mb-4 border border-dashed border-gray-300 bg-gray-50 p-2">
          <Column width={4} className="bg-blue-100 p-2">
            <div className="flex h-12 items-center justify-center">
              Column 1 (33%)
            </div>
          </Column>
          <Column width={4} className="bg-green-100 p-2">
            <div className="flex h-12 items-center justify-center">
              Column 2 (33%)
            </div>
          </Column>
          <Column width={4} className="bg-yellow-100 p-2">
            <div className="flex h-12 items-center justify-center">
              Column 3 (33%)
            </div>
          </Column>
        </Row>

        <h3 className="mb-4 text-lg font-medium">PageLayout 页面布局</h3>
        <div
          className="relative mb-4 overflow-hidden border border-dashed border-gray-300"
          style={{ height: 400 }}
        >
          <PageLayout
            title="页面标题"
            showBack={true}
            fullHeight={false}
            className="bg-gray-50"
          >
            <PageLayout.Content>
              <div className="h-40 rounded-lg bg-white p-4 shadow-sm">
                <h4 className="mb-2 font-medium">内容区域</h4>
                <p className="text-sm text-gray-600">
                  使用 PageLayout.Content 包装内容
                </p>
              </div>
            </PageLayout.Content>
            <PageLayout.Footer>
              <p className="text-center text-sm text-gray-600">页脚区域</p>
            </PageLayout.Footer>
          </PageLayout>
        </div>
      </CardContent>
      <CardFooter>
        <Link
          href="/components/layout"
          className="text-sm text-blue-600 hover:underline"
        >
          查看更多布局组件示例 →
        </Link>
      </CardFooter>
    </Card>
  );
};

// ==================== 导航组件演示 ====================

/**
 * 导航组件演示
 */
const NavigationComponentsDemo = () => {
  const [activeTab, setActiveTab] = useState('home');

  const bottomTabs = [
    { key: 'home', label: '首页', icon: <HomeIcon /> },
    { key: 'search', label: '搜索', icon: <SearchIcon /> },
    { key: 'profile', label: '我的', icon: <UserIcon /> },
  ];

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle>导航组件</CardTitle>
      </CardHeader>
      <CardContent>
        <h3 className="mb-4 text-lg font-medium">MobileNav 移动导航</h3>
        <div className="mb-4 border border-dashed border-gray-300 bg-gray-50 p-4">
          <MobileNav
            items={[
              { key: 'home', label: '首页', icon: <HomeIcon /> },
              { key: 'search', label: '搜索', icon: <SearchIcon /> },
              { key: 'profile', label: '我的', icon: <UserIcon />, badge: 3 },
            ]}
            activeItem="home"
            className="bg-white shadow-sm"
          />
        </div>

        <h3 className="mb-4 text-lg font-medium">BottomTabBar 底部标签栏</h3>
        <div className="relative mb-4 border border-dashed border-gray-300 bg-gray-50 pb-16">
          <div className="p-4">
            <p className="mb-8 text-center">当前活动标签: {activeTab}</p>
          </div>
          <BottomTabBar
            tabs={bottomTabs}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            className="absolute right-0 bottom-0 left-0"
          />
        </div>
      </CardContent>
      <CardFooter>
        <Link
          href="/components/navigation"
          className="text-sm text-blue-600 hover:underline"
        >
          查看更多导航组件示例 →
        </Link>
      </CardFooter>
    </Card>
  );
};

// ==================== 图标组件 ====================

const HomeIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
    <polyline points="9 22 9 12 15 12 15 22"></polyline>
  </svg>
);

const SearchIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="11" cy="11" r="8"></circle>
    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
  </svg>
);

const UserIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
    <circle cx="12" cy="7" r="4"></circle>
  </svg>
);

// ==================== 主页面组件 ====================

export default function ComponentsPage() {
  return (
    <div className="flex flex-col min-h-screen max-w-[390px] mx-auto">
      <main className="flex-1 p-4 space-y-8">
        <div className="mb-8">
          <h1 className="text-lg font-medium text-gray-900 mb-2">
            组件库演示
          </h1>
          <p className="text-sm text-gray-600">
            展示食品溯源系统中使用的现代化UI组件
          </p>
        </div>

        <LayoutComponentsDemo />
        <NavigationComponentsDemo />

        {/* 返回首页链接 */}
        <div className="mt-8 text-center">
          <Link href="/" className="text-sm text-blue-600 hover:underline">
            ← 返回首页
          </Link>
        </div>
      </main>
    </div>
  );
}
