/**
 * 权限系统验证工具
 * 用于验证模块级权限控制系统的完整性和正确性
 */

import { PermissionChecker, UserPermissions, USER_ROLES } from '@/types/permissions';

export interface PermissionTestResult {
  name: string;
  status: 'success' | 'error' | 'warning';
  message: string;
  details?: any;
  timestamp: number;
}

export interface PermissionTestSuite {
  name: string;
  description: string;
  tests: PermissionTestResult[];
  startTime?: number;
  endTime?: number;
  totalDuration?: number;
}

export class PermissionValidator {
  private results: PermissionTestResult[] = [];
  private suites: PermissionTestSuite[] = [];

  constructor() {
    this.initializeSuites();
  }

  private initializeSuites() {
    this.suites = [
      {
        name: 'permission-data',
        description: '权限数据完整性测试',
        tests: []
      },
      {
        name: 'role-hierarchy',
        description: '角色层级测试',
        tests: []
      },
      {
        name: 'module-access',
        description: '模块访问权限测试',
        tests: []
      },
      {
        name: 'feature-access',
        description: '功能访问权限测试',
        tests: []
      },
      {
        name: 'permission-inheritance',
        description: '权限继承测试',
        tests: []
      }
    ];
  }

  /**
   * 添加测试结果
   */
  private addResult(suiteName: string, result: PermissionTestResult) {
    this.results.push(result);
    
    const suite = this.suites.find(s => s.name === suiteName);
    if (suite) {
      suite.tests.push(result);
    }
  }

  /**
   * 执行单个测试
   */
  private executeTest(
    suiteName: string,
    testName: string,
    testFunction: () => any
  ): PermissionTestResult {
    try {
      const result = testFunction();
      
      const testResult: PermissionTestResult = {
        name: testName,
        status: 'success',
        message: '测试通过',
        details: result,
        timestamp: Date.now()
      };
      
      this.addResult(suiteName, testResult);
      return testResult;
    } catch (error) {
      const testResult: PermissionTestResult = {
        name: testName,
        status: 'error',
        message: `测试失败: ${error instanceof Error ? error.message : '未知错误'}`,
        details: error,
        timestamp: Date.now()
      };
      
      this.addResult(suiteName, testResult);
      return testResult;
    }
  }

  /**
   * 权限数据完整性测试
   */
  testPermissionDataIntegrity(userPermissions: UserPermissions): PermissionTestResult[] {
    const suiteName = 'permission-data';
    const suite = this.suites.find(s => s.name === suiteName);
    if (suite) {
      suite.startTime = Date.now();
    }

    const tests = [
      {
        name: '用户权限数据结构完整性',
        test: () => {
          if (!userPermissions) {
            throw new Error('用户权限数据不存在');
          }
          
          const requiredFields = ['modules', 'features', 'roleLevel', 'roleName'];
          const missingFields = requiredFields.filter(field => !(field in userPermissions));
          
          if (missingFields.length > 0) {
            throw new Error(`缺少必要字段: ${missingFields.join(', ')}`);
          }
          
          return {
            hasAllFields: true,
            structure: userPermissions
          };
        }
      },
      {
        name: '模块权限数据验证',
        test: () => {
          const modules = userPermissions.modules;
          const expectedModules = ['farming_access', 'processing_access', 'logistics_access', 'admin_access', 'platform_access'];
          
          const missingModules = expectedModules.filter(module => !(module in modules));
          if (missingModules.length > 0) {
            throw new Error(`缺少模块权限: ${missingModules.join(', ')}`);
          }
          
          return {
            moduleCount: Object.keys(modules).length,
            modules: modules
          };
        }
      },
      {
        name: '功能权限数据验证',
        test: () => {
          const features = userPermissions.features;
          
          if (!features || typeof features !== 'object') {
            throw new Error('功能权限数据格式错误');
          }
          
          return {
            featureCount: Object.keys(features).length,
            features: features
          };
        }
      },
      {
        name: '角色级别数据验证',
        test: () => {
          const roleLevel = userPermissions.roleLevel;
          const validLevels = [0, 5, 10, 20, 50];
          
          if (!validLevels.includes(roleLevel)) {
            throw new Error(`无效的角色级别: ${roleLevel}`);
          }
          
          return {
            roleLevel: roleLevel,
            roleName: userPermissions.roleName
          };
        }
      }
    ];

    const results: PermissionTestResult[] = [];
    for (const test of tests) {
      const result = this.executeTest(suiteName, test.name, test.test);
      results.push(result);
    }

    if (suite) {
      suite.endTime = Date.now();
      suite.totalDuration = suite.endTime - (suite.startTime || 0);
    }

    return results;
  }

  /**
   * 角色层级测试
   */
  testRoleHierarchy(userPermissions: UserPermissions): PermissionTestResult[] {
    const suiteName = 'role-hierarchy';
    const suite = this.suites.find(s => s.name === suiteName);
    if (suite) {
      suite.startTime = Date.now();
    }

    const tests = [
      {
        name: '角色级别层次验证',
        test: () => {
          const currentLevel = userPermissions.roleLevel;
          const levels = [0, 5, 10, 20, 50];
          
          const higherLevels = levels.filter(level => level < currentLevel);
          const lowerLevels = levels.filter(level => level > currentLevel);
          
          // 验证用户应该能访问更高级别的权限
          for (const level of higherLevels) {
            if (!PermissionChecker.hasRoleLevel(userPermissions, level)) {
              throw new Error(`用户级别${currentLevel}应该能访问级别${level}`);
            }
          }
          
          return {
            currentLevel,
            canAccessHigherLevels: higherLevels,
            cannotAccessLowerLevels: lowerLevels
          };
        }
      },
      {
        name: '权限继承验证',
        test: () => {
          const currentLevel = userPermissions.roleLevel;
          
          // 根据角色级别验证权限继承
          const inheritanceRules = {
            0: ['platform_access', 'admin_access', 'logistics_access', 'processing_access', 'farming_access'],
            5: ['admin_access', 'logistics_access', 'processing_access', 'farming_access'],
            10: ['admin_access', 'logistics_access', 'processing_access', 'farming_access'],
            20: ['logistics_access', 'processing_access', 'farming_access'],
            50: ['logistics_access', 'processing_access', 'farming_access']
          };
          
          const expectedModules = inheritanceRules[currentLevel as keyof typeof inheritanceRules] || [];
          const actualModules = Object.keys(userPermissions.modules).filter(
            module => userPermissions.modules[module as keyof typeof userPermissions.modules]
          );
          
          return {
            expectedModules,
            actualModules,
            inheritanceCorrect: expectedModules.every(module => actualModules.includes(module))
          };
        }
      }
    ];

    const results: PermissionTestResult[] = [];
    for (const test of tests) {
      const result = this.executeTest(suiteName, test.name, test.test);
      results.push(result);
    }

    if (suite) {
      suite.endTime = Date.now();
      suite.totalDuration = suite.endTime - (suite.startTime || 0);
    }

    return results;
  }

  /**
   * 模块访问权限测试
   */
  testModuleAccess(userPermissions: UserPermissions): PermissionTestResult[] {
    const suiteName = 'module-access';
    const suite = this.suites.find(s => s.name === suiteName);
    if (suite) {
      suite.startTime = Date.now();
    }

    const modules = ['farming', 'processing', 'logistics', 'admin', 'platform'];
    
    const tests = modules.map(module => ({
      name: `${module}模块访问权限`,
      test: () => {
        const hasAccess = PermissionChecker.hasModulePermission(userPermissions, module);
        const moduleKey = `${module}_access` as keyof typeof userPermissions.modules;
        const directAccess = userPermissions.modules[moduleKey];
        
        return {
          module,
          hasAccess,
          directAccess,
          consistent: hasAccess === directAccess
        };
      }
    }));

    const results: PermissionTestResult[] = [];
    for (const test of tests) {
      const result = this.executeTest(suiteName, test.name, test.test);
      results.push(result);
    }

    if (suite) {
      suite.endTime = Date.now();
      suite.totalDuration = suite.endTime - (suite.startTime || 0);
    }

    return results;
  }

  /**
   * 功能访问权限测试
   */
  testFeatureAccess(userPermissions: UserPermissions): PermissionTestResult[] {
    const suiteName = 'feature-access';
    const suite = this.suites.find(s => s.name === suiteName);
    if (suite) {
      suite.startTime = Date.now();
    }

    const features = [
      'create_trace',
      'manage_users',
      'system_config',
      'view_analytics',
      'export_data'
    ];

    const tests = features.map(feature => ({
      name: `${feature}功能访问权限`,
      test: () => {
        const hasAccess = PermissionChecker.hasFeaturePermission(userPermissions, feature);
        const directAccess = userPermissions.features[feature];
        
        return {
          feature,
          hasAccess,
          directAccess,
          consistent: hasAccess === directAccess
        };
      }
    }));

    const results: PermissionTestResult[] = [];
    for (const test of tests) {
      const result = this.executeTest(suiteName, test.name, test.test);
      results.push(result);
    }

    if (suite) {
      suite.endTime = Date.now();
      suite.totalDuration = suite.endTime - (suite.startTime || 0);
    }

    return results;
  }

  /**
   * 权限继承测试
   */
  testPermissionInheritance(userPermissions: UserPermissions): PermissionTestResult[] {
    const suiteName = 'permission-inheritance';
    const suite = this.suites.find(s => s.name === suiteName);
    if (suite) {
      suite.startTime = Date.now();
    }

    const tests = [
      {
        name: '角色权限继承规则',
        test: () => {
          const currentLevel = userPermissions.roleLevel;
          
          // 测试权限继承规则
          const inheritanceTests = [
            { level: 0, shouldHave: ['platform_access', 'admin_access'] },
            { level: 5, shouldHave: ['admin_access'], shouldNotHave: ['platform_access'] },
            { level: 10, shouldHave: ['admin_access'], shouldNotHave: ['platform_access'] },
            { level: 20, shouldHave: ['logistics_access'], shouldNotHave: ['admin_access'] },
            { level: 50, shouldHave: ['farming_access'], shouldNotHave: ['admin_access'] }
          ];
          
          const currentTest = inheritanceTests.find(t => t.level === currentLevel);
          if (!currentTest) {
            throw new Error(`未找到级别${currentLevel}的测试规则`);
          }
          
          const violations = [];
          
          // 检查应该拥有的权限
          if (currentTest.shouldHave) {
            for (const permission of currentTest.shouldHave) {
              if (!userPermissions.modules[permission as keyof typeof userPermissions.modules]) {
                violations.push(`缺少应有权限: ${permission}`);
              }
            }
          }
          
          // 检查不应该拥有的权限
          if (currentTest.shouldNotHave) {
            for (const permission of currentTest.shouldNotHave) {
              if (userPermissions.modules[permission as keyof typeof userPermissions.modules]) {
                violations.push(`拥有不应有权限: ${permission}`);
              }
            }
          }
          
          return {
            currentLevel,
            violations,
            isValid: violations.length === 0
          };
        }
      },
      {
        name: '跨模块权限一致性',
        test: () => {
          const modules = userPermissions.modules;
          const inconsistencies = [];
          
          // 检查权限级别与模块权限的一致性
          const currentLevel = userPermissions.roleLevel;
          
          if (currentLevel >= 20 && modules.admin_access) {
            inconsistencies.push('普通用户不应有admin权限');
          }
          
          if (currentLevel >= 10 && modules.platform_access) {
            inconsistencies.push('非平台管理员不应有platform权限');
          }
          
          return {
            inconsistencies,
            isConsistent: inconsistencies.length === 0
          };
        }
      }
    ];

    const results: PermissionTestResult[] = [];
    for (const test of tests) {
      const result = this.executeTest(suiteName, test.name, test.test);
      results.push(result);
    }

    if (suite) {
      suite.endTime = Date.now();
      suite.totalDuration = suite.endTime - (suite.startTime || 0);
    }

    return results;
  }

  /**
   * 执行完整的权限验证套件
   */
  async runFullValidation(userPermissions: UserPermissions): Promise<{
    results: PermissionTestResult[];
    suites: PermissionTestSuite[];
    summary: {
      total: number;
      passed: number;
      failed: number;
      warnings: number;
      duration: number;
    };
  }> {
    const startTime = Date.now();
    
    // 清空之前的结果
    this.results = [];
    this.initializeSuites();

    console.log('🔍 开始执行权限系统验证');
    console.log(`👤 用户: ${userPermissions.roleName} (级别${userPermissions.roleLevel})`);

    // 执行所有测试套件
    this.testPermissionDataIntegrity(userPermissions);
    this.testRoleHierarchy(userPermissions);
    this.testModuleAccess(userPermissions);
    this.testFeatureAccess(userPermissions);
    this.testPermissionInheritance(userPermissions);

    const endTime = Date.now();
    const totalDuration = endTime - startTime;

    const summary = {
      total: this.results.length,
      passed: this.results.filter(r => r.status === 'success').length,
      failed: this.results.filter(r => r.status === 'error').length,
      warnings: this.results.filter(r => r.status === 'warning').length,
      duration: totalDuration
    };

    console.log('✅ 权限系统验证完成');
    console.log(`📊 测试结果: ${summary.passed}/${summary.total} 通过`);
    console.log(`⏱️ 总耗时: ${summary.duration}ms`);

    return {
      results: this.results,
      suites: this.suites,
      summary
    };
  }

  /**
   * 获取测试结果
   */
  getResults(): PermissionTestResult[] {
    return [...this.results];
  }

  /**
   * 获取测试套件
   */
  getSuites(): PermissionTestSuite[] {
    return [...this.suites];
  }

  /**
   * 清空测试结果
   */
  clearResults() {
    this.results = [];
    this.initializeSuites();
  }

  /**
   * 生成权限验证报告
   */
  generateReport(): string {
    const total = this.results.length;
    const passed = this.results.filter(r => r.status === 'success').length;
    const failed = this.results.filter(r => r.status === 'error').length;
    const warnings = this.results.filter(r => r.status === 'warning').length;
    const passRate = total > 0 ? ((passed / total) * 100).toFixed(1) : '0';

    let report = `
权限系统验证报告
================
验证时间: ${new Date().toLocaleString()}

总体统计:
- 总测试数: ${total}
- 通过数: ${passed}
- 失败数: ${failed}
- 警告数: ${warnings}
- 通过率: ${passRate}%

测试套件详情:
`;

    for (const suite of this.suites) {
      const suiteTotal = suite.tests.length;
      const suitePassed = suite.tests.filter(t => t.status === 'success').length;
      const suiteFailed = suite.tests.filter(t => t.status === 'error').length;
      const suiteWarnings = suite.tests.filter(t => t.status === 'warning').length;
      const suiteDuration = suite.totalDuration || 0;

      report += `
${suite.description}:
- 测试数: ${suiteTotal}
- 通过: ${suitePassed}
- 失败: ${suiteFailed}
- 警告: ${suiteWarnings}
- 耗时: ${suiteDuration}ms
`;

      for (const test of suite.tests) {
        const status = test.status === 'success' ? '✅' : test.status === 'warning' ? '⚠️' : '❌';
        report += `  ${status} ${test.name}: ${test.message}\n`;
      }
    }

    return report;
  }
}

// 导出单例实例
export const permissionValidator = new PermissionValidator();

// 导出便捷函数
export const validatePermissionSystem = async (userPermissions: UserPermissions) => {
  return await permissionValidator.runFullValidation(userPermissions);
};

export const validatePermissionData = (userPermissions: UserPermissions) => {
  return permissionValidator.testPermissionDataIntegrity(userPermissions);
};

export const validateRoleHierarchy = (userPermissions: UserPermissions) => {
  return permissionValidator.testRoleHierarchy(userPermissions);
};