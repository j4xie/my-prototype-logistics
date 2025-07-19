'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import Badge from '@/components/ui/badge';
import { Loading } from '@/components/ui/loading';

interface ReportData {
  userAnalytics: {
    totalRegistrations: number;
    activeUsers: number;
    userGrowth: Array<{date: string; count: number}>;
    topDepartments: Array<{name: string; count: number}>;
  };
  businessAnalytics: {
    totalQueries: number;
    successfulQueries: number;
    avgResponseTime: number;
    topProducts: Array<{name: string; queries: number}>;
    queryTrends: Array<{date: string; count: number}>;
  };
  systemMetrics: {
    uptime: number;
    cpuUsage: number;
    memoryUsage: number;
    diskUsage: number;
    apiCalls: Array<{endpoint: string; count: number}>;
  };
}

export default function AdminReportsPage() {
  const router = useRouter();
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeReport, setActiveReport] = useState<'user' | 'business' | 'system'>('user');
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'quarter'>('month');

  useEffect(() => {
    const loadReports = async () => {
      try {
        await new Promise(resolve => setTimeout(resolve, 1500));

        setReportData({
          userAnalytics: {
            totalRegistrations: 1247,
            activeUsers: 892,
            userGrowth: [
              {date: '2025-01-01', count: 1120},
              {date: '2025-01-15', count: 1180},
              {date: '2025-02-01', count: 1247}
            ],
            topDepartments: [
              {name: '养殖部门', count: 425},
              {name: '物流部门', count: 312},
              {name: '管理部门', count: 267},
              {name: '质检部门', count: 243}
            ]
          },
          businessAnalytics: {
            totalQueries: 28765,
            successfulQueries: 28634,
            avgResponseTime: 245,
            topProducts: [
              {name: '有机黑猪肉', queries: 2845},
              {name: '散养土鸡', queries: 2156},
              {name: '绿色蔬菜', queries: 1834},
              {name: '生态牛肉', queries: 1623}
            ],
            queryTrends: [
              {date: '2025-01-01', count: 1200},
              {date: '2025-01-15', count: 1450},
              {date: '2025-02-01', count: 1680}
            ]
          },
          systemMetrics: {
            uptime: 99.8,
            cpuUsage: 45,
            memoryUsage: 68,
            diskUsage: 32,
            apiCalls: [
              {endpoint: '/api/trace', count: 12450},
              {endpoint: '/api/auth', count: 8234},
              {endpoint: '/api/products', count: 5677},
              {endpoint: '/api/users', count: 3421}
            ]
          }
        });
      } catch (error) {
        console.error('加载报表数据失败:', error);
      } finally {
        setLoading(false);
      }
    };

    loadReports();
  }, [timeRange]);

  const handleExport = (type: string) => {
    alert(`导出${type}报表功能开发中...`);
  };

  const handleRefresh = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      alert('数据已刷新！');
    }, 1000);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loading />
      </div>
    );
  }

  if (!reportData) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-lg text-red-600">加载数据失败</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen max-w-[390px] mx-auto bg-gray-50">
      {/* 顶部导航 */}
      <header className="fixed top-0 left-0 right-0 z-[999] bg-[#1890FF] text-white shadow-sm">
        <div className="max-w-[390px] mx-auto flex items-center justify-between h-16 px-4">
          <button
            onClick={() => router.back()}
            className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-white/10"
            aria-label="返回"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-lg font-medium">数据报表</h1>
          <button
            onClick={handleRefresh}
            className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-white/10"
            aria-label="刷新"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </header>

      {/* 主内容 */}
      <main className="flex-1 pt-[80px] pb-[80px] px-4 space-y-4">
        {/* 时间范围选择 */}
        <Card className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">时间范围</span>
            <Select
              value={timeRange}
              onChange={(value) => setTimeRange(value as any)}
              options={[
                { value: 'week', label: '最近一周' },
                { value: 'month', label: '最近一月' },
                { value: 'quarter', label: '最近三月' }
              ]}
            />
          </div>
        </Card>

        {/* 报表类型导航 */}
        <Card className="bg-white rounded-lg shadow-sm">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveReport('user')}
              className={`flex-1 py-3 px-4 text-sm font-medium ${
                activeReport === 'user'
                  ? 'text-[#1890FF] border-b-2 border-[#1890FF]'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              用户分析
            </button>
            <button
              onClick={() => setActiveReport('business')}
              className={`flex-1 py-3 px-4 text-sm font-medium ${
                activeReport === 'business'
                  ? 'text-[#1890FF] border-b-2 border-[#1890FF]'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              业务分析
            </button>
            <button
              onClick={() => setActiveReport('system')}
              className={`flex-1 py-3 px-4 text-sm font-medium ${
                activeReport === 'system'
                  ? 'text-[#1890FF] border-b-2 border-[#1890FF]'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              系统监控
            </button>
          </div>

          <div className="p-4">
            {activeReport === 'user' && (
              <div className="space-y-4">
                {/* 用户概览 */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-blue-50 rounded-lg">
                    <p className="text-2xl font-bold text-[#1890FF]">
                      {reportData.userAnalytics.totalRegistrations.toLocaleString()}
                    </p>
                    <p className="text-sm text-gray-600">总注册用户</p>
                  </div>
                  <div className="text-center p-3 bg-green-50 rounded-lg">
                    <p className="text-2xl font-bold text-green-600">
                      {reportData.userAnalytics.activeUsers.toLocaleString()}
                    </p>
                    <p className="text-sm text-gray-600">活跃用户</p>
                  </div>
                </div>

                {/* 增长趋势 */}
                <Card className="bg-gray-50 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-900 mb-3">用户增长趋势</h4>
                  <div className="space-y-2">
                    {reportData.userAnalytics.userGrowth.map((item, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">
                          {new Date(item.date).toLocaleDateString()}
                        </span>
                        <span className="text-sm font-medium">{item.count.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </Card>

                {/* 部门分布 */}
                <Card className="bg-gray-50 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-900 mb-3">部门用户分布</h4>
                  <div className="space-y-3">
                    {reportData.userAnalytics.topDepartments.map((dept, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <span className="text-sm text-gray-700">{dept.name}</span>
                        <div className="flex items-center space-x-2">
                          <div className="w-16 h-2 bg-gray-200 rounded-full">
                            <div
                              className="h-2 bg-[#1890FF] rounded-full"
                              style={{width: `${(dept.count / reportData.userAnalytics.totalRegistrations) * 100}%`}}
                            ></div>
                          </div>
                          <span className="text-sm font-medium">{dept.count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>

                <Button
                  onClick={() => handleExport('用户分析')}
                  variant="primary"
                  className="w-full"
                >
                  导出用户报表
                </Button>
              </div>
            )}

            {activeReport === 'business' && (
              <div className="space-y-4">
                {/* 业务概览 */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-blue-50 rounded-lg">
                    <p className="text-2xl font-bold text-[#1890FF]">
                      {reportData.businessAnalytics.totalQueries.toLocaleString()}
                    </p>
                    <p className="text-sm text-gray-600">总查询次数</p>
                  </div>
                  <div className="text-center p-3 bg-green-50 rounded-lg">
                    <p className="text-2xl font-bold text-green-600">
                      {((reportData.businessAnalytics.successfulQueries / reportData.businessAnalytics.totalQueries) * 100).toFixed(1)}%
                    </p>
                    <p className="text-sm text-gray-600">成功率</p>
                  </div>
                </div>

                <div className="text-center p-3 bg-orange-50 rounded-lg">
                  <p className="text-2xl font-bold text-orange-600">
                    {reportData.businessAnalytics.avgResponseTime}ms
                  </p>
                  <p className="text-sm text-gray-600">平均响应时间</p>
                </div>

                {/* 热门产品 */}
                <Card className="bg-gray-50 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-900 mb-3">热门产品查询</h4>
                  <div className="space-y-3">
                    {reportData.businessAnalytics.topProducts.map((product, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <span className="text-sm text-gray-700">{product.name}</span>
                        <Badge variant="primary">{product.queries.toLocaleString()}</Badge>
                      </div>
                    ))}
                  </div>
                </Card>

                {/* 查询趋势 */}
                <Card className="bg-gray-50 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-900 mb-3">查询量趋势</h4>
                  <div className="space-y-2">
                    {reportData.businessAnalytics.queryTrends.map((item, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">
                          {new Date(item.date).toLocaleDateString()}
                        </span>
                        <span className="text-sm font-medium">{item.count.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </Card>

                <Button
                  onClick={() => handleExport('业务分析')}
                  variant="primary"
                  className="w-full"
                >
                  导出业务报表
                </Button>
              </div>
            )}

            {activeReport === 'system' && (
              <div className="space-y-4">
                {/* 系统状态 */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-green-50 rounded-lg">
                    <p className="text-2xl font-bold text-green-600">
                      {reportData.systemMetrics.uptime}%
                    </p>
                    <p className="text-sm text-gray-600">系统可用性</p>
                  </div>
                  <div className="text-center p-3 bg-blue-50 rounded-lg">
                    <p className="text-2xl font-bold text-[#1890FF]">
                      {reportData.systemMetrics.cpuUsage}%
                    </p>
                    <p className="text-sm text-gray-600">CPU使用率</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-orange-50 rounded-lg">
                    <p className="text-2xl font-bold text-orange-600">
                      {reportData.systemMetrics.memoryUsage}%
                    </p>
                    <p className="text-sm text-gray-600">内存使用率</p>
                  </div>
                  <div className="text-center p-3 bg-purple-50 rounded-lg">
                    <p className="text-2xl font-bold text-purple-600">
                      {reportData.systemMetrics.diskUsage}%
                    </p>
                    <p className="text-sm text-gray-600">磁盘使用率</p>
                  </div>
                </div>

                {/* API调用统计 */}
                <Card className="bg-gray-50 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-900 mb-3">API调用统计</h4>
                  <div className="space-y-3">
                    {reportData.systemMetrics.apiCalls.map((api, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <span className="text-sm text-gray-700 font-mono">{api.endpoint}</span>
                        <Badge variant="default">{api.count.toLocaleString()}</Badge>
                      </div>
                    ))}
                  </div>
                </Card>

                {/* 性能指标说明 */}
                <Card className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-blue-800 mb-2">性能指标说明</h4>
                  <ul className="text-xs text-blue-700 space-y-1">
                    <li>• 系统可用性：99%以上为优秀</li>
                    <li>• CPU使用率：70%以下为正常</li>
                    <li>• 内存使用率：80%以下为正常</li>
                    <li>• 磁盘使用率：80%以下为安全</li>
                  </ul>
                </Card>

                <Button
                  onClick={() => handleExport('系统监控')}
                  variant="primary"
                  className="w-full"
                >
                  导出系统报表
                </Button>
              </div>
            )}
          </div>
        </Card>
      </main>
    </div>
  );
}
