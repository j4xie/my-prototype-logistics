'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, ArrowLeft, Home } from 'lucide-react';

/**
 * 403 权限不足页面
 */
export default function ForbiddenPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-orange-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <Card className="text-center shadow-lg border-red-200">
          <CardHeader className="pb-4">
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Shield className="w-10 h-10 text-red-500" />
            </div>
            <CardTitle className="text-2xl font-bold text-gray-900">
              访问被拒绝
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="space-y-2">
              <p className="text-gray-600">
                抱歉，您没有权限访问此页面
              </p>
              <p className="text-sm text-gray-500">
                此页面仅限平台超级管理员访问
              </p>
            </div>

            <div className="space-y-3">
              <Button
                onClick={() => router.back()}
                variant="secondary"
                className="w-full flex items-center justify-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                返回上一页
              </Button>

              <Button
                onClick={() => router.push('/')}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700"
              >
                <Home className="w-4 h-4" />
                返回首页
              </Button>
            </div>

            <div className="text-xs text-gray-400 pt-4 border-t">
              如需获取相关权限，请联系系统管理员
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
