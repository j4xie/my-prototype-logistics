'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMockAuth } from '@/hooks/useMockAuth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface BackupRecord {
  id: string;
  name: string;
  type: 'full' | 'incremental' | 'database' | 'files';
  size: string;
  status: 'completed' | 'running' | 'failed' | 'scheduled';
  startTime: string;
  endTime?: string;
  duration?: string;
  description: string;
  location: string;
  autoCreated: boolean;
}

interface BackupStats {
  totalBackups: number;
  todayBackups: number;
  totalSize: string;
  lastBackup: string;
  nextScheduled: string;
}

interface BackupSchedule {
  id: string;
  name: string;
  type: 'full' | 'incremental' | 'database';
  frequency: 'daily' | 'weekly' | 'monthly';
  time: string;
  enabled: boolean;
  lastRun?: string;
  nextRun: string;
}

export default function BackupPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useMockAuth();
  const [backupRecords, setBackupRecords] = useState<BackupRecord[]>([]);
  const [schedules, setSchedules] = useState<BackupSchedule[]>([]);
  const [stats, setStats] = useState<BackupStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState<'backup' | 'restore' | 'schedule'>('backup');
  const [backupProgress, setBackupProgress] = useState(0);
  const [isBackingUp, setIsBackingUp] = useState(false);

  useEffect(() => {
    // 等待认证状态确定
    if (authLoading) return;

    // 只在生产环境下检查认证，开发环境已通过useMockAuth自动处理
    if (!isAuthenticated && process.env.NODE_ENV === 'production') {
      router.push('/login');
      return;
    }

    const loadData = async () => {
      await new Promise(resolve => setTimeout(resolve, 1000));

      const mockRecords: BackupRecord[] = [
        {
          id: 'BK001',
          name: '系统完整备份_20240614',
          type: 'full',
          size: '2.8GB',
          status: 'completed',
          startTime: '2024-06-14 02:00:00',
          endTime: '2024-06-14 02:45:30',
          duration: '45分30秒',
          description: '包含数据库、文件系统、配置文件的完整备份',
          location: '/backup/full/backup_20240614_020000.tar.gz',
          autoCreated: true
        },
        {
          id: 'BK002',
          name: '数据库增量备份_20240614',
          type: 'incremental',
          size: '156MB',
          status: 'completed',
          startTime: '2024-06-14 12:00:00',
          endTime: '2024-06-14 12:08:15',
          duration: '8分15秒',
          description: '数据库增量备份（自上次备份以来的变更）',
          location: '/backup/incremental/db_inc_20240614_120000.sql',
          autoCreated: true
        },
        {
          id: 'BK003',
          name: '手动文件备份',
          type: 'files',
          size: '950MB',
          status: 'running',
          startTime: '2024-06-14 16:30:00',
          description: '用户上传文件和附件的手动备份',
          location: '/backup/files/manual_files_20240614.zip',
          autoCreated: false
        },
        {
          id: 'BK004',
          name: '系统配置备份',
          type: 'database',
          size: '45MB',
          status: 'failed',
          startTime: '2024-06-14 14:00:00',
          endTime: '2024-06-14 14:02:30',
          duration: '2分30秒',
          description: '系统配置和设置的备份（失败）',
          location: '/backup/config/config_20240614.json',
          autoCreated: false
        }
      ];

      const mockSchedules: BackupSchedule[] = [
        {
          id: 'SCH001',
          name: '每日完整备份',
          type: 'full',
          frequency: 'daily',
          time: '02:00',
          enabled: true,
          lastRun: '2024-06-14 02:00:00',
          nextRun: '2024-06-15 02:00:00'
        },
        {
          id: 'SCH002',
          name: '数据库增量备份',
          type: 'incremental',
          frequency: 'daily',
          time: '12:00',
          enabled: true,
          lastRun: '2024-06-14 12:00:00',
          nextRun: '2024-06-14 18:00:00'
        },
        {
          id: 'SCH003',
          name: '周度数据库备份',
          type: 'database',
          frequency: 'weekly',
          time: '01:00',
          enabled: false,
          nextRun: '2024-06-16 01:00:00'
        }
      ];

      const mockStats: BackupStats = {
        totalBackups: 28,
        todayBackups: 3,
        totalSize: '15.6GB',
        lastBackup: '2024-06-14 12:08:15',
        nextScheduled: '2024-06-14 18:00:00'
      };

      setBackupRecords(mockRecords);
      setSchedules(mockSchedules);
      setStats(mockStats);
      setIsLoading(false);
    };

    loadData();
  }, [router, authLoading, isAuthenticated]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return { bg: '#F6FFED', text: '#52C41A', label: '已完成', icon: 'fas fa-check-circle' };
      case 'running':
        return { bg: '#E6F7FF', text: '#1677FF', label: '运行中', icon: 'fas fa-sync fa-spin' };
      case 'failed':
        return { bg: '#FFF2F0', text: '#FF4D4F', label: '失败', icon: 'fas fa-times-circle' };
      case 'scheduled':
        return { bg: '#FFF7E6', text: '#FA8C16', label: '已计划', icon: 'fas fa-clock' };
      default:
        return { bg: '#F5F5F5', text: '#8C8C8C', label: '未知', icon: 'fas fa-question-circle' };
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'full':
        return { bg: '#E6F7FF', text: '#1677FF', label: '完整备份' };
      case 'incremental':
        return { bg: '#F6FFED', text: '#52C41A', label: '增量备份' };
      case 'database':
        return { bg: '#FFF7E6', text: '#FA8C16', label: '数据库' };
      case 'files':
        return { bg: '#FFF2F0', text: '#FF4D4F', label: '文件备份' };
      default:
        return { bg: '#F5F5F5', text: '#8C8C8C', label: '其他' };
    }
  };

  const startBackup = (type: 'full' | 'incremental' | 'database' | 'files') => {
    setIsBackingUp(true);
    setBackupProgress(0);

    const interval = setInterval(() => {
      setBackupProgress(prev => {
        const newProgress = prev + Math.random() * 10;
        if (newProgress >= 100) {
          clearInterval(interval);
          setIsBackingUp(false);
          setBackupProgress(0);

          // 添加新的备份记录
          const newBackup: BackupRecord = {
            id: `BK${Date.now()}`,
            name: `手动${type === 'full' ? '完整' : type === 'incremental' ? '增量' : type === 'database' ? '数据库' : '文件'}备份_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`,
            type: type,
            size: `${(Math.random() * 1000 + 100).toFixed(0)}MB`,
            status: 'completed',
            startTime: new Date().toLocaleString(),
            endTime: new Date(Date.now() + 300000).toLocaleString(),
            duration: `${Math.floor(Math.random() * 10 + 5)}分钟`,
            description: `手动创建的${type === 'full' ? '完整系统' : type === 'incremental' ? '增量数据' : type === 'database' ? '数据库' : '文件'}备份`,
            location: `/backup/${type}/manual_${Date.now()}.${type === 'database' ? 'sql' : 'tar.gz'}`,
            autoCreated: false
          };

          setBackupRecords(prev => [newBackup, ...prev]);
          return 100;
        }
        return newProgress;
      });
    }, 300);
  };

  if (authLoading || isLoading) {
    return (
      <div className="flex flex-col min-h-screen bg-[#f0f2f5]">
        <div className="max-w-[390px] mx-auto w-full min-h-screen flex items-center justify-center">
          <div className="text-center">
            <i className="fas fa-database fa-spin text-[#1677FF] text-3xl mb-4"></i>
            <p className="text-[#8c8c8c]">
              {authLoading ? '验证用户身份...' : '加载备份数据...'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#f0f2f5]">
      {/* 顶部导航栏 */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-[#1677FF] text-white z-50 shadow-[0_2px_8px_rgba(0,0,0,0.15)]">
        <div className="max-w-[390px] mx-auto h-full flex items-center justify-between px-4">
          <button
            onClick={() => router.back()}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
          >
            <i className="fas fa-arrow-left"></i>
          </button>
          <h1 className="text-lg font-semibold">系统备份</h1>
          <button
            onClick={() => router.push('/admin')}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
          >
            <i className="fas fa-home"></i>
          </button>
        </div>
      </header>

      {/* 主内容区域 */}
      <main className="flex-1 pt-20 pb-4">
        <div className="max-w-[390px] mx-auto px-4">

          {/* 备份统计 */}
          {stats && (
            <Card className="bg-white rounded-lg shadow-sm p-4 mb-4">
              <h3 className="font-medium text-[#262626] mb-3 flex items-center">
                <i className="fas fa-chart-bar text-[#1677FF] mr-2"></i>
                备份概览
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-semibold text-[#1677FF] mb-1">
                    {stats.totalBackups}
                  </div>
                  <div className="text-sm text-[#8c8c8c]">总备份数</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-semibold text-[#52C41A] mb-1">
                    {stats.todayBackups}
                  </div>
                  <div className="text-sm text-[#8c8c8c]">今日备份</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-semibold text-[#FA8C16] mb-1">
                    {stats.totalSize}
                  </div>
                  <div className="text-sm text-[#8c8c8c]">总大小</div>
                </div>
                <div className="text-center">
                  <div className="text-xs font-medium text-[#FF4D4F] mb-1">
                    {stats.nextScheduled.split(' ')[1]}
                  </div>
                  <div className="text-sm text-[#8c8c8c]">下次备份</div>
                </div>
              </div>
            </Card>
          )}

          {/* 备份进度 */}
          {isBackingUp && (
            <Card className="bg-white rounded-lg shadow-sm p-4 mb-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-[#262626] flex items-center">
                    <i className="fas fa-sync fa-spin text-[#1677FF] mr-2"></i>
                    正在备份...
                  </h3>
                  <span className="text-sm font-medium text-[#1677FF]">{Math.round(backupProgress)}%</span>
                </div>
                <div className="w-full bg-[#f0f0f0] rounded-full h-2">
                  <div
                    className="bg-[#1677FF] h-2 rounded-full transition-all duration-300"
                    style={{ width: `${backupProgress}%` }}
                  ></div>
                </div>
              </div>
            </Card>
          )}

          {/* 标签页切换 */}
          <Card className="bg-white rounded-lg shadow-sm p-4 mb-4">
            <div className="flex space-x-1">
              <button
                onClick={() => setSelectedTab('backup')}
                className={`
                  flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all
                  ${selectedTab === 'backup'
                    ? 'bg-[#1677FF] text-white shadow-sm'
                    : 'bg-[#f5f5f5] text-[#8c8c8c] hover:bg-[#e6f7ff] hover:text-[#1677FF]'
                  }
                `}
              >
                <i className="fas fa-save mr-1"></i>
                创建备份
              </button>
              <button
                onClick={() => setSelectedTab('restore')}
                className={`
                  flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all
                  ${selectedTab === 'restore'
                    ? 'bg-[#1677FF] text-white shadow-sm'
                    : 'bg-[#f5f5f5] text-[#8c8c8c] hover:bg-[#e6f7ff] hover:text-[#1677FF]'
                  }
                `}
              >
                <i className="fas fa-undo mr-1"></i>
                备份历史
              </button>
              <button
                onClick={() => setSelectedTab('schedule')}
                className={`
                  flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all
                  ${selectedTab === 'schedule'
                    ? 'bg-[#1677FF] text-white shadow-sm'
                    : 'bg-[#f5f5f5] text-[#8c8c8c] hover:bg-[#e6f7ff] hover:text-[#1677FF]'
                  }
                `}
              >
                <i className="fas fa-calendar mr-1"></i>
                定时计划
              </button>
            </div>
          </Card>

          {/* 创建备份标签页 */}
          {selectedTab === 'backup' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Button
                  onClick={() => startBackup('full')}
                  disabled={isBackingUp}
                  className="h-16 bg-[#1677FF] hover:bg-[#4096FF] text-white flex flex-col items-center justify-center"
                >
                  <i className="fas fa-database text-xl mb-1"></i>
                  <span className="text-sm">完整备份</span>
                </Button>
                <Button
                  onClick={() => startBackup('incremental')}
                  disabled={isBackingUp}
                  className="h-16 bg-[#52C41A] hover:bg-[#73D13D] text-white flex flex-col items-center justify-center"
                >
                  <i className="fas fa-plus-circle text-xl mb-1"></i>
                  <span className="text-sm">增量备份</span>
                </Button>
                <Button
                  onClick={() => startBackup('database')}
                  disabled={isBackingUp}
                  className="h-16 bg-[#FA8C16] hover:bg-[#FFA940] text-white flex flex-col items-center justify-center"
                >
                  <i className="fas fa-server text-xl mb-1"></i>
                  <span className="text-sm">数据库备份</span>
                </Button>
                <Button
                  onClick={() => startBackup('files')}
                  disabled={isBackingUp}
                  className="h-16 bg-[#FF4D4F] hover:bg-[#FF7875] text-white flex flex-col items-center justify-center"
                >
                  <i className="fas fa-folder text-xl mb-1"></i>
                  <span className="text-sm">文件备份</span>
                </Button>
              </div>

              <Card className="bg-white rounded-lg shadow-sm p-4">
                <h4 className="font-medium text-[#262626] mb-3">备份类型说明</h4>
                <div className="space-y-3 text-sm">
                  <div className="flex items-start">
                    <i className="fas fa-database text-[#1677FF] mr-3 mt-1"></i>
                    <div>
                      <div className="font-medium text-[#262626]">完整备份</div>
                      <div className="text-[#8c8c8c]">备份整个系统，包括数据库、文件和配置</div>
                    </div>
                  </div>
                  <div className="flex items-start">
                    <i className="fas fa-plus-circle text-[#52C41A] mr-3 mt-1"></i>
                    <div>
                      <div className="font-medium text-[#262626]">增量备份</div>
                      <div className="text-[#8c8c8c]">仅备份自上次备份以来的更改</div>
                    </div>
                  </div>
                  <div className="flex items-start">
                    <i className="fas fa-server text-[#FA8C16] mr-3 mt-1"></i>
                    <div>
                      <div className="font-medium text-[#262626]">数据库备份</div>
                      <div className="text-[#8c8c8c]">仅备份数据库内容</div>
                    </div>
                  </div>
                  <div className="flex items-start">
                    <i className="fas fa-folder text-[#FF4D4F] mr-3 mt-1"></i>
                    <div>
                      <div className="font-medium text-[#262626]">文件备份</div>
                      <div className="text-[#8c8c8c]">备份用户上传的文件和附件</div>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* 备份历史标签页 */}
          {selectedTab === 'restore' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-[#262626]">备份历史</h3>
                <span className="text-sm text-[#8c8c8c]">共 {backupRecords.length} 条记录</span>
              </div>

              {backupRecords.map((record) => {
                const statusInfo = getStatusColor(record.status);
                const typeInfo = getTypeColor(record.type);

                return (
                  <Card
                    key={record.id}
                    className="bg-white rounded-lg shadow-sm p-4 cursor-pointer transition-all hover:shadow-md hover:scale-[1.03]"
                    onClick={() => router.push(`/admin/backup/detail/${record.id}`)}
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium text-[#262626] mb-1 flex items-center">
                            <i className="fas fa-archive text-[#1677FF] mr-2"></i>
                            {record.name}
                            <span
                              className="ml-2 px-2 py-0.5 rounded text-xs font-medium"
                              style={{ backgroundColor: typeInfo.bg, color: typeInfo.text }}
                            >
                              {typeInfo.label}
                            </span>
                          </h4>
                          <p className="text-sm text-[#8c8c8c] mb-1">
                            {record.description}
                          </p>
                          <p className="text-sm text-[#8c8c8c]">
                            <i className="fas fa-calendar mr-1"></i>
                            {record.startTime}
                            {record.duration && ` (用时: ${record.duration})`}
                          </p>
                        </div>
                        <div className="text-right">
                          <div
                            className="px-2 py-1 rounded text-xs font-medium mb-2 flex items-center"
                            style={{ backgroundColor: statusInfo.bg, color: statusInfo.text }}
                          >
                            <i className={`${statusInfo.icon} mr-1`}></i>
                            {statusInfo.label}
                          </div>
                          <div className="text-xs text-[#8c8c8c]">
                            {record.size}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-[#f0f0f0] text-xs text-[#bfbfbf]">
                        <span>
                          <i className={`fas ${record.autoCreated ? 'fa-robot' : 'fa-user'} mr-1`}></i>
                          {record.autoCreated ? '自动备份' : '手动备份'}
                        </span>
                        <span className="truncate max-w-[200px]">
                          <i className="fas fa-folder mr-1"></i>
                          {record.location}
                        </span>
                      </div>

                      {record.status === 'completed' && (
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            onClick={(e) => {
                              e.stopPropagation();
                              alert('下载备份文件');
                            }}
                            className="bg-[#52C41A] hover:bg-[#73D13D] text-white text-sm h-8"
                          >
                            <i className="fas fa-download mr-1"></i>
                            下载
                          </Button>
                          <Button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm('确定要恢复此备份吗？这将覆盖当前数据。')) {
                                alert('开始恢复操作...');
                              }
                            }}
                            className="bg-[#FA8C16] hover:bg-[#FFA940] text-white text-sm h-8"
                          >
                            <i className="fas fa-undo mr-1"></i>
                            恢复
                          </Button>
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          {/* 定时计划标签页 */}
          {selectedTab === 'schedule' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-[#262626]">定时计划</h3>
                <Button
                  onClick={() => router.push('/admin/backup/schedule/create')}
                  className="bg-[#1677FF] hover:bg-[#4096FF] text-white text-sm"
                >
                  <i className="fas fa-plus mr-1"></i>
                  新建计划
                </Button>
              </div>

              {schedules.map((schedule) => {
                const typeInfo = getTypeColor(schedule.type);

                return (
                  <Card
                    key={schedule.id}
                    className="bg-white rounded-lg shadow-sm p-4 cursor-pointer transition-all hover:shadow-md hover:scale-[1.03]"
                    onClick={() => router.push(`/admin/backup/schedule/${schedule.id}`)}
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium text-[#262626] mb-1 flex items-center">
                            <i className="fas fa-clock text-[#1677FF] mr-2"></i>
                            {schedule.name}
                            <span
                              className="ml-2 px-2 py-0.5 rounded text-xs font-medium"
                              style={{ backgroundColor: typeInfo.bg, color: typeInfo.text }}
                            >
                              {typeInfo.label}
                            </span>
                          </h4>
                          <p className="text-sm text-[#8c8c8c] mb-1">
                            <i className="fas fa-repeat mr-1"></i>
                            {schedule.frequency === 'daily' ? '每日' : schedule.frequency === 'weekly' ? '每周' : '每月'} {schedule.time} 执行
                          </p>
                          <p className="text-sm text-[#8c8c8c]">
                            <i className="fas fa-forward mr-1"></i>
                            下次运行: {schedule.nextRun}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className={`px-2 py-1 rounded text-xs font-medium ${
                            schedule.enabled
                              ? 'bg-[#F6FFED] text-[#52C41A]'
                              : 'bg-[#F5F5F5] text-[#8C8C8C]'
                          }`}>
                            {schedule.enabled ? '已启用' : '已禁用'}
                          </div>
                        </div>
                      </div>

                      {schedule.lastRun && (
                        <div className="pt-3 border-t border-[#f0f0f0] text-xs text-[#bfbfbf]">
                          <span>
                            <i className="fas fa-history mr-1"></i>
                            上次运行: {schedule.lastRun}
                          </span>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            // 切换启用状态
                            setSchedules(prev => prev.map(s =>
                              s.id === schedule.id ? { ...s, enabled: !s.enabled } : s
                            ));
                          }}
                          className={`text-sm h-8 ${
                            schedule.enabled
                              ? 'bg-[#FF4D4F] hover:bg-[#FF7875] text-white'
                              : 'bg-[#52C41A] hover:bg-[#73D13D] text-white'
                          }`}
                        >
                          <i className={`fas ${schedule.enabled ? 'fa-pause' : 'fa-play'} mr-1`}></i>
                          {schedule.enabled ? '禁用' : '启用'}
                        </Button>
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            alert('立即执行备份计划');
                          }}
                          className="bg-[#FA8C16] hover:bg-[#FFA940] text-white text-sm h-8"
                        >
                          <i className="fas fa-play mr-1"></i>
                          立即执行
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
