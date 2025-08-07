'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Badge from '@/components/ui/badge';
import { Plus, Settings } from 'lucide-react';

/**
 * 套餐管理简化框架组件
 * 预留扩展空间的基础版本
 */
export default function PlansTable() {
  const [isPlanning, setIsPlanning] = useState(true);

  // 模拟套餐数据（用于展示框架）
  const mockPlans = [
    {
      name: '基础版',
      price: '¥299/月',
      features: ['最多20个用户', '10GB存储空间', '基础功能'],
      status: 'active'
    },
    {
      name: '专业版', 
      price: '¥599/月',
      features: ['最多50个用户', '50GB存储空间', '高级功能'],
      status: 'active'
    },
    {
      name: '企业版',
      price: '¥1299/月', 
      features: ['最多200个用户', '200GB存储空间', '企业级功能'],
      status: 'active'
    }
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="text-xl font-semibold">订阅套餐管理</CardTitle>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => setIsPlanning(!isPlanning)}
              className="flex items-center gap-2"
            >
              <Settings className="w-4 h-4" />
              {isPlanning ? '规划模式' : '管理模式'}
            </Button>
            
            <Button
              variant="primary"
              onClick={() => alert('新建套餐功能暂未实现，请等待后续版本')}
              className="flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              新建套餐
            </Button>
          </div>
        </div>

        <div className="text-sm text-gray-600">
          套餐管理系统框架版本 - 预留扩展空间
        </div>
      </CardHeader>

      <CardContent>
        {isPlanning ? (
          // 规划说明模式
          <div className="space-y-6">
            <div className="text-center py-8 bg-blue-50 rounded-lg border">
              <h3 className="text-lg font-medium text-blue-800 mb-4">订阅套餐系统规划</h3>
              <div className="text-sm text-blue-700 space-y-2 max-w-2xl mx-auto">
                <p>• 支持多层级套餐配置（基础版、专业版、企业版）</p>
                <p>• 灵活的功能权限控制和用户数量限制</p>
                <p>• 支持月付/年付订阅模式和优惠策略</p>
                <p>• 工厂升级/降级套餐的平滑过渡</p>
                <p>• 套餐使用情况统计和分析</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 border rounded-lg">
                <h4 className="font-medium text-gray-800 mb-2">套餐配置</h4>
                <p className="text-sm text-gray-600">价格、功能、限制等配置项</p>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <h4 className="font-medium text-gray-800 mb-2">订阅管理</h4>
                <p className="text-sm text-gray-600">工厂订阅状态和续费管理</p>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <h4 className="font-medium text-gray-800 mb-2">使用统计</h4>
                <p className="text-sm text-gray-600">套餐使用情况和收入分析</p>
              </div>
            </div>
          </div>
        ) : (
          // 简化的套餐列表展示
          <div className="space-y-4">
            <div className="text-sm text-gray-600 mb-4">
              当前框架展示 - 实际功能开发中
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {mockPlans.map((plan, index) => (
                <div key={index} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-3">
                    <h4 className="font-medium text-gray-800">{plan.name}</h4>
                    <Badge variant="success">
                      {plan.status === 'active' ? '启用' : '禁用'}
                    </Badge>
                  </div>
                  
                  <div className="text-lg font-semibold text-blue-600 mb-3">
                    {plan.price}
                  </div>
                  
                  <div className="space-y-1 mb-4">
                    {plan.features.map((feature, idx) => (
                      <div key={idx} className="text-sm text-gray-600">
                        • {feature}
                      </div>
                    ))}
                  </div>
                  
                  <div className="flex gap-2">
                    <Button 
                      variant="secondary" 
                      size="small"
                      onClick={() => alert('编辑功能暂未实现')}
                    >
                      编辑
                    </Button>
                    <Button 
                      variant="secondary" 
                      size="small"
                      onClick={() => alert('统计功能暂未实现')}
                    >
                      统计
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="text-center py-6 text-gray-500">
              <p className="mb-2">🚧 功能开发中</p>
              <p className="text-sm">完整的套餐管理功能将在后续版本中实现</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
