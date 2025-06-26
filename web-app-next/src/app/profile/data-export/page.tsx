'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Download,
  ArrowLeft,
  Clock,
  Archive,
  CheckCircle,
  FileText,
  RefreshCw,
  AlertCircle,
  Database,
  Shield,
  Info
} from 'lucide-react';
import { useRouter } from 'next/navigation';

interface ExportItem {
  id: string;
  name: string;
  description: string;
  category: 'profile' | 'activity' | 'data' | 'documents' | 'settings';
  size: string;
  included: boolean;
  sensitive: boolean;
  lastUpdated: string;
}

interface ExportFormat {
  id: string;
  name: string;
  extension: string;
  description: string;
  icon: any;
  recommended?: boolean;
}

interface ExportHistory {
  id: string;
  fileName: string;
  format: string;
  size: string;
  createdAt: string;
  status: 'completed' | 'failed' | 'expired';
  downloadUrl?: string;
  retentionDays: number;
}

// 可导出的数据项
const exportItems: ExportItem[] = [
  {
    id: 'profile_basic',
    name: '基本资料',
    description: '姓名、职位、联系方式等基本信息',
    category: 'profile',
    size: '2.3 KB',
    included: true,
    sensitive: false,
    lastUpdated: '2025-02-02'
  },
  {
    id: 'profile_extended',
    name: '扩展资料',
    description: '专业技能、认证、成就等详细信息',
    category: 'profile',
    size: '5.7 KB',
    included: true,
    sensitive: false,
    lastUpdated: '2025-02-01'
  },
  {
    id: 'activity_logs',
    name: '活动记录',
    description: '登录记录、操作日志、访问历史',
    category: 'activity',
    size: '156.2 KB',
    included: false,
    sensitive: true,
    lastUpdated: '2025-02-02'
  },
  {
    id: 'task_data',
    name: '任务数据',
    description: '创建和参与的任务、项目记录',
    category: 'data',
    size: '89.4 KB',
    included: true,
    sensitive: false,
    lastUpdated: '2025-02-02'
  },
  {
    id: 'documents',
    name: '上传文档',
    description: '用户上传的文件和附件',
    category: 'documents',
    size: '12.8 MB',
    included: false,
    sensitive: false,
    lastUpdated: '2025-01-30'
  },
  {
    id: 'preferences',
    name: '偏好设置',
    description: '个人偏好、隐私设置、通知配置',
    category: 'settings',
    size: '1.1 KB',
    included: true,
    sensitive: true,
    lastUpdated: '2025-02-02'
  },
  {
    id: 'collaboration_data',
    name: '协作数据',
    description: '团队协作记录、评论、反馈',
    category: 'data',
    size: '234.6 KB',
    included: false,
    sensitive: false,
    lastUpdated: '2025-02-01'
  },
  {
    id: 'analytics_data',
    name: '分析数据',
    description: '使用统计、性能指标、行为分析',
    category: 'activity',
    size: '45.7 KB',
    included: false,
    sensitive: true,
    lastUpdated: '2025-02-02'
  }
];

// 导出格式选项
const exportFormats: ExportFormat[] = [
  {
    id: 'json',
    name: 'JSON',
    extension: '.json',
    description: '结构化数据格式，适合程序处理',
    icon: FileText,
    recommended: true
  },
  {
    id: 'csv',
    name: 'CSV',
    extension: '.csv',
    description: '表格数据格式，适合Excel等工具',
    icon: Database
  },
  {
    id: 'pdf',
    name: 'PDF',
    extension: '.pdf',
    description: '便于查看和打印的文档格式',
    icon: FileText
  },
  {
    id: 'zip',
    name: 'ZIP压缩包',
    extension: '.zip',
    description: '包含所有数据的压缩文件',
    icon: Archive
  }
];

// 导出历史记录
const mockExportHistory: ExportHistory[] = [
  {
    id: '1',
    fileName: '个人数据导出_2025-01-28.json',
    format: 'JSON',
    size: '245.8 KB',
    createdAt: '2025-01-28 15:30',
    status: 'completed',
    downloadUrl: '/api/exports/download/1',
    retentionDays: 3
  },
  {
    id: '2',
    fileName: '完整数据备份_2025-01-15.zip',
    format: 'ZIP',
    size: '13.2 MB',
    createdAt: '2025-01-15 10:20',
    status: 'expired',
    retentionDays: 0
  },
  {
    id: '3',
    fileName: '任务数据_2025-01-10.csv',
    format: 'CSV',
    size: '89.4 KB',
    createdAt: '2025-01-10 14:45',
    status: 'failed',
    retentionDays: 0
  }
];

// 模拟Toast通知
const showToast = (title: string, description: string, type: 'success' | 'error' | 'warning' = 'success') => {
  console.log(`Toast [${type}]: ${title} - ${description}`);
  if (type === 'error') {
    alert(`错误: ${title}\n${description}`);
  } else if (type === 'warning') {
    alert(`警告: ${title}\n${description}`);
  } else {
    // 显示简单的成功提示
    const successMsg = document.createElement('div');
    successMsg.innerHTML = `✅ ${title}: ${description}`;
    successMsg.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #10b981; color: white; padding: 12px 16px; border-radius: 8px; z-index: 9999; font-size: 14px;';
    document.body.appendChild(successMsg);
    setTimeout(() => document.body.removeChild(successMsg), 3000);
  }
};

export default function ProfileDataExportPage() {
  const router = useRouter();
  const [items, setItems] = useState<ExportItem[]>(exportItems);
  const [selectedFormat, setSelectedFormat] = useState<string>('json');
  const [exportHistory] = useState<ExportHistory[]>(mockExportHistory);
  const [isExporting, setIsExporting] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [activeTab, setActiveTab] = useState<'select' | 'history'>('select');

  // 切换数据项选择
  const toggleItem = (itemId: string) => {
    setItems(prev => prev.map(item =>
      item.id === itemId ? { ...item, included: !item.included } : item
    ));
  };

  // 计算选中项的总大小
  const calculateTotalSize = () => {
    const selectedItems = items.filter(item => item.included);
    let totalBytes = 0;

    selectedItems.forEach(item => {
      const sizeStr = item.size;
      const sizeNum = parseFloat(sizeStr);
      if (sizeStr.includes('MB')) {
        totalBytes += sizeNum * 1024 * 1024;
      } else if (sizeStr.includes('KB')) {
        totalBytes += sizeNum * 1024;
      }
    });

    if (totalBytes > 1024 * 1024) {
      return `${(totalBytes / (1024 * 1024)).toFixed(1)} MB`;
    } else {
      return `${(totalBytes / 1024).toFixed(1)} KB`;
    }
  };

  // 获取分类图标
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'profile': return Shield;
      case 'activity': return Clock;
      case 'data': return Database;
      case 'documents': return FileText;
      case 'settings': return Info;
      default: return Info;
    }
  };

  // 获取分类名称
  const getCategoryName = (category: string) => {
    switch (category) {
      case 'profile': return '个人资料';
      case 'activity': return '活动记录';
      case 'data': return '业务数据';
      case 'documents': return '文档文件';
      case 'settings': return '设置配置';
      default: return '其他';
    }
  };

  // 开始导出
  const handleStartExport = () => {
    const selectedItems = items.filter(item => item.included);
    if (selectedItems.length === 0) {
      showToast('请选择要导出的数据', '至少选择一个数据项进行导出', 'warning');
      return;
    }

    const hasSensitiveData = selectedItems.some(item => item.sensitive);
    if (hasSensitiveData) {
      setShowConfirmDialog(true);
    } else {
      performExport();
    }
  };

  // 执行导出
  const performExport = async () => {
    setIsExporting(true);
    setShowConfirmDialog(false);

    try {
      // 模拟导出过程
      await new Promise(resolve => setTimeout(resolve, 3000));

      const selectedItems = items.filter(item => item.included);
      const selectedFormatData = exportFormats.find(f => f.id === selectedFormat);
      const totalSize = calculateTotalSize();

      // 创建模拟文件并下载
      const exportData = {
        exportInfo: {
          timestamp: new Date().toISOString(),
          format: selectedFormatData?.name,
          totalSize,
          itemCount: selectedItems.length
        },
        items: selectedItems.map(item => ({
          name: item.name,
          category: item.category,
          size: item.size,
          lastUpdated: item.lastUpdated,
          data: `[模拟数据] ${item.description}`
        }))
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json'
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `个人数据导出_${new Date().toISOString().split('T')[0]}${selectedFormatData?.extension}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast('导出成功', '数据已下载到本地，请妥善保管');
    } catch (error) {
      console.error('导出失败:', error);
      showToast('导出失败', '请稍后重试', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  // 下载历史文件
  const handleDownloadHistory = async (historyItem: ExportHistory) => {
    if (historyItem.status !== 'completed') {
      showToast('无法下载', '文件不可用', 'warning');
      return;
    }

    try {
      // 模拟下载
      showToast('开始下载', '正在准备下载文件...');
      await new Promise(resolve => setTimeout(resolve, 1500));
      showToast('下载完成', '文件已保存到本地');
    } catch {
      showToast('下载失败', '请稍后重试', 'error');
    }
  };

  const selectedItems = items.filter(item => item.included);
  const totalSize = calculateTotalSize();
  const categorizedItems = items.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, ExportItem[]>);

  return (
    <div className="flex flex-col min-h-screen max-w-[390px] mx-auto bg-gray-50">
      {/* 顶部导航 */}
      <div className="fixed top-0 left-0 right-0 z-[999] bg-[#1890FF] text-white shadow-sm">
        <div className="max-w-[390px] mx-auto px-4 h-[60px] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="p-1 hover:bg-white/20 rounded"
              aria-label="返回"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h1 className="text-lg font-medium">数据导出</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab(activeTab === 'select' ? 'history' : 'select')}
              className="p-2 hover:bg-white/20 rounded"
              aria-label="切换视图"
            >
              {activeTab === 'select' ? <Clock className="w-5 h-5" /> : <Download className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      <main className="flex-1 pt-[80px] pb-[120px]">
        {/* 标签切换 */}
        <div className="px-4 py-3 border-b bg-white">
          <div className="flex gap-1">
            <button
              onClick={() => setActiveTab('select')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'select'
                  ? 'bg-[#1890FF] text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              选择数据
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'history'
                  ? 'bg-[#1890FF] text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              导出历史
            </button>
          </div>
        </div>

        {activeTab === 'select' ? (
          <>
            {/* 导出格式选择 */}
            <Card className="mx-4 mt-4 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-[#1890FF]" />
                  导出格式
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  {exportFormats.map((format) => {
                    const IconComponent = format.icon;
                    return (
                      <button
                        key={format.id}
                        onClick={() => setSelectedFormat(format.id)}
                        className={`p-3 rounded-lg border text-left transition-all ${
                          selectedFormat === format.id
                            ? 'border-[#1890FF] bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <IconComponent className="w-4 h-4 text-gray-600" />
                          <span className="font-medium">{format.name}</span>
                          {format.recommended && (
                            <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-xs rounded">
                              推荐
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500">{format.description}</p>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* 数据选择 */}
            <Card className="mx-4 mt-4 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="w-5 h-5 text-[#1890FF]" />
                  选择数据
                  <span className="ml-auto text-sm font-normal text-gray-500">
                    已选 {selectedItems.length}/{items.length}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {Object.entries(categorizedItems).map(([category, categoryItems]) => {
                  const CategoryIcon = getCategoryIcon(category);
                  return (
                    <div key={category} className="mb-6 last:mb-0">
                      <div className="flex items-center gap-2 mb-3">
                        <CategoryIcon className="w-4 h-4 text-gray-600" />
                        <h4 className="font-medium text-gray-900">{getCategoryName(category)}</h4>
                      </div>
                      <div className="space-y-2">
                        {categoryItems.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg"
                          >
                            <button
                              onClick={() => toggleItem(item.id)}
                              className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                                item.included
                                  ? 'bg-[#1890FF] border-[#1890FF] text-white'
                                  : 'border-gray-300 hover:border-gray-400'
                              }`}
                            >
                              {item.included && <CheckCircle className="w-3 h-3" />}
                            </button>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h5 className="font-medium text-gray-900">{item.name}</h5>
                                {item.sensitive && (
                                  <AlertCircle className="w-4 h-4 text-orange-500" aria-label="敏感数据" />
                                )}
                              </div>
                              <p className="text-sm text-gray-600 mb-1">{item.description}</p>
                              <div className="flex items-center justify-between text-xs text-gray-500">
                                <span>大小: {item.size}</span>
                                <span>更新: {item.lastUpdated}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* 导出摘要 */}
            {selectedItems.length > 0 && (
              <Card className="mx-4 mt-4 shadow-sm border-[#1890FF]">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-gray-900">导出摘要</h4>
                    <span className="text-sm text-gray-600">总大小: {totalSize}</span>
                  </div>
                  <div className="text-sm text-gray-600 mb-3">
                    将导出 {selectedItems.length} 项数据，格式为 {exportFormats.find(f => f.id === selectedFormat)?.name}
                  </div>
                  {selectedItems.some(item => item.sensitive) && (
                    <div className="flex items-center gap-2 p-2 bg-orange-50 rounded text-orange-700 text-sm">
                      <AlertCircle className="w-4 h-4" />
                      包含敏感数据，请妥善保管导出文件
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </>
        ) : (
          /* 导出历史 */
          <Card className="mx-4 mt-4 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-[#1890FF]" />
                导出历史
              </CardTitle>
            </CardHeader>
            <CardContent>
              {exportHistory.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Archive className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>暂无导出历史</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {exportHistory.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex-1 min-w-0">
                        <h5 className="font-medium text-gray-900 truncate">{item.fileName}</h5>
                        <div className="flex items-center gap-4 text-xs text-gray-500 mt-1">
                          <span>{item.format}</span>
                          <span>{item.size}</span>
                          <span>{item.createdAt}</span>
                        </div>
                        {item.status === 'completed' && item.retentionDays > 0 && (
                          <p className="text-xs text-orange-600 mt-1">
                            {item.retentionDays} 天后过期
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {item.status === 'completed' ? (
                          <button
                            onClick={() => handleDownloadHistory(item)}
                            className="p-2 text-[#1890FF] hover:bg-blue-50 rounded"
                            aria-label="下载"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                        ) : (
                          <div className={`p-2 rounded ${
                            item.status === 'failed' ? 'text-red-500' : 'text-gray-400'
                          }`}>
                            {item.status === 'failed' ? (
                              <AlertCircle className="w-4 h-4" />
                            ) : (
                              <Clock className="w-4 h-4" />
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </main>

      {/* 底部操作按钮 - 仅在选择数据标签时显示 */}
      {activeTab === 'select' && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg">
          <div className="max-w-[390px] mx-auto p-4">
            <Button
              onClick={handleStartExport}
              disabled={selectedItems.length === 0 || isExporting}
              className="w-full flex items-center justify-center gap-2 bg-[#1890FF] hover:bg-[#1678d4]"
            >
              {isExporting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  正在导出...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  开始导出 ({selectedItems.length} 项)
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* 确认对话框 */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[9999]">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-orange-100 rounded-full">
                  <AlertCircle className="w-6 h-6 text-orange-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">敏感数据确认</h3>
              </div>
              <p className="text-gray-600 mb-6">
                您选择的数据中包含敏感信息（如活动记录、偏好设置等）。导出后请妥善保管文件，避免泄露个人隐私。
              </p>
              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  onClick={() => setShowConfirmDialog(false)}
                  className="flex-1"
                >
                  取消
                </Button>
                <Button
                  onClick={performExport}
                  className="flex-1 bg-[#1890FF] hover:bg-[#1678d4]"
                >
                  确认导出
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
