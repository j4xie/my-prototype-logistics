'use client';

import { useEffect, useState } from 'react';
import AdminRouteGuard from './AdminRouteGuard';

interface AdminLayoutWrapperProps {
  children: React.ReactNode;
  requireDesktop?: boolean;
  requiredLevel?: 5 | 6;
}

export default function AdminLayoutWrapper({ 
  children, 
  requireDesktop = false,
  requiredLevel = 5 
}: AdminLayoutWrapperProps) {
  const [isDesktop, setIsDesktop] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    checkDeviceType();
    
    const handleResize = () => checkDeviceType();
    window.addEventListener('resize', handleResize);
    
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const checkDeviceType = () => {
    const width = window.innerWidth;
    const userAgent = navigator.userAgent.toLowerCase();
    
    // 检测移动设备
    const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
    const isTablet = width >= 768 && width <= 1024;
    const isDesktopSize = width >= 1024;
    
    setIsDesktop(isDesktopSize && !isMobile);
  };

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">初始化管理后台...</p>
        </div>
      </div>
    );
  }

  // 如果需要桌面端但当前是移动设备
  if (requireDesktop && !isDesktop) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="text-center max-w-md mx-auto">
          <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <i className="fas fa-desktop text-amber-600 text-3xl"></i>
          </div>
          <h2 className="text-2xl font-semibold text-slate-800 mb-4">需要桌面端访问</h2>
          <p className="text-slate-600 mb-6 leading-relaxed">
            此管理功能需要在桌面端电脑上操作，以确保最佳的管理体验和操作精确度。
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-blue-800 mb-2">推荐配置</h3>
            <ul className="text-sm text-blue-700 text-left space-y-1">
              <li>• 屏幕分辨率：1920×1080 或更高</li>
              <li>• 浏览器：Chrome、Firefox、Edge 最新版</li>
              <li>• 操作系统：Windows 10/11 或 macOS</li>
            </ul>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <p className="text-sm text-amber-700">
              <i className="fas fa-info-circle mr-2"></i>
              当前检测到移动设备，屏幕宽度: {typeof window !== 'undefined' ? window.innerWidth : 0}px
            </p>
          </div>
          <p className="text-sm text-slate-500 mt-4">
            请使用桌面端设备访问管理后台功能
          </p>
        </div>
      </div>
    );
  }

  return (
    <AdminRouteGuard requiredLevel={requiredLevel}>
      {children}
    </AdminRouteGuard>
  );
} 