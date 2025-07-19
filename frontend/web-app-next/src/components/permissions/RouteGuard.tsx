'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { usePermissions } from '@/hooks/usePermissions';
import { Loading } from '@/components/ui/loading';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Badge from '@/components/ui/badge';
import { Shield, Lock, ArrowLeft, Home } from 'lucide-react';

interface RouteGuardProps {
  children: React.ReactNode;
  requiredModule?: 'farming' | 'processing' | 'logistics' | 'admin' | 'platform';
  requiredLevel?: number;
  fallbackRoute?: string;
  showFallback?: boolean;
}

/**
 * 统一的路由权限守卫组件
 * 基于新的模块级权限系统
 */
export default function RouteGuard({
  children,
  requiredModule,
  requiredLevel,
  fallbackRoute = '/login',
  showFallback = true
}: RouteGuardProps) {
  const router = useRouter();
  const { isAuthenticated, user, isLoading } = useAuthStore();
  const permissions = usePermissions();
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [authMessage, setAuthMessage] = useState<string>('');

  useEffect(() => {
    checkPermissions();
  }, [isAuthenticated, user, requiredModule, requiredLevel]);

  const checkPermissions = async () => {
    try {
      // 检查是否正在加载
      if (isLoading) {
        setIsAuthorized(null);
        return;
      }

      // 首先检查预览模式
      if (typeof window !== 'undefined') {
        const previewMode = sessionStorage.getItem('preview_mode_enabled');
        if (previewMode) {
          console.log('[RouteGuard] 预览模式检测到，跳过权限检查');
          setIsAuthorized(true);
          setAuthMessage('');
          return;
        }
      }

      // 检查基本认证
      if (!isAuthenticated || !user) {
        console.log('[RouteGuard] 用户未认证，重定向到登录页');
        setIsAuthorized(false);
        setAuthMessage('您需要先登录才能访问此页面');
        
        if (!showFallback) {
          router.push(fallbackRoute);
        }
        return;
      }

      // 检查模块权限
      if (requiredModule && !permissions.hasModuleAccess(requiredModule)) {
        console.log(`[RouteGuard] 用户无${requiredModule}模块权限`);
        setIsAuthorized(false);
        setAuthMessage(`您没有访问${getModuleName(requiredModule)}模块的权限`);
        
        if (!showFallback) {
          router.push('/');
        }
        return;
      }

      // 检查角色级别
      if (requiredLevel !== undefined && !permissions.hasRoleLevel(requiredLevel)) {
        console.log(`[RouteGuard] 用户权限级别不足: 需要${requiredLevel}, 当前${permissions.roleLevel}`);
        setIsAuthorized(false);
        setAuthMessage(`该功能需要权限级别${requiredLevel}，您当前级别为${permissions.roleLevel}`);
        
        if (!showFallback) {
          router.push('/');
        }
        return;
      }

      // 权限验证通过
      console.log(`[RouteGuard] 权限验证通过: 用户${user.username}, 模块${requiredModule || '无'}, 级别${requiredLevel || '无'}`);
      setIsAuthorized(true);
      setAuthMessage('');

    } catch (error) {
      console.error('[RouteGuard] 权限验证失败:', error);
      setIsAuthorized(false);
      setAuthMessage('权限验证失败，请重试');
    }
  };

  const getModuleName = (module: string): string => {
    const moduleNames: Record<string, string> = {
      farming: '农业管理',
      processing: '生产加工',
      logistics: '物流配送',
      admin: '系统管理',
      platform: '平台管理'
    };
    return moduleNames[module] || module;
  };

  // 加载状态
  if (isLoading || isAuthorized === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f0f2f5]">
        <div className="text-center">
          <Loading className="w-8 h-8 mx-auto mb-4" />
          <p className="text-slate-600">验证权限中...</p>
        </div>
      </div>
    );
  }

  // 权限不足，显示错误页面
  if (!isAuthorized) {
    if (!showFallback) {
      return null; // 不显示错误页面，直接重定向
    }

    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f0f2f5] p-4">
        <Card className="max-w-md w-full p-6 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="h-8 w-8 text-red-500" />
          </div>
          
          <h2 className="text-xl font-semibold text-slate-800 mb-2">访问受限</h2>
          
          <p className="text-slate-600 mb-4">
            {authMessage}
          </p>

          {/* 用户信息 */}
          {user && (
            <div className="bg-gray-50 rounded-lg p-3 mb-4">
              <div className="flex items-center justify-center space-x-2 mb-2">
                <span className="text-sm font-medium">{user.displayName || user.username}</span>
                <Badge variant="secondary" className="text-xs">
                  级别 {permissions.roleLevel}
                </Badge>
              </div>
              <div className="text-xs text-gray-500">
                当前角色: {permissions.roleInfo?.name || '普通用户'}
              </div>
            </div>
          )}

          {/* 权限要求 */}
          {(requiredModule || requiredLevel !== undefined) && (
            <div className="bg-blue-50 rounded-lg p-3 mb-4">
              <div className="flex items-center justify-center space-x-2 mb-2">
                <Shield className="h-4 w-4 text-blue-500" />
                <span className="text-sm font-medium text-blue-700">权限要求</span>
              </div>
              <div className="text-xs text-blue-600 space-y-1">
                {requiredModule && (
                  <div>模块权限: {getModuleName(requiredModule)}</div>
                )}
                {requiredLevel !== undefined && (
                  <div>权限级别: {requiredLevel}或以上</div>
                )}
              </div>
            </div>
          )}

          {/* 操作按钮 */}
          <div className="flex flex-col space-y-2">
            <Button
              onClick={() => router.push('/')}
              className="flex items-center justify-center space-x-2"
            >
              <Home className="h-4 w-4" />
              <span>返回首页</span>
            </Button>
            
            <Button
              onClick={() => router.back()}
              variant="outline"
              className="flex items-center justify-center space-x-2"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>返回上页</span>
            </Button>

            {!isAuthenticated && (
              <Button
                onClick={() => router.push('/login')}
                variant="secondary"
                className="flex items-center justify-center space-x-2"
              >
                <span>重新登录</span>
              </Button>
            )}
          </div>
        </Card>
      </div>
    );
  }

  // 权限验证通过，显示内容
  return <>{children}</>;
}