'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, Button, Badge, Loading } from '@/components/ui';

// 农业指标数据接口
interface IndicatorData {
  id: string;
  name: string;
  type: string;
  category: string;
  value: number;
  unit: string;
  status: 'normal' | 'warning' | 'danger';
  trend: 'up' | 'down' | 'stable';
  lastUpdate: string;
  description: string;
  threshold: {
    min: number;
    max: number;
    optimal: number;
  };
  history: Array<{
    date: string;
    value: number;
    note?: string;
  }>;
}

// Mock 数据
const mockIndicatorData: IndicatorData = {
  id: '1',
  name: '土壤pH值',
  type: '环境指标',
  category: '土壤质量',
  value: 6.8,
  unit: 'pH',
  status: 'normal',
  trend: 'stable',
  lastUpdate: '2025-02-02 15:30',
  description: '土壤酸碱度是影响作物生长的重要因素，需要保持在适宜范围内',
  threshold: {
    min: 6.0,
    max: 7.5,
    optimal: 6.8
  },
  history: [
    { date: '2025-01-30', value: 6.7, note: '雨后检测' },
    { date: '2025-01-29', value: 6.8 },
    { date: '2025-01-28', value: 6.9 },
    { date: '2025-01-27', value: 6.7 },
    { date: '2025-01-26', value: 6.8 },
    { date: '2025-01-25', value: 6.6, note: '施肥后' },
    { date: '2025-01-24', value: 6.9 }
  ]
};

export default function IndicatorDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [indicator, setIndicator] = useState<IndicatorData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchIndicator = async () => {
      setIsLoading(true);
      try {
        await new Promise(resolve => setTimeout(resolve, 1000));
        setIndicator(mockIndicatorData);
      } catch (error) {
        console.error('获取指标详情失败:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchIndicator();
  }, [params.id]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'normal': return 'text-green-600 bg-green-50';
      case 'warning': return 'text-yellow-600 bg-yellow-50';
      case 'danger': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'normal': return '正常';
      case 'warning': return '预警';
      case 'danger': return '异常';
      default: return '未知';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loading text="加载指标详情..." />
      </div>
    );
  }

  if (!indicator) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">指标数据不存在</p>
          <Button onClick={() => router.back()}>返回</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[390px] mx-auto bg-white min-h-screen">
        {/* 头部 */}
        <div className="bg-white border-b border-gray-100 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Button
                variant="ghost"
                size="small"
                onClick={() => router.back()}
                className="p-1"
              >
                ←
              </Button>
              <h1 className="text-lg font-semibold text-gray-900">指标详情</h1>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* 基本信息卡片 */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xl font-bold text-gray-900">{indicator.name}</h2>
              <Badge className={getStatusColor(indicator.status)}>
                {getStatusText(indicator.status)}
              </Badge>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">当前值</span>
                <div className="flex items-center space-x-1">
                  <span className="text-2xl font-bold text-blue-600">
                    {indicator.value}
                  </span>
                  <span className="text-gray-500">{indicator.unit}</span>
                </div>
              </div>

              <div className="flex justify-between">
                <span className="text-gray-600">类型</span>
                <span className="text-gray-900">{indicator.type}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-gray-600">分类</span>
                <span className="text-gray-900">{indicator.category}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-gray-600">更新时间</span>
                <span className="text-gray-500 text-sm">{indicator.lastUpdate}</span>
              </div>
            </div>
          </Card>

          {/* 阈值设置 */}
          <Card className="p-4">
            <h3 className="font-semibold text-gray-900 mb-3">阈值设置</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">最小值</span>
                <span className="text-red-600">{indicator.threshold.min} {indicator.unit}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">最大值</span>
                <span className="text-red-600">{indicator.threshold.max} {indicator.unit}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">最适值</span>
                <span className="text-green-600">{indicator.threshold.optimal} {indicator.unit}</span>
              </div>
            </div>
          </Card>

          {/* 历史数据 */}
          <Card className="p-4">
            <h3 className="font-semibold text-gray-900 mb-3">历史趋势</h3>
            <div className="space-y-2">
              {indicator.history.slice(0, 5).map((record, index) => (
                <div key={index} className="flex justify-between items-center py-1">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600">{record.date}</span>
                    {record.note && (
                      <Badge variant="default" className="text-xs">
                        {record.note}
                      </Badge>
                    )}
                  </div>
                  <span className="text-sm font-medium text-gray-900">
                    {record.value} {indicator.unit}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          {/* 操作按钮 */}
          <div className="flex space-x-3 pt-2">
            <Button className="flex-1">
              记录数据
            </Button>
            <Button variant="secondary" className="flex-1">
              生成报告
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
