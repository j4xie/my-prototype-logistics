import { apiClient } from './apiClient';
import { getCurrentFactoryId } from '../../utils/factoryIdHelper';

/**
 * 应收应付管理API客户端
 * 路径：/api/mobile/{factoryId}/finance/*
 * 对应后端：ArApController.java (11 endpoints)
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
  transactionType:
    | 'AR_INVOICE'
    | 'AR_PAYMENT'
    | 'AR_ADJUSTMENT'
    | 'AP_INVOICE'
    | 'AP_PAYMENT'
    | 'AP_ADJUSTMENT';
  amount: number;
  balanceAfter: number;
  paymentMethod?: string;
  paymentReference?: string;
  orderId?: string;
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

export interface StatementData {
  counterpartyId: string;
  counterpartyName: string;
  startDate: string;
  endDate: string;
  openingBalance: number;
  closingBalance: number;
  transactions: ArApTransaction[];
}

export interface CreditCheckResult {
  customerId: string;
  requestedAmount: number;
  withinCreditLimit: boolean;
}

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

export type CounterpartyType = 'CUSTOMER' | 'SUPPLIER';
export type PaymentMethod =
  | 'CASH'
  | 'BANK_TRANSFER'
  | 'WECHAT'
  | 'ALIPAY'
  | 'CHECK'
  | 'CREDIT'
  | 'POS'
  | 'OTHER';

export interface RecordTransactionRequest {
  counterpartyId: string;
  orderId?: string;
  amount: number;
  dueDate?: string;
  paymentMethod?: PaymentMethod;
  paymentReference?: string;
  remark?: string;
}

// ========== API客户端类 ==========

class FinanceApiClient {
  private getPath(factoryId?: string): string {
    const currentFactoryId = getCurrentFactoryId(factoryId);
    if (!currentFactoryId) {
      throw new Error('factoryId 是必需的，请先登录或提供 factoryId 参数');
    }
    return `/api/mobile/${currentFactoryId}/finance`;
  }

  // ==================== 写操作 ====================

  /**
   * 1. 记录应收挂账（销售出货）
   * POST /{factoryId}/finance/receivable
   */
  async recordReceivable(
    request: RecordTransactionRequest,
    factoryId?: string
  ): Promise<{ success: boolean; data: ArApTransaction; message: string }> {
    return apiClient.post(this.getPath(factoryId) + '/receivable', request);
  }

  /**
   * 2. 记录客户付款（冲减应收）
   * POST /{factoryId}/finance/receivable/payment
   */
  async recordArPayment(
    request: RecordTransactionRequest,
    factoryId?: string
  ): Promise<{ success: boolean; data: ArApTransaction; message: string }> {
    return apiClient.post(this.getPath(factoryId) + '/receivable/payment', request);
  }

  /**
   * 3. 记录应付挂账（采购入库）
   * POST /{factoryId}/finance/payable
   */
  async recordPayable(
    request: RecordTransactionRequest,
    factoryId?: string
  ): Promise<{ success: boolean; data: ArApTransaction; message: string }> {
    return apiClient.post(this.getPath(factoryId) + '/payable', request);
  }

  /**
   * 4. 记录向供应商付款（冲减应付）
   * POST /{factoryId}/finance/payable/payment
   */
  async recordApPayment(
    request: RecordTransactionRequest,
    factoryId?: string
  ): Promise<{ success: boolean; data: ArApTransaction; message: string }> {
    return apiClient.post(this.getPath(factoryId) + '/payable/payment', request);
  }

  /**
   * 5. 手工调整余额
   * POST /{factoryId}/finance/adjustment?counterpartyType=CUSTOMER|SUPPLIER
   */
  async recordAdjustment(
    counterpartyType: CounterpartyType,
    request: RecordTransactionRequest,
    factoryId?: string
  ): Promise<{ success: boolean; data: ArApTransaction; message: string }> {
    return apiClient.post(this.getPath(factoryId) + '/adjustment', request, {
      params: { counterpartyType },
    });
  }

  // ==================== 查询操作 ====================

  /**
   * 6. 获取财务概览（应收应付汇总）
   * GET /{factoryId}/finance/overview
   */
  async getOverview(
    factoryId?: string
  ): Promise<{ success: boolean; data: FinanceOverview }> {
    return apiClient.get(this.getPath(factoryId) + '/overview');
  }

  /**
   * 7. 获取交易记录列表（分页）
   * GET /{factoryId}/finance/transactions
   */
  async getTransactions(
    params?: {
      page?: number;
      size?: number;
      counterpartyType?: CounterpartyType;
      counterpartyId?: string;
    },
    factoryId?: string
  ): Promise<{ success: boolean; data: PageResponse<ArApTransaction> }> {
    return apiClient.get(this.getPath(factoryId) + '/transactions', { params });
  }

  /**
   * 8. 获取对账单（期间内交易明细 + 期初期末余额）
   * GET /{factoryId}/finance/statement
   */
  async getStatement(
    params: {
      counterpartyType: CounterpartyType;
      counterpartyId: string;
      startDate: string;
      endDate: string;
    },
    factoryId?: string
  ): Promise<{ success: boolean; data: StatementData }> {
    return apiClient.get(this.getPath(factoryId) + '/statement', { params });
  }

  /**
   * 9. 账龄分析（6桶）
   * GET /{factoryId}/finance/aging
   */
  async getAging(
    counterpartyType: CounterpartyType,
    factoryId?: string
  ): Promise<{ success: boolean; data: AgingData[] }> {
    return apiClient.get(this.getPath(factoryId) + '/aging', {
      params: { counterpartyType },
    });
  }

  /**
   * 10. 信用额度检查
   * GET /{factoryId}/finance/credit-check?customerId=xxx&amount=xxx
   */
  async checkCreditLimit(
    params: { customerId: string; amount: number },
    factoryId?: string
  ): Promise<{ success: boolean; data: CreditCheckResult }> {
    return apiClient.get(this.getPath(factoryId) + '/credit-check', { params });
  }
}

export const financeApiClient = new FinanceApiClient();
export default financeApiClient;
