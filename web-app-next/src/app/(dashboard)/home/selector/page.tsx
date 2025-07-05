'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loading } from '@/components/ui/loading';
import { useAuthStore } from '@/store/authStore';

interface UserInfo {
  id: string;
  username: string;
  role: string;
  name: string;
  avatar?: string;
  department?: string;
  lastLogin?: string;
}

interface ModuleCard {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  bgColor: string;
  route: string;
  enabled: boolean;
  badge?: string;
  features: string[];
}

// 真实的业务模块配置 - 基于原系统
const businessModules: ModuleCard[] = [
  {
    id: 'farming',
    title: '农业管理',
    description: '农田作物种植全程管理',
    icon: 'fas fa-seedling',
    color: '#52C41A',
    bgColor: '#F6FFED',
    route: '/farming',
    enabled: true,
    badge: '农业生产',
    features: ['田地管理', '作物管理', '种植计划', '收获记录']
  },
  {
    id: 'processing',
    title: '生产加工',
    description: '食品加工质量管控',
    icon: 'fas fa-industry',
    color: '#FA8C16',
    bgColor: '#FFF7E6',
    route: '/processing',
    enabled: true,
    badge: '质量管控',
    features: ['原料管理', '生产批次', '质量检测', '成品管理']
  },
  {
    id: 'logistics',
    title: '物流配送',
    description: '运输配送全程追踪',
    icon: 'fas fa-truck',
    color: '#722ED1',
    bgColor: '#F9F0FF',
    route: '/logistics',
    enabled: true,
    badge: '全程追踪',
    features: ['仓库管理', '车辆管理', '运输订单', '配送跟踪']
  },
  {
    id: 'trace',
    title: '溯源查询',
    description: '产品溯源信息查询',
    icon: 'fas fa-search',
    color: '#1677FF',
    bgColor: '#E6F7FF',
    route: '/query',
    enabled: true,
    badge: '核心功能',
    features: ['溯源查询', '详情查看', '证书下载', '地图展示']
  }
];

// 管理功能模块
const managementModules: ModuleCard[] = [
  {
    id: 'admin',
    title: '系统管理',
    description: '用户权限系统配置',
    icon: 'fas fa-cog',
    color: '#8C8C8C',
    bgColor: '#F5F5F5',
    route: '/admin/dashboard',
    enabled: true,
    features: ['用户管理', '权限配置', '系统日志', '数据导入']
  },
  {
    id: 'profile',
    title: '个人中心',
    description: '个人信息设置管理',
    icon: 'fas fa-user',
    color: '#13C2C2',
    bgColor: '#E6FFFB',
    route: '/profile',
    enabled: true,
    features: ['个人信息', '系统设置', '帮助中心', '意见反馈']
  }
];

export default function HomeSelectorPage() {
  const router = useRouter();
  const { isAuthenticated, user: authUser, logout } = useAuthStore();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    // 检查登录状态
    if (!isAuthenticated) {
      console.log('🔒 用户未认证，重定向到登录页');
      router.push('/login');
      return;
    }

    console.log('✅ 用户已认证，显示模块选择器:', authUser?.displayName);

    // 更新时间
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, [isAuthenticated, authUser, router]);

  const handleModuleClick = (module: ModuleCard) => {
    if (!module.enabled) {
      alert('该功能暂未开放');
      return;
    }

    // 添加点击反馈动画
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
    if (confirm('确定要退出登录吗？')) {
      logout();
      router.push('/login');
    }
  };

  const formatTime = (date: Date) => {
    if (!mounted) return '';
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  if (!mounted || !isAuthenticated) {
    return (
      <div className="flex flex-col min-h-screen bg-[#f0f2f5]">
        <div className="max-w-[390px] mx-auto w-full min-h-screen flex items-center justify-center">
          <Loading />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#f0f2f5]">
      {/* 顶部导航栏 */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-[#1677FF] text-white z-50 shadow-[0_2px_8px_rgba(0,0,0,0.15)]">
        <div className="max-w-[390px] mx-auto h-full flex items-center justify-between px-4">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
              <i className="fas fa-leaf text-sm"></i>
            </div>
            <h1 className="text-lg font-semibold">食品溯源系统</h1>
          </div>
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
        <div className="max-w-[390px] mx-auto px-4 space-y-4">

          {/* 用户信息卡片 */}
          {authUser && (
            <Card className="bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition-all duration-300">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gradient-to-br from-[#1677FF] to-[#4096FF] rounded-full flex items-center justify-center text-white font-semibold text-lg shadow-md">
                  {authUser.displayName ? authUser.displayName.charAt(0).toUpperCase() : authUser.username.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-[#262626] text-base">
                    欢迎回来，{authUser.displayName || authUser.username}
                  </h3>
                  <p className="text-sm text-[#8c8c8c] flex items-center space-x-2">
                    <span>
                      {authUser.role?.name || '普通用户'}
                    </span>
                    <span className="text-xs">•</span>
                    <span className="text-xs">{formatTime(currentTime)}</span>
                  </p>
                </div>
                <div className="text-[#52c41a]">
                  <i className="fas fa-check-circle text-lg"></i>
                </div>
              </div>
            </Card>
          )}

          {/* 核心业务模块 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[#262626]">核心业务</h2>
              <span className="text-xs text-[#8c8c8c]">4个模块</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {businessModules.map((module) => (
                <Card
                  key={module.id}
                  id={`module-${module.id}`}
                  className={`
                    bg-white rounded-lg shadow-sm p-4 text-center cursor-pointer
                    transition-all duration-300 ease-out border border-gray-100
                    hover:shadow-md hover:-translate-y-1 hover:scale-[1.03] hover:border-[${module.color}]
                    active:scale-95 active:shadow-sm
                    ${!module.enabled ? 'opacity-50 cursor-not-allowed' : ''}
                  `}
                  onClick={() => handleModuleClick(module)}
                >
                  {/* 模块图标和徽章 */}
                  <div className="relative mb-3">
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-2 shadow-sm"
                      style={{ backgroundColor: module.bgColor }}
                    >
                      <i
                        className={`${module.icon} text-xl`}
                        style={{ color: module.color }}
                      ></i>
                    </div>
                    {module.badge && (
                      <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                        {module.badge}
                      </div>
                    )}
                  </div>

                  {/* 模块信息 */}
                  <h3 className="font-semibold text-[#262626] text-sm mb-1">
                    {module.title}
                  </h3>
                  <p className="text-xs text-[#8c8c8c] mb-2 leading-relaxed">
                    {module.description}
                  </p>

                  {/* 功能特性 */}
                  <div className="flex flex-wrap gap-1 justify-center">
                    {module.features.slice(0, 2).map((feature, index) => (
                      <span
                        key={index}
                        className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600"
                      >
                        {feature}
                      </span>
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* 管理功能模块 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[#262626]">管理功能</h2>
              <span className="text-xs text-[#8c8c8c]">2个模块</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {managementModules.map((module) => (
                <Card
                  key={module.id}
                  id={`module-${module.id}`}
                  className={`
                    bg-white rounded-lg shadow-sm p-4 text-center cursor-pointer
                    transition-all duration-300 ease-out border border-gray-100
                    hover:shadow-md hover:-translate-y-1 hover:scale-[1.03] hover:border-[${module.color}]
                    active:scale-95 active:shadow-sm
                    ${!module.enabled ? 'opacity-50 cursor-not-allowed' : ''}
                  `}
                  onClick={() => handleModuleClick(module)}
                >
                  {/* 模块图标 */}
                  <div className="mb-3">
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-2 shadow-sm"
                      style={{ backgroundColor: module.bgColor }}
                    >
                      <i
                        className={`${module.icon} text-xl`}
                        style={{ color: module.color }}
                      ></i>
                    </div>
                  </div>

                  {/* 模块信息 */}
                  <h3 className="font-semibold text-[#262626] text-sm mb-1">
                    {module.title}
                  </h3>
                  <p className="text-xs text-[#8c8c8c] mb-2 leading-relaxed">
                    {module.description}
                  </p>

                  {/* 功能特性 */}
                  <div className="flex flex-wrap gap-1 justify-center">
                    {module.features.slice(0, 2).map((feature, index) => (
                      <span
                        key={index}
                        className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600"
                      >
                        {feature}
                      </span>
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* 快速操作 */}
          <Card className="bg-white rounded-lg shadow-sm p-4">
            <h3 className="font-semibold text-[#262626] text-sm mb-3">快速操作</h3>
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant="secondary"
                className="h-10 text-xs"
                onClick={() => router.push('/trace/query')}
              >
                <i className="fas fa-search mr-1"></i>
                溯源查询
              </Button>
              <Button
                variant="secondary"
                className="h-10 text-xs"
                onClick={() => router.push('/farming/create-trace')}
              >
                <i className="fas fa-plus mr-1"></i>
                新建记录
              </Button>
              <Button
                variant="secondary"
                className="h-10 text-xs"
                onClick={() => router.push('/trace/list')}
              >
                <i className="fas fa-list mr-1"></i>
                记录列表
              </Button>
            </div>
          </Card>

          {/* 系统信息 */}
          <div className="text-center text-xs text-[#8c8c8c] py-4">
            <p>© 2025 食品溯源系统 | 工业级管理平台</p>
            <p className="mt-1">支持多产品类型溯源流程管理</p>
          </div>
        </div>
      </main>
    </div>
  );
}
