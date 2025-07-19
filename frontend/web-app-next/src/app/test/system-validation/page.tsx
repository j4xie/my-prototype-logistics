'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Badge from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuthStore } from '@/store/authStore';
import { usePermissions } from '@/hooks/usePermissions';
import { realApiClient } from '@/lib/real-api-client';
import { authService } from '@/services/auth.service';
import { realApiTester, runRealApiTests } from '@/utils/real-api-tester';
import { permissionValidator, validatePermissionSystem } from '@/utils/permission-validator';
import { 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  RefreshCw, 
  Database, 
  Shield, 
  Route,
  Settings,
  Users,
  Activity
} from 'lucide-react';

interface TestResult {
  name: string;
  status: 'success' | 'error' | 'pending' | 'skipped';
  message: string;
  details?: any;
  duration?: number;
  timestamp?: number;
}

interface TestSuite {
  name: string;
  description: string;
  tests: TestResult[];
  progress: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
}

/**
 * 系统验证和测试页面
 * 使用real API进行全面的权限系统测试
 */
export default function SystemValidationPage() {
  const { user, isAuthenticated } = useAuthStore();
  const permissions = usePermissions();
  
  const [testSuites, setTestSuites] = useState<TestSuite[]>([]);
  const [currentSuite, setCurrentSuite] = useState<string | null>(null);
  const [overallProgress, setOverallProgress] = useState(0);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  // 初始化测试套件
  useEffect(() => {
    initializeTestSuites();
  }, []);

  const initializeTestSuites = () => {
    const suites: TestSuite[] = [
      {
        name: 'api-connectivity',
        description: 'Real API 连接测试',
        tests: [],
        progress: 0,
        status: 'pending'
      },
      {
        name: 'authentication',
        description: '认证系统测试',
        tests: [],
        progress: 0,
        status: 'pending'
      },
      {
        name: 'permission-system',
        description: '权限系统测试',
        tests: [],
        progress: 0,
        status: 'pending'
      },
      {
        name: 'route-protection',
        description: '路由保护测试',
        tests: [],
        progress: 0,
        status: 'pending'
      },
      {
        name: 'user-management',
        description: '用户管理测试',
        tests: [],
        progress: 0,
        status: 'pending'
      }
    ];
    
    setTestSuites(suites);
  };

  const updateTestSuite = (suiteName: string, updates: Partial<TestSuite>) => {
    setTestSuites(prev => prev.map(suite => 
      suite.name === suiteName 
        ? { ...suite, ...updates }
        : suite
    ));
  };

  const addTestResult = (suiteName: string, result: TestResult) => {
    const timestamp = Date.now();
    const resultWithTimestamp = { ...result, timestamp };
    
    setTestResults(prev => [...prev, resultWithTimestamp]);
    
    updateTestSuite(suiteName, {
      tests: [...(testSuites.find(s => s.name === suiteName)?.tests || []), resultWithTimestamp]
    });
  };

  // Real API 连接测试
  const testApiConnectivity = async () => {
    const suiteName = 'api-connectivity';
    updateTestSuite(suiteName, { status: 'running' });
    setCurrentSuite(suiteName);

    const tests = [
      {
        name: '后端API健康检查',
        test: async () => {
          const response = await realApiClient.get('/health');
          return response;
        }
      },
      {
        name: '认证端点可用性',
        test: async () => {
          const response = await realApiClient.get('/api/auth/status');
          return response;
        }
      },
      {
        name: '用户管理端点',
        test: async () => {
          const response = await realApiClient.get('/api/users');
          return response;
        }
      },
      {
        name: '白名单管理端点',
        test: async () => {
          const response = await realApiClient.get('/api/whitelist');
          return response;
        }
      },
      {
        name: '平台管理端点',
        test: async () => {
          const response = await realApiClient.get('/api/platform/factories');
          return response;
        }
      }
    ];

    let successCount = 0;
    for (let i = 0; i < tests.length; i++) {
      const test = tests[i];
      const startTime = Date.now();
      
      try {
        addTestResult(suiteName, {
          name: test.name,
          status: 'pending',
          message: '正在测试...'
        });

        const result = await test.test();
        const duration = Date.now() - startTime;
        
        addTestResult(suiteName, {
          name: test.name,
          status: 'success',
          message: `连接成功 (${duration}ms)`,
          details: result,
          duration
        });
        
        successCount++;
      } catch (error) {
        const duration = Date.now() - startTime;
        addTestResult(suiteName, {
          name: test.name,
          status: 'error',
          message: `连接失败: ${error instanceof Error ? error.message : '未知错误'}`,
          details: error,
          duration
        });
      }
      
      updateTestSuite(suiteName, { progress: ((i + 1) / tests.length) * 100 });
    }

    updateTestSuite(suiteName, { 
      status: successCount === tests.length ? 'completed' : 'failed',
      progress: 100
    });
  };

  // 认证系统测试
  const testAuthenticationSystem = async () => {
    const suiteName = 'authentication';
    updateTestSuite(suiteName, { status: 'running' });
    setCurrentSuite(suiteName);

    const tests = [
      {
        name: '用户登录状态检查',
        test: async () => {
          const response = await authService.checkAuthStatus();
          return response;
        }
      },
      {
        name: '手机号验证功能',
        test: async () => {
          const response = await authService.verifyPhone('13800138000', 'TEST_2024_001');
          return response;
        }
      },
      {
        name: '令牌刷新机制',
        test: async () => {
          const token = localStorage.getItem('auth-token');
          if (!token) throw new Error('无有效令牌');
          
          const response = await authService.refreshToken();
          return response;
        }
      },
      {
        name: '用户信息获取',
        test: async () => {
          const response = await authService.getUserProfile();
          return response;
        }
      }
    ];

    let successCount = 0;
    for (let i = 0; i < tests.length; i++) {
      const test = tests[i];
      const startTime = Date.now();
      
      try {
        addTestResult(suiteName, {
          name: test.name,
          status: 'pending',
          message: '正在测试...'
        });

        const result = await test.test();
        const duration = Date.now() - startTime;
        
        addTestResult(suiteName, {
          name: test.name,
          status: 'success',
          message: `测试通过 (${duration}ms)`,
          details: result,
          duration
        });
        
        successCount++;
      } catch (error) {
        const duration = Date.now() - startTime;
        addTestResult(suiteName, {
          name: test.name,
          status: 'error',
          message: `测试失败: ${error instanceof Error ? error.message : '未知错误'}`,
          details: error,
          duration
        });
      }
      
      updateTestSuite(suiteName, { progress: ((i + 1) / tests.length) * 100 });
    }

    updateTestSuite(suiteName, { 
      status: successCount === tests.length ? 'completed' : 'failed',
      progress: 100
    });
  };

  // 权限系统测试
  const testPermissionSystem = async () => {
    const suiteName = 'permission-system';
    updateTestSuite(suiteName, { status: 'running' });
    setCurrentSuite(suiteName);

    const tests = [
      {
        name: '模块权限检查',
        test: async () => {
          const modules = ['farming', 'processing', 'logistics', 'admin', 'platform'];
          const results = modules.map(module => ({
            module,
            hasAccess: permissions.hasModuleAccess(module)
          }));
          return results;
        }
      },
      {
        name: '角色级别权限',
        test: async () => {
          const levels = [0, 5, 10, 20, 50];
          const results = levels.map(level => ({
            level,
            hasAccess: permissions.hasRoleLevel(level)
          }));
          return results;
        }
      },
      {
        name: '功能权限检查',
        test: async () => {
          const features = ['create_trace', 'manage_users', 'system_config'];
          const results = features.map(feature => ({
            feature,
            hasAccess: permissions.hasFeatureAccess(feature)
          }));
          return results;
        }
      },
      {
        name: '权限数据一致性',
        test: async () => {
          if (!user?.permissions) throw new Error('用户权限数据不存在');
          
          const modulePermissions = user.permissions.modules;
          const roleLevel = user.permissions.roleLevel;
          
          return {
            modulePermissions,
            roleLevel,
            roleInfo: permissions.roleInfo
          };
        }
      }
    ];

    let successCount = 0;
    for (let i = 0; i < tests.length; i++) {
      const test = tests[i];
      const startTime = Date.now();
      
      try {
        addTestResult(suiteName, {
          name: test.name,
          status: 'pending',
          message: '正在测试...'
        });

        const result = await test.test();
        const duration = Date.now() - startTime;
        
        addTestResult(suiteName, {
          name: test.name,
          status: 'success',
          message: `权限检查通过 (${duration}ms)`,
          details: result,
          duration
        });
        
        successCount++;
      } catch (error) {
        const duration = Date.now() - startTime;
        addTestResult(suiteName, {
          name: test.name,
          status: 'error',
          message: `权限检查失败: ${error instanceof Error ? error.message : '未知错误'}`,
          details: error,
          duration
        });
      }
      
      updateTestSuite(suiteName, { progress: ((i + 1) / tests.length) * 100 });
    }

    updateTestSuite(suiteName, { 
      status: successCount === tests.length ? 'completed' : 'failed',
      progress: 100
    });
  };

  // 路由保护测试
  const testRouteProtection = async () => {
    const suiteName = 'route-protection';
    updateTestSuite(suiteName, { status: 'running' });
    setCurrentSuite(suiteName);

    const protectedRoutes = [
      { path: '/farming', module: 'farming', level: 50 },
      { path: '/processing', module: 'processing', level: 50 },
      { path: '/logistics', module: 'logistics', level: 50 },
      { path: '/admin', module: 'admin', level: 10 },
      { path: '/platform', module: 'platform', level: 0 }
    ];

    const tests = protectedRoutes.map(route => ({
      name: `${route.path} 路由保护`,
      test: async () => {
        const moduleAccess = permissions.hasModuleAccess(route.module);
        const levelAccess = permissions.hasRoleLevel(route.level);
        const canAccess = moduleAccess && levelAccess;
        
        return {
          path: route.path,
          module: route.module,
          requiredLevel: route.level,
          currentLevel: permissions.roleLevel,
          moduleAccess,
          levelAccess,
          canAccess
        };
      }
    }));

    let successCount = 0;
    for (let i = 0; i < tests.length; i++) {
      const test = tests[i];
      const startTime = Date.now();
      
      try {
        addTestResult(suiteName, {
          name: test.name,
          status: 'pending',
          message: '正在检查路由保护...'
        });

        const result = await test.test();
        const duration = Date.now() - startTime;
        
        addTestResult(suiteName, {
          name: test.name,
          status: 'success',
          message: `路由保护检查完成 (${duration}ms)`,
          details: result,
          duration
        });
        
        successCount++;
      } catch (error) {
        const duration = Date.now() - startTime;
        addTestResult(suiteName, {
          name: test.name,
          status: 'error',
          message: `路由保护检查失败: ${error instanceof Error ? error.message : '未知错误'}`,
          details: error,
          duration
        });
      }
      
      updateTestSuite(suiteName, { progress: ((i + 1) / tests.length) * 100 });
    }

    updateTestSuite(suiteName, { 
      status: successCount === tests.length ? 'completed' : 'failed',
      progress: 100
    });
  };

  // 用户管理测试
  const testUserManagement = async () => {
    const suiteName = 'user-management';
    updateTestSuite(suiteName, { status: 'running' });
    setCurrentSuite(suiteName);

    const tests = [
      {
        name: '获取用户列表',
        test: async () => {
          const response = await realApiClient.get('/api/users');
          return response;
        }
      },
      {
        name: '获取待审核用户',
        test: async () => {
          const response = await realApiClient.get('/api/users/pending');
          return response;
        }
      },
      {
        name: '获取白名单',
        test: async () => {
          const response = await realApiClient.get('/api/whitelist');
          return response;
        }
      },
      {
        name: '获取平台工厂列表',
        test: async () => {
          const response = await realApiClient.get('/api/platform/factories');
          return response;
        }
      }
    ];

    let successCount = 0;
    for (let i = 0; i < tests.length; i++) {
      const test = tests[i];
      const startTime = Date.now();
      
      try {
        addTestResult(suiteName, {
          name: test.name,
          status: 'pending',
          message: '正在测试...'
        });

        const result = await test.test();
        const duration = Date.now() - startTime;
        
        addTestResult(suiteName, {
          name: test.name,
          status: 'success',
          message: `API调用成功 (${duration}ms)`,
          details: result,
          duration
        });
        
        successCount++;
      } catch (error) {
        const duration = Date.now() - startTime;
        addTestResult(suiteName, {
          name: test.name,
          status: 'error',
          message: `API调用失败: ${error instanceof Error ? error.message : '未知错误'}`,
          details: error,
          duration
        });
      }
      
      updateTestSuite(suiteName, { progress: ((i + 1) / tests.length) * 100 });
    }

    updateTestSuite(suiteName, { 
      status: successCount === tests.length ? 'completed' : 'failed',
      progress: 100
    });
  };

  // 运行Real API测试
  const runRealApiTestSuite = async () => {
    setIsRunning(true);
    setTestResults([]);
    initializeTestSuites();

    try {
      console.log('🚀 启动Real API测试套件');
      const apiResults = await runRealApiTests();
      
      // 转换结果格式
      for (const result of apiResults.results) {
        const testResult: TestResult = {
          name: result.name,
          status: result.status,
          message: result.message,
          details: result.response || result.error,
          duration: result.duration,
          timestamp: result.timestamp
        };
        
        setTestResults(prev => [...prev, testResult]);
      }
      
      console.log('✅ Real API测试完成', apiResults.summary);
    } catch (error) {
      console.error('Real API测试失败:', error);
    }
  };

  // 运行权限系统验证
  const runPermissionValidation = async () => {
    if (!user?.permissions) {
      alert('用户权限数据不可用');
      return;
    }

    try {
      console.log('🔍 启动权限系统验证');
      const permissionResults = await validatePermissionSystem(user.permissions);
      
      // 转换结果格式
      for (const result of permissionResults.results) {
        const testResult: TestResult = {
          name: result.name,
          status: result.status,
          message: result.message,
          details: result.details,
          timestamp: result.timestamp
        };
        
        setTestResults(prev => [...prev, testResult]);
      }
      
      console.log('✅ 权限系统验证完成', permissionResults.summary);
    } catch (error) {
      console.error('权限系统验证失败:', error);
    }
  };

  // 运行所有测试
  const runAllTests = async () => {
    setIsRunning(true);
    setTestResults([]);
    initializeTestSuites();

    try {
      // 运行Real API测试
      await runRealApiTestSuite();
      
      // 运行权限验证
      await runPermissionValidation();
      
      // 运行原有的测试
      await testApiConnectivity();
      await testAuthenticationSystem();
      await testPermissionSystem();
      await testRouteProtection();
      await testUserManagement();
    } catch (error) {
      console.error('测试执行失败:', error);
    } finally {
      setIsRunning(false);
      setCurrentSuite(null);
    }

    // 计算总体进度
    const totalTests = testSuites.reduce((sum, suite) => sum + suite.tests.length, 0);
    const completedTests = testResults.filter(r => r.status === 'success').length;
    setOverallProgress(totalTests > 0 ? (completedTests / totalTests) * 100 : 0);
  };

  // 获取测试状态图标
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'pending':
        return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-400" />;
    }
  };

  // 获取套件图标
  const getSuiteIcon = (suiteName: string) => {
    const icons = {
      'api-connectivity': Database,
      'authentication': Shield,
      'permission-system': Shield,
      'route-protection': Route,
      'user-management': Users
    };
    const Icon = icons[suiteName as keyof typeof icons] || Settings;
    return <Icon className="h-5 w-5" />;
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">系统验证测试</h1>
        <p className="text-gray-600">使用Real API进行全面的权限系统测试</p>
      </div>

      {/* 认证状态提示 */}
      {!isAuthenticated && (
        <Alert className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            您需要先登录才能进行系统测试。请前往登录页面完成认证。
          </AlertDescription>
        </Alert>
      )}

      {/* 用户信息概览 */}
      {user && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              测试环境信息
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-600">当前用户</p>
                <p className="font-medium">{user.username}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">权限级别</p>
                <Badge variant="outline">{permissions.roleLevel}</Badge>
              </div>
              <div>
                <p className="text-sm text-gray-600">角色</p>
                <p className="font-medium">{permissions.roleInfo?.name || '未知'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">API环境</p>
                <Badge variant="secondary">Real API</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 测试控制 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>测试控制</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <p className="text-sm text-gray-600">总体进度</p>
                <Progress value={overallProgress} className="w-64" />
              </div>
              <Button
                onClick={runAllTests}
                disabled={isRunning || !isAuthenticated}
                className="flex items-center gap-2"
              >
                {isRunning ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    运行中...
                  </>
                ) : (
                  <>
                    <Activity className="h-4 w-4" />
                    完整测试
                  </>
                )}
              </Button>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                onClick={runRealApiTestSuite}
                disabled={isRunning || !isAuthenticated}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <Database className="h-4 w-4" />
                Real API测试
              </Button>
              
              <Button
                onClick={runPermissionValidation}
                disabled={isRunning || !isAuthenticated}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <Shield className="h-4 w-4" />
                权限验证
              </Button>
              
              <Button
                onClick={() => {
                  setTestResults([]);
                  initializeTestSuites();
                  setOverallProgress(0);
                }}
                disabled={isRunning}
                variant="ghost"
                size="sm"
                className="flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                清空结果
              </Button>
            </div>
          </div>
          
          {currentSuite && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                正在执行: {testSuites.find(s => s.name === currentSuite)?.description}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* 测试结果 */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">概览</TabsTrigger>
          <TabsTrigger value="api-connectivity">API连接</TabsTrigger>
          <TabsTrigger value="authentication">认证</TabsTrigger>
          <TabsTrigger value="permission-system">权限</TabsTrigger>
          <TabsTrigger value="route-protection">路由</TabsTrigger>
          <TabsTrigger value="user-management">用户管理</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {testSuites.map((suite) => (
              <Card key={suite.name}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    {getSuiteIcon(suite.name)}
                    {suite.description}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">状态</span>
                      <Badge variant={
                        suite.status === 'completed' ? 'default' :
                        suite.status === 'failed' ? 'destructive' :
                        suite.status === 'running' ? 'secondary' : 'outline'
                      }>
                        {suite.status === 'completed' ? '完成' :
                         suite.status === 'failed' ? '失败' :
                         suite.status === 'running' ? '运行中' : '待运行'}
                      </Badge>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">进度</span>
                        <span className="text-sm font-medium">{Math.round(suite.progress)}%</span>
                      </div>
                      <Progress value={suite.progress} className="h-2" />
                    </div>
                    <p className="text-sm text-gray-600">
                      {suite.tests.length} 个测试项
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {testSuites.map((suite) => (
          <TabsContent key={suite.name} value={suite.name} className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {getSuiteIcon(suite.name)}
                  {suite.description}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {suite.tests.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">
                      暂无测试结果，请先运行测试
                    </p>
                  ) : (
                    suite.tests.map((test, index) => (
                      <div key={index} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(test.status)}
                            <span className="font-medium">{test.name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {test.duration && (
                              <Badge variant="outline" className="text-xs">
                                {test.duration}ms
                              </Badge>
                            )}
                            {test.timestamp && (
                              <span className="text-xs text-gray-500">
                                {new Date(test.timestamp).toLocaleTimeString()}
                              </span>
                            )}
                          </div>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{test.message}</p>
                        {test.details && (
                          <details className="mt-2">
                            <summary className="cursor-pointer text-sm text-blue-600">
                              查看详情
                            </summary>
                            <pre className="mt-2 text-xs bg-gray-50 p-2 rounded overflow-x-auto">
                              {JSON.stringify(test.details, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}