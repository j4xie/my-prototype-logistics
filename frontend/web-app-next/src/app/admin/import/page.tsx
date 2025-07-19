'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMockAuth } from '@/hooks/useMockAuth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface ImportTask {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  recordCount: number;
  successCount: number;
  errorCount: number;
  startTime: string;
  endTime?: string;
  errorDetails?: string[];
}

interface ImportStats {
  totalImports: number;
  todayImports: number;
  successRate: number;
  totalRecords: number;
}

interface ImportTemplate {
  id: string;
  name: string;
  description: string;
  fileType: string;
  fields: string[];
  example: string;
}

export default function DataImportPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useMockAuth();
  const [importTasks, setImportTasks] = useState<ImportTask[]>([]);
  const [templates, setTemplates] = useState<ImportTemplate[]>([]);
  const [stats, setStats] = useState<ImportStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState<'upload' | 'history' | 'templates'>('upload');
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

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

      const mockTasks: ImportTask[] = [
        {
          id: 'IMP001',
          fileName: '农产品数据_2024.xlsx',
          fileType: 'Excel',
          fileSize: '2.5MB',
          status: 'completed',
          progress: 100,
          recordCount: 1250,
          successCount: 1230,
          errorCount: 20,
          startTime: '2024-06-14 14:30:15',
          endTime: '2024-06-14 14:32:45',
          errorDetails: ['第15行：缺少必填字段"产品编号"', '第28行：日期格式错误']
        },
        {
          id: 'IMP002',
          fileName: '用户信息导入.csv',
          fileType: 'CSV',
          fileSize: '850KB',
          status: 'processing',
          progress: 65,
          recordCount: 500,
          successCount: 325,
          errorCount: 0,
          startTime: '2024-06-14 15:15:30'
        },
        {
          id: 'IMP003',
          fileName: '供应商清单.xlsx',
          fileType: 'Excel',
          fileSize: '1.8MB',
          status: 'failed',
          progress: 30,
          recordCount: 800,
          successCount: 240,
          errorCount: 560,
          startTime: '2024-06-14 13:45:20',
          endTime: '2024-06-14 13:47:10',
          errorDetails: ['文件格式不匹配', '缺少必要的列头信息', '数据类型错误过多']
        }
      ];

      const mockTemplates: ImportTemplate[] = [
        {
          id: 'TPL001',
          name: '农产品信息模板',
          description: '用于导入农产品基础信息的标准模板',
          fileType: 'Excel',
          fields: ['产品编号', '产品名称', '分类', '产地', '生产日期', '保质期'],
          example: 'product_template.xlsx'
        },
        {
          id: 'TPL002',
          name: '用户数据模板',
          description: '批量导入用户账户信息的模板',
          fileType: 'CSV',
          fields: ['用户名', '邮箱', '手机号', '角色', '部门', '状态'],
          example: 'user_template.csv'
        },
        {
          id: 'TPL003',
          name: '供应商信息模板',
          description: '供应商基础信息批量导入模板',
          fileType: 'Excel',
          fields: ['供应商编号', '公司名称', '联系人', '电话', '地址', '资质'],
          example: 'supplier_template.xlsx'
        },
        {
          id: 'TPL004',
          name: '检测报告模板',
          description: '质量检测报告数据导入模板',
          fileType: 'CSV',
          fields: ['报告编号', '产品批次', '检测项目', '检测结果', '检测日期'],
          example: 'test_report_template.csv'
        }
      ];

      const mockStats: ImportStats = {
        totalImports: 156,
        todayImports: 8,
        successRate: 85.2,
        totalRecords: 45680
      };

      setImportTasks(mockTasks);
      setTemplates(mockTemplates);
      setStats(mockStats);
      setIsLoading(false);
    };

    loadData();
  }, [router, authLoading, isAuthenticated]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return { bg: '#F6FFED', text: '#52C41A', label: '已完成', icon: 'fas fa-check-circle' };
      case 'processing':
        return { bg: '#E6F7FF', text: '#1677FF', label: '处理中', icon: 'fas fa-sync fa-spin' };
      case 'failed':
        return { bg: '#FFF2F0', text: '#FF4D4F', label: '失败', icon: 'fas fa-times-circle' };
      case 'pending':
        return { bg: '#FFF7E6', text: '#FA8C16', label: '待处理', icon: 'fas fa-clock' };
      default:
        return { bg: '#F5F5F5', text: '#8C8C8C', label: '未知', icon: 'fas fa-question-circle' };
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = e.dataTransfer.files;
    if (files && files[0]) {
      handleFileUpload(files[0]);
    }
  };

  const handleFileUpload = (file: File) => {
    // 模拟文件上传过程
    const newTask: ImportTask = {
      id: `IMP${Date.now()}`,
      fileName: file.name,
      fileType: file.name.split('.').pop()?.toUpperCase() || 'Unknown',
      fileSize: (file.size / 1024 / 1024).toFixed(1) + 'MB',
      status: 'processing',
      progress: 0,
      recordCount: 0,
      successCount: 0,
      errorCount: 0,
      startTime: new Date().toLocaleString()
    };

    setImportTasks(prev => [newTask, ...prev]);

    // 模拟进度更新
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 15;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        // 更新任务状态为完成
        setImportTasks(prev => prev.map(task =>
          task.id === newTask.id
            ? { ...task, status: 'completed', progress: 100, recordCount: 450, successCount: 440, errorCount: 10, endTime: new Date().toLocaleString() }
            : task
        ));
      } else {
        setImportTasks(prev => prev.map(task =>
          task.id === newTask.id
            ? { ...task, progress: Math.round(progress) }
            : task
        ));
      }
    }, 500);
  };

  if (authLoading || isLoading) {
    return (
      <div className="flex flex-col min-h-screen bg-[#f0f2f5]">
        <div className="max-w-[390px] mx-auto w-full min-h-screen flex items-center justify-center">
          <div className="text-center">
            <i className="fas fa-upload fa-spin text-[#1677FF] text-3xl mb-4"></i>
            <p className="text-[#8c8c8c]">
              {authLoading ? '验证用户身份...' : '加载导入数据...'}
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
          <h1 className="text-lg font-semibold">数据导入</h1>
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

          {/* 导入统计 */}
          {stats && (
            <Card className="bg-white rounded-lg shadow-sm p-4 mb-4">
              <h3 className="font-medium text-[#262626] mb-3 flex items-center">
                <i className="fas fa-chart-bar text-[#1677FF] mr-2"></i>
                导入统计
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-semibold text-[#1677FF] mb-1">
                    {stats.totalImports}
                  </div>
                  <div className="text-sm text-[#8c8c8c]">总导入次数</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-semibold text-[#52C41A] mb-1">
                    {stats.todayImports}
                  </div>
                  <div className="text-sm text-[#8c8c8c]">今日导入</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-semibold text-[#FA8C16] mb-1">
                    {stats.successRate}%
                  </div>
                  <div className="text-sm text-[#8c8c8c]">成功率</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-semibold text-[#FF4D4F] mb-1">
                    {stats.totalRecords.toLocaleString()}
                  </div>
                  <div className="text-sm text-[#8c8c8c]">总记录数</div>
                </div>
              </div>
            </Card>
          )}

          {/* 标签页切换 */}
          <Card className="bg-white rounded-lg shadow-sm p-4 mb-4">
            <div className="flex space-x-1">
              <button
                onClick={() => setSelectedTab('upload')}
                className={`
                  flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all
                  ${selectedTab === 'upload'
                    ? 'bg-[#1677FF] text-white shadow-sm'
                    : 'bg-[#f5f5f5] text-[#8c8c8c] hover:bg-[#e6f7ff] hover:text-[#1677FF]'
                  }
                `}
              >
                <i className="fas fa-upload mr-1"></i>
                文件上传
              </button>
              <button
                onClick={() => setSelectedTab('history')}
                className={`
                  flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all
                  ${selectedTab === 'history'
                    ? 'bg-[#1677FF] text-white shadow-sm'
                    : 'bg-[#f5f5f5] text-[#8c8c8c] hover:bg-[#e6f7ff] hover:text-[#1677FF]'
                  }
                `}
              >
                <i className="fas fa-history mr-1"></i>
                导入历史
              </button>
              <button
                onClick={() => setSelectedTab('templates')}
                className={`
                  flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all
                  ${selectedTab === 'templates'
                    ? 'bg-[#1677FF] text-white shadow-sm'
                    : 'bg-[#f5f5f5] text-[#8c8c8c] hover:bg-[#e6f7ff] hover:text-[#1677FF]'
                  }
                `}
              >
                <i className="fas fa-file-alt mr-1"></i>
                导入模板
              </button>
            </div>
          </Card>

          {/* 文件上传标签页 */}
          {selectedTab === 'upload' && (
            <div className="space-y-4">
              {/* 拖拽上传区域 */}
              <Card className="bg-white rounded-lg shadow-sm p-4">
                <div
                  className={`
                    border-2 border-dashed rounded-lg p-8 text-center transition-all
                    ${dragActive
                      ? 'border-[#1677FF] bg-[#e6f7ff]'
                      : 'border-[#d9d9d9] hover:border-[#1677FF] hover:bg-[#fafafa]'
                    }
                  `}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                >
                  <i className="fas fa-cloud-upload-alt text-4xl text-[#1677FF] mb-4"></i>
                  <h3 className="font-medium text-[#262626] mb-2">拖拽文件到此处上传</h3>
                  <p className="text-sm text-[#8c8c8c] mb-4">
                    支持 Excel (.xlsx, .xls) 和 CSV (.csv) 格式
                  </p>
                  <Button
                    onClick={() => document.getElementById('file-upload')?.click()}
                    className="bg-[#1677FF] hover:bg-[#4096FF] text-white"
                  >
                    <i className="fas fa-plus mr-2"></i>
                    选择文件
                  </Button>
                  <input
                    id="file-upload"
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        handleFileUpload(file);
                      }
                    }}
                  />
                </div>
              </Card>

              {/* 导入须知 */}
              <Card className="bg-white rounded-lg shadow-sm p-4">
                <h4 className="font-medium text-[#262626] mb-3 flex items-center">
                  <i className="fas fa-info-circle text-[#1677FF] mr-2"></i>
                  导入须知
                </h4>
                <div className="space-y-2 text-sm text-[#8c8c8c]">
                  <p>• 文件大小不超过 10MB</p>
                  <p>• Excel 文件请确保数据在第一个工作表</p>
                  <p>• CSV 文件请使用 UTF-8 编码</p>
                  <p>• 第一行应为列标题</p>
                  <p>• 必填字段不能为空</p>
                  <p>• 日期格式：YYYY-MM-DD</p>
                </div>
              </Card>
            </div>
          )}

          {/* 导入历史标签页 */}
          {selectedTab === 'history' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-[#262626]">导入历史</h3>
                <span className="text-sm text-[#8c8c8c]">共 {importTasks.length} 条记录</span>
              </div>

              {importTasks.map((task) => {
                const statusInfo = getStatusColor(task.status);

                return (
                  <Card
                    key={task.id}
                    className="bg-white rounded-lg shadow-sm p-4 cursor-pointer transition-all hover:shadow-md hover:scale-[1.03]"
                    onClick={() => router.push(`/admin/import/task/${task.id}`)}
                  >
                    <div className="space-y-3">
                      {/* 基本信息 */}
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium text-[#262626] mb-1 flex items-center">
                            <i className="fas fa-file text-[#1677FF] mr-2"></i>
                            {task.fileName}
                            <span
                              className="ml-2 px-2 py-0.5 rounded text-xs font-medium flex items-center"
                              style={{ backgroundColor: statusInfo.bg, color: statusInfo.text }}
                            >
                              <i className={`${statusInfo.icon} mr-1`}></i>
                              {statusInfo.label}
                            </span>
                          </h4>
                          <p className="text-sm text-[#8c8c8c] mb-1">
                            <i className="fas fa-calendar mr-1"></i>
                            {task.startTime}
                            {task.endTime && ` - ${task.endTime}`}
                          </p>
                          <p className="text-sm text-[#8c8c8c]">
                            <i className="fas fa-hdd mr-1"></i>
                            {task.fileType} · {task.fileSize}
                          </p>
                        </div>
                      </div>

                      {/* 进度条 */}
                      {task.status === 'processing' && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-[#8c8c8c]">处理进度</span>
                            <span className="text-sm font-medium text-[#1677FF]">{task.progress}%</span>
                          </div>
                          <div className="w-full bg-[#f0f0f0] rounded-full h-2">
                            <div
                              className="bg-[#1677FF] h-2 rounded-full transition-all duration-300"
                              style={{ width: `${task.progress}%` }}
                            ></div>
                          </div>
                        </div>
                      )}

                      {/* 统计信息 */}
                      {task.recordCount > 0 && (
                        <div className="grid grid-cols-3 gap-4 pt-3 border-t border-[#f0f0f0]">
                          <div className="text-center">
                            <div className="text-lg font-semibold text-[#1677FF]">{task.recordCount}</div>
                            <div className="text-xs text-[#8c8c8c]">总记录</div>
                          </div>
                          <div className="text-center">
                            <div className="text-lg font-semibold text-[#52C41A]">{task.successCount}</div>
                            <div className="text-xs text-[#8c8c8c]">成功</div>
                          </div>
                          <div className="text-center">
                            <div className="text-lg font-semibold text-[#FF4D4F]">{task.errorCount}</div>
                            <div className="text-xs text-[#8c8c8c]">失败</div>
                          </div>
                        </div>
                      )}

                      {/* 错误信息 */}
                      {task.errorDetails && task.errorDetails.length > 0 && (
                        <div className="bg-[#FFF2F0] p-3 rounded-md">
                          <h5 className="font-medium text-[#FF4D4F] mb-2 flex items-center">
                            <i className="fas fa-exclamation-triangle mr-1"></i>
                            错误详情
                          </h5>
                          <div className="space-y-1">
                            {task.errorDetails.slice(0, 2).map((error, index) => (
                              <p key={index} className="text-sm text-[#8c8c8c]">• {error}</p>
                            ))}
                            {task.errorDetails.length > 2 && (
                              <p className="text-sm text-[#1677FF]">... 还有 {task.errorDetails.length - 2} 个错误</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          {/* 导入模板标签页 */}
          {selectedTab === 'templates' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-[#262626]">导入模板</h3>
                <span className="text-sm text-[#8c8c8c]">共 {templates.length} 个模板</span>
              </div>

              {templates.map((template) => (
                <Card
                  key={template.id}
                  className="bg-white rounded-lg shadow-sm p-4 cursor-pointer transition-all hover:shadow-md hover:scale-[1.03]"
                  onClick={() => router.push(`/admin/import/template/${template.id}`)}
                >
                  <div className="space-y-3">
                    {/* 基本信息 */}
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium text-[#262626] mb-1 flex items-center">
                          <i className="fas fa-file-download text-[#1677FF] mr-2"></i>
                          {template.name}
                          <span className="ml-2 px-2 py-0.5 bg-[#E6F7FF] text-[#1677FF] rounded text-xs font-medium">
                            {template.fileType}
                          </span>
                        </h4>
                        <p className="text-sm text-[#8c8c8c] mb-2">
                          {template.description}
                        </p>
                      </div>
                    </div>

                    {/* 字段列表 */}
                    <div className="space-y-2">
                      <h5 className="text-sm font-medium text-[#262626]">包含字段：</h5>
                      <div className="flex flex-wrap gap-1">
                        {template.fields.map((field, index) => (
                          <span
                            key={index}
                            className="px-2 py-1 bg-[#f0f0f0] text-[#8c8c8c] text-xs rounded"
                          >
                            {field}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* 下载按钮 */}
                    <div className="pt-3 border-t border-[#f0f0f0]">
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          // 模拟下载
                          alert(`下载模板：${template.example}`);
                        }}
                        className="w-full bg-[#52C41A] hover:bg-[#73D13D] text-white"
                      >
                        <i className="fas fa-download mr-2"></i>
                        下载模板文件
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
