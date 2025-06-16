'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import type { UserInfo } from '@/types/api';

interface ModuleCard {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  bgColor: string;
  route: string;
  enabled: boolean;
}

const modules: ModuleCard[] = [
  {
    id: 'farming',
    title: '养殖管理',
    description: '畜禽养殖全程监控',
    icon: 'fas fa-seedling',
    color: '#52C41A',
    bgColor: '#F6FFED',
    route: '/farming/monitor',
    enabled: true
  },
  {
    id: 'processing',
    title: '生产加工',
    description: '屠宰加工质量管控',
    icon: 'fas fa-industry',
    color: '#FA8C16',
    bgColor: '#FFF7E6',
    route: '/processing/reports',
    enabled: true
  },
  {
    id: 'logistics',
    title: '物流运输',
    description: '运输配送全程追踪',
    icon: 'fas fa-truck',
    color: '#722ED1',
    bgColor: '#F9F0FF',
    route: '/logistics/monitor',
    enabled: true
  },
  {
    id: 'trace',
    title: '溯源查询',
    description: '产品溯源信息查询',
    icon: 'fas fa-search',
    color: '#1677FF',
    bgColor: '#E6F7FF',
    route: '/trace/query',
    enabled: true
  },
  {
    id: 'admin',
    title: '系统管理',
    description: '用户权限系统配置',
    icon: 'fas fa-cog',
    color: '#8C8C8C',
    bgColor: '#F5F5F5',
    route: '/admin/dashboard',
    enabled: true
  },
  {
    id: 'profile',
    title: '个人中心',
    description: '个人信息设置管理',
    icon: 'fas fa-user',
    color: '#13C2C2',
    bgColor: '#E6FFFB',
    route: '/profile',
    enabled: true
  }
];

export default function HomeSelectorPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // 检查登录状态
    const token = localStorage.getItem('auth_token');
    const userInfo = localStorage.getItem('user_info');
    
    if (!token) {
      router.push('/auth/login');
      return;
    }
    
    if (userInfo) {
      try {
        setUser(JSON.parse(userInfo));
      } catch (error) {
        console.error('Failed to parse user info:', error);
      }
    }
    
    setIsLoading(false);
  }, [router]);

  const handleModuleClick = (module: ModuleCard) => {
    if (!module.enabled) {
      return;
    }
    
    // 添加点击反馈
    const element = document.getElementById(`module-${module.id}`);
    if (element) {
      element.style.transform = 'scale(0.95)';
      setTimeout(() => {
        element.style.transform = '';
        router.push(module.route);
      }, 150);
    } else {
      router.push(module.route);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_info');
    router.push('/auth/login');
  };

  if (isLoading) {
    return (
      <div className="flex flex-col min-h-screen bg-[#f0f2f5]">
        <div className="max-w-[390px] mx-auto w-full min-h-screen flex items-center justify-center">
          <div className="text-center">
            <i className="fas fa-spinner fa-spin text-[#1677FF] text-3xl mb-4"></i>
            <p className="text-[#8c8c8c]">加载中...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#f0f2f5]">
      {/* 顶部导航栏 */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-[#1677FF] text-white z-50 shadow-[0_2px_8px_rgba(0,0,0,0.15)]">
        <div className="max-w-[390px] mx-auto h-full flex items-center justify-between px-4">
          <h1 className="text-lg font-semibold">功能模块选择</h1>
          <button
            onClick={handleLogout}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
            title="退出登录"
          >
            <i className="fas fa-sign-out-alt text-sm"></i>
          </button>
        </div>
      </header>

      {/* 主内容区域 */}
      <main className="flex-1 pt-20 pb-4">
        <div className="max-w-[390px] mx-auto px-4">
          
          {/* 用户信息卡片 */}
          {user && (
            <Card className="bg-white rounded-lg shadow-sm p-4 mb-4 hover:shadow-md transition-shadow">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-[#1677FF] rounded-full flex items-center justify-center text-white font-semibold text-lg">
                  {user.username.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-[#262626]">欢迎回来，{user.username}</h3>
                  <p className="text-sm text-[#8c8c8c]">
                    {user.role === 'admin' ? '系统管理员' : 
                     user.role === 'manager' ? '管理员' : 
                     user.role === 'operator' ? '操作员' : '查看者'}
                  </p>
                </div>
                <div className="text-[#52c41a]">
                  <i className="fas fa-check-circle"></i>
                </div>
              </div>
            </Card>
          )}

          {/* 模块网格 */}
          <div className="grid grid-cols-2 gap-4">
            {modules.map((module) => (
              <Card
                key={module.id}
                id={`module-${module.id}`}
                className={`
                  bg-white rounded-lg shadow-sm p-4 text-center cursor-pointer
                  transition-all duration-300 ease-out
                  hover:shadow-md hover:-translate-y-1 hover:scale-[1.03]
                  active:scale-95 active:shadow-sm
                  ${!module.enabled ? 'opacity-50 cursor-not-allowed' : ''}
                `}
                onClick={() => handleModuleClick(module)}
              >
                {/* 图标区域 */}
                <div 
                  className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3"
                  style={{ backgroundColor: module.bgColor }}
                >
                  <i 
                    className={`${module.icon} text-xl`}
                    style={{ color: module.color }}
                  ></i>
                </div>

                {/* 标题和描述 */}
                <h3 className="font-medium text-[#262626] mb-1">{module.title}</h3>
                <p className="text-xs text-[#8c8c8c] leading-relaxed">{module.description}</p>

                {/* 状态指示器 */}
                {!module.enabled && (
                  <div className="mt-2">
                    <span className="text-xs text-[#ff4d4f] bg-[#fff2f0] px-2 py-1 rounded">
                      暂未开放
                    </span>
                  </div>
                )}
              </Card>
            ))}
          </div>

          {/* 快捷操作区域 */}
          <div className="mt-6 space-y-3">
            <Card className="bg-white rounded-lg shadow-sm p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-[#E6F7FF] rounded-full flex items-center justify-center">
                    <i className="fas fa-qrcode text-[#1677FF]"></i>
                  </div>
                  <div>
                    <h4 className="font-medium text-[#262626]">扫码查询</h4>
                    <p className="text-xs text-[#8c8c8c]">扫描产品二维码快速溯源</p>
                  </div>
                </div>
                <button 
                  className="text-[#1677FF] hover:text-[#4096FF] transition-colors"
                  onClick={() => router.push('/trace/scan')}
                >
                  <i className="fas fa-chevron-right"></i>
                </button>
              </div>
            </Card>

            <Card className="bg-white rounded-lg shadow-sm p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-[#F6FFED] rounded-full flex items-center justify-center">
                    <i className="fas fa-bell text-[#52C41A]"></i>
                  </div>
                  <div>
                    <h4 className="font-medium text-[#262626]">消息通知</h4>
                    <p className="text-xs text-[#8c8c8c]">查看系统通知和提醒</p>
                  </div>
                </div>
                <button 
                  className="text-[#1677FF] hover:text-[#4096FF] transition-colors"
                  onClick={() => router.push('/profile/notifications')}
                >
                  <i className="fas fa-chevron-right"></i>
                </button>
              </div>
            </Card>
          </div>
        </div>
      </main>

      {/* 底部信息 */}
      <footer className="text-center py-4 text-xs text-[#8c8c8c]">
        <p>© 2024 食品溯源系统 v2.0</p>
        <p className="mt-1">安全 · 可信 · 透明</p>
      </footer>
    </div>
  );
} 