'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Badge from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { realApiClient } from '@/lib/real-api-client';
import { authService } from '@/services/auth.service';
import { REAL_API_CONFIG } from '@/config/api-endpoints';
import { useAuthStore } from '@/store/authStore';
import { 
  Timer, 
  Zap, 
  TrendingUp, 
  Database, 
  Shield, 
  Users,
  AlertCircle,
  CheckCircle,
  XCircle,
  Activity
} from 'lucide-react';

interface PerformanceMetric {
  name: string;
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  avgTime: number;
  minTime: number;
  maxTime: number;
  successRate: number;
  totalRequests: number;
  errors: number;
  status: 'good' | 'warning' | 'error';
}

interface LoadTestResult {
  name: string;
  endpoint: string;
  concurrency: number;
  totalRequests: number;
  completedRequests: number;
  failedRequests: number;
  avgResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  requestsPerSecond: number;
  totalDuration: number;
  status: 'running' | 'completed' | 'failed';
}

/**
 * Real API性能测试页面
 * 专门用于测试Real API的性能和稳定性
 */
export default function RealApiPerformancePage() {
  const { user, isAuthenticated } = useAuthStore();
  const [metrics, setMetrics] = useState<PerformanceMetric[]>([]);
  const [loadTests, setLoadTests] = useState<LoadTestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [currentTest, setCurrentTest] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  // 性能测试端点配置
  const testEndpoints = [
    { name: '健康检查', endpoint: '/health', method: 'GET' as const },
    { name: '认证状态', endpoint: '/api/auth/status', method: 'GET' as const },
    { name: '用户列表', endpoint: '/api/users', method: 'GET' as const },
    { name: '用户信息', endpoint: '/api/auth/me', method: 'GET' as const },
    { name: '白名单', endpoint: '/api/whitelist', method: 'GET' as const },
    { name: '平台工厂', endpoint: '/api/platform/factories', method: 'GET' as const },
    { name: '用户统计', endpoint: '/api/users/stats', method: 'GET' as const },
    { name: '白名单统计', endpoint: '/api/whitelist/stats', method: 'GET' as const }
  ];

  // 执行单个端点的性能测试
  const testEndpointPerformance = async (
    endpoint: { name: string; endpoint: string; method: 'GET' | 'POST' | 'PUT' | 'DELETE' },
    iterations: number = 10
  ): Promise<PerformanceMetric> => {
    const times: number[] = [];
    let errors = 0;
    let successCount = 0;

    for (let i = 0; i < iterations; i++) {
      const startTime = Date.now();
      try {
        await realApiClient.get(endpoint.endpoint);
        const endTime = Date.now();
        times.push(endTime - startTime);
        successCount++;
      } catch (error) {
        errors++;
        console.error(`请求失败: ${endpoint.endpoint}`, error);
      }
    }

    const avgTime = times.length > 0 ? times.reduce((sum, time) => sum + time, 0) / times.length : 0;
    const minTime = times.length > 0 ? Math.min(...times) : 0;
    const maxTime = times.length > 0 ? Math.max(...times) : 0;
    const successRate = (successCount / iterations) * 100;

    let status: 'good' | 'warning' | 'error' = 'good';
    if (successRate < 95) {
      status = 'error';
    } else if (avgTime > 2000) {
      status = 'warning';
    }

    return {
      name: endpoint.name,
      endpoint: endpoint.endpoint,
      method: endpoint.method,
      avgTime,
      minTime,
      maxTime,
      successRate,
      totalRequests: iterations,
      errors,
      status
    };
  };

  // 运行性能测试
  const runPerformanceTests = async () => {
    setIsRunning(true);
    setMetrics([]);
    setProgress(0);

    try {
      for (let i = 0; i < testEndpoints.length; i++) {
        const endpoint = testEndpoints[i];
        setCurrentTest(endpoint.name);
        
        const metric = await testEndpointPerformance(endpoint);
        setMetrics(prev => [...prev, metric]);
        
        setProgress(((i + 1) / testEndpoints.length) * 100);
      }
    } catch (error) {
      console.error('性能测试失败:', error);
    } finally {
      setIsRunning(false);
      setCurrentTest(null);
    }
  };

  // 执行负载测试
  const runLoadTest = async (
    endpoint: { name: string; endpoint: string; method: string },
    concurrency: number = 5,
    totalRequests: number = 50
  ) => {
    const loadTest: LoadTestResult = {
      name: endpoint.name,
      endpoint: endpoint.endpoint,
      concurrency,
      totalRequests,
      completedRequests: 0,
      failedRequests: 0,
      avgResponseTime: 0,
      minResponseTime: Infinity,
      maxResponseTime: 0,
      requestsPerSecond: 0,
      totalDuration: 0,
      status: 'running'
    };

    setLoadTests(prev => [...prev, loadTest]);
    const testIndex = loadTests.length;

    const startTime = Date.now();
    const times: number[] = [];
    let completedRequests = 0;
    let failedRequests = 0;

    const updateLoadTest = (updates: Partial<LoadTestResult>) => {
      setLoadTests(prev => 
        prev.map((test, index) => 
          index === testIndex ? { ...test, ...updates } : test
        )
      );
    };

    try {
      const promises = [];
      for (let i = 0; i < totalRequests; i++) {
        const promise = (async () => {
          const requestStart = Date.now();
          try {
            await realApiClient.get(endpoint.endpoint);
            const requestEnd = Date.now();
            const duration = requestEnd - requestStart;
            times.push(duration);
            completedRequests++;
            
            updateLoadTest({
              completedRequests,
              minResponseTime: Math.min(loadTest.minResponseTime, duration),
              maxResponseTime: Math.max(loadTest.maxResponseTime, duration)
            });
          } catch (error) {
            failedRequests++;
            updateLoadTest({ failedRequests });
          }
        })();
        
        promises.push(promise);
        
        // 控制并发数
        if (promises.length >= concurrency) {
          await Promise.all(promises);
          promises.length = 0;
        }
      }
      
      // 等待剩余请求完成
      if (promises.length > 0) {
        await Promise.all(promises);
      }
      
      const endTime = Date.now();
      const totalDuration = endTime - startTime;
      const avgResponseTime = times.length > 0 ? times.reduce((sum, time) => sum + time, 0) / times.length : 0;
      const requestsPerSecond = totalRequests / (totalDuration / 1000);
      
      updateLoadTest({
        completedRequests,
        failedRequests,
        avgResponseTime,
        requestsPerSecond,
        totalDuration,
        status: 'completed'
      });
      
    } catch (error) {
      console.error('负载测试失败:', error);
      updateLoadTest({ status: 'failed' });
    }
  };

  // 获取性能状态颜色
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'good': return 'text-green-600';
      case 'warning': return 'text-yellow-600';
      case 'error': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  // 获取性能状态图标
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'good': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'warning': return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case 'error': return <XCircle className="h-4 w-4 text-red-500" />;
      default: return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Real API 性能测试</h1>
        <p className="text-gray-600">测试Real API的性能、稳定性和负载承受能力</p>
      </div>

      {/* 认证状态提示 */}
      {!isAuthenticated && (
        <Alert className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            您需要先登录才能进行性能测试。请前往登录页面完成认证。
          </AlertDescription>
        </Alert>
      )}

      {/* API配置信息 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            API配置信息
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-600">API地址</p>
              <p className="font-medium">{REAL_API_CONFIG.baseURL}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">超时时间</p>
              <p className="font-medium">{REAL_API_CONFIG.timeout}ms</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">重试次数</p>
              <p className="font-medium">{REAL_API_CONFIG.retryAttempts}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">当前用户</p>
              <p className="font-medium">{user?.username || '未登录'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 性能测试控制 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Timer className="h-5 w-5" />
            性能测试控制
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <div className="space-y-2">
              <p className="text-sm text-gray-600">测试进度</p>
              <Progress value={progress} className="w-64" />
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={runPerformanceTests}
                disabled={isRunning || !isAuthenticated}
                className="flex items-center gap-2"
              >
                <Zap className="h-4 w-4" />
                {isRunning ? '运行中...' : '开始性能测试'}
              </Button>
              <Button
                onClick={() => runLoadTest(testEndpoints[0], 10, 100)}
                disabled={isRunning || !isAuthenticated}
                variant="outline"
                className="flex items-center gap-2"
              >
                <TrendingUp className="h-4 w-4" />
                负载测试
              </Button>
            </div>
          </div>
          
          {currentTest && (
            <Alert>
              <Activity className="h-4 w-4" />
              <AlertDescription>
                正在测试: {currentTest}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* 性能测试结果 */}
      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Timer className="h-5 w-5" />
              性能指标
            </CardTitle>
          </CardHeader>
          <CardContent>
            {metrics.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                暂无性能测试数据，请运行性能测试
              </p>
            ) : (
              <div className="space-y-4">
                {metrics.map((metric, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(metric.status)}
                        <span className="font-medium">{metric.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {metric.method}
                        </Badge>
                      </div>
                      <Badge variant={
                        metric.status === 'good' ? 'default' :
                        metric.status === 'warning' ? 'secondary' : 'destructive'
                      }>
                        {metric.status === 'good' ? '良好' :
                         metric.status === 'warning' ? '警告' : '错误'}
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-600">平均响应时间</p>
                        <p className={`font-medium ${getStatusColor(metric.status)}`}>
                          {metric.avgTime.toFixed(0)}ms
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-600">成功率</p>
                        <p className={`font-medium ${getStatusColor(metric.status)}`}>
                          {metric.successRate.toFixed(1)}%
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-600">最小时间</p>
                        <p className="font-medium">{metric.minTime}ms</p>
                      </div>
                      <div>
                        <p className="text-gray-600">最大时间</p>
                        <p className="font-medium">{metric.maxTime}ms</p>
                      </div>
                    </div>
                    
                    <div className="mt-2 text-xs text-gray-500">
                      {metric.totalRequests} 次请求，{metric.errors} 次失败
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              负载测试
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadTests.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                暂无负载测试数据，请运行负载测试
              </p>
            ) : (
              <div className="space-y-4">
                {loadTests.map((test, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">{test.name}</span>
                      <Badge variant={
                        test.status === 'completed' ? 'default' :
                        test.status === 'running' ? 'secondary' : 'destructive'
                      }>
                        {test.status === 'completed' ? '完成' :
                         test.status === 'running' ? '运行中' : '失败'}
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-600">并发数</p>
                        <p className="font-medium">{test.concurrency}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">总请求数</p>
                        <p className="font-medium">{test.totalRequests}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">完成请求</p>
                        <p className="font-medium text-green-600">{test.completedRequests}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">失败请求</p>
                        <p className="font-medium text-red-600">{test.failedRequests}</p>
                      </div>
                    </div>
                    
                    {test.status === 'completed' && (
                      <div className="mt-3 pt-3 border-t grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-gray-600">平均响应时间</p>
                          <p className="font-medium">{test.avgResponseTime.toFixed(0)}ms</p>
                        </div>
                        <div>
                          <p className="text-gray-600">QPS</p>
                          <p className="font-medium">{test.requestsPerSecond.toFixed(1)}</p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 快速测试按钮 */}
      <Card>
        <CardHeader>
          <CardTitle>快速测试</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {testEndpoints.slice(0, 4).map((endpoint, index) => (
              <Button
                key={index}
                onClick={() => runLoadTest(endpoint, 5, 20)}
                disabled={isRunning || !isAuthenticated}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <Database className="h-3 w-3" />
                {endpoint.name}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}