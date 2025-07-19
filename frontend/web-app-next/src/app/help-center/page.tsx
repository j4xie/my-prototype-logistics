'use client';

import { useState } from 'react';
import {
  Card,
  Button,
  PageLayout,
  Input,
  Badge
} from '@/components/ui';

interface FAQ {
  id: string;
  category: string;
  question: string;
  answer: string;
  tags: string[];
  helpful: number;
}

interface Guide {
  id: string;
  title: string;
  description: string;
  category: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  duration: string;
  icon: string;
  steps: string[];
}

export default function HelpCenterPage() {
  const [activeTab, setActiveTab] = useState('faq'); // faq, guides, contact
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [expandedFAQ, setExpandedFAQ] = useState<string | null>(null);
  const [selectedGuide, setSelectedGuide] = useState<Guide | null>(null);

  const categories = [
    { id: 'all', name: '全部', icon: '📋' },
    { id: 'account', name: '账户管理', icon: '👤' },
    { id: 'farming', name: '养殖管理', icon: '🐷' },
    { id: 'trace', name: '溯源查询', icon: '🔍' },
    { id: 'logistics', name: '物流配送', icon: '🚚' },
    { id: 'processing', name: '生产加工', icon: '🏭' },
    { id: 'system', name: '系统问题', icon: '⚙️' }
  ];

  const faqs: FAQ[] = [
    {
      id: 'faq1',
      category: 'account',
      question: '如何重置密码？',
      answer: '1. 在登录页面点击"忘记密码"\n2. 输入您的邮箱地址\n3. 查收邮件并点击重置链接\n4. 设置新密码并确认\n5. 使用新密码登录系统',
      tags: ['密码', '登录', '账户'],
      helpful: 45
    },
    {
      id: 'faq2',
      category: 'farming',
      question: '如何添加新的养殖动物？',
      answer: '1. 进入养殖管理模块\n2. 点击"添加动物"按钮\n3. 填写动物基本信息（耳标号、品种、出生日期等）\n4. 选择养殖场地和负责人\n5. 确认信息并保存\n6. 系统将自动生成动物档案',
      tags: ['动物', '养殖', '档案'],
      helpful: 32
    },
    {
      id: 'faq3',
      category: 'trace',
      question: '溯源码在哪里可以找到？',
      answer: '溯源码通常位于产品包装上的二维码或条形码旁边。每个产品都有唯一的溯源码，可以通过以下方式查询：\n1. 扫描产品包装上的二维码\n2. 手动输入包装上的溯源码\n3. 在溯源查询页面搜索产品信息',
      tags: ['溯源码', '查询', '包装'],
      helpful: 67
    },
    {
      id: 'faq4',
      category: 'logistics',
      question: '如何跟踪配送状态？',
      answer: '1. 进入物流管理模块\n2. 在运输订单中找到您的订单\n3. 点击订单号查看详细信息\n4. 查看实时配送状态和位置\n5. 也可以在配送跟踪页面输入订单号查询',
      tags: ['配送', '跟踪', '订单'],
      helpful: 28
    },
    {
      id: 'faq5',
      category: 'processing',
      question: '质检报告如何生成？',
      answer: '1. 完成产品质量检测\n2. 进入质检报告管理页面\n3. 点击"新建报告"按钮\n4. 填写检测结果和相关数据\n5. 上传检测证书和图片\n6. 提交审核并等待批准',
      tags: ['质检', '报告', '审核'],
      helpful: 19
    },
    {
      id: 'faq6',
      category: 'system',
      question: '页面加载很慢怎么办？',
      answer: '可以尝试以下解决方案：\n1. 检查网络连接是否稳定\n2. 清除浏览器缓存和Cookie\n3. 关闭其他占用网络的应用\n4. 重启浏览器或设备\n5. 如果问题持续，请联系技术支持',
      tags: ['性能', '网络', '故障'],
      helpful: 15
    }
  ];

  const guides: Guide[] = [
    {
      id: 'guide1',
      title: '新用户快速入门',
      description: '帮助新用户快速了解系统功能和基本操作',
      category: 'account',
      difficulty: 'beginner',
      duration: '10分钟',
      icon: '🚀',
      steps: [
        '注册并验证账户',
        '完善个人资料信息',
        '了解主要功能模块',
        '设置系统偏好',
        '开始使用核心功能'
      ]
    },
    {
      id: 'guide2',
      title: '创建溯源记录',
      description: '详细介绍如何为产品创建完整的溯源记录',
      category: 'farming',
      difficulty: 'intermediate',
      duration: '20分钟',
      icon: '📝',
      steps: [
        '选择要创建溯源的动物',
        '填写养殖过程信息',
        '记录饲料和药物使用',
        '上传相关照片和证书',
        '设置质量检测节点',
        '生成溯源二维码'
      ]
    },
    {
      id: 'guide3',
      title: '疫苗接种管理',
      description: '学习如何管理动物疫苗接种记录和计划',
      category: 'farming',
      difficulty: 'intermediate',
      duration: '15分钟',
      icon: '💉',
      steps: [
        '查看疫苗库存状态',
        '制定疫苗接种计划',
        '记录疫苗接种信息',
        '监控接种后反应',
        '设置下次接种提醒'
      ]
    },
    {
      id: 'guide4',
      title: '配送订单处理',
      description: '物流人员如何高效处理配送订单',
      category: 'logistics',
      difficulty: 'advanced',
      duration: '25分钟',
      icon: '📦',
      steps: [
        '接收新配送订单',
        '分配合适的司机和车辆',
        '规划最优配送路线',
        '实时跟踪配送进度',
        '处理异常情况',
        '完成订单确认'
      ]
    }
  ];

  const filteredFAQs = faqs.filter(faq => {
    const matchesSearch = faq.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         faq.answer.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         faq.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = selectedCategory === 'all' || faq.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const filteredGuides = guides.filter(guide => {
    const matchesSearch = guide.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         guide.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || guide.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner':
        return 'bg-green-100 text-green-800';
      case 'intermediate':
        return 'bg-yellow-100 text-yellow-800';
      case 'advanced':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getDifficultyText = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner':
        return '入门';
      case 'intermediate':
        return '中级';
      case 'advanced':
        return '高级';
      default:
        return '未知';
    }
  };

  if (selectedGuide) {
    return (
      <PageLayout
        title="操作指南"
        className="flex flex-col min-h-screen max-w-[390px] mx-auto bg-gray-50"
      >
        <main className="flex-1 pt-[80px] pb-[20px] px-4">
          <Card className="bg-white rounded-lg shadow-sm p-4 mb-4">
            <div className="flex items-center space-x-3 mb-4">
              <span className="text-3xl">{selectedGuide.icon}</span>
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-gray-900">{selectedGuide.title}</h2>
                <p className="text-sm text-gray-600">{selectedGuide.description}</p>
              </div>
            </div>

            <div className="flex items-center space-x-4 mb-4">
              <Badge className={getDifficultyColor(selectedGuide.difficulty)}>
                {getDifficultyText(selectedGuide.difficulty)}
              </Badge>
              <span className="text-sm text-gray-600">⏱️ {selectedGuide.duration}</span>
            </div>
          </Card>

          <Card className="bg-white rounded-lg shadow-sm p-4">
            <h3 className="text-md font-semibold text-gray-900 mb-4">操作步骤</h3>
            <div className="space-y-3">
              {selectedGuide.steps.map((step, index) => (
                <div key={index} className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-medium">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <p className="text-gray-700">{step}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </main>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title="帮助中心"
      className="flex flex-col min-h-screen max-w-[390px] mx-auto bg-gray-50"
    >
      <main className="flex-1 pt-[80px] pb-[20px] px-4">
        {/* 搜索框 */}
        <Card className="bg-white rounded-lg shadow-sm p-4 mb-4">
          <Input
            label="搜索问题"
            placeholder="请输入您要查找的问题..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </Card>

        {/* 分类选择 */}
        <div className="mb-4">
          <div className="flex overflow-x-auto pb-2 space-x-2">
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  selectedCategory === category.id
                    ? 'bg-blue-500 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                <span>{category.icon}</span>
                <span>{category.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 标签页 */}
        <div className="mb-4">
          <div className="flex bg-white rounded-lg shadow-sm overflow-hidden">
            <button
              onClick={() => setActiveTab('faq')}
              className={`flex-1 py-3 px-4 text-sm font-medium ${
                activeTab === 'faq'
                  ? 'bg-blue-500 text-white'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              常见问题
            </button>
            <button
              onClick={() => setActiveTab('guides')}
              className={`flex-1 py-3 px-4 text-sm font-medium ${
                activeTab === 'guides'
                  ? 'bg-blue-500 text-white'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              操作指南
            </button>
            <button
              onClick={() => setActiveTab('contact')}
              className={`flex-1 py-3 px-4 text-sm font-medium ${
                activeTab === 'contact'
                  ? 'bg-blue-500 text-white'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              联系我们
            </button>
          </div>
        </div>

        {/* 常见问题 */}
        {activeTab === 'faq' && (
          <div className="space-y-3">
            <h3 className="text-md font-semibold text-gray-800">
              常见问题 ({filteredFAQs.length})
            </h3>

            {filteredFAQs.length === 0 ? (
              <Card className="bg-white rounded-lg shadow-sm p-8 text-center">
                <p className="text-gray-500 mb-4">没有找到相关问题</p>
                <Button
                  onClick={() => {
                    setSearchTerm('');
                    setSelectedCategory('all');
                  }}
                  variant="secondary"
                >
                  清除搜索
                </Button>
              </Card>
            ) : (
              filteredFAQs.map((faq) => (
                <Card
                  key={faq.id}
                  className="bg-white rounded-lg shadow-sm p-4 cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => setExpandedFAQ(expandedFAQ === faq.id ? null : faq.id)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-gray-900 flex-1">{faq.question}</h4>
                    <span className="text-gray-400 ml-2">
                      {expandedFAQ === faq.id ? '−' : '+'}
                    </span>
                  </div>

                  {expandedFAQ === faq.id && (
                    <>
                      <div className="text-sm text-gray-700 mb-3 whitespace-pre-line">
                        {faq.answer}
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex flex-wrap gap-1">
                          {faq.tags.map((tag, index) => (
                            <span
                              key={index}
                              className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                        <span className="text-xs text-gray-500">👍 {faq.helpful}</span>
                      </div>
                    </>
                  )}
                </Card>
              ))
            )}
          </div>
        )}

        {/* 操作指南 */}
        {activeTab === 'guides' && (
          <div className="space-y-3">
            <h3 className="text-md font-semibold text-gray-800">
              操作指南 ({filteredGuides.length})
            </h3>

            {filteredGuides.length === 0 ? (
              <Card className="bg-white rounded-lg shadow-sm p-8 text-center">
                <p className="text-gray-500 mb-4">没有找到相关指南</p>
                <Button
                  onClick={() => {
                    setSearchTerm('');
                    setSelectedCategory('all');
                  }}
                  variant="secondary"
                >
                  清除搜索
                </Button>
              </Card>
            ) : (
              filteredGuides.map((guide) => (
                <Card
                  key={guide.id}
                  className="bg-white rounded-lg shadow-sm p-4 cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => setSelectedGuide(guide)}
                >
                  <div className="flex items-center space-x-3 mb-3">
                    <span className="text-2xl">{guide.icon}</span>
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{guide.title}</h4>
                      <p className="text-sm text-gray-600">{guide.description}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-4">
                    <Badge className={getDifficultyColor(guide.difficulty)}>
                      {getDifficultyText(guide.difficulty)}
                    </Badge>
                    <span className="text-sm text-gray-600">⏱️ {guide.duration}</span>
                    <span className="text-gray-400 ml-auto">→</span>
                  </div>
                </Card>
              ))
            )}
          </div>
        )}

        {/* 联系我们 */}
        {activeTab === 'contact' && (
          <div className="space-y-4">
            <h3 className="text-md font-semibold text-gray-800 mb-4">联系我们</h3>

            <Card className="bg-white rounded-lg shadow-sm p-4">
              <div className="flex items-center space-x-3 mb-3">
                <span className="text-2xl">📞</span>
                <div>
                  <h4 className="font-medium text-gray-900">客服热线</h4>
                  <p className="text-sm text-gray-600">400-888-0000</p>
                  <p className="text-xs text-gray-500">工作日 9:00-18:00</p>
                </div>
              </div>
            </Card>

            <Card className="bg-white rounded-lg shadow-sm p-4">
              <div className="flex items-center space-x-3 mb-3">
                <span className="text-2xl">📧</span>
                <div>
                  <h4 className="font-medium text-gray-900">邮箱支持</h4>
                  <p className="text-sm text-gray-600">support@example.com</p>
                  <p className="text-xs text-gray-500">24小时内回复</p>
                </div>
              </div>
            </Card>

            <Card className="bg-white rounded-lg shadow-sm p-4">
              <div className="flex items-center space-x-3 mb-3">
                <span className="text-2xl">💬</span>
                <div>
                  <h4 className="font-medium text-gray-900">在线客服</h4>
                  <p className="text-sm text-gray-600">实时在线咨询</p>
                  <p className="text-xs text-gray-500">工作日 9:00-22:00</p>
                </div>
              </div>
              <Button
                onClick={() => alert('即将跳转到在线客服')}
                variant="primary"
                className="w-full mt-3"
              >
                开始对话
              </Button>
            </Card>

            <Card className="bg-blue-50 border-blue-200 p-4">
              <div className="flex items-center space-x-3">
                <span className="text-2xl">📱</span>
                <div>
                  <h4 className="font-medium text-blue-800">微信群</h4>
                  <p className="text-sm text-blue-700">扫码加入用户交流群</p>
                  <p className="text-xs text-blue-600">与其他用户分享经验</p>
                </div>
              </div>
            </Card>
          </div>
        )}
      </main>
    </PageLayout>
  );
}
