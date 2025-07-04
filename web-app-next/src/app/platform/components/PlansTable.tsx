'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Badge from '@/components/ui/badge';
import { Table, TableColumn } from '@/components/ui/table';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { platformApi } from '@/lib/api/platform';
import type { SubscriptionPlanInfo } from '@/mocks/data/platform-data';

/**
 * 套餐管理表格组件
 * 显示所有订阅套餐信息和管理操作
 */
export default function PlansTable() {
  const [plans, setPlans] = useState<SubscriptionPlanInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 获取套餐列表
  const fetchPlans = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await platformApi.subscription.getPlans();
      setPlans(response.data || []);
    } catch (err) {
      console.error('获取套餐列表失败:', err);
      setError(err instanceof Error ? err.message : '获取数据失败');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  // 格式化价格
  const formatPrice = (monthly: number, yearly: number) => {
    if (monthly === 0) return '免费';
    return `¥${monthly}/月 | ¥${yearly}/年`;
  };

  // 获取状态显示
  const getStatusBadge = (isActive: boolean) => {
    return isActive ? (
      <Badge variant="success">启用</Badge>
    ) : (
      <Badge variant="default">禁用</Badge>
    );
  };

  // 表格列定义
  const columns: TableColumn<SubscriptionPlanInfo>[] = [
    {
      key: 'display_name',
      title: '套餐名称',
      width: '150px',
      sortable: true,
      render: (value) => <span className="font-medium">{value}</span>
    },
    {
      key: 'price_monthly',
      title: '价格',
      width: '180px',
      render: (_, record) => formatPrice(record.price_monthly, record.price_yearly)
    },
    {
      key: 'max_users',
      title: '用户上限',
      width: '100px',
      align: 'center',
      sortable: true
    },
    {
      key: 'max_storage_gb',
      title: '存储空间',
      width: '120px',
      align: 'center',
      sortable: true,
      render: (value) => `${value} GB`
    },
    {
      key: 'features',
      title: '特性',
      width: '300px',
      render: (features: string[]) => (
        <div className="space-y-1">
          {features.slice(0, 3).map((feature, index) => (
            <div key={index} className="text-sm text-gray-600">
              • {feature}
            </div>
          ))}
          {features.length > 3 && (
            <div className="text-xs text-gray-400">
              +{features.length - 3} 更多特性
            </div>
          )}
        </div>
      )
    },
    {
      key: 'is_active',
      title: '状态',
      width: '80px',
      align: 'center',
      render: (value) => getStatusBadge(value as boolean)
    },
    {
      key: 'actions',
      title: '操作',
      width: '100px',
      align: 'center',
      render: (_, record) => (
        <div className="flex justify-center items-center gap-1">
          <Button
            variant="ghost"
            size="small"
            className="h-8 w-8 p-0"
            title="编辑套餐"
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="small"
            className="h-8 w-8 p-0"
            title="删除套餐"
          >
            <Trash2 className="h-4 w-4 text-red-600" />
          </Button>
        </div>
      )
    }
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="text-xl font-semibold">套餐管理</CardTitle>

          <Button
            variant="primary"
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            新建套餐
          </Button>
        </div>

        <div className="text-sm text-gray-600">
          共 {plans.length} 个套餐
        </div>
      </CardHeader>

      <CardContent>
        {error ? (
          // 错误状态
          <div className="text-center py-8">
            <p className="text-red-600">⚠️ {error}</p>
            <Button
              variant="secondary"
              onClick={fetchPlans}
              className="mt-4"
            >
              重试
            </Button>
          </div>
        ) : (
          // 表格内容
          <Table
            columns={columns}
            data={plans}
            loading={isLoading}
            emptyText="暂无套餐数据"
            hoverable={true}
            striped={true}
            responsive={true}
            size="md"
          />
        )}
      </CardContent>
    </Card>
  );
}
