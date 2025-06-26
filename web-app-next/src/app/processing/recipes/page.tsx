'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import PageLayout from '@/components/ui/page-layout';

export default function RecipesPage() {
  const router = useRouter();

  return (
    <PageLayout
      title="配方管理"
      showBack={true}
      onBack={() => router.push('/processing')}
      className="flex flex-col min-h-screen max-w-[390px] mx-auto bg-gray-50"
    >
      <main className="flex-1 pt-[80px] pb-[90px] px-4">
        <div className="space-y-4">
          {/* 配方统计 */}
          <Card className="bg-white p-4">
            <h3 className="text-lg font-medium text-gray-900 mb-3">配方统计</h3>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xl font-bold text-blue-600">25</p>
                <p className="text-sm text-gray-600">总配方</p>
              </div>
              <div>
                <p className="text-xl font-bold text-green-600">18</p>
                <p className="text-sm text-gray-600">已发布</p>
              </div>
              <div>
                <p className="text-xl font-bold text-yellow-600">7</p>
                <p className="text-sm text-gray-600">草稿</p>
              </div>
            </div>
          </Card>

          {/* 热门配方 */}
          <Card className="bg-white p-4">
            <h3 className="text-lg font-medium text-gray-900 mb-3">热门配方</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">🥩</span>
                  <div>
                    <p className="font-medium">红烧肉</p>
                    <p className="text-sm text-gray-600">45分钟 · 4人份</p>
                  </div>
                </div>
                <span className="text-sm text-yellow-600">★ 4.8</span>
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">🍅</span>
                  <div>
                    <p className="font-medium">番茄鸡蛋汤</p>
                    <p className="text-sm text-gray-600">15分钟 · 2人份</p>
                  </div>
                </div>
                <span className="text-sm text-yellow-600">★ 4.5</span>
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">🥒</span>
                  <div>
                    <p className="font-medium">凉拌黄瓜</p>
                    <p className="text-sm text-gray-600">10分钟 · 3人份</p>
                  </div>
                </div>
                <span className="text-sm text-yellow-600">★ 4.2</span>
              </div>
            </div>
          </Card>

          {/* 配方分类 */}
          <Card className="bg-white p-4">
            <h3 className="text-lg font-medium text-gray-900 mb-3">配方分类</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-blue-50 rounded-lg text-center cursor-pointer hover:bg-blue-100 transition-colors">
                <p className="text-lg font-bold text-blue-600">15</p>
                <p className="text-sm text-blue-600">主食</p>
              </div>
              <div className="p-3 bg-green-50 rounded-lg text-center cursor-pointer hover:bg-green-100 transition-colors">
                <p className="text-lg font-bold text-green-600">8</p>
                <p className="text-sm text-green-600">汤品</p>
              </div>
              <div className="p-3 bg-yellow-50 rounded-lg text-center cursor-pointer hover:bg-yellow-100 transition-colors">
                <p className="text-lg font-bold text-yellow-600">12</p>
                <p className="text-sm text-yellow-600">小菜</p>
              </div>
              <div className="p-3 bg-purple-50 rounded-lg text-center cursor-pointer hover:bg-purple-100 transition-colors">
                <p className="text-lg font-bold text-purple-600">6</p>
                <p className="text-sm text-purple-600">饮品</p>
              </div>
            </div>
          </Card>

          {/* 最近更新 */}
          <Card className="bg-white p-4">
            <h3 className="text-lg font-medium text-gray-900 mb-3">最近更新</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center space-x-2">
                  <span className="text-lg">🐔</span>
                  <span className="text-sm">宫保鸡丁</span>
                </div>
                <span className="text-xs text-gray-500">2小时前</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center space-x-2">
                  <span className="text-lg">🍋</span>
                  <span className="text-sm">柠檬蜂蜜茶</span>
                </div>
                <span className="text-xs text-gray-500">1天前</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center space-x-2">
                  <span className="text-lg">🥕</span>
                  <span className="text-sm">胡萝卜炒肉</span>
                </div>
                <span className="text-xs text-gray-500">3天前</span>
              </div>
            </div>
          </Card>
        </div>
      </main>

      {/* 底部操作按钮 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 max-w-[390px] mx-auto">
        <div className="flex space-x-3">
          <Button
            onClick={() => router.push('/processing/recipes/new')}
            className="flex-1 bg-blue-500 hover:bg-blue-600 text-white"
          >
            新建配方
          </Button>
          <Button
            onClick={() => router.push('/processing/recipes/list')}
            variant="secondary"
            className="flex-1"
          >
            查看全部
          </Button>
        </div>
      </div>
    </PageLayout>
  );
}
