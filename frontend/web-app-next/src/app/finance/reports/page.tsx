'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Badge from '@/components/ui/badge';
import { Loading } from '@/components/ui/loading';

interface FinanceData {
  period: string;
  revenue: {
    sales: number;
    other: number;
    total: number;
  };
  costs: {
    materials: number;
    labor: number;
    overhead: number;
    total: number;
  };
  profit: {
    gross: number;
    net: number;
    margin: number;
  };
}

interface Transaction {
  id: string;
  date: string;
  type: 'income' | 'expense';
  category: string;
  description: string;
  amount: number;
  status: 'completed' | 'pending' | 'cancelled';
}

const mockFinanceData: FinanceData = {
  period: '2024年1月',
  revenue: {
    sales: 2850000,
    other: 125000,
    total: 2975000
  },
  costs: {
    materials: 1650000,
    labor: 320000,
    overhead: 180000,
    total: 2150000
  },
  profit: {
    gross: 825000,
    net: 687000,
    margin: 23.1
  }
};

const mockTransactions: Transaction[] = [
  {
    id: 'TXN001',
    date: '2024-02-02',
    type: 'income',
    category: '销售收入',
    description: '北京餐饮连锁有限公司订单',
    amount: 8960,
    status: 'completed'
  },
  {
    id: 'TXN002',
    date: '2024-02-02',
    type: 'expense',
    category: '原材料采购',
    description: '黑猪养殖专业合作社采购',
    amount: 28000,
    status: 'completed'
  },
  {
    id: 'TXN003',
    date: '2024-02-01',
    type: 'income',
    category: '销售收入',
    description: '上海美食广场订单',
    amount: 4580,
    status: 'completed'
  },
  {
    id: 'TXN004',
    date: '2024-02-01',
    type: 'expense',
    category: '物流运输',
    description: '冷链运输费用',
    amount: 1200,
    status: 'completed'
  },
  {
    id: 'TXN005',
    date: '2024-01-31',
    type: 'expense',
    category: '人工成本',
    description: '一月份员工工资',
    amount: 85000,
    status: 'pending'
  }
];

const getTypeColor = (type: Transaction['type']) => {
  return type === 'income' ? 'success' : 'error';
};

const getStatusColor = (status: Transaction['status']) => {
  switch (status) {
    case 'completed': return 'success';
    case 'pending': return 'warning';
    case 'cancelled': return 'error';
    default: return 'default';
  }
};

export default function FinanceReportsPage() {
  const [financeData, setFinanceData] = useState<FinanceData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setFinanceData(mockFinanceData);
      setTransactions(mockTransactions);
      setLoading(false);
    }, 800);

    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return (
      <div className="max-w-[390px] mx-auto p-4">
        <div className="text-center py-8">
          <Loading />
          <p className="text-gray-500 mt-2">加载财务数据...</p>
        </div>
      </div>
    );
  }

  if (!financeData) {
    return (
      <div className="max-w-[390px] mx-auto p-4">
        <div className="text-center py-8">
          <p className="text-gray-500">财务数据加载失败</p>
        </div>
      </div>
    );
  }

  const currentMonthIncome = transactions
    .filter(t => t.type === 'income' && t.status === 'completed')
    .reduce((sum, t) => sum + t.amount, 0);

  const currentMonthExpense = transactions
    .filter(t => t.type === 'expense' && t.status === 'completed')
    .reduce((sum, t) => sum + t.amount, 0);

  return (
    <div className="max-w-[390px] mx-auto p-4 space-y-4">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">财务报表</h1>
        <Button size="small">导出报表</Button>
      </div>

      {/* 报表期间 */}
      <Card className="p-4">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-gray-900">{financeData.period}</h2>
          <p className="text-sm text-gray-600">财务概览</p>
        </div>
      </Card>

      {/* 核心指标 */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="p-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              ¥{(financeData.revenue.total / 10000).toFixed(1)}万
            </div>
            <div className="text-sm text-gray-600">总收入</div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">
              ¥{(financeData.costs.total / 10000).toFixed(1)}万
            </div>
            <div className="text-sm text-gray-600">总支出</div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card className="p-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              ¥{(financeData.profit.net / 10000).toFixed(1)}万
            </div>
            <div className="text-sm text-gray-600">净利润</div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">
              {financeData.profit.margin.toFixed(1)}%
            </div>
            <div className="text-sm text-gray-600">利润率</div>
          </div>
        </Card>
      </div>

      {/* 收入明细 */}
      <Card className="p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">收入构成</h3>
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-gray-600">销售收入</span>
            <span className="font-semibold text-green-600">
              ¥{(financeData.revenue.sales / 10000).toFixed(1)}万
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600">其他收入</span>
            <span className="font-semibold text-green-600">
              ¥{(financeData.revenue.other / 10000).toFixed(1)}万
            </span>
          </div>
          <div className="border-t pt-2">
            <div className="flex justify-between items-center font-semibold">
              <span className="text-gray-900">总收入</span>
              <span className="text-green-600">
                ¥{(financeData.revenue.total / 10000).toFixed(1)}万
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* 成本明细 */}
      <Card className="p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">成本构成</h3>
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-gray-600">原材料成本</span>
            <span className="font-semibold text-red-600">
              ¥{(financeData.costs.materials / 10000).toFixed(1)}万
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600">人工成本</span>
            <span className="font-semibold text-red-600">
              ¥{(financeData.costs.labor / 10000).toFixed(1)}万
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600">管理费用</span>
            <span className="font-semibold text-red-600">
              ¥{(financeData.costs.overhead / 10000).toFixed(1)}万
            </span>
          </div>
          <div className="border-t pt-2">
            <div className="flex justify-between items-center font-semibold">
              <span className="text-gray-900">总成本</span>
              <span className="text-red-600">
                ¥{(financeData.costs.total / 10000).toFixed(1)}万
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* 本月流水 */}
      <Card className="p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">本月流水概览</h3>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="text-center">
            <div className="text-lg font-bold text-green-600">
              ¥{(currentMonthIncome / 10000).toFixed(2)}万
            </div>
            <div className="text-sm text-gray-600">收入</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-red-600">
              ¥{(currentMonthExpense / 10000).toFixed(2)}万
            </div>
            <div className="text-sm text-gray-600">支出</div>
          </div>
        </div>
        <div className="text-center pt-2 border-t">
          <div className="text-lg font-bold text-blue-600">
            ¥{((currentMonthIncome - currentMonthExpense) / 10000).toFixed(2)}万
          </div>
          <div className="text-sm text-gray-600">净额</div>
        </div>
      </Card>

      {/* 近期交易 */}
      <Card className="p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">近期交易</h3>
        <div className="space-y-3">
          {transactions.slice(0, 5).map(transaction => (
            <div key={transaction.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <Badge variant={getTypeColor(transaction.type)}>
                    {transaction.type === 'income' ? '收入' : '支出'}
                  </Badge>
                  <Badge variant={getStatusColor(transaction.status)}>
                    {transaction.status === 'completed' ? '已完成' :
                     transaction.status === 'pending' ? '待处理' : '已取消'}
                  </Badge>
                </div>
                <div className="text-sm font-medium text-gray-900 mt-1">
                  {transaction.description}
                </div>
                <div className="text-xs text-gray-600">
                  {transaction.category} • {transaction.date}
                </div>
              </div>
              <div className={`text-lg font-bold ${
                transaction.type === 'income' ? 'text-green-600' : 'text-red-600'
              }`}>
                {transaction.type === 'income' ? '+' : '-'}¥{transaction.amount.toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* 操作按钮 */}
      <div className="grid grid-cols-2 gap-4">
        <Button className="w-full">详细报表</Button>
        <Button variant="secondary" className="w-full">记账</Button>
      </div>
    </div>
  );
}
