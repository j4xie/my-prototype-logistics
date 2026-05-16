/**
 * S-RD-1 / N48 研发样品 API Client — Sprint 2 / Track F.
 *
 * 后端路径: /api/mobile/{factoryId}/rd/* (RdController, Sprint 1 已 ship)
 *
 * 注: 此 client 仅覆盖 sample CRUD + 状态机, RdRequest / QuotationTask 等其他 rd 资源
 * 由独立 client 处理 (本 client scope = samples).
 */
import { apiClient } from './apiClient';
import { getCurrentFactoryId } from '../../utils/factoryIdHelper';

/** Cretas 统一响应封套. */
interface ApiEnvelope<T> {
  code: number;
  data: T;
  message: string;
  success: boolean;
}

/** ProductSample status 状态机 (跟后端 ProductSampleServiceImpl 一致). */
export type SampleStatus = 'DRAFT' | 'IN_PROGRESS' | 'TESTING' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';

export interface ProductSample {
  id: string;
  factoryId: string;
  sampleCode: string;
  rdRequestId?: string;
  name: string;
  specification?: string;
  grade?: string;
  mainMaterial?: string;
  status: SampleStatus;
  progressNotes?: string;
  photoUrls?: string;
  assignedTo?: number;
  submittedBy?: number;
  approvedBy?: number;
  approvedAt?: string;
  approvalNotes?: string;
  productTypeId?: string;
  bomProductTypeId?: string;
  customerName?: string;
  salesperson?: string;
  storageMethod?: string;
  customerExpectedPrice?: number;
  productStatus?: string;
  customerType?: string;
  customerLatestRequirement?: string;
  sampleVersion?: string;
  sellingPoints?: string;
  customerCode?: string;
  customerLevel?: string;
  productQuotePrice?: number;
  materialPrice?: number;
  processingFee?: number;
  mainMaterialInfo?: string;
  mainMaterialYieldRate?: number;
  mainMaterialImages?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SamplePage {
  content: ProductSample[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

export interface CreateSampleBody {
  rdRequestId?: string;
  name: string;
  specification?: string;
  grade?: string;
  mainMaterial?: string;
  assignedTo?: number;
  /** 任意扩展字段, RdController.applyExtendedFields 处理. */
  [key: string]: unknown;
}

class SampleApiClient {
  private base(factoryId?: string): string {
    const id = getCurrentFactoryId(factoryId);
    if (!id) throw new Error('factoryId 是必需的, 请先登录');
    return `/api/mobile/${id}/rd`;
  }

  /** 分页列表, status 可选. */
  async listSamples(params?: {
    factoryId?: string;
    status?: SampleStatus;
    page?: number;
    size?: number;
  }): Promise<SamplePage> {
    const { factoryId, ...query } = params ?? {};
    const res = await apiClient.get<ApiEnvelope<SamplePage>>(`${this.base(factoryId)}/samples`, { params: query });
    return res.data;
  }

  async getSample(sampleId: string, factoryId?: string): Promise<ProductSample> {
    const res = await apiClient.get<ApiEnvelope<ProductSample>>(`${this.base(factoryId)}/samples/${sampleId}`);
    return res.data;
  }

  async createSample(body: CreateSampleBody, factoryId?: string): Promise<ProductSample> {
    const res = await apiClient.post<ApiEnvelope<ProductSample>>(`${this.base(factoryId)}/samples`, body);
    return res.data;
  }

  /** 更新字段 (RdController PUT). */
  async updateSample(sampleId: string, fields: Partial<ProductSample>, factoryId?: string): Promise<ProductSample> {
    const res = await apiClient.put<ApiEnvelope<ProductSample>>(
      `${this.base(factoryId)}/samples/${sampleId}`,
      fields,
    );
    return res.data;
  }

  /** 更新进度 (POST tracking record). 跟 RdController 现存 endpoint 对应. */
  async updateProgress(
    sampleId: string,
    body: { note: string; photoUrl?: string },
    factoryId?: string,
  ): Promise<ProductSample> {
    const res = await apiClient.post<ApiEnvelope<ProductSample>>(
      `${this.base(factoryId)}/samples/${sampleId}/progress`,
      body,
    );
    return res.data;
  }

  /** 提交审核 (DRAFT/IN_PROGRESS → SUBMITTED). */
  async submitForApproval(sampleId: string, factoryId?: string): Promise<ProductSample> {
    const res = await apiClient.post<ApiEnvelope<ProductSample>>(
      `${this.base(factoryId)}/samples/${sampleId}/submit`,
      {},
    );
    return res.data;
  }

  /**
   * 审核通过 (SUBMITTED → APPROVED).
   * 后端 SampleApprovedEventListener 异步触发: 自动建 QuotationTask + best-effort BOM 草稿 + 通知销售主管.
   */
  async approveSample(sampleId: string, notes?: string, factoryId?: string): Promise<ProductSample> {
    const res = await apiClient.post<ApiEnvelope<ProductSample>>(
      `${this.base(factoryId)}/samples/${sampleId}/approve`,
      { notes },
    );
    return res.data;
  }

  /** 审核驳回. */
  async rejectSample(sampleId: string, notes?: string, factoryId?: string): Promise<ProductSample> {
    const res = await apiClient.post<ApiEnvelope<ProductSample>>(
      `${this.base(factoryId)}/samples/${sampleId}/reject`,
      { notes },
    );
    return res.data;
  }
}

export const sampleApiClient = new SampleApiClient();
