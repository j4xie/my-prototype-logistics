/**
 * @module MobileUIDemo
 * @description 食品溯源系统 - 移动端UI组件演示页面
 * @version 1.0.0
 * @author 食品溯源系统开发团队
 */

import React, { useState } from 'react';
import {
  PageLayout,
  Card,
  Button,
  Input,
  FluidContainer,
  Row,
  Column,
  StatCard
} from '../../components/ui';

/**
 * 移动端UI演示页面
 */
const MobileUIDemo = () => {
  const [activeTab, setActiveTab] = useState('home');
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    message: ''
  });

  // 底部标签栏配置
  const bottomTabs = [
    {
      key: 'home',
      label: '首页',
      icon: (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      )
    },
    {
      key: 'trace',
      label: '溯源',
      icon: (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      )
    },
    {
      key: 'profile',
      label: '我的',
      icon: (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      )
    }
  ];

  // 菜单项配置
  const menuItems = [
    {
      label: '设置',
      icon: (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      onClick: () => alert('设置功能')
    },
    {
      label: '帮助',
      icon: (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      onClick: () => alert('帮助功能')
    }
  ];

  const handleInputChange = (field) => (event) => {
    setFormData(prev => ({
      ...prev,
      [field]: event.target.value
    }));
  };

  const handleSubmit = () => {
    alert('表单提交: ' + JSON.stringify(formData, null, 2));
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'home':
        return (
          <PageLayout.Content>
            <FluidContainer>
              {/* 用户信息卡片 */}
              <Card className="mb-4">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-[#1890FF] rounded-full flex items-center justify-center">
                    <span className="text-white font-medium">张</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-medium text-gray-900">你好，张三</h3>
                    <p className="text-sm text-gray-600">早班</p>
                  </div>
                  <span className="rounded-full text-xs bg-[#E6F7FF] text-[#1890FF] px-2 py-0.5">
                    管理员
                  </span>
                </div>
              </Card>

              {/* 统计卡片 */}
              <Row className="mb-4">
                <Column span={6}>
                  <StatCard
                    title="今日处理"
                    value="128"
                    unit="件"
                    trend="+12%"
                    trendType="up"
                    icon="📦"
                  />
                </Column>
                <Column span={6}>
                  <StatCard
                    title="待处理"
                    value="23"
                    unit="件"
                    trend="-5%"
                    trendType="down"
                    icon="⏰"
                  />
                </Column>
              </Row>

              {/* 快速操作 */}
              <Card title="快速操作" className="mb-4">
                <Row>
                  <Column span={6}>
                    <Button
                      variant="primary"
                      className="w-full h-20 flex-col"
                      onClick={() => alert('扫码溯源')}
                    >
                      <span className="text-2xl mb-1">📱</span>
                      扫码溯源
                    </Button>
                  </Column>
                  <Column span={6}>
                    <Button
                      variant="success"
                      className="w-full h-20 flex-col"
                      onClick={() => alert('数据录入')}
                    >
                      <span className="text-2xl mb-1">📝</span>
                      数据录入
                    </Button>
                  </Column>
                </Row>
                <Row className="mt-4">
                  <Column span={6}>
                    <Button
                      variant="warning"
                      className="w-full h-20 flex-col"
                      onClick={() => alert('质量检测')}
                    >
                      <span className="text-2xl mb-1">🔍</span>
                      质量检测
                    </Button>
                  </Column>
                  <Column span={6}>
                    <Button
                      variant="secondary"
                      className="w-full h-20 flex-col"
                      onClick={() => alert('报告查看')}
                    >
                      <span className="text-2xl mb-1">📊</span>
                      报告查看
                    </Button>
                  </Column>
                </Row>
              </Card>
            </FluidContainer>
          </PageLayout.Content>
        );

      case 'trace':
        return (
          <PageLayout.Content>
            <FluidContainer>
              <Card title="溯源查询" className="mb-4">
                <div className="space-y-4">
                  <Input
                    label="产品编码"
                    placeholder="请输入产品编码"
                    value={formData.username}
                    onChange={handleInputChange('username')}
                  />
                  <Button variant="primary" className="w-full">
                    开始溯源
                  </Button>
                </div>
              </Card>

              <Card title="最近溯源记录">
                <div className="space-y-3">
                  {[1, 2, 3].map(item => (
                    <div key={item} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium">产品编码: SP{item.toString().padStart(6, '0')}</p>
                        <p className="text-sm text-gray-600">2025-05-19 14:30</p>
                      </div>
                      <Button size="sm" variant="secondary">
                        查看详情
                      </Button>
                    </div>
                  ))}
                </div>
              </Card>
            </FluidContainer>
          </PageLayout.Content>
        );

      case 'profile':
        return (
          <PageLayout.Content>
            <FluidContainer>
              <Card title="个人信息" className="mb-4">
                <div className="space-y-4">
                  <Input
                    label="用户名"
                    value={formData.username}
                    onChange={handleInputChange('username')}
                  />
                  <Input
                    label="邮箱"
                    type="email"
                    value={formData.email}
                    onChange={handleInputChange('email')}
                  />
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      备注信息
                    </label>
                    <textarea
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1890FF] focus:border-[#1890FF]"
                      rows={4}
                      placeholder="请输入备注信息"
                      value={formData.message}
                      onChange={handleInputChange('message')}
                    />
                  </div>
                  <Button variant="primary" className="w-full" onClick={handleSubmit}>
                    保存信息
                  </Button>
                </div>
              </Card>
            </FluidContainer>
          </PageLayout.Content>
        );

      default:
        return null;
    }
  };

  return (
    <PageLayout
      title="移动端UI演示"
      showBack={true}
      rightContent={
        <button className="p-1 rounded-md hover:bg-[#40A9FF] transition-colors">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5zM4 19h10a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </button>
      }
      menuItems={menuItems}
      bottomTabs={bottomTabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
    >
      {renderContent()}
    </PageLayout>
  );
};

export default MobileUIDemo; 