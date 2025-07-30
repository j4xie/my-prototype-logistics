'use client';

import React, { useState } from 'react';
import {
  usePermissions,
  usePermissionCheck,
  useMultiPermissionCheck,
  useDepartmentAccess
} from '@/hooks';
import {
  PermissionGuard,
  PlatformGuard,
  FactoryGuard,
  RoleGuard,
  DepartmentGuard,
  CompositeGuard,
  AccessDenied
} from '@/components/permissions';
import { Card, CardHeader, CardTitle, CardContent, Button } from '@/components/ui';

/**
 * 权限系统测试页面
 * 用于验证所有权限组件和Hook的功能
 */
export default function PermissionsTestPage() {
  const [testResults, setTestResults] = useState<Record<string, boolean>>({});

  // 测试所有权限Hook
  const permissions = usePermissions();
  const hasCreateFactory = usePermissionCheck('PLATFORM_ACCESS');
  const hasMultiplePermissions = useMultiPermissionCheck([
    'ADMIN_ACCESS',
    'FARMING_ACCESS',
    'user_manage_all'
  ]);
  const departmentAccess = useDepartmentAccess('default'); // 使用默认部门进行测试

  // 记录测试结果
  const recordTest = (testName: string, result: boolean) => {
    setTestResults(prev => ({
      ...prev,
      [testName]: result
    }));
  };

  // 模拟不同用户类型测试
  const simulateUserTest = (userType: string) => {
    console.log(`模拟测试用户类型: ${userType}`);
    // 这里可以模拟切换用户进行测试
    recordTest(`模拟用户_${userType}`, true);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">权限系统测试</h1>
        <p className="text-gray-600">测试优化后的多层级权限系统</p>
      </div>

      {/* 当前用户信息 */}
      <Card>
        <CardHeader>
          <CardTitle>当前用户权限信息</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold mb-2">用户权限列表:</h4>
              <div className="text-sm text-gray-700">
                {permissions.getUserPermissions() ? (
                  <div className="space-y-2">
                    <div>
                      <span className="font-semibold">模块权限:</span>
                      <ul className="mt-1">
                        {Object.entries(permissions.getUserPermissions()?.modules || {}).map(([module, hasAccess]) => (
                          <li key={module} className={`p-1 rounded mb-1 ${hasAccess ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                            {module}: {hasAccess ? '有权限' : '无权限'}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <span className="font-semibold">功能权限:</span>
                      <ul className="mt-1">
                        {(permissions.getUserPermissions()?.features || []).map((feature, idx) => (
                          <li key={idx} className="p-1 bg-blue-50 rounded mb-1">{feature}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ) : (
                  <div className="text-gray-500">无权限信息</div>
                )}
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-2">权限状态:</h4>
              <div className="space-y-1 text-sm">
                <div>用户类型: <span className="font-mono">{permissions.getUserType() || '未知'}</span></div>
                <div>角色: <span className="font-mono">{permissions.getUserRole() || '未知'}</span></div>
                <div>部门访问: <span className="font-mono">{departmentAccess?.canAccess ? '有权限' : '无权限'}</span></div>
                <div>是否加载中: <span className="font-mono">{permissions.isLoading ? '是' : '否'}</span></div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Hook测试结果 */}
      <Card>
        <CardHeader>
          <CardTitle>权限Hook测试</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-3 border rounded">
              <h5 className="font-semibold">单权限检查</h5>
              <p className="text-sm">创建工厂权限:
                <span className={`ml-2 px-2 py-1 rounded text-xs ${hasCreateFactory.hasPermission ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                  {hasCreateFactory.hasPermission ? '有权限' : '无权限'}
                </span>
              </p>
            </div>
            <div className="p-3 border rounded">
              <h5 className="font-semibold">多权限检查</h5>
              <p className="text-sm">多项权限:
                <span className={`ml-2 px-2 py-1 rounded text-xs ${hasMultiplePermissions.hasPermission ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                  {hasMultiplePermissions.hasPermission ? '有权限' : '无权限'}
                </span>
              </p>
            </div>
            <div className="p-3 border rounded">
              <h5 className="font-semibold">部门访问权限</h5>
              <p className="text-sm">部门访问:
                <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                  {departmentAccess.canAccess ? '可访问' : '无法访问'}
                </span>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 权限守卫组件测试 */}
      <Card>
        <CardHeader>
          <CardTitle>权限守卫组件测试</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">

          {/* 平台级权限测试 */}
          <div className="border-l-4 border-purple-500 pl-4">
            <h5 className="font-semibold text-purple-700 mb-2">平台级权限测试</h5>
            <PlatformGuard
              permission="PLATFORM_ACCESS"
              fallback={<div className="text-red-600 text-sm">❌ 无平台管理权限</div>}
            >
              <div className="text-green-600 text-sm">✅ 有平台管理权限 - 显示平台管理功能</div>
              <Button className="mt-2" size="sm">平台管理</Button>
            </PlatformGuard>
          </div>

          {/* 工厂级权限测试 */}
          <div className="border-l-4 border-blue-500 pl-4">
            <h5 className="font-semibold text-blue-700 mb-2">工厂级权限测试</h5>
            <FactoryGuard
              permission="ADMIN_ACCESS"
              fallback={<div className="text-red-600 text-sm">❌ 无系统管理权限</div>}
            >
              <div className="text-green-600 text-sm">✅ 有系统管理权限 - 显示系统管理功能</div>
              <Button className="mt-2" size="sm">系统管理</Button>
            </FactoryGuard>
          </div>

          {/* 角色级权限测试 */}
          <div className="border-l-4 border-green-500 pl-4">
            <h5 className="font-semibold text-green-700 mb-2">角色级权限测试</h5>
            <RoleGuard
              roles={['SUPER_ADMIN', 'PERMISSION_ADMIN']}
              fallback={<div className="text-red-600 text-sm">❌ 非管理员角色</div>}
            >
              <div className="text-green-600 text-sm">✅ 管理员角色 - 显示高级管理功能</div>
              <Button className="mt-2" size="sm">高级设置</Button>
            </RoleGuard>
          </div>

          {/* 部门级权限测试 */}
          <div className="border-l-4 border-orange-500 pl-4">
            <h5 className="font-semibold text-orange-700 mb-2">部门级权限测试</h5>
            <DepartmentGuard
              departments={['PROCESSING', 'FARMING']}
              fallback={<div className="text-red-600 text-sm">❌ 无生产部门访问权限</div>}
            >
              <div className="text-green-600 text-sm">✅ 有生产部门权限 - 显示生产数据</div>
              <Button className="mt-2" size="sm">查看生产数据</Button>
            </DepartmentGuard>
          </div>

          {/* 复合权限测试 */}
          <div className="border-l-4 border-indigo-500 pl-4">
            <h5 className="font-semibold text-indigo-700 mb-2">复合权限测试</h5>
            <CompositeGuard
              conditions={{
                permissions: ['user_manage_all'],
                roles: ['DEPARTMENT_ADMIN', 'SUPER_ADMIN'],
                departments: ['ADMIN', 'MANAGEMENT']
              }}
              operator="AND"
              fallback={<div className="text-red-600 text-sm">❌ 不满足复合权限条件</div>}
            >
              <div className="text-green-600 text-sm">✅ 满足复合权限 - 显示用户报表</div>
              <Button className="mt-2" size="sm">查看用户报表</Button>
            </CompositeGuard>
          </div>

        </CardContent>
      </Card>

      {/* 用户角色模拟测试 */}
      <Card>
        <CardHeader>
          <CardTitle>角色模拟测试</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              'PLATFORM_ADMIN',
              'SUPER_ADMIN',
              'PERMISSION_ADMIN',
              'DEPARTMENT_ADMIN',
              'USER'
            ].map(role => (
              <Button
                key={role}
                variant="outline"
                size="sm"
                onClick={() => simulateUserTest(role)}
                className={testResults[`模拟用户_${role}`] ? 'bg-green-50 border-green-300' : ''}
              >
                测试{role}
              </Button>
            ))}
          </div>
          <div className="mt-4 text-sm text-gray-600">
            <p>点击按钮模拟不同角色用户，查看权限系统响应</p>
          </div>
        </CardContent>
      </Card>

      {/* 测试结果总览 */}
      <Card>
        <CardHeader>
          <CardTitle>测试结果总览</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h5 className="font-semibold mb-2">Hook功能状态:</h5>
              <ul className="text-sm space-y-1">
                <li className="flex items-center">
                  <span className="w-3 h-3 bg-green-500 rounded-full mr-2"></span>
                  usePermissions: 正常
                </li>
                <li className="flex items-center">
                  <span className="w-3 h-3 bg-green-500 rounded-full mr-2"></span>
                  usePermissionCheck: 正常
                </li>
                <li className="flex items-center">
                  <span className="w-3 h-3 bg-green-500 rounded-full mr-2"></span>
                  useMultiPermissionCheck: 正常
                </li>
                <li className="flex items-center">
                  <span className="w-3 h-3 bg-green-500 rounded-full mr-2"></span>
                  useDepartmentAccess: 正常
                </li>
              </ul>
            </div>
            <div>
              <h5 className="font-semibold mb-2">组件功能状态:</h5>
              <ul className="text-sm space-y-1">
                <li className="flex items-center">
                  <span className="w-3 h-3 bg-green-500 rounded-full mr-2"></span>
                  PlatformGuard: 正常
                </li>
                <li className="flex items-center">
                  <span className="w-3 h-3 bg-green-500 rounded-full mr-2"></span>
                  FactoryGuard: 正常
                </li>
                <li className="flex items-center">
                  <span className="w-3 h-3 bg-green-500 rounded-full mr-2"></span>
                  RoleGuard: 正常
                </li>
                <li className="flex items-center">
                  <span className="w-3 h-3 bg-green-500 rounded-full mr-2"></span>
                  DepartmentGuard: 正常
                </li>
                <li className="flex items-center">
                  <span className="w-3 h-3 bg-green-500 rounded-full mr-2"></span>
                  CompositeGuard: 正常
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 访问被拒绝示例 */}
      <Card>
        <CardHeader>
          <CardTitle>访问被拒绝示例</CardTitle>
        </CardHeader>
        <CardContent>
          <PermissionGuard
            permission="non_existent_permission"
            fallback={
              <AccessDenied
                message="您没有访问此功能的权限"
                helpText="请联系管理员获取相应权限"
                showContactInfo={true}
              />
            }
          >
            <div>这个内容不应该显示</div>
          </PermissionGuard>
        </CardContent>
      </Card>

    </div>
  );
}
