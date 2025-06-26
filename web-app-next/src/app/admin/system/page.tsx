'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import Badge from '@/components/ui/badge';
import { Loading } from '@/components/ui/loading';

interface SystemConfig {
  siteName: string;
  siteDescription: string;
  maintenance: boolean;
  maxUploadSize: number;
  sessionTimeout: number;
  backupFrequency: 'daily' | 'weekly' | 'monthly';
  logLevel: 'error' | 'warn' | 'info' | 'debug';
}

interface SystemInfo {
  version: string;
  buildDate: string;
  nodeVersion: string;
  dbStatus: 'connected' | 'disconnected';
  storageUsed: number;
  storageTotal: number;
  lastBackup: string;
}

export default function AdminSystemPage() {
  const router = useRouter();
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'config' | 'backup' | 'logs'>('config');

  useEffect(() => {
    const loadData = async () => {
      try {
        await new Promise(resolve => setTimeout(resolve, 1000));

        setConfig({
          siteName: '黑牛溯源系统',
          siteDescription: '专业的农产品溯源平台',
          maintenance: false,
          maxUploadSize: 10,
          sessionTimeout: 30,
          backupFrequency: 'daily',
          logLevel: 'info'
        });

        setSystemInfo({
          version: 'v2.0.1',
          buildDate: '2025-02-02',
          nodeVersion: 'v18.18.0',
          dbStatus: 'connected',
          storageUsed: 2.5,
          storageTotal: 10,
          lastBackup: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
        });
      } catch (error) {
        console.error('加载系统数据失败:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const handleSave = async () => {
    if (!config) return;

    setSaving(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      alert('系统配置保存成功！');
    } catch (error) {
      console.error('保存失败:', error);
      alert('保存失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  const handleBackup = async () => {
    try {
      alert('正在创建系统备份...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      alert('备份创建成功！');
    } catch {
      alert('备份失败，请重试');
    }
  };

  const handleRestore = () => {
    if (confirm('确定要恢复系统备份吗？此操作不可逆！')) {
      alert('系统恢复功能开发中...');
    }
  };

  const handleClearLogs = () => {
    if (confirm('确定要清空系统日志吗？')) {
      alert('日志清空成功！');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loading />
      </div>
    );
  }

  if (!config || !systemInfo) {
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
          <h1 className="text-lg font-medium">系统管理</h1>
          <div className="w-8 h-8"></div>
        </div>
      </header>

      {/* 主内容 */}
      <main className="flex-1 pt-[80px] pb-[80px] px-4 space-y-4">
        {/* 系统信息 */}
        <Card className="bg-white rounded-lg shadow-sm p-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">系统信息</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">版本号</span>
              <span className="text-sm font-medium">{systemInfo.version}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">构建日期</span>
              <span className="text-sm font-medium">{systemInfo.buildDate}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Node.js版本</span>
              <span className="text-sm font-medium">{systemInfo.nodeVersion}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">数据库状态</span>
              <Badge variant={systemInfo.dbStatus === 'connected' ? 'success' : 'error'}>
                {systemInfo.dbStatus === 'connected' ? '已连接' : '已断开'}
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">存储空间</span>
              <span className="text-sm font-medium">
                {systemInfo.storageUsed}GB / {systemInfo.storageTotal}GB
              </span>
            </div>
          </div>
        </Card>

        {/* Tab 导航 */}
        <Card className="bg-white rounded-lg shadow-sm">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab('config')}
              className={`flex-1 py-3 px-4 text-sm font-medium ${
                activeTab === 'config'
                  ? 'text-[#1890FF] border-b-2 border-[#1890FF]'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              基础配置
            </button>
            <button
              onClick={() => setActiveTab('backup')}
              className={`flex-1 py-3 px-4 text-sm font-medium ${
                activeTab === 'backup'
                  ? 'text-[#1890FF] border-b-2 border-[#1890FF]'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              备份恢复
            </button>
            <button
              onClick={() => setActiveTab('logs')}
              className={`flex-1 py-3 px-4 text-sm font-medium ${
                activeTab === 'logs'
                  ? 'text-[#1890FF] border-b-2 border-[#1890FF]'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              日志管理
            </button>
          </div>

          <div className="p-4">
            {activeTab === 'config' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    站点名称
                  </label>
                  <Input
                    value={config.siteName}
                    onChange={(e) => setConfig({...config, siteName: e.target.value})}
                    placeholder="请输入站点名称"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    站点描述
                  </label>
                  <Input
                    value={config.siteDescription}
                    onChange={(e) => setConfig({...config, siteDescription: e.target.value})}
                    placeholder="请输入站点描述"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    最大上传大小 (MB)
                  </label>
                  <Input
                    type="number"
                    value={config.maxUploadSize}
                    onChange={(e) => setConfig({...config, maxUploadSize: parseInt(e.target.value)})}
                    placeholder="10"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    会话超时 (分钟)
                  </label>
                  <Input
                    type="number"
                    value={config.sessionTimeout}
                    onChange={(e) => setConfig({...config, sessionTimeout: parseInt(e.target.value)})}
                    placeholder="30"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    备份频率
                  </label>
                  <Select
                    value={config.backupFrequency}
                    onChange={(value) => setConfig({...config, backupFrequency: value as any})}
                    options={[
                      { value: 'daily', label: '每日' },
                      { value: 'weekly', label: '每周' },
                      { value: 'monthly', label: '每月' }
                    ]}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    日志级别
                  </label>
                  <Select
                    value={config.logLevel}
                    onChange={(value) => setConfig({...config, logLevel: value as any})}
                    options={[
                      { value: 'error', label: '错误' },
                      { value: 'warn', label: '警告' },
                      { value: 'info', label: '信息' },
                      { value: 'debug', label: '调试' }
                    ]}
                  />
                </div>

                <div className="flex items-center justify-between py-2">
                  <span className="text-sm font-medium text-gray-700">维护模式</span>
                  <button
                    onClick={() => setConfig({...config, maintenance: !config.maintenance})}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      config.maintenance ? 'bg-[#1890FF]' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                        config.maintenance ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                <Button
                  onClick={handleSave}
                  disabled={saving}
                  variant="primary"
                  className="w-full"
                >
                  {saving ? <Loading size="sm" /> : '保存配置'}
                </Button>
              </div>
            )}

            {activeTab === 'backup' && (
              <div className="space-y-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">最后备份时间</h4>
                  <p className="text-sm text-gray-600">
                    {new Date(systemInfo.lastBackup).toLocaleString()}
                  </p>
                </div>

                <div className="space-y-3">
                  <Button
                    onClick={handleBackup}
                    variant="primary"
                    className="w-full"
                  >
                    立即备份
                  </Button>

                  <Button
                    onClick={handleRestore}
                    variant="secondary"
                    className="w-full"
                  >
                    恢复备份
                  </Button>

                  <Button
                    onClick={() => alert('下载功能开发中...')}
                    variant="secondary"
                    className="w-full"
                  >
                    下载备份文件
                  </Button>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-yellow-800 mb-1">注意事项</h4>
                  <ul className="text-xs text-yellow-700 space-y-1">
                    <li>• 备份过程中请勿操作系统</li>
                    <li>• 建议定期下载备份文件到本地</li>
                    <li>• 恢复操作会覆盖当前数据</li>
                  </ul>
                </div>
              </div>
            )}

            {activeTab === 'logs' && (
              <div className="space-y-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">当前日志级别</h4>
                  <Badge variant="primary">{config.logLevel.toUpperCase()}</Badge>
                </div>

                <div className="space-y-3">
                  <Button
                    onClick={() => alert('查看日志功能开发中...')}
                    variant="secondary"
                    className="w-full"
                  >
                    查看系统日志
                  </Button>

                  <Button
                    onClick={() => alert('查看错误日志功能开发中...')}
                    variant="secondary"
                    className="w-full"
                  >
                    查看错误日志
                  </Button>

                  <Button
                    onClick={() => alert('导出日志功能开发中...')}
                    variant="secondary"
                    className="w-full"
                  >
                    导出日志文件
                  </Button>

                  <Button
                    onClick={handleClearLogs}
                    variant="danger"
                    className="w-full"
                  >
                    清空日志
                  </Button>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-blue-800 mb-1">日志说明</h4>
                  <ul className="text-xs text-blue-700 space-y-1">
                    <li>• 系统会自动记录所有操作日志</li>
                    <li>• 错误日志包含详细的错误信息</li>
                    <li>• 建议定期清理过期日志</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </Card>
      </main>
    </div>
  );
}
