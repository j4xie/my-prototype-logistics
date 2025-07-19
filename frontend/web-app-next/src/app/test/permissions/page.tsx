'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Badge from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  usePermissions, 
  useModuleAccess, 
  useFeatureAccess, 
  useUserRole, 
  usePageGuard,
  useModuleStates 
} from '@/hooks/usePermissions';
import { useAuthStore } from '@/store/authStore';
import { CheckCircle, XCircle, User, Shield, Database } from 'lucide-react';

/**
 * 权限系统测试页面
 * 用于验证新的模块级权限控制系统
 */
export default function PermissionsTestPage() {
  const { user, login, logout, isAuthenticated } = useAuthStore();
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [testModule, setTestModule] = useState('farming');
  const [testFeature, setTestFeature] = useState('user_manage_all');

  // 使用权限Hooks
  const permissions = usePermissions();
  const moduleAccess = useModuleAccess();
  const featureAccess = useFeatureAccess();
  const userRole = useUserRole();
  const moduleStates = useModuleStates();
  const pageGuard = usePageGuard('ADMIN_ACCESS');

  // 测试账户信息
  const testAccounts = [
    { username: 'super_admin', password: 'super123', role: '平台管理员' },
    { username: 'user', password: 'user123', role: '工厂超级管理员' },
    { username: 'admin', password: 'admin123', role: '权限管理员' },
    { username: 'dept_admin', password: 'dept123', role: '部门管理员' },
    { username: 'worker', password: 'worker123', role: '普通员工' }
  ];

  const handleLogin = async (username: string, password: string) => {
    try {
      setLoginError('');
      await login({ username, password });
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : '登录失败');
    }
  };

  const handleLogout = () => {
    logout();
    setCredentials({ username: '', password: '' });
  };

  const StatusIcon = ({ status }: { status: boolean }) => (
    status ? (
      <CheckCircle className="h-4 w-4 text-green-500" />
    ) : (
      <XCircle className="h-4 w-4 text-red-500" />
    )
  );

  const ModuleCard = ({ 
    module, 
    accessible, 
    className, 
    tooltip 
  }: { 
    module: string; 
    accessible: boolean; 
    className: string; 
    tooltip: string; 
  }) => (
    <Card className={`${accessible ? 'border-green-200' : 'border-red-200'} mb-2`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className={`h-4 w-4 ${className}`} />
            <span className="font-medium">{module}</span>
          </div>
          <div className="flex items-center gap-2">
            <StatusIcon status={accessible} />
            <Badge variant={accessible ? 'default' : 'secondary'}>
              {accessible ? '可访问' : '禁止访问'}
            </Badge>
          </div>
        </div>
        {tooltip && (
          <p className="text-sm text-gray-500 mt-2">{tooltip}</p>
        )}
      </CardContent>
    </Card>
  );

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold mb-2">权限系统测试</h1>
          <p className="text-gray-600">请先登录以测试权限系统</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                手动登录
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="username">用户名</Label>
                <Input
                  id="username"
                  value={credentials.username}
                  onChange={(e) => setCredentials(prev => ({ ...prev, username: e.target.value }))}
                  placeholder="输入用户名"
                />
              </div>
              <div>
                <Label htmlFor="password">密码</Label>
                <Input
                  id="password"
                  type="password"
                  value={credentials.password}
                  onChange={(e) => setCredentials(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="输入密码"
                />
              </div>
              {loginError && (
                <div className="text-red-500 text-sm">{loginError}</div>
              )}
              <Button
                onClick={() => handleLogin(credentials.username, credentials.password)}
                disabled={!credentials.username || !credentials.password}
                className="w-full"
              >
                登录
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                测试账户
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {testAccounts.map((account, index) => (
                <div key={index} className="flex items-center justify-between p-2 border rounded">
                  <div>
                    <div className="font-medium">{account.username}</div>
                    <div className="text-sm text-gray-500">{account.role}</div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleLogin(account.username, account.password)}
                  >
                    登录
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold mb-2">权限系统测试</h1>
        <p className="text-gray-600">当前用户: {user?.displayName} ({userRole.roleInfo?.roleDisplayName})</p>
        <Button onClick={handleLogout} variant="outline" className="mt-2">
          登出
        </Button>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* 用户信息 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              用户信息
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <span className="font-medium">用户名：</span>
              {user?.username}
            </div>
            <div>
              <span className="font-medium">角色：</span>
              {userRole.roleInfo?.roleDisplayName}
            </div>
            <div>
              <span className="font-medium">角色级别：</span>
              {userRole.roleLevel}
            </div>
            <div>
              <span className="font-medium">部门：</span>
              {userRole.roleInfo?.departmentDisplayName || '无'}
            </div>
            <div>
              <span className="font-medium">权限特性：</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {userRole.roleInfo?.isPlatformAdmin && (
                  <Badge variant="destructive">平台管理员</Badge>
                )}
                {userRole.roleInfo?.isSuperAdmin && (
                  <Badge variant="default">超级管理员</Badge>
                )}
                {userRole.roleInfo?.isPermissionAdmin && (
                  <Badge variant="secondary">权限管理员</Badge>
                )}
                {userRole.roleInfo?.isDepartmentAdmin && (
                  <Badge variant="outline">部门管理员</Badge>
                )}
                {userRole.roleInfo?.isRegularUser && (
                  <Badge variant="outline">普通用户</Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 模块访问权限 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              模块访问权限
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ModuleCard
              module="养殖模块"
              accessible={moduleStates.farming.accessible}
              className={moduleStates.farming.className}
              tooltip={moduleStates.farming.tooltip}
            />
            <ModuleCard
              module="生产模块"
              accessible={moduleStates.processing.accessible}
              className={moduleStates.processing.className}
              tooltip={moduleStates.processing.tooltip}
            />
            <ModuleCard
              module="物流模块"
              accessible={moduleStates.logistics.accessible}
              className={moduleStates.logistics.className}
              tooltip={moduleStates.logistics.tooltip}
            />
            <ModuleCard
              module="管理模块"
              accessible={moduleStates.admin.accessible}
              className={moduleStates.admin.className}
              tooltip={moduleStates.admin.tooltip}
            />
            <ModuleCard
              module="平台模块"
              accessible={moduleStates.platform.accessible}
              className={moduleStates.platform.className}
              tooltip={moduleStates.platform.tooltip}
            />
          </CardContent>
        </Card>

        {/* 功能权限 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              功能权限
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span>管理所有用户</span>
              <StatusIcon status={featureAccess.canManageAllUsers} />
            </div>
            <div className="flex items-center justify-between">
              <span>管理部门用户</span>
              <StatusIcon status={featureAccess.canManageOwnDeptUsers} />
            </div>
            <div className="flex items-center justify-between">
              <span>管理所有白名单</span>
              <StatusIcon status={featureAccess.canManageAllWhitelist} />
            </div>
            <div className="flex items-center justify-between">
              <span>管理部门白名单</span>
              <StatusIcon status={featureAccess.canManageOwnDeptWhitelist} />
            </div>
            <div className="flex items-center justify-between">
              <span>查看所有统计</span>
              <StatusIcon status={featureAccess.canViewAllStats} />
            </div>
            <div className="flex items-center justify-between">
              <span>查看部门统计</span>
              <StatusIcon status={featureAccess.canViewOwnDeptStats} />
            </div>
          </CardContent>
        </Card>

        {/* 动态权限测试 */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>动态权限测试</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="testModule">测试模块</Label>
                <select
                  id="testModule"
                  value={testModule}
                  onChange={(e) => setTestModule(e.target.value)}
                  className="w-full p-2 border rounded"
                >
                  <option value="farming">养殖模块</option>
                  <option value="processing">生产模块</option>
                  <option value="logistics">物流模块</option>
                  <option value="admin">管理模块</option>
                  <option value="platform">平台模块</option>
                </select>
              </div>
              <div>
                <Label htmlFor="testFeature">测试功能</Label>
                <select
                  id="testFeature"
                  value={testFeature}
                  onChange={(e) => setTestFeature(e.target.value)}
                  className="w-full p-2 border rounded"
                >
                  <option value="user_manage_all">管理所有用户</option>
                  <option value="user_manage_own_dept">管理部门用户</option>
                  <option value="whitelist_manage_all">管理所有白名单</option>
                  <option value="whitelist_manage_own_dept">管理部门白名单</option>
                  <option value="stats_view_all">查看所有统计</option>
                  <option value="stats_view_own_dept">查看部门统计</option>
                </select>
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="flex items-center justify-between p-3 border rounded">
                <span>模块访问权限: {testModule}</span>
                <StatusIcon status={permissions.hasModuleAccess(testModule)} />
              </div>
              <div className="flex items-center justify-between p-3 border rounded">
                <span>功能权限: {testFeature}</span>
                <StatusIcon status={permissions.hasFeaturePermission(testFeature)} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 页面守卫测试 */}
        <Card>
          <CardHeader>
            <CardTitle>页面守卫测试</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span>管理模块访问</span>
                <StatusIcon status={pageGuard.canAccess} />
              </div>
              <div className="text-sm text-gray-600">
                {pageGuard.needsLogin && '需要登录'}
                {pageGuard.needsPermission && '需要权限'}
                {pageGuard.canAccess && '可以访问'}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}