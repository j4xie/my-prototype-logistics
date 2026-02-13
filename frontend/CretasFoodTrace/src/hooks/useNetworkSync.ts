import { useEffect, useRef, useCallback } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { Alert } from 'react-native';
import { useDraftReportStore } from '../store/draftReportStore';
import { getCurrentFactoryId } from '../utils/factoryIdHelper';
import { apiClient } from '../services/api/apiClient';
import { logger } from '../utils/logger';

const syncLogger = logger.createContextLogger('NetworkSync');

export function useNetworkSync() {
  const { drafts, removeDraft } = useDraftReportStore();
  const isSyncing = useRef(false);
  let factoryId: string;
  try {
    factoryId = getCurrentFactoryId();
  } catch {
    factoryId = '';
  }

  const syncDrafts = useCallback(async () => {
    if (isSyncing.current || drafts.length === 0 || !factoryId) return;
    isSyncing.current = true;

    let syncedCount = 0;
    let failedCount = 0;

    for (const draft of drafts) {
      if (draft.factoryId !== factoryId) continue;
      try {
        if (draft.batchId) {
          await apiClient.post(
            `/api/mobile/${factoryId}/processing/batches/${draft.batchId}/report`,
            {
              actualQuantity: draft.outputQuantity,
              goodQuantity: draft.goodQuantity,
              defectQuantity: draft.defectQuantity,
              notes: draft.notes,
            }
          );
          removeDraft(draft.id);
          syncedCount++;
          syncLogger.info(`Draft ${draft.id} synced successfully`);
        }
      } catch {
        failedCount++;
        syncLogger.warn(`Draft ${draft.id} sync failed`);
      }
    }

    if (syncedCount > 0) {
      Alert.alert(
        '离线数据同步',
        `成功同步 ${syncedCount} 条报工记录${failedCount > 0 ? `，${failedCount} 条失败` : ''}`
      );
    }

    isSyncing.current = false;
  }, [drafts, factoryId, removeDraft]);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      if (state.isConnected && drafts.length > 0) {
        syncDrafts();
      }
    });
    return () => unsubscribe();
  }, [syncDrafts, drafts.length]);

  return {
    pendingCount: drafts.filter(d => d.factoryId === factoryId).length,
    syncDrafts,
  };
}
