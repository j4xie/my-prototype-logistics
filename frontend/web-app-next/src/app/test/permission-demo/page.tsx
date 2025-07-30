'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Badge from '@/components/ui/badge';
import {
  RouteGuard,
  PermissionAwareNavigation,
  PermissionCheck,
  PermissionBadge,
  usePermissionContext
} from '@/components/permissions';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuthStore } from '@/store/authStore';
import { Shield, Lock, User, Settings, Eye, EyeOff } from 'lucide-react';

/**
 * 权限系统演示页面
 * 展示新的模块级权限控制功能
 */
function PermissionDemoContent() {
  const { user } = useAuthStore();
  const permissions = usePermissions();
  const permissionContext = usePermissionContext();

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">权限系统演示</h1>
        <p className="text-gray-600">展示新的模块级权限控制功能</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* 用户权限信息 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              当前用户信息
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {user && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">用户名:</span>
                  <span className="font-medium">{user.username}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">显示名:</span>
                  <span className="font-medium">{user.displayName || '未设置'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">角色:</span>
                  <Badge variant="secondary">{permissions.roleInfo?.name || '未知'}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">权限级别:</span>
                  <Badge variant="outline">{permissions.roleLevel}</Badge>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 模块访问权限 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              模块访问权限
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { key: 'farming', name: '农业管理' },
                { key: 'processing', name: '生产加工' },
                { key: 'logistics', name: '物流配送' },
                { key: 'admin', name: '系统管理' },
                { key: 'platform', name: '平台管理' }
              ].map(module => (
                <div key={module.key} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">{module.name}:</span>
                  <div className="flex items-center gap-2">
                    {permissions?.hasModuleAccess?.(module.key) ? (
                      <Badge variant="default" className="text-xs">
                        <Eye className="h-3 w-3 mr-1" />
                        有权限
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="text-xs">
                        <EyeOff className="h-3 w-3 mr-1" />
                        无权限
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 角色级别权限 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              角色级别权限
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { level: 0, name: '平台管理员' },
                { level: 5, name: '超级管理员' },
                { level: 10, name: '权限管理员' },
                { level: 20, name: '部门管理员' },
                { level: 50, name: '普通用户' }
              ].map(role => (
                <div key={role.level} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">级别{role.level} - {role.name}:</span>
                  <div className="flex items-center gap-2">
                    {permissions.hasRoleLevel(role.level) ? (
                      <Badge variant="default" className="text-xs">
                        <Eye className="h-3 w-3 mr-1" />
                        可访问
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">
                        <EyeOff className="h-3 w-3 mr-1" />
                        不可访问
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 权限检查组件演示 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              权限检查组件
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">农业管理权限检查:</h4>
                <PermissionCheck module="farming" fallback={<Badge variant="destructive">无权限</Badge>}>
                  <Badge variant="default">有权限</Badge>
                </PermissionCheck>
              </div>

              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">管理员权限检查:</h4>
                <PermissionCheck level={10} fallback={<Badge variant="destructive">无权限</Badge>}>
                  <Badge variant="default">有权限</Badge>
                </PermissionCheck>
              </div>

              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">平台管理权限检查:</h4>
                <PermissionCheck module="platform" fallback={<Badge variant="destructive">无权限</Badge>}>
                  <Badge variant="default">有权限</Badge>
                </PermissionCheck>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 权限敏感导航演示 */}
      <div className="mt-8">
        <Card>
          <CardHeader>
            <CardTitle>权限敏感导航组件</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-3">网格布局 (只显示有权限的模块)</h3>
                <PermissionAwareNavigation variant="grid" />
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-3">列表布局 (显示所有模块，标明权限状态)</h3>
                <PermissionAwareNavigation variant="list" showAll />
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-3">水平布局 (只显示有权限的模块)</h3>
                <PermissionAwareNavigation variant="horizontal" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 权限徽章演示 */}
      <div className="mt-8">
        <Card>
          <CardHeader>
            <CardTitle>权限徽章组件</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <p className="text-sm text-gray-600">农业管理权限:</p>
                <PermissionBadge module="farming" />
              </div>
              <div className="space-y-2">
                <p className="text-sm text-gray-600">管理员权限:</p>
                <PermissionBadge level={10} />
              </div>
              <div className="space-y-2">
                <p className="text-sm text-gray-600">平台管理权限:</p>
                <PermissionBadge module="platform" />
              </div>
              <div className="space-y-2">
                <p className="text-sm text-gray-600">超级管理员权限:</p>
                <PermissionBadge level={5} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 权限API演示 */}
      <div className="mt-8">
        <Card>
          <CardHeader>
            <CardTitle>权限检查API</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Button
                  onClick={() => {
                    const canAccess = permissionContext.canAccessRoute('/farming');
                    alert(`访问农业管理路由: ${canAccess ? '允许' : '拒绝'}`);
                  }}
                  size="sm"
                >
                  检查农业管理路由
                </Button>
                <Button
                  onClick={() => {
                    const canAccess = permissionContext.canAccessRoute('/admin');
                    alert(`访问管理路由: ${canAccess ? '允许' : '拒绝'}`);
                  }}
                  size="sm"
                  variant="outline"
                >
                  检查管理路由
                </Button>
              </div>
              <div className="flex items-center gap-4">
                <Button
                  onClick={() => {
                    const hasAccess = permissionContext.hasFeatureAccess('create_trace');
                    alert(`创建溯源功能: ${hasAccess ? '可用' : '不可用'}`);
                  }}
                  size="sm"
                  variant="secondary"
                >
                  检查创建溯源功能
                </Button>
                <Button
                  onClick={() => {
                    permissionContext.refresh();
                    alert('权限已刷新');
                  }}
                  size="sm"
                  variant="outline"
                >
                  刷新权限
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function PermissionDemoPage() {
  return (
    <RouteGuard requiredLevel={50}>
      <PermissionDemoContent />
    </RouteGuard>
  );
}
