'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loading } from '@/components/ui/loading';

interface AdminRouteGuardProps {
  children: React.ReactNode;
  requiredLevel?: 5 | 6; // 5: 权限管理员, 6: 超级管理员
  fallbackRoute?: string;
}

export default function AdminRouteGuard({ 
  children, 
  requiredLevel = 5, 
  fallbackRoute = '/admin/login' 
}: AdminRouteGuardProps) {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [userLevel, setUserLevel] = useState<number>(0);

  useEffect(() => {
    checkAdminAuth();
  }, [requiredLevel]);

  const checkAdminAuth = () => {
    try {
      const token = localStorage.getItem('admin_auth_token');
      const userInfo = localStorage.getItem('admin_user_info');

      if (!token || !userInfo) {
        console.log('[AdminGuard] 未找到管理员认证信息');
        setIsAuthorized(false);
        router.push(fallbackRoute);
        return;
      }

      const user = JSON.parse(userInfo);
      const level = user.level || user.admin_level || 0;
      
      setUserLevel(level);

      // 检查管理员级别
      if (level < requiredLevel) {
        console.log(`[AdminGuard] 权限不足: 需要Level ${requiredLevel}, 当前Level ${level}`);
        setIsAuthorized(false);
        
        // 根据用户级别跳转到相应提示页面
        if (level >= 5) {
          // 权限管理员访问超级管理员功能
          alert(`权限不足：该功能需要Level ${requiredLevel}权限，您当前是Level ${level}`);
          router.push('/admin/dashboard');
        } else {
          // 非管理员用户
          router.push(fallbackRoute);
        }
        return;
      }

      // 验证会话是否过期（可选）
      const loginTime = user.loginTime;
      if (loginTime) {
        const now = new Date().getTime();
        const loginTimestamp = new Date(loginTime).getTime();
        const sessionDuration = 8 * 60 * 60 * 1000; // 8小时会话

        if (now - loginTimestamp > sessionDuration) {
          console.log('[AdminGuard] 管理员会话已过期');
          localStorage.removeItem('admin_auth_token');
          localStorage.removeItem('admin_user_info');
          setIsAuthorized(false);
          alert('管理员会话已过期，请重新登录');
          router.push(fallbackRoute);
          return;
        }
      }

      console.log(`[AdminGuard] 管理员认证通过: Level ${level}, 用户: ${user.username}`);
      setIsAuthorized(true);

    } catch (error) {
      console.error('[AdminGuard] 管理员认证验证失败:', error);
      localStorage.removeItem('admin_auth_token');
      localStorage.removeItem('admin_user_info');
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
            您的权限级别(Level {userLevel})不足以访问此功能，需要Level {requiredLevel}或更高权限。
          </p>
          <button
            onClick={() => router.push('/admin/login')}
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