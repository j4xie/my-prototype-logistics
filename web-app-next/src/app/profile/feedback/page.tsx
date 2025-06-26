'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  MessageSquare,
  ArrowLeft,
  Send,
  Star,
  Bug,
  Lightbulb,
  Heart,
  Settings,
  Upload,
  X,
  Clock,
  Tag
} from 'lucide-react';
import { useRouter } from 'next/navigation';

interface FeedbackType {
  id: string;
  name: string;
  description: string;
  icon: any;
  color: string;
}

interface FeedbackHistory {
  id: string;
  type: string;
  title: string;
  content: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'reviewing' | 'resolved' | 'rejected';
  submittedAt: string;
  updatedAt: string;
  response?: string;
  rating?: number;
}

interface AttachedFile {
  id: string;
  name: string;
  size: string;
  type: string;
}

// 反馈类型配置
const feedbackTypes: FeedbackType[] = [
  {
    id: 'bug',
    name: '错误报告',
    description: '报告系统功能异常或错误',
    icon: Bug,
    color: 'text-red-600 bg-red-50'
  },
  {
    id: 'feature',
    name: '功能建议',
    description: '建议新功能或改进现有功能',
    icon: Lightbulb,
    color: 'text-yellow-600 bg-yellow-50'
  },
  {
    id: 'usability',
    name: '易用性反馈',
    description: '用户体验和界面设计反馈',
    icon: Heart,
    color: 'text-pink-600 bg-pink-50'
  },
  {
    id: 'performance',
    name: '性能问题',
    description: '系统速度、响应时间等性能相关',
    icon: Settings,
    color: 'text-blue-600 bg-blue-50'
  },
  {
    id: 'general',
    name: '一般反馈',
    description: '其他类型的意见和建议',
    icon: MessageSquare,
    color: 'text-gray-600 bg-gray-50'
  }
];

// 模拟历史反馈数据
const mockFeedbackHistory: FeedbackHistory[] = [
  {
    id: '1',
    type: 'feature',
    title: '建议增加数据导出功能',
    content: '希望能够导出个人数据，方便备份和分析。建议支持多种格式如JSON、CSV等。',
    priority: 'medium',
    status: 'resolved',
    submittedAt: '2025-01-20 14:30',
    updatedAt: '2025-01-25 16:45',
    response: '感谢您的建议！数据导出功能已在最新版本中上线，您可以在个人资料页面找到此功能。',
    rating: 5
  },
  {
    id: '2',
    type: 'bug',
    title: '登录页面偶尔无法正常加载',
    content: '在使用Safari浏览器时，登录页面有时会显示空白，需要刷新几次才能正常显示。',
    priority: 'high',
    status: 'reviewing',
    submittedAt: '2025-01-28 09:15',
    updatedAt: '2025-01-28 09:15'
  },
  {
    id: '3',
    type: 'usability',
    title: '移动端操作体验可以优化',
    content: '在手机上使用时，某些按钮比较小，不太容易点击。建议增大按钮尺寸或增加点击区域。',
    priority: 'low',
    status: 'pending',
    submittedAt: '2025-02-01 11:20',
    updatedAt: '2025-02-01 11:20'
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

export default function ProfileFeedbackPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'submit' | 'history'>('submit');

  // 新反馈表单状态
  const [selectedType, setSelectedType] = useState<string>('');
  const [title, setTitle] = useState<string>('');
  const [content, setContent] = useState<string>('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 历史反馈状态
  const [feedbackHistory] = useState<FeedbackHistory[]>(mockFeedbackHistory);
  const [selectedHistory, setSelectedHistory] = useState<FeedbackHistory | null>(null);

  // 获取优先级样式
  const getPriorityStyle = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'text-red-700 bg-red-100';
      case 'high': return 'text-orange-700 bg-orange-100';
      case 'medium': return 'text-blue-700 bg-blue-100';
      case 'low': return 'text-gray-700 bg-gray-100';
      default: return 'text-gray-700 bg-gray-100';
    }
  };

  // 获取状态样式
  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'resolved': return 'text-green-700 bg-green-100';
      case 'reviewing': return 'text-blue-700 bg-blue-100';
      case 'pending': return 'text-yellow-700 bg-yellow-100';
      case 'rejected': return 'text-red-700 bg-red-100';
      default: return 'text-gray-700 bg-gray-100';
    }
  };

  // 获取状态文本
  const getStatusText = (status: string) => {
    switch (status) {
      case 'resolved': return '已解决';
      case 'reviewing': return '处理中';
      case 'pending': return '待处理';
      case 'rejected': return '已拒绝';
      default: return '未知';
    }
  };

  // 获取优先级文本
  const getPriorityText = (priority: string) => {
    switch (priority) {
      case 'urgent': return '紧急';
      case 'high': return '高';
      case 'medium': return '中';
      case 'low': return '低';
      default: return '中';
    }
  };

  // 处理文件上传
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      const newFiles: AttachedFile[] = Array.from(files).map((file, index) => ({
        id: `file-${Date.now()}-${index}`,
        name: file.name,
        size: `${(file.size / 1024).toFixed(1)}KB`,
        type: file.type
      }));
      setAttachedFiles(prev => [...prev, ...newFiles]);
    }
  };

  // 移除文件
  const removeFile = (fileId: string) => {
    setAttachedFiles(prev => prev.filter(file => file.id !== fileId));
  };

  // 提交反馈
  const handleSubmitFeedback = async () => {
    if (!selectedType || !title.trim() || !content.trim()) {
      showToast('提交失败', '请填写完整的反馈信息', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      // 模拟API调用
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 模拟成功率 (95%)
      if (Math.random() < 0.95) {
        showToast('反馈提交成功', '感谢您的反馈，我们会尽快处理', 'success');

        // 重置表单
        setSelectedType('');
        setTitle('');
        setContent('');
        setPriority('medium');
        setAttachedFiles([]);

        // 切换到历史记录标签
        setTimeout(() => setActiveTab('history'), 1000);
      } else {
        throw new Error('提交失败');
      }
    } catch (_error) {
      showToast('提交失败', '网络异常，请稍后重试', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 反馈评价
  const handleRateFeedback = async (_feedbackId: string, _rating: number) => {
    try {
      // 模拟评价过程
      await new Promise(resolve => setTimeout(resolve, 1000));
      showToast('评价成功', '感谢您的评价');
    } catch (_error) {
      showToast('评价失败', '请稍后重试', 'error');
    }
  };

  const pendingCount = feedbackHistory.filter(item => item.status === 'pending').length;
  const resolvedCount = feedbackHistory.filter(item => item.status === 'resolved').length;

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
            <h1 className="text-lg font-medium">用户反馈</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab(activeTab === 'submit' ? 'history' : 'submit')}
              className="p-2 hover:bg-white/20 rounded"
              aria-label="切换视图"
            >
              {activeTab === 'submit' ? <Clock className="w-5 h-5" /> : <MessageSquare className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      <main className="flex-1 pt-[80px] pb-[120px]">
        {/* 标签切换 */}
        <div className="px-4 py-3 border-b bg-white">
          <div className="flex gap-1">
            <button
              onClick={() => setActiveTab('submit')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'submit'
                  ? 'bg-[#1890FF] text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              提交反馈
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'history'
                  ? 'bg-[#1890FF] text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              历史记录 ({feedbackHistory.length})
            </button>
          </div>
        </div>

        {activeTab === 'submit' ? (
          <>
            {/* 反馈类型选择 */}
            <Card className="mx-4 mt-4 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Tag className="w-5 h-5 text-[#1890FF]" />
                  反馈类型
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-3">
                  {feedbackTypes.map((type) => {
                    const IconComponent = type.icon;
                    return (
                      <button
                        key={type.id}
                        onClick={() => setSelectedType(type.id)}
                        className={`p-3 rounded-lg border text-left transition-all ${
                          selectedType === type.id
                            ? 'border-[#1890FF] bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded ${type.color}`}>
                            <IconComponent className="w-4 h-4" />
                          </div>
                          <div>
                            <h4 className="font-medium text-gray-900">{type.name}</h4>
                            <p className="text-sm text-gray-600">{type.description}</p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* 反馈详情 */}
            <Card className="mx-4 mt-4 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-[#1890FF]" />
                  反馈详情
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* 标题 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    反馈标题 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="请简要概括您的问题或建议"
                    className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#1890FF] focus:border-transparent"
                    maxLength={100}
                  />
                  <div className="text-xs text-gray-500 mt-1">{title.length}/100</div>
                </div>

                {/* 优先级 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    优先级
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { value: 'low', label: '低' },
                      { value: 'medium', label: '中' },
                      { value: 'high', label: '高' },
                      { value: 'urgent', label: '紧急' }
                    ].map((item) => (
                      <button
                        key={item.value}
                        onClick={() => setPriority(item.value as any)}
                        className={`p-2 text-sm rounded-lg border transition-colors ${
                          priority === item.value
                            ? 'border-[#1890FF] bg-blue-50 text-[#1890FF]'
                            : 'border-gray-200 text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 详细描述 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    详细描述 <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="请详细描述您的问题、建议或意见，包括操作步骤、期望结果等信息"
                    rows={6}
                    className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#1890FF] focus:border-transparent resize-none"
                    maxLength={1000}
                  />
                  <div className="text-xs text-gray-500 mt-1">{content.length}/1000</div>
                </div>

                {/* 附件上传 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    附件 (可选)
                  </label>
                  <div className="border-2 border-dashed border-gray-200 rounded-lg p-4">
                    <input
                      type="file"
                      multiple
                      accept="image/*,.pdf,.doc,.docx,.txt"
                      onChange={handleFileUpload}
                      className="hidden"
                      id="file-upload"
                    />
                    <label
                      htmlFor="file-upload"
                      className="flex flex-col items-center justify-center cursor-pointer"
                    >
                      <Upload className="w-8 h-8 text-gray-400 mb-2" />
                      <span className="text-sm text-gray-600">点击上传文件</span>
                      <span className="text-xs text-gray-500 mt-1">
                        支持图片、PDF、Word、文本文件，单个文件不超过5MB
                      </span>
                    </label>
                  </div>

                  {/* 已上传文件列表 */}
                  {attachedFiles.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {attachedFiles.map((file) => (
                        <div
                          key={file.id}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-100 rounded">
                              <Upload className="w-4 h-4 text-blue-600" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">{file.name}</p>
                              <p className="text-xs text-gray-500">{file.size}</p>
                            </div>
                          </div>
                          <button
                            onClick={() => removeFile(file.id)}
                            className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                            aria-label={`删除文件 ${file.name}`}
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 提交按钮 */}
                <div className="pt-4">
                  <Button
                    onClick={handleSubmitFeedback}
                    disabled={isSubmitting || !selectedType || !title.trim() || !content.trim()}
                    className="w-full flex items-center justify-center gap-2 bg-[#1890FF] hover:bg-blue-600 disabled:bg-gray-300"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        提交中...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        提交反馈
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </>
        ) : (
          <>
            {/* 统计概览 */}
            <Card className="mx-4 mt-4 shadow-sm">
              <CardContent className="p-4">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-[#1890FF]">{feedbackHistory.length}</div>
                    <div className="text-xs text-gray-600">总计</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-yellow-600">{pendingCount}</div>
                    <div className="text-xs text-gray-600">待处理</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-600">{resolvedCount}</div>
                    <div className="text-xs text-gray-600">已解决</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 历史反馈列表 */}
            <div className="mx-4 mt-4 space-y-3">
              {feedbackHistory.map((feedback) => (
                <Card key={feedback.id} className="shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900 mb-1">{feedback.title}</h4>
                        <p className="text-sm text-gray-600 line-clamp-2">{feedback.content}</p>
                      </div>
                      <div className="flex flex-col items-end gap-2 ml-3">
                        <span className={`text-xs px-2 py-1 rounded-full ${getStatusStyle(feedback.status)}`}>
                          {getStatusText(feedback.status)}
                        </span>
                        <span className={`text-xs px-2 py-1 rounded-full ${getPriorityStyle(feedback.priority)}`}>
                          {getPriorityText(feedback.priority)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>{feedback.submittedAt}</span>
                      <button
                        onClick={() => setSelectedHistory(selectedHistory?.id === feedback.id ? null : feedback)}
                        className="text-[#1890FF] hover:underline"
                      >
                        {selectedHistory?.id === feedback.id ? '收起' : '查看详情'}
                      </button>
                    </div>

                    {/* 详情展开 */}
                    {selectedHistory?.id === feedback.id && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        {feedback.response && (
                          <div className="mb-4 p-3 bg-green-50 rounded-lg">
                            <h5 className="text-sm font-medium text-green-800 mb-1">官方回复</h5>
                            <p className="text-sm text-green-700">{feedback.response}</p>
                          </div>
                        )}

                        {feedback.status === 'resolved' && !feedback.rating && (
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-600">请为此次服务评分：</span>
                            <div className="flex gap-1">
                              {[1, 2, 3, 4, 5].map((rating) => (
                                <button
                                  key={rating}
                                  onClick={() => handleRateFeedback(feedback.id, rating)}
                                  className="p-1 hover:bg-yellow-50 rounded transition-colors"
                                  aria-label={`${rating}星评价`}
                                >
                                  <Star className="w-4 h-4 text-gray-300 hover:text-yellow-400" />
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {feedback.rating && (
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-600">您的评分：</span>
                            <div className="flex gap-1">
                              {[1, 2, 3, 4, 5].map((rating) => (
                                <Star
                                  key={rating}
                                  className={`w-4 h-4 ${
                                    rating <= feedback.rating! ? 'text-yellow-400' : 'text-gray-300'
                                  }`}
                                />
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}

              {feedbackHistory.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>暂无反馈记录</p>
                  <p className="text-sm">提交您的第一个反馈吧</p>
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
