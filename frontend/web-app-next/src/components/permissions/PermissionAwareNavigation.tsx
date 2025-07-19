'use client';

import { useRouter } from 'next/navigation';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import Badge from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { 
  Home, 
  Sprout, 
  Factory, 
  Truck, 
  Settings, 
  Building, 
  Lock,
  ChevronRight,
  Shield
} from 'lucide-react';

interface NavigationItem {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<any>;
  route: string;
  module?: 'farming' | 'processing' | 'logistics' | 'admin' | 'platform';
  level?: number;
  badge?: string;
  color: string;
  bgColor: string;
}

const navigationItems: NavigationItem[] = [
  {
    id: 'home',
    title: '首页',
    description: '系统首页和模块选择',
    icon: Home,
    route: '/',
    color: '#1677FF',
    bgColor: '#E6F7FF'
  },
  {
    id: 'farming',
    title: '农业管理',
    description: '农田作物种植全程管理',
    icon: Sprout,
    route: '/farming',
    module: 'farming',
    level: 50,
    badge: '农业生产',
    color: '#52C41A',
    bgColor: '#F6FFED'
  },
  {
    id: 'processing',
    title: '生产加工',
    description: '食品加工质量管控',
    icon: Factory,
    route: '/processing',
    module: 'processing',
    level: 50,
    badge: '质量管控',
    color: '#FA8C16',
    bgColor: '#FFF7E6'
  },
  {
    id: 'logistics',
    title: '物流配送',
    description: '运输配送全程追踪',
    icon: Truck,
    route: '/logistics',
    module: 'logistics',
    level: 50,
    badge: '全程追踪',
    color: '#722ED1',
    bgColor: '#F9F0FF'
  },
  {
    id: 'admin',
    title: '系统管理',
    description: '用户权限系统配置',
    icon: Settings,
    route: '/admin/dashboard',
    module: 'admin',
    level: 10,
    color: '#8C8C8C',
    bgColor: '#F5F5F5'
  },
  {
    id: 'platform',
    title: '平台管理',
    description: '平台级管理功能',
    icon: Building,
    route: '/platform',
    module: 'platform',
    level: 0,
    color: '#FF4D4F',
    bgColor: '#FFF1F0'
  }
];

interface PermissionAwareNavigationProps {
  variant?: 'grid' | 'list' | 'horizontal';
  showAll?: boolean;
  className?: string;
}

export default function PermissionAwareNavigation({
  variant = 'grid',
  showAll = false,
  className = ''
}: PermissionAwareNavigationProps) {
  const router = useRouter();
  const permissions = usePermissions();

  const checkItemPermission = (item: NavigationItem): boolean => {
    if (!item.module) return true; // 公共页面，如首页
    
    // 检查模块权限
    if (!permissions.hasModuleAccess(item.module)) {
      return false;
    }
    
    // 检查级别权限
    if (item.level !== undefined && !permissions.hasRoleLevel(item.level)) {
      return false;
    }
    
    return true;
  };

  const getItemStatus = (item: NavigationItem) => {
    const hasPermission = checkItemPermission(item);
    return {
      accessible: hasPermission,
      tooltip: hasPermission ? '' : `需要${item.module ? `${item.title}模块权限` : ''}${item.level !== undefined ? `和级别${item.level}权限` : ''}`,
      className: hasPermission ? 'text-gray-900' : 'text-gray-400'
    };
  };

  const handleItemClick = (item: NavigationItem) => {
    const status = getItemStatus(item);
    if (!status.accessible) {
      alert(status.tooltip || '您没有访问此功能的权限');
      return;
    }
    
    router.push(item.route);
  };

  const accessibleItems = navigationItems.filter(item => showAll || checkItemPermission(item));

  if (variant === 'horizontal') {
    return (
      <div className={`flex space-x-2 overflow-x-auto pb-2 ${className}`}>
        {accessibleItems.map((item) => {
          const status = getItemStatus(item);
          const IconComponent = item.icon;
          
          return (
            <Button
              key={item.id}
              variant={status.accessible ? "outline" : "ghost"}
              size="sm"
              onClick={() => handleItemClick(item)}
              className={`flex items-center space-x-2 whitespace-nowrap ${
                status.accessible ? 'hover:bg-gray-50' : 'cursor-not-allowed opacity-50'
              }`}
              disabled={!status.accessible}
            >
              <IconComponent className="h-4 w-4" />
              <span>{item.title}</span>
              {!status.accessible && <Lock className="h-3 w-3" />}
            </Button>
          );
        })}
      </div>
    );
  }

  if (variant === 'list') {
    return (
      <div className={`space-y-2 ${className}`}>
        {accessibleItems.map((item) => {
          const status = getItemStatus(item);
          const IconComponent = item.icon;
          
          return (
            <Card
              key={item.id}
              className={`p-3 cursor-pointer transition-all ${
                status.accessible 
                  ? 'hover:shadow-md hover:border-blue-200' 
                  : 'opacity-50 cursor-not-allowed bg-gray-50'
              }`}
              onClick={() => handleItemClick(item)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: status.accessible ? item.bgColor : '#f5f5f5' }}
                  >
                    <IconComponent
                      className="h-4 w-4"
                      style={{ color: status.accessible ? item.color : '#d9d9d9' }}
                    />
                  </div>
                  <div>
                    <h3 className={`font-medium ${status.className}`}>
                      {item.title}
                      {!status.accessible && <Lock className="h-3 w-3 inline ml-1" />}
                    </h3>
                    <p className={`text-sm ${status.accessible ? 'text-gray-500' : 'text-gray-400'}`}>
                      {status.accessible ? item.description : '需要相应权限'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {item.badge && status.accessible && (
                    <Badge variant="secondary" className="text-xs">
                      {item.badge}
                    </Badge>
                  )}
                  {!status.accessible && (
                    <Badge variant="destructive" className="text-xs">
                      受限
                    </Badge>
                  )}
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    );
  }

  // 默认网格布局
  return (
    <div className={`grid grid-cols-2 gap-3 ${className}`}>
      {accessibleItems.map((item) => {
        const status = getItemStatus(item);
        const IconComponent = item.icon;
        
        return (
          <Card
            key={item.id}
            className={`p-4 text-center cursor-pointer transition-all ${
              status.accessible 
                ? 'hover:shadow-md hover:-translate-y-1 hover:scale-[1.02]' 
                : 'opacity-50 cursor-not-allowed bg-gray-50'
            }`}
            onClick={() => handleItemClick(item)}
          >
            {/* 图标和徽章 */}
            <div className="relative mb-3">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-2 shadow-sm relative"
                style={{ backgroundColor: status.accessible ? item.bgColor : '#f5f5f5' }}
              >
                <IconComponent
                  className="h-6 w-6"
                  style={{ color: status.accessible ? item.color : '#d9d9d9' }}
                />
                {!status.accessible && (
                  <div className="absolute -top-1 -right-1 bg-red-500 rounded-full p-1">
                    <Lock className="h-2 w-2 text-white" />
                  </div>
                )}
              </div>
              {item.badge && status.accessible && (
                <Badge variant="secondary" className="text-xs">
                  {item.badge}
                </Badge>
              )}
            </div>

            {/* 标题和描述 */}
            <h3 className={`font-medium text-sm mb-1 ${status.className}`}>
              {item.title}
              {!status.accessible && <Lock className="h-3 w-3 inline ml-1" />}
            </h3>
            <p className={`text-xs ${status.accessible ? 'text-gray-500' : 'text-gray-400'}`}>
              {status.accessible ? item.description : '需要相应权限'}
            </p>

            {/* 权限状态 */}
            <div className="mt-2">
              {status.accessible ? (
                <Badge variant="outline" className="text-xs">
                  可访问
                </Badge>
              ) : (
                <Badge variant="destructive" className="text-xs">
                  权限不足
                </Badge>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

// 导出辅助组件
export function PermissionBadge({ 
  module, 
  level, 
  className = '' 
}: { 
  module?: string; 
  level?: number; 
  className?: string; 
}) {
  const permissions = usePermissions();
  
  const hasModuleAccess = module ? permissions.hasModuleAccess(module) : true;
  const hasLevelAccess = level !== undefined ? permissions.hasRoleLevel(level) : true;
  const hasAccess = hasModuleAccess && hasLevelAccess;
  
  return (
    <Badge
      variant={hasAccess ? "default" : "destructive"}
      className={`text-xs flex items-center space-x-1 ${className}`}
    >
      {hasAccess ? (
        <>
          <Shield className="h-3 w-3" />
          <span>有权限</span>
        </>
      ) : (
        <>
          <Lock className="h-3 w-3" />
          <span>无权限</span>
        </>
      )}
    </Badge>
  );
}