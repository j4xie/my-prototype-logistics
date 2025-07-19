'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Badge from '@/components/ui/badge';
import { Loading } from '@/components/ui/loading';
import { ArrowLeft, LogOut } from 'lucide-react';

interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  department: string;
  shift: string;
  avatar: string;
  statistics: {
    traceRecords: number;
    todayUploads: number;
    auditRate: number;
  };
  permissions: string[];
}

interface QuickAction {
  id: string;
  title: string;
  icon: string;
  href: string;
  description?: string;
}

interface MenuItem {
  id: string;
  title: string;
  icon: string;
  href: string;
  badge?: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  const quickActions: QuickAction[] = [
    {
      id: 'trace-records',
      title: '溯源记录',
      icon: '📋',
      href: '/list',
      description: '查看我的溯源记录'
    },
    {
      id: 'work-log',
      title: '工作日志',
      icon: '⏰',
      href: '/farming/data-collection-center',
      description: '今日工作记录'
    },
    {
      id: 'task-list',
      title: '任务列表',
      icon: '✅',
      href: '/admin/dashboard',
      description: '待办任务管理'
    },
    {
      id: 'permissions',
      title: '权限管理',
      icon: '🔐',
      href: '/admin/users',
      description: '查看我的权限'
    }
  ];

  const menuItems: MenuItem[] = [
    {
      id: 'edit-profile',
      title: '个人资料',
      icon: '👤',
      href: '/profile/edit'
    },
    {
      id: 'security',
      title: '账号安全',
      icon: '🔒',
      href: '/profile/security'
    },
    {
      id: 'notifications',
      title: '消息通知',
      icon: '🔔',
      href: '/profile/notifications',
      badge: '3'
    },
    {
      id: 'settings',
      title: '系统设置',
      icon: '⚙️',
      href: '/settings'
    }
  ];

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);

      // 模拟API调用
      const response = await fetch('/api/users/profile');
      if (response.ok) {
        const data = await response.json();
        setProfile(data);
      } else {
        // Mock数据回退
        setProfile({
          id: 'user_001',
          name: '张三',
          email: 'zhangsan@example.com',
          phone: '13800138000',
          role: '系统管理员',
          department: '技术部',
          shift: '早班',
          avatar: '/images/avatar-placeholder.svg',
          statistics: {
            traceRecords: 127,
            todayUploads: 23,
            auditRate: 98
          },
          permissions: ['admin', 'trace.all', 'user.manage']
        });
      }
    } catch (error) {
      console.error('获取用户资料失败:', error);

      // 错误时使用Mock数据
      setProfile({
        id: 'user_001',
        name: '张三',
        email: 'zhangsan@example.com',
        phone: '13800138000',
        role: '系统管理员',
        department: '技术部',
        shift: '早班',
        avatar: '/images/avatar-placeholder.svg',
        statistics: {
          traceRecords: 127,
          todayUploads: 23,
          auditRate: 98
        },
        permissions: ['admin', 'trace.all', 'user.manage']
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    if (confirm('确定要退出登录吗？')) {
      // 清除本地存储的用户信息
      localStorage.removeItem('user');
      localStorage.removeItem('token');

      // 跳转到登录页
      router.push('/login');
    }
  };

  const handleQuickAction = (action: QuickAction) => {
    router.push(action.href);
  };

  const handleMenuItem = (item: MenuItem) => {
    router.push(item.href);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loading size="lg" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex flex-col min-h-screen max-w-[390px] mx-auto bg-gray-50">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-500 mb-4">获取用户信息失败</p>
            <Button onClick={fetchProfile}>重试</Button>
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
          <button
            onClick={() => router.back()}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
            title="返回"
          >
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-lg font-semibold">个人中心</h1>
          <button
            onClick={() => router.push('/home/selector')}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
            title="返回主页"
          >
            <i className="fas fa-home"></i>
          </button>
        </div>
      </header>

      <div className="max-w-[390px] mx-auto w-full">
        {/* 用户信息卡片 */}
        <div className="bg-[#1890FF] text-white p-6 pb-16 rounded-b-[30px] relative overflow-hidden mt-16">
        {/* 装饰性背景圆圈 */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-5 rounded-full -mr-10 -mt-10"></div>
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white opacity-5 rounded-full -ml-10 -mb-10"></div>

        <div className="flex items-center mb-4">
          <div className="relative w-16 h-16 mr-4">
            <Image
              src={profile.avatar}
              alt="用户头像"
              width={64}
              height={64}
              priority
              className="rounded-full border-2 border-white object-cover"
              onError={(e) => {
                // 头像加载失败时的处理
                const img = e.target as HTMLImageElement;
                img.src = '/images/avatar-placeholder.svg';
              }}
            />
          </div>
          <div>
            <h2 className="text-xl font-bold">{profile.name}</h2>
            <div className="flex items-center mt-1">
              <Badge variant="primary" className="text-sm bg-white/20 text-white border-white/20 mr-2">
                {profile.role}
              </Badge>
              <Badge variant="default" className="text-xs bg-white/10 text-white border-white/20">
                {profile.shift}
              </Badge>
            </div>
          </div>
        </div>

        {/* 统计数据 */}
        <div className="grid grid-cols-3 gap-4 mt-6">
          <div className="text-center">
            <p className="text-xl font-bold">{profile.statistics.traceRecords}</p>
            <p className="text-xs opacity-80">溯源记录</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold">{profile.statistics.todayUploads}</p>
            <p className="text-xs opacity-80">今日上传</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold">{profile.statistics.auditRate}%</p>
            <p className="text-xs opacity-80">审核通过率</p>
          </div>
        </div>
      </div>

      {/* 主内容 */}
      <main className="flex-1 px-4 space-y-4 -mt-10">
        {/* 快捷功能卡片 */}
        <Card className="bg-white rounded-xl shadow-sm p-4">
          <h3 className="text-base font-medium mb-3">快捷功能</h3>
          <div className="grid grid-cols-4 gap-2">
            {quickActions.map((action) => (
              <button
                key={action.id}
                onClick={() => handleQuickAction(action)}
                className="flex flex-col items-center p-2 rounded-lg hover:bg-gray-50 transition-colors"
                aria-label={action.description}
              >
                <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mb-1">
                  <span className="text-lg">{action.icon}</span>
                </div>
                <span className="text-xs text-center">{action.title}</span>
              </button>
            ))}
          </div>
        </Card>

        {/* 菜单列表 */}
        <Card className="bg-white rounded-xl shadow-sm overflow-hidden">
          {menuItems.map((item, index) => (
            <button
              key={item.id}
              onClick={() => handleMenuItem(item)}
              className={`w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors text-left ${
                index < menuItems.length - 1 ? 'border-b border-gray-100' : ''
              }`}
              aria-label={`进入${item.title}`}
            >
              <div className="flex items-center">
                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center mr-3">
                  <span className="text-lg">{item.icon}</span>
                </div>
                <span className="font-medium">{item.title}</span>
                {item.badge && (
                  <Badge variant="error" className="ml-2 text-xs">
                    {item.badge}
                  </Badge>
                )}
              </div>
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ))}
        </Card>

        {/* 退出登录按钮 */}
        <div className="pb-6">
          <Button
            onClick={handleLogout}
            variant="danger"
            className="w-full"
          >
            退出登录
          </Button>
        </div>
      </main>
      </div>
    </div>
  );
}
