import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useDraftReportStore, DraftReport } from '../../store/draftReportStore';
import { processingApiClient } from '../../services/api/processingApiClient';
import { handleError } from '../../utils/errorHandler';

const DraftReportsScreen: React.FC = () => {
  const navigation = useNavigation();
  const { drafts, removeDraft, clearDrafts } = useDraftReportStore();
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  const handleResubmit = async (draft: DraftReport) => {
    if (!draft.batchId) {
      Alert.alert('无法提交', '缺少批次信息');
      return;
    }

    setSubmittingId(draft.id);
    try {
      await processingApiClient.submitWorkReport(draft.batchId, {
        actualQuantity: draft.outputQuantity,
        goodQuantity: draft.goodQuantity,
        defectQuantity: draft.defectQuantity,
        notes: draft.notes,
      });
      removeDraft(draft.id);
      Alert.alert('提交成功', `批次 ${draft.batchNumber} 报工已同步`);
    } catch (error: unknown) {
      handleError(error, { showAlert: false, logError: true });
      Alert.alert('提交失败', '请检查网络后重试');
    } finally {
      setSubmittingId(null);
    }
  };

  const handleDelete = (draft: DraftReport) => {
    Alert.alert(
      '删除草稿',
      `确定删除批次 ${draft.batchNumber || draft.batchId} 的草稿？`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: () => removeDraft(draft.id),
        },
      ],
    );
  };

  const handleClearAll = () => {
    if (drafts.length === 0) return;
    Alert.alert('清空所有草稿', `确定删除全部 ${drafts.length} 条草稿？`, [
      { text: '取消', style: 'cancel' },
      { text: '清空', style: 'destructive', onPress: clearDrafts },
    ]);
  };

  const formatTime = (isoString: string) => {
    const d = new Date(isoString);
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hour = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${month}-${day} ${hour}:${min}`;
  };

  const renderItem = ({ item }: { item: DraftReport }) => {
    const isSubmitting = submittingId === item.id;
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <MaterialCommunityIcons name="file-clock-outline" size={20} color="#F59E0B" />
            <Text style={styles.batchNumber}>{item.batchNumber || `ID:${item.batchId}`}</Text>
          </View>
          <Text style={styles.timestamp}>{formatTime(item.createdAt)}</Text>
        </View>

        {item.productName && (
          <Text style={styles.productName}>{item.productName}</Text>
        )}

        <View style={styles.dataRow}>
          <View style={styles.dataItem}>
            <Text style={styles.dataLabel}>产出</Text>
            <Text style={styles.dataValue}>{item.outputQuantity} kg</Text>
          </View>
          <View style={styles.dataItem}>
            <Text style={styles.dataLabel}>合格</Text>
            <Text style={[styles.dataValue, { color: '#10B981' }]}>{item.goodQuantity} kg</Text>
          </View>
          <View style={styles.dataItem}>
            <Text style={styles.dataLabel}>缺陷</Text>
            <Text style={[styles.dataValue, item.defectQuantity > 0 ? { color: '#EF4444' } : {}]}>
              {item.defectQuantity} kg
            </Text>
          </View>
        </View>

        {item.notes ? (
          <Text style={styles.notes} numberOfLines={2}>{item.notes}</Text>
        ) : null}

        <View style={styles.cardActions}>
          <TouchableOpacity
            style={styles.resubmitButton}
            onPress={() => handleResubmit(item)}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <MaterialCommunityIcons name="cloud-upload-outline" size={16} color="#fff" />
                <Text style={styles.resubmitText}>重新提交</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => handleDelete(item)}
            disabled={isSubmitting}
          >
            <MaterialCommunityIcons name="delete-outline" size={16} color="#EF4444" />
            <Text style={styles.deleteText}>删除</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#1a1a1a" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>待同步草稿</Text>
          {drafts.length > 0 && (
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{drafts.length}</Text>
            </View>
          )}
        </View>
        {drafts.length > 0 && (
          <TouchableOpacity onPress={handleClearAll}>
            <Text style={styles.clearAllText}>清空</Text>
          </TouchableOpacity>
        )}
      </View>

      {drafts.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons name="checkbox-marked-circle-outline" size={64} color="#D1D5DB" />
          <Text style={styles.emptyTitle}>暂无草稿</Text>
          <Text style={styles.emptySubtitle}>所有报工数据已同步</Text>
        </View>
      ) : (
        <FlatList
          data={drafts}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: {
    padding: 4,
    marginRight: 8,
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  countBadge: {
    backgroundColor: '#F59E0B',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  countBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  clearAllText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '500',
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  batchNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  timestamp: {
    fontSize: 12,
    color: '#999',
  },
  productName: {
    fontSize: 13,
    color: '#666',
    marginBottom: 10,
  },
  dataRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 10,
  },
  dataItem: {
    flex: 1,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
  },
  dataLabel: {
    fontSize: 11,
    color: '#999',
    marginBottom: 4,
  },
  dataValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  notes: {
    fontSize: 13,
    color: '#666',
    marginBottom: 10,
    fontStyle: 'italic',
  },
  cardActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  resubmitButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4F46E5',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  resubmitText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FEE2E2',
    backgroundColor: '#FEF2F2',
    gap: 4,
  },
  deleteText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 80,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#9CA3AF',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#D1D5DB',
    marginTop: 4,
  },
});

export default DraftReportsScreen;
