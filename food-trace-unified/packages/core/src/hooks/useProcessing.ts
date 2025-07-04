// 加工模块Hooks - 重点模块
import { useCallback } from 'react';
import { useProcessingStore } from '../store/processingStore';
import type { Batch, QualityCheck, Equipment } from '../types/business';

// 主要加工Hook
export const useProcessing = () => {
  const {
    batches,
    currentBatch,
    qualityChecks,
    equipment,
    rawMaterials,
    finishedProducts,
    loading,
    error,
    fetchBatches,
    fetchQualityChecks,
    fetchEquipment,
    fetchRawMaterials,
    fetchFinishedProducts,
    setCurrentBatch,
    clearError
  } = useProcessingStore();

  return {
    // 状态
    batches,
    currentBatch,
    qualityChecks,
    equipment,
    rawMaterials,
    finishedProducts,
    loading,
    error,

    // 操作
    fetchBatches,
    fetchQualityChecks,
    fetchEquipment,
    fetchRawMaterials,
    fetchFinishedProducts,
    setCurrentBatch,
    clearError
  };
};

// 生产批次管理Hook
export const useBatches = () => {
  const {
    batches,
    currentBatch,
    loading,
    error,
    fetchBatches,
    createBatch,
    updateBatch,
    deleteBatch,
    setCurrentBatch
  } = useProcessingStore();

  const handleCreateBatch = useCallback(async (data: any) => {
    try {
      await createBatch(data);
      return true;
    } catch (error) {
      console.error('Failed to create batch:', error);
      return false;
    }
  }, [createBatch]);

  const handleUpdateBatch = useCallback(async (id: string, data: any) => {
    try {
      await updateBatch(id, data);
      return true;
    } catch (error) {
      console.error('Failed to update batch:', error);
      return false;
    }
  }, [updateBatch]);

  const handleDeleteBatch = useCallback(async (id: string) => {
    try {
      await deleteBatch(id);
      return true;
    } catch (error) {
      console.error('Failed to delete batch:', error);
      return false;
    }
  }, [deleteBatch]);

  const getBatchById = useCallback((id: string) => {
    return batches.find(batch => batch.id === id);
  }, [batches]);

  const getBatchesByStatus = useCallback((status: string) => {
    return batches.filter(batch => batch.status === status);
  }, [batches]);

  return {
    batches,
    currentBatch,
    loading: loading.batches,
    error,
    fetchBatches,
    createBatch: handleCreateBatch,
    updateBatch: handleUpdateBatch,
    deleteBatch: handleDeleteBatch,
    setCurrentBatch,
    getBatchById,
    getBatchesByStatus
  };
};

// 质量检测Hook
export const useQualityChecks = () => {
  const {
    qualityChecks,
    currentQualityCheck,
    loading,
    error,
    fetchQualityChecks,
    createQualityCheck,
    updateQualityCheck,
    deleteQualityCheck
  } = useProcessingStore();

  const handleCreateQualityCheck = useCallback(async (data: Omit<QualityCheck, 'id'>) => {
    try {
      await createQualityCheck(data);
      return true;
    } catch (error) {
      console.error('Failed to create quality check:', error);
      return false;
    }
  }, [createQualityCheck]);

  const handleUpdateQualityCheck = useCallback(async (id: string, data: Partial<QualityCheck>) => {
    try {
      await updateQualityCheck(id, data);
      return true;
    } catch (error) {
      console.error('Failed to update quality check:', error);
      return false;
    }
  }, [updateQualityCheck]);

  const handleDeleteQualityCheck = useCallback(async (id: string) => {
    try {
      await deleteQualityCheck(id);
      return true;
    } catch (error) {
      console.error('Failed to delete quality check:', error);
      return false;
    }
  }, [deleteQualityCheck]);

  const getQualityChecksByBatch = useCallback((batchId: string) => {
    return qualityChecks.filter(check => check.id.includes(batchId));
  }, [qualityChecks]);

  const getQualityChecksByResult = useCallback((result: 'pass' | 'fail' | 'warning') => {
    return qualityChecks.filter(check => check.result === result);
  }, [qualityChecks]);

  const getQualityScore = useCallback((batchId?: string) => {
    const checks = batchId 
      ? getQualityChecksByBatch(batchId)
      : qualityChecks;
      
    if (checks.length === 0) return 0;
    
    const passCount = checks.filter(check => check.result === 'pass').length;
    return (passCount / checks.length) * 100;
  }, [qualityChecks, getQualityChecksByBatch]);

  return {
    qualityChecks,
    currentQualityCheck,
    loading: loading.quality,
    error,
    fetchQualityChecks,
    createQualityCheck: handleCreateQualityCheck,
    updateQualityCheck: handleUpdateQualityCheck,
    deleteQualityCheck: handleDeleteQualityCheck,
    getQualityChecksByBatch,
    getQualityChecksByResult,
    getQualityScore
  };
};

// 设备管理Hook (基础框架)
export const useEquipment = () => {
  const {
    equipment,
    activeEquipment,
    loading,
    error,
    fetchEquipment,
    addEquipment,
    updateEquipment,
    removeEquipment
  } = useProcessingStore();

  const getEquipmentById = useCallback((id: string) => {
    return equipment.find(eq => eq.id === id);
  }, [equipment]);

  const getEquipmentByType = useCallback((type: string) => {
    return equipment.filter(eq => eq.type === type);
  }, [equipment]);

  return {
    equipment,
    activeEquipment,
    loading: loading.equipment,
    error,
    fetchEquipment,
    addEquipment,
    updateEquipment,
    removeEquipment,
    getEquipmentById,
    getEquipmentByType
  };
};

// 原料管理Hook (基础框架)
export const useRawMaterials = () => {
  const {
    rawMaterials,
    currentMaterial,
    loading,
    error,
    fetchRawMaterials,
    addRawMaterial,
    updateRawMaterial,
    removeRawMaterial
  } = useProcessingStore();

  return {
    rawMaterials,
    currentMaterial,
    loading: loading.materials,
    error,
    fetchRawMaterials,
    addRawMaterial,
    updateRawMaterial,
    removeRawMaterial
  };
};

// 成品管理Hook (基础框架)
export const useFinishedProducts = () => {
  const {
    finishedProducts,
    loading,
    error,
    fetchFinishedProducts,
    addFinishedProduct,
    updateFinishedProduct,
    removeFinishedProduct
  } = useProcessingStore();

  return {
    finishedProducts,
    loading: loading.products,
    error,
    fetchFinishedProducts,
    addFinishedProduct,
    updateFinishedProduct,
    removeFinishedProduct
  };
};