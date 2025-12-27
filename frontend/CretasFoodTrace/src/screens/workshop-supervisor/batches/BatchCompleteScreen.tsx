/**
 * 批次完成确认页面
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Icon } from 'react-native-paper';
import { WSBatchesStackParamList } from '../../../types/navigation';

type RouteProps = RouteProp<WSBatchesStackParamList, 'BatchComplete'>;

export function BatchCompleteScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProps>();

  const [confirmChecks, setConfirmChecks] = useState({
    qualityCheck: false,
    dataComplete: false,
    equipmentReset: false,
  });

  // 模拟批次数据
  const batch = {
    batchNumber: 'PB-20251227-001',
    productName: '带鱼片',
    targetQuantity: 80,
    actualQuantity: 78,
    qualifiedQuantity: 76,
    qualityRate: 97.4,
    totalTime: '3小时15分钟',
    workers: 3,
  };

  const allChecked = Object.values(confirmChecks).every(Boolean);

  const handleComplete = () => {
    Alert.alert(
      '确认完成',
      `确定完成批次 ${batch.batchNumber} 吗？`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确认完成',
          onPress: () => {
            Alert.alert('成功', '批次已完成！', [
              { text: '确定', onPress: () => navigation.goBack() }
            ]);
          },
        },
      ]
    );
  };

  const toggleCheck = (key: keyof typeof confirmChecks) => {
    setConfirmChecks({ ...confirmChecks, [key]: !confirmChecks[key] });
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 头部 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon source="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>完成批次</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* 批次汇总 */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <Icon source="check-decagram" size={32} color="#52c41a" />
            <Text style={styles.summaryTitle}>批次生产完成</Text>
          </View>
          <Text style={styles.batchNumber}>{batch.batchNumber}</Text>
          <Text style={styles.productName}>{batch.productName}</Text>
        </View>

        {/* 生产数据 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>生产数据汇总</Text>
          <View style={styles.dataCard}>
            <View style={styles.dataRow}>
              <View style={styles.dataItem}>
                <Text style={styles.dataLabel}>目标产量</Text>
                <Text style={styles.dataValue}>{batch.targetQuantity} kg</Text>
              </View>
              <View style={styles.dataItem}>
                <Text style={styles.dataLabel}>实际产量</Text>
                <Text style={[styles.dataValue, { color: '#1890ff' }]}>
                  {batch.actualQuantity} kg
                </Text>
              </View>
            </View>
            <View style={styles.dataRow}>
              <View style={styles.dataItem}>
                <Text style={styles.dataLabel}>合格数量</Text>
                <Text style={[styles.dataValue, { color: '#52c41a' }]}>
                  {batch.qualifiedQuantity} kg
                </Text>
              </View>
              <View style={styles.dataItem}>
                <Text style={styles.dataLabel}>合格率</Text>
                <Text style={[styles.dataValue, { color: '#52c41a' }]}>
                  {batch.qualityRate}%
                </Text>
              </View>
            </View>
            <View style={styles.dataRow}>
              <View style={styles.dataItem}>
                <Text style={styles.dataLabel}>总耗时</Text>
                <Text style={styles.dataValue}>{batch.totalTime}</Text>
              </View>
              <View style={styles.dataItem}>
                <Text style={styles.dataLabel}>参与人数</Text>
                <Text style={styles.dataValue}>{batch.workers} 人</Text>
              </View>
            </View>
          </View>
        </View>

        {/* 确认清单 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>完成确认</Text>
          <View style={styles.checklistCard}>
            <TouchableOpacity
              style={styles.checkItem}
              onPress={() => toggleCheck('qualityCheck')}
            >
              <Icon
                source={confirmChecks.qualityCheck ? 'checkbox-marked' : 'checkbox-blank-outline'}
                size={24}
                color={confirmChecks.qualityCheck ? '#52c41a' : '#ccc'}
              />
              <Text style={styles.checkText}>质检已完成</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.checkItem}
              onPress={() => toggleCheck('dataComplete')}
            >
              <Icon
                source={confirmChecks.dataComplete ? 'checkbox-marked' : 'checkbox-blank-outline'}
                size={24}
                color={confirmChecks.dataComplete ? '#52c41a' : '#ccc'}
              />
              <Text style={styles.checkText}>数据已录入完整</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.checkItem}
              onPress={() => toggleCheck('equipmentReset')}
            >
              <Icon
                source={confirmChecks.equipmentReset ? 'checkbox-marked' : 'checkbox-blank-outline'}
                size={24}
                color={confirmChecks.equipmentReset ? '#52c41a' : '#ccc'}
              />
              <Text style={styles.checkText}>设备已复位清洁</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* 底部按钮 */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.completeBtn, !allChecked && styles.completeBtnDisabled]}
          onPress={handleComplete}
          disabled={!allChecked}
        >
          <Icon source="check-circle" size={24} color="#fff" />
          <Text style={styles.completeBtnText}>确认完成批次</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#667eea',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  summaryCard: {
    backgroundColor: '#f6ffed',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#b7eb8f',
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#52c41a',
    marginLeft: 8,
  },
  batchNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  productName: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  dataCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
  },
  dataRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  dataItem: {
    flex: 1,
    alignItems: 'center',
  },
  dataLabel: {
    fontSize: 12,
    color: '#999',
  },
  dataValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 4,
  },
  checklistCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 8,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f0f0f0',
  },
  checkText: {
    fontSize: 15,
    color: '#333',
    marginLeft: 12,
  },
  footer: {
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  completeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#52c41a',
    borderRadius: 8,
    padding: 16,
  },
  completeBtnDisabled: {
    backgroundColor: '#ccc',
  },
  completeBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 8,
  },
});

export default BatchCompleteScreen;
