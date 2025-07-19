'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { usePreviewMode } from '@/utils/previewMode';
import { Eye, X, LogOut, Clock } from 'lucide-react';

/**
 * 预览模式状态指示器组件
 * 在预览模式下显示浮动状态栏
 */
export default function PreviewModeIndicator() {
  const {
    isPreviewMode,
    previewState,
    disablePreviewMode
  } = usePreviewMode();

  const [isVisible, setIsVisible] = useState(true);
  const [timeRemaining, setTimeRemaining] = useState<string>('');

  useEffect(() => {
    if (!isPreviewMode || !previewState) return;

    // 计算剩余时间
    const updateTimeRemaining = () => {
      const now = Date.now();
      const elapsed = now - previewState.entryTime;
      const remaining = (8 * 60 * 60 * 1000) - elapsed; // 8小时 - 已过时间

      if (remaining <= 0) {
        disablePreviewMode();
        return;
      }

      const hours = Math.floor(remaining / (60 * 60 * 1000));
      const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
      setTimeRemaining(`${hours}小时${minutes}分钟`);
    };

    updateTimeRemaining();
    const interval = setInterval(updateTimeRemaining, 60000); // 每分钟更新一次

    return () => clearInterval(interval);
  }, [isPreviewMode, previewState, disablePreviewMode]);

  // 如果不在预览模式或已隐藏，不显示
  if (!isPreviewMode || !isVisible) {
    return null;
  }

  const handleExitPreview = () => {
    disablePreviewMode();
    // 刷新页面回到正常模式
    window.location.reload();
  };

  const handleMinimize = () => {
    setIsVisible(false);
    // 5秒后自动显示
    setTimeout(() => setIsVisible(true), 5000);
  };

  return (
    <div className="fixed top-4 right-4 z-50">
      <Card className="bg-green-50 border-green-200 shadow-lg">
        <div className="flex items-center gap-3 p-3">
          {/* 预览模式图标 */}
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <Eye className="h-4 w-4 text-green-600" />
            <span className="text-sm font-medium text-green-800">
              预览模式
            </span>
          </div>

          {/* 时间显示 */}
          <div className="flex items-center gap-1 text-xs text-green-600">
            <Clock className="h-3 w-3" />
            <span>剩余 {timeRemaining}</span>
          </div>

          {/* 操作按钮 */}
          <div className="flex items-center gap-1">
            <Button
              onClick={handleMinimize}
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0 hover:bg-green-100"
            >
              <X className="h-3 w-3" />
            </Button>
            
            <Button
              onClick={handleExitPreview}
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-xs hover:bg-green-100 text-green-700"
            >
              <LogOut className="h-3 w-3 mr-1" />
              退出
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}