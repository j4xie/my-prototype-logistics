'use client';

import React from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuthStore } from '@/store/authStore';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import Badge from '@/components/ui/badge';

/**
 * 权限验证测试页面
 * 用于验证权限体系是否正确实现
 */
export default function PermissionsVerificationPage() {
  const { user } = useAuthStore();
  const permissions = usePermissions();

  const expectedPermissions = {
    'PLATFORM_ADMIN': {
      farming: false,
      processing: false,
      logistics: false,
      trace: false,
      admin: false,
      platform: true
    },
    'SUPER_ADMIN': {
      farming: true,
      processing: true,
      logistics: true,
      trace: true,
      admin: true,
      platform: false
    },
    'PERMISSION_ADMIN': {
      farming: false,
      processing: false,
      logistics: false,
      trace: true,
      admin: true,
      platform: false
    },
    'DEPARTMENT_ADMIN': {
      farming: true, // 按部门
      processing: false,
      logistics: false,
      trace: true,
      admin: false,
      platform: false
    },
    'USER': {
      farming: false,
      processing: true, // 按部门
      logistics: false,
      trace: true,
      admin: false,
      platform: false
    }
  };

  if (!user) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6">
            <div className="text-center text-gray-500">
              请先登录以验证权限
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const userRole = permissions.getUserRole() || 'UNKNOWN';
  const expected = expectedPermissions[userRole as keyof typeof expectedPermissions];
  const actual = permissions.getModuleAccessState();

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">权限体系验证</h1>
        <p className="text-gray-600">验证每个角色的权限是否按需求正确实现</p>
      </div>

      {/* 当前用户信息 */}
      <Card>
        <CardHeader>
          <CardTitle>当前用户信息</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-gray-600">用户名</div>
              <div className="font-medium">{user.username}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">角色</div>
              <Badge>{permissions.roleInfo?.name}</Badge>
            </div>
            <div>
              <div className="text-sm text-gray-600">角色级别</div>
              <div className="font-medium">{permissions.roleLevel}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">部门</div>
              <div className="font-medium">{user.permissions?.department || '无'}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 权限验证结果 */}
      <Card>
        <CardHeader>
          <CardTitle>权限验证结果 - {userRole}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Object.entries({
              farming: '农业管理',
              processing: '生产加工',
              logistics: '物流配送',
              trace: '溯源查询',
              admin: '系统管理',
              platform: '平台管理'
            }).map(([module, name]) => {
              const expectedAccess = expected?.[module as keyof typeof expected];
              const actualAccess = actual[module as keyof typeof actual];
              const isCorrect = expectedAccess === actualAccess;
              
              return (
                <div key={module} className="flex items-center justify-between p-3 border rounded">
                  <div className="flex items-center space-x-3">
                    <div className="font-medium">{name}</div>
                    <div className="text-sm text-gray-500">({module})</div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="text-sm">
                      期望: <Badge variant={expectedAccess ? 'default' : 'secondary'}>
                        {expectedAccess ? '有权限' : '无权限'}
                      </Badge>
                    </div>
                    <div className="text-sm">
                      实际: <Badge variant={actualAccess ? 'default' : 'secondary'}>
                        {actualAccess ? '有权限' : '无权限'}
                      </Badge>
                    </div>
                    <div>
                      {isCorrect ? (
                        <Badge className="bg-green-100 text-green-800">✅ 正确</Badge>
                      ) : (
                        <Badge className="bg-red-100 text-red-800">❌ 错误</Badge>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* 功能权限验证 */}
      <Card>
        <CardHeader>
          <CardTitle>功能权限验证</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span>用户管理权限</span>
              <Badge variant={permissions.hasFeaturePermission('user_manage_all') || permissions.hasFeaturePermission('user_manage_own_dept') ? 'default' : 'secondary'}>
                {permissions.hasFeaturePermission('user_manage_all') ? '全工厂' : 
                 permissions.hasFeaturePermission('user_manage_own_dept') ? '本部门' : '无'}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>统计查看权限</span>
              <Badge variant={permissions.hasFeaturePermission('stats_view_all') || permissions.hasFeaturePermission('stats_view_own_dept') ? 'default' : 'secondary'}>
                {permissions.hasFeaturePermission('stats_view_all') ? '全工厂' : 
                 permissions.hasFeaturePermission('stats_view_own_dept') ? '本部门' : '无'}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 权限体系说明 */}
      <Card>
        <CardHeader>
          <CardTitle>权限体系说明</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-semibold mb-2">平台管理员 (platform_admin)</h4>
              <ul className="space-y-1 text-gray-600">
                <li>• 仅能访问平台管理功能</li>
                <li>• 不能访问工厂业务模块</li>
                <li>• 功能：工厂管理、平台统计</li>
                <li>• 使用真实数据库账户登录</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">工厂超级管理员</h4>
              <ul className="space-y-1 text-gray-600">
                <li>• 工厂内所有模块权限</li>
                <li>• 包括：农业、生产、物流、溯源、系统管理</li>
                <li>• 不能访问平台管理</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">权限管理员</h4>
              <ul className="space-y-1 text-gray-600">
                <li>• 仅系统管理 + 溯源查询</li>
                <li>• 不能访问业务模块</li>
                <li>• 功能：用户管理、权限分配</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">部门管理员</h4>
              <ul className="space-y-1 text-gray-600">
                <li>• 本部门业务模块 + 溯源查询</li>
                <li>• 部门用户管理权限</li>
                <li>• 不能跨部门访问</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">普通用户</h4>
              <ul className="space-y-1 text-gray-600">
                <li>• 本部门业务模块 + 溯源查询</li>
                <li>• 仅数据添加、查看权限</li>
                <li>• 无管理权限</li>
                <li>• 所有角色使用真实数据库账户</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}