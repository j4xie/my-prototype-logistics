import { apiClient } from './apiClient';
import { getCurrentFactoryId } from '../../utils/factoryIdHelper';
import axios from 'axios';
import { API_BASE_URL } from '../../constants/config';

/**
 * 溯源API客户端
 * 路径：/api/mobile/{factoryId}/traceability/* 和 /api/public/trace/*
 *
 * 业务场景：提供产品全链路溯源查询，支持消费者扫码查询
 */

// ========== 类型定义 ==========

export interface ProductionInfo {
  batchNumber: string;
  productName: string;
  productType: string;
  productionDate: string;
  completionTime?: string;
  supervisorName?: string;
  equipmentName?: string;
  quantity?: number;
  unit?: string;
  qualityStatus: string;
  factoryName: string;
  factoryId: string;
}

export interface MaterialInfo {
  batchNumber: string;
  materialName: string;
  materialType: string;
  supplierName: string;
  supplierCode?: string;
  receiptDate: string;
  expireDate?: string;
  quantity?: number;
  unit?: string;
  storageLocation?: string;
  status: string;
}

export interface QualityInfo {
  inspectionId: string;
  inspectionDate: string;
  inspectorName: string;
  result: string;
  passRate?: number;
  conclusion?: string;
  remarks?: string;
}

export interface ShipmentInfo {
  shipmentNumber: string;
  shipmentDate: string;
  customerName: string;
  logisticsCompany?: string;
  trackingNumber?: string;
  status: string;
  quantity?: number;
  unit?: string;
}

export interface BatchTraceResponse {
  production: ProductionInfo;
  materialCount: number;
  inspectionCount: number;
  shipmentCount: number;
  qualityStatus: string;
  lastUpdateTime: string;
}

export interface FullTraceResponse {
  production: ProductionInfo;
  materials: MaterialInfo[];
  qualityInspections: QualityInfo[];
  shipments: ShipmentInfo[];
  traceCode: string;
  queryTime: string;
}

export interface PublicMaterialInfo {
  materialType: string;
  origin: string;
  receiptDate: string;
}

export interface PublicQualityInfo {
  inspectionDate: string;
  result: string;
  passRate?: number;
}

export interface PublicTraceResponse {
  productName: string;
  batchNumber: string;
  productionDate?: string;
  factoryName: string;
  qualityStatus: string;
  certificationInfo?: string;
  materials: PublicMaterialInfo[];
  qualityInspection?: PublicQualityInfo;
  traceCode: string;
  queryTime: string;
  isValid: boolean;
  message: string;
}

// ========== API客户端类 ==========

class TraceabilityApiClient {
  private getPath(factoryId?: string) {
    const currentFactoryId = getCurrentFactoryId(factoryId);
    if (!currentFactoryId) {
      throw new Error('factoryId 是必需的，请先登录或提供 factoryId 参数');
    }
    return `/api/mobile/${currentFactoryId}/traceability`;
  }

  /**
   * 1. 获取基础溯源信息（批次级别）
   * GET /api/mobile/{factoryId}/traceability/batch/{batchNumber}
   * 需要认证
   */
  async getBatchTrace(
    batchNumber: string,
    factoryId?: string
  ): Promise<BatchTraceResponse | null> {
    try {
      const response = await apiClient.get<any>(
        `${this.getPath(factoryId)}/batch/${batchNumber}`
      );
      return response.data || response;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * 2. 获取完整溯源链路
   * GET /api/mobile/{factoryId}/traceability/full/{batchNumber}
   * 需要认证
   */
  async getFullTrace(
    batchNumber: string,
    factoryId?: string
  ): Promise<FullTraceResponse | null> {
    try {
      const response = await apiClient.get<any>(
        `${this.getPath(factoryId)}/full/${batchNumber}`
      );
      return response.data || response;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * 3. 公开溯源查询（消费者扫码，无需认证）
   * GET /api/public/trace/{batchNumber}
   */
  async getPublicTrace(batchNumber: string): Promise<PublicTraceResponse> {
    try {
      // 公开接口不需要认证，直接使用axios
      const response = await axios.get(
        `${API_BASE_URL}/api/public/trace/${batchNumber}`
      );
      return response.data?.data || response.data;
    } catch (error: any) {
      console.error('[TraceabilityApiClient] 公开溯源查询失败:', error);
      return {
        productName: '',
        batchNumber: batchNumber,
        factoryName: '',
        qualityStatus: '',
        materials: [],
        traceCode: '',
        queryTime: new Date().toISOString(),
        isValid: false,
        message: error.response?.data?.message || '溯源查询失败'
      };
    }
  }

  /**
   * 4. 通过溯源码查询（消费者扫码，无需认证）
   * GET /api/public/trace/code/{traceCode}
   */
  async getTraceByCode(traceCode: string): Promise<PublicTraceResponse> {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/api/public/trace/code/${traceCode}`
      );
      return response.data?.data || response.data;
    } catch (error: any) {
      console.error('[TraceabilityApiClient] 溯源码查询失败:', error);
      return {
        productName: '',
        batchNumber: '',
        factoryName: '',
        qualityStatus: '',
        materials: [],
        traceCode: traceCode,
        queryTime: new Date().toISOString(),
        isValid: false,
        message: error.response?.data?.message || '无效的溯源码'
      };
    }
  }
}

export const traceabilityApiClient = new TraceabilityApiClient();
export default traceabilityApiClient;
