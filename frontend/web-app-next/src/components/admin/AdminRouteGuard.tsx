'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loading } from '@/components/ui/loading';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuthStore } from '@/store/authStore';

interface AdminRouteGuardProps {
  children: React.ReactNode;
  requiredLevel?: 0 | 5 | 10 | 20 | 50; // 新的权限级别系统
  fallbackRoute?: string;
}

export default function AdminRouteGuard({ 
  children, 
  requiredLevel = 10, 
  fallbackRoute = '/login' 
}: AdminRouteGuardProps) {
  const router = useRouter();
  const { isAuthenticated, user } = useAuthStore();
  const permissions = usePermissions();
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    checkAdminAuth();
  }, [isAuthenticated, user, requiredLevel]);

  const checkAdminAuth = () => {
    try {
      // 首先检查预览模式
      if (typeof window !== 'undefined') {
        const previewMode = sessionStorage.getItem('preview_mode_enabled');
        if (previewMode) {
          console.log('[AdminGuard] 预览模式检测到，跳过权限检查');
          setIsAuthorized(true);
          return;
        }
      }

      // 检查基本认证状态
      if (!isAuthenticated || !user) {
        console.log('[AdminGuard] 用户未认证');
        setIsAuthorized(false);
        router.push(fallbackRoute);
        return;
      }

      // 检查admin模块权限
      if (!permissions.hasModuleAccess('admin')) {
        console.log('[AdminGuard] 无admin模块权限');
        setIsAuthorized(false);
        alert('您没有访问管理功能的权限');
        router.push('/');
        return;
      }

      // 检查权限级别
      if (!permissions.hasRoleLevel(requiredLevel)) {
        console.log(`[AdminGuard] 权限级别不足: 需要${requiredLevel}, 当前${permissions.roleLevel}`);
        setIsAuthorized(false);
        
        // 根据用户级别跳转到相应提示页面
        if (permissions.roleLevel <= 20) {
          // 管理员级别用户访问更高级别功能
          alert(`权限不足：该功能需要级别${requiredLevel}权限，您当前是级别${permissions.roleLevel}`);
          router.push('/admin/dashboard');
        } else {
          // 普通用户
          router.push('/');
        }
        return;
      }

      console.log(`[AdminGuard] 管理员认证通过: 级别${permissions.roleLevel}, 用户: ${user.username}`);
      setIsAuthorized(true);

    } catch (error) {
      console.error('[AdminGuard] 管理员认证验证失败:', error);
      setIsAuthorized(false);
      router.push(fallbackRoute);
    }
  };

  // 加载状态
  if (isAuthorized === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <Loading className="w-8 h-8 mx-auto mb-4" />
          <p className="text-slate-600">验证管理员权限中...</p>
        </div>
      </div>
    );
  }

  // 未授权
  if (!isAuthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="fas fa-shield-alt text-red-500 text-2xl"></i>
          </div>
          <h2 className="text-xl font-semibold text-slate-800 mb-2">访问受限</h2>
          <p className="text-slate-600 mb-4">
            您的权限级别(级别 {permissions.roleLevel})不足以访问此功能，需要级别 {requiredLevel}或更高权限。
          </p>
          <button
            onClick={() => router.push('/login')}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            重新登录
          </button>
        </div>
      </div>
    );
  }

  // 已授权，显示内容
  return <>{children}</>;
} 