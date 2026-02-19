import { apiClient } from './apiClient';
import { getCurrentFactoryId } from '../../utils/factoryIdHelper';

/**
 * 应收应付管理API客户端
 * 路径：/api/mobile/{factoryId}/finance/*
 */

// ========== 类型定义 ==========

export interface FinanceOverview {
  totalReceivable: number;
  totalPayable: number;
  receivableCount: number;
  payableCount: number;
  overdueAmount: number;
  overdueCount: number;
}

export interface ArApTransaction {
  id: string;
  factoryId: string;
  transactionNumber: string;
  counterpartyType: 'CUSTOMER' | 'SUPPLIER';
  counterpartyId: string;
  counterpartyName?: string;
  transactionType: 'AR_INVOICE' | 'AR_PAYMENT' | 'AR_ADJUSTMENT' | 'AP_INVOICE' | 'AP_PAYMENT' | 'AP_ADJUSTMENT';
  amount: number;
  balanceAfter: number;
  paymentMethod?: string;
  transactionDate: string;
  dueDate?: string;
  remark?: string;
  createdAt: string;
}

export interface AgingData {
  counterpartyId: string;
  counterpartyName: string;
  counterpartyType: string;
  totalBalance: number;
  current: number;
  days1to30: number;
  days31to60: number;
  days61to90: number;
  days91to180: number;
  over180: number;
}

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

// ========== API客户端类 ==========

class FinanceApiClient {
  private getPath(factoryId?: string) {
    const currentFactoryId = getCurrentFactoryId(factoryId);
    if (!currentFactoryId) {
      throw new Error('factoryId 是必需的，请先登录或提供 factoryId 参数');
    }
    return `/api/mobile/${currentFactoryId}/finance`;
  }

  /** 获取财务概览 */
  async getOverview(factoryId?: string): Promise<{ success: boolean; data: FinanceOverview }> {
    return apiClient.get(this.getPath(factoryId) + '/overview');
  }

  /** 获取交易记录 */
  async getTransactions(params?: { page?: number; size?: number; counterpartyType?: string }, factoryId?: string): Promise<{ success: boolean; data: PageResponse<ArApTransaction> }> {
    return apiClient.get(this.getPath(factoryId) + '/transactions', { params });
  }

  /** 获取账龄分析 */
  async getAging(counterpartyType: 'CUSTOMER' | 'SUPPLIER', factoryId?: string): Promise<{ success: boolean; data: AgingData[] }> {
    return apiClient.get(this.getPath(factoryId) + '/aging', { params: { counterpartyType } });
  }
}

export const financeApiClient = new FinanceApiClient();
