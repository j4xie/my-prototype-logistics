// 加工模块状态管理 - 重点模块
import { create } from 'zustand';
import type { ProcessingData, QualityCheck, Equipment, Batch } from '../types/business';
import type { ApiResponse } from '../types/api';
import { logger } from '../platform/logger';
import { getCoreConfig } from '../core';

interface ProcessingState {
  // 生产批次
  batches: Batch[];
  currentBatch: Batch | null;
  
  // 质量检测
  qualityChecks: QualityCheck[];
  currentQualityCheck: QualityCheck | null;
  
  // 设备管理
  equipment: Equipment[];
  activeEquipment: Equipment[];
  
  // 原料管理
  rawMaterials: any[];
  currentMaterial: any | null;
  
  // 成品管理
  finishedProducts: any[];
  
  // 加载状态
  loading: {
    batches: boolean;
    quality: boolean;
    equipment: boolean;
    materials: boolean;
    products: boolean;
  };
  
  error: string | null;
}

interface ProcessingActions {
  // 生产批次管理
  fetchBatches: (params?: any) => Promise<void>;
  createBatch: (data: any) => Promise<void>;
  updateBatch: (id: string, data: any) => Promise<void>;
  deleteBatch: (id: string) => Promise<void>;
  setCurrentBatch: (batch: Batch | null) => void;
  
  // 质量检测
  fetchQualityChecks: (batchId?: string) => Promise<void>;
  createQualityCheck: (data: Omit<QualityCheck, 'id'>) => Promise<void>;
  updateQualityCheck: (id: string, data: Partial<QualityCheck>) => Promise<void>;
  deleteQualityCheck: (id: string) => Promise<void>;
  
  // 设备管理
  fetchEquipment: () => Promise<void>;
  addEquipment: (data: Omit<Equipment, 'id'>) => Promise<void>;
  updateEquipment: (id: string, data: Partial<Equipment>) => Promise<void>;
  removeEquipment: (id: string) => Promise<void>;
  
  // 原料管理
  fetchRawMaterials: () => Promise<void>;
  addRawMaterial: (data: any) => Promise<void>;
  updateRawMaterial: (id: string, data: any) => Promise<void>;
  removeRawMaterial: (id: string) => Promise<void>;
  
  // 成品管理
  fetchFinishedProducts: () => Promise<void>;
  addFinishedProduct: (data: any) => Promise<void>;
  updateFinishedProduct: (id: string, data: any) => Promise<void>;
  removeFinishedProduct: (id: string) => Promise<void>;
  
  // 工具方法
  setError: (error: string | null) => void;
  clearError: () => void;
  setLoading: (type: keyof ProcessingState['loading'], loading: boolean) => void;
}

type ProcessingStore = ProcessingState & ProcessingActions;

export const useProcessingStore = create<ProcessingStore>((set, get) => ({
  // 初始状态
  batches: [],
  currentBatch: null,
  qualityChecks: [],
  currentQualityCheck: null,
  equipment: [],
  activeEquipment: [],
  rawMaterials: [],
  currentMaterial: null,
  finishedProducts: [],
  loading: {
    batches: false,
    quality: false,
    equipment: false,
    materials: false,
    products: false
  },
  error: null,

  // 生产批次管理
  fetchBatches: async (params = {}) => {
    try {
      set(state => ({ loading: { ...state.loading, batches: true }, error: null }));
      
      const config = getCoreConfig();
      const queryParams = new URLSearchParams(params).toString();
      const response = await fetch(`${config.apiBaseUrl}/api/processing/batches?${queryParams}`);
      
      if (!response.ok) {
        throw new Error('获取生产批次失败');
      }
      
      const data: ApiResponse<Batch[]> = await response.json();
      
      if (data.success) {
        set(state => ({
          batches: data.data,
          loading: { ...state.loading, batches: false }
        }));
        logger.info('Batches loaded successfully', { count: data.data.length });
      } else {
        throw new Error(data.message || '获取生产批次失败');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '获取生产批次失败';
      set(state => ({
        loading: { ...state.loading, batches: false },
        error: errorMessage
      }));
      logger.error('Failed to fetch batches:', error);
    }
  },

  createBatch: async (data: any) => {
    try {
      set(state => ({ loading: { ...state.loading, batches: true }, error: null }));
      
      const config = getCoreConfig();
      const response = await fetch(`${config.apiBaseUrl}/api/processing/batches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        throw new Error('创建生产批次失败');
      }
      
      const result: ApiResponse<Batch> = await response.json();
      
      if (result.success) {
        set(state => ({
          batches: [...state.batches, result.data],
          loading: { ...state.loading, batches: false }
        }));
        logger.info('Batch created successfully', { id: result.data.id });
      } else {
        throw new Error(result.message || '创建生产批次失败');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '创建生产批次失败';
      set(state => ({
        loading: { ...state.loading, batches: false },
        error: errorMessage
      }));
      logger.error('Failed to create batch:', error);
      throw error;
    }
  },

  updateBatch: async (id: string, data: any) => {
    try {
      set(state => ({ loading: { ...state.loading, batches: true }, error: null }));
      
      const config = getCoreConfig();
      const response = await fetch(`${config.apiBaseUrl}/api/processing/batches/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        throw new Error('更新生产批次失败');
      }
      
      const result: ApiResponse<Batch> = await response.json();
      
      if (result.success) {
        set(state => ({
          batches: state.batches.map(batch => 
            batch.id === id ? result.data : batch
          ),
          currentBatch: state.currentBatch?.id === id ? result.data : state.currentBatch,
          loading: { ...state.loading, batches: false }
        }));
        logger.info('Batch updated successfully', { id });
      } else {
        throw new Error(result.message || '更新生产批次失败');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '更新生产批次失败';
      set(state => ({
        loading: { ...state.loading, batches: false },
        error: errorMessage
      }));
      logger.error('Failed to update batch:', error);
      throw error;
    }
  },

  deleteBatch: async (id: string) => {
    try {
      set(state => ({ loading: { ...state.loading, batches: true }, error: null }));
      
      const config = getCoreConfig();
      const response = await fetch(`${config.apiBaseUrl}/api/processing/batches/${id}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        throw new Error('删除生产批次失败');
      }
      
      set(state => ({
        batches: state.batches.filter(batch => batch.id !== id),
        currentBatch: state.currentBatch?.id === id ? null : state.currentBatch,
        loading: { ...state.loading, batches: false }
      }));
      
      logger.info('Batch deleted successfully', { id });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '删除生产批次失败';
      set(state => ({
        loading: { ...state.loading, batches: false },
        error: errorMessage
      }));
      logger.error('Failed to delete batch:', error);
      throw error;
    }
  },

  // 质量检测管理
  fetchQualityChecks: async (batchId?: string) => {
    try {
      set(state => ({ loading: { ...state.loading, quality: true }, error: null }));
      
      const config = getCoreConfig();
      const url = batchId 
        ? `${config.apiBaseUrl}/api/processing/quality-checks?batchId=${batchId}`
        : `${config.apiBaseUrl}/api/processing/quality-checks`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error('获取质量检测记录失败');
      }
      
      const data: ApiResponse<QualityCheck[]> = await response.json();
      
      if (data.success) {
        set(state => ({
          qualityChecks: data.data,
          loading: { ...state.loading, quality: false }
        }));
        logger.info('Quality checks loaded successfully', { count: data.data.length });
      } else {
        throw new Error(data.message || '获取质量检测记录失败');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '获取质量检测记录失败';
      set(state => ({
        loading: { ...state.loading, quality: false },
        error: errorMessage
      }));
      logger.error('Failed to fetch quality checks:', error);
    }
  },

  createQualityCheck: async (data: Omit<QualityCheck, 'id'>) => {
    try {
      set(state => ({ loading: { ...state.loading, quality: true }, error: null }));
      
      const config = getCoreConfig();
      const response = await fetch(`${config.apiBaseUrl}/api/processing/quality-checks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          id: `qc_${Date.now()}`,
          timestamp: new Date()
        })
      });
      
      if (!response.ok) {
        throw new Error('创建质量检测记录失败');
      }
      
      const result: ApiResponse<QualityCheck> = await response.json();
      
      if (result.success) {
        set(state => ({
          qualityChecks: [...state.qualityChecks, result.data],
          loading: { ...state.loading, quality: false }
        }));
        logger.info('Quality check created successfully', { id: result.data.id });
      } else {
        throw new Error(result.message || '创建质量检测记录失败');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '创建质量检测记录失败';
      set(state => ({
        loading: { ...state.loading, quality: false },
        error: errorMessage
      }));
      logger.error('Failed to create quality check:', error);
      throw error;
    }
  },

  updateQualityCheck: async (id: string, data: Partial<QualityCheck>) => {
    try {
      set(state => ({ loading: { ...state.loading, quality: true }, error: null }));
      
      const config = getCoreConfig();
      const response = await fetch(`${config.apiBaseUrl}/api/processing/quality-checks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        throw new Error('更新质量检测记录失败');
      }
      
      const result: ApiResponse<QualityCheck> = await response.json();
      
      if (result.success) {
        set(state => ({
          qualityChecks: state.qualityChecks.map(check => 
            check.id === id ? result.data : check
          ),
          loading: { ...state.loading, quality: false }
        }));
        logger.info('Quality check updated successfully', { id });
      } else {
        throw new Error(result.message || '更新质量检测记录失败');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '更新质量检测记录失败';
      set(state => ({
        loading: { ...state.loading, quality: false },
        error: errorMessage
      }));
      logger.error('Failed to update quality check:', error);
      throw error;
    }
  },

  deleteQualityCheck: async (id: string) => {
    try {
      set(state => ({ loading: { ...state.loading, quality: true }, error: null }));
      
      const config = getCoreConfig();
      const response = await fetch(`${config.apiBaseUrl}/api/processing/quality-checks/${id}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        throw new Error('删除质量检测记录失败');
      }
      
      set(state => ({
        qualityChecks: state.qualityChecks.filter(check => check.id !== id),
        loading: { ...state.loading, quality: false }
      }));
      
      logger.info('Quality check deleted successfully', { id });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '删除质量检测记录失败';
      set(state => ({
        loading: { ...state.loading, quality: false },
        error: errorMessage
      }));
      logger.error('Failed to delete quality check:', error);
      throw error;
    }
  },

  // 设备管理 (简化实现)
  fetchEquipment: async () => {
    // 基础框架实现
    set(state => ({ loading: { ...state.loading, equipment: true } }));
    // TODO: 实现设备获取逻辑
    set(state => ({ loading: { ...state.loading, equipment: false } }));
  },

  addEquipment: async (data: Omit<Equipment, 'id'>) => {
    // 基础框架实现
    logger.info('Adding equipment:', data);
  },

  updateEquipment: async (id: string, data: Partial<Equipment>) => {
    // 基础框架实现
    logger.info('Updating equipment:', { id, data });
  },

  removeEquipment: async (id: string) => {
    // 基础框架实现
    logger.info('Removing equipment:', { id });
  },

  // 原料管理 (简化实现)
  fetchRawMaterials: async () => {
    set(state => ({ loading: { ...state.loading, materials: true } }));
    // TODO: 实现原料获取逻辑
    set(state => ({ loading: { ...state.loading, materials: false } }));
  },

  addRawMaterial: async (data: any) => {
    logger.info('Adding raw material:', data);
  },

  updateRawMaterial: async (id: string, data: any) => {
    logger.info('Updating raw material:', { id, data });
  },

  removeRawMaterial: async (id: string) => {
    logger.info('Removing raw material:', { id });
  },

  // 成品管理 (简化实现)
  fetchFinishedProducts: async () => {
    set(state => ({ loading: { ...state.loading, products: true } }));
    // TODO: 实现成品获取逻辑
    set(state => ({ loading: { ...state.loading, products: false } }));
  },

  addFinishedProduct: async (data: any) => {
    logger.info('Adding finished product:', data);
  },

  updateFinishedProduct: async (id: string, data: any) => {
    logger.info('Updating finished product:', { id, data });
  },

  removeFinishedProduct: async (id: string) => {
    logger.info('Removing finished product:', { id });
  },

  // 辅助方法
  setCurrentBatch: (batch: Batch | null) => set({ currentBatch: batch }),
  setError: (error: string | null) => set({ error }),
  clearError: () => set({ error: null }),
  setLoading: (type: keyof ProcessingState['loading'], loading: boolean) => 
    set(state => ({ loading: { ...state.loading, [type]: loading } }))
}));