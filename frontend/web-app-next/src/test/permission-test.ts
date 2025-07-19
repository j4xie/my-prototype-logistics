/**
 * 权限系统测试文件
 * 验证新权限系统的基本功能
 */

import { generateUserPermissions, PermissionChecker, USER_ROLES, DEPARTMENTS } from '@/types/permissions';

// 测试权限生成
console.log('=== 权限系统测试 ===');

// 测试平台管理员权限
const platformAdmin = generateUserPermissions('PLATFORM_ADMIN');
console.log('平台管理员权限:', platformAdmin);

// 测试工厂超级管理员权限
const superAdmin = generateUserPermissions('SUPER_ADMIN');
console.log('工厂超级管理员权限:', superAdmin);

// 测试部门管理员权限
const deptAdmin = generateUserPermissions('DEPARTMENT_ADMIN', 'FARMING');
console.log('部门管理员权限:', deptAdmin);

// 测试普通用户权限
const regularUser = generateUserPermissions('USER', 'PROCESSING');
console.log('普通用户权限:', regularUser);

// 测试权限检查
console.log('\n=== 权限检查测试 ===');

// 测试模块访问权限
console.log('平台管理员访问平台模块:', PermissionChecker.hasModuleAccess(platformAdmin, 'PLATFORM_ACCESS'));
console.log('超级管理员访问农业模块:', PermissionChecker.hasModuleAccess(superAdmin, 'FARMING_ACCESS'));
console.log('部门管理员访问农业模块:', PermissionChecker.hasModuleAccess(deptAdmin, 'FARMING_ACCESS'));
console.log('普通用户访问加工模块:', PermissionChecker.hasModuleAccess(regularUser, 'PROCESSING_ACCESS'));

// 测试角色级别
console.log('\n=== 角色级别测试 ===');
console.log('平台管理员级别:', platformAdmin.roleLevel);
console.log('超级管理员级别:', superAdmin.roleLevel);
console.log('部门管理员级别:', deptAdmin.roleLevel);
console.log('普通用户级别:', regularUser.roleLevel);

console.log('✅ 权限系统测试完成');

export {};