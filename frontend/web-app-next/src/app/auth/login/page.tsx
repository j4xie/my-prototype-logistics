'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loading } from '@/components/ui/loading';

/**
 * 认证路径重定向页面
 *
 * 将 /auth/login 重定向到 /login
 * 这是一个临时解决方案，用于解决路由引用不一致问题
 */
export default function AuthLoginRedirect() {
  const router = useRouter();

  useEffect(() => {
    // 立即重定向到正确的登录页面
    router.replace('/login');
  }, [router]);

  return (
    <div className="min-h-screen bg-[#f0f2f5] flex items-center justify-center">
      <div className="text-center">
        <Loading className="w-8 h-8 mx-auto mb-4" />
        <p className="text-gray-600">正在跳转到登录页面...</p>
      </div>
    </div>
  );
}
