'use client';

import { useRouter, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/authStore';

/**
 * 开发者导航栏组件
 * 为开发者提供平台管理和工厂管理之间的快速切换
 */
export default function DeveloperNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuthStore();

  // 只有开发者才显示导航栏
  if (user?.role?.id !== 'DEVELOPER' && user?.permissions?.role !== 'DEVELOPER') {
    return null;
  }

  // 判断当前所在的页面区域
  const isOnPlatform = pathname.startsWith('/platform');
  const isOnFactory = pathname.startsWith('/home') || 
                     pathname.startsWith('/farming') || 
                     pathname.startsWith('/processing') || 
                     pathname.startsWith('/logistics') ||
                     pathname.startsWith('/trace') ||
                     pathname.startsWith('/admin');

  const handlePlatformClick = () => {
    router.push('/platform');
  };

  const handleFactoryClick = () => {
    router.push('/home/selector');
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-gray-900 text-white shadow-lg developer-nav">
      <div className="max-w-7xl mx-auto px-4 py-2 flex justify-between items-center">
        {/* 左侧信息 */}
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium">🛠️ 开发者模式</span>
          <span className="text-xs text-gray-400">({user?.username})</span>
        </div>
        
        {/* 右侧切换按钮 */}
        <div className="flex space-x-2 nav-buttons">
          <Button
            size="sm"
            variant={isOnPlatform ? "default" : "ghost"}
            onClick={handlePlatformClick}
            className="text-xs px-3 py-1 transition-all duration-200 nav-button"
            title="切换到平台管理界面"
          >
            🏢 平台管理
          </Button>
          
          <Button
            size="sm"
            variant={isOnFactory ? "default" : "ghost"}
            onClick={handleFactoryClick}
            className="text-xs px-3 py-1 transition-all duration-200 nav-button"
            title="切换到工厂管理界面"
          >
            🏭 模块选择
          </Button>
        </div>
      </div>
    </div>
  );
}