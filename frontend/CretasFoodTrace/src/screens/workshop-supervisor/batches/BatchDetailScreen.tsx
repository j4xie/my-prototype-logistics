/**
 * 批次详情页面
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Icon } from 'react-native-paper';
import { WSBatchesStackParamList } from '../../../types/navigation';

type NavigationProp = NativeStackNavigationProp<WSBatchesStackParamList, 'BatchDetail'>;
type RouteProps = RouteProp<WSBatchesStackParamList, 'BatchDetail'>;

export function BatchDetailScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();

  // 模拟批次详情
  const batch = {
    id: route.params?.batchId || '1',
    batchNumber: 'PB-20251227-001',
    productName: '带鱼片',
    targetQuantity: 80,
    currentQuantity: 52,
    progress: 65,
    status: 'in_progress',
    currentStage: '切片',
    startTime: '08:30',
    estimatedEndTime: '11:30',
    workers: [
      { id: 1, name: '王建国', role: '切片操作员' },
      { id: 2, name: '李明辉', role: '包装操作员' },
    ],
    equipment: { id: 1, name: '切片机A', equipmentId: 'EQ-001' },
    stages: [
      { name: '解冻', status: 'completed', duration: '45min' },
      { name: '清洗', status: 'completed', duration: '30min' },
      { name: '切片', status: 'in_progress', duration: '进行中' },
      { name: '包装', status: 'pending', duration: '-' },
      { name: '入库', status: 'pending', duration: '-' },
    ],
  };

  const getStageIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return { icon: 'check-circle', color: '#52c41a' };
      case 'in_progress':
        return { icon: 'progress-clock', color: '#1890ff' };
      default:
        return { icon: 'circle-outline', color: '#ccc' };
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 头部 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon source="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>批次详情</Text>
        <TouchableOpacity>
          <Icon source="dots-vertical" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* 批次信息卡片 */}
        <View style={styles.batchCard}>
          <View style={styles.batchHeader}>
            <Text style={styles.batchNumber}>{batch.batchNumber}</Text>
            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>进行中</Text>
            </View>
          </View>
          <Text style={styles.productName}>{batch.productName}</Text>

          {/* 进度条 */}
          <View style={styles.progressSection}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${batch.progress}%` }]} />
            </View>
            <View style={styles.progressInfo}>
              <Text style={styles.progressText}>
                {batch.currentQuantity}kg / {batch.targetQuantity}kg
              </Text>
              <Text style={styles.progressPercent}>{batch.progress}%</Text>
            </View>
          </View>

          {/* 时间信息 */}
          <View style={styles.timeRow}>
            <View style={styles.timeItem}>
              <Icon source="clock-start" size={16} color="#666" />
              <Text style={styles.timeText}>开始: {batch.startTime}</Text>
            </View>
            <View style={styles.timeItem}>
              <Icon source="clock-end" size={16} color="#666" />
              <Text style={styles.timeText}>预计: {batch.estimatedEndTime}</Text>
            </View>
          </View>
        </View>

        {/* 当前工艺环节 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>当前工艺环节</Text>
          <TouchableOpacity
            style={styles.currentStageCard}
            onPress={() => navigation.navigate('BatchStage', { batchId: batch.id, stageType: batch.currentStage, stageName: batch.currentStage })}
          >
            <View style={styles.stageIcon}>
              <Icon source="cog-play" size={24} color="#fff" />
            </View>
            <View style={styles.stageInfo}>
              <Text style={styles.stageName}>{batch.currentStage}</Text>
              <Text style={styles.stageDuration}>进行中 - 预计15分钟完成</Text>
            </View>
            <Icon source="chevron-right" size={24} color="#667eea" />
          </TouchableOpacity>
        </View>

        {/* 工艺流程 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>工艺流程</Text>
          <View style={styles.stagesList}>
            {batch.stages.map((stage, index) => {
              const stageStyle = getStageIcon(stage.status);
              return (
                <View key={index} style={styles.stageItem}>
                  <View style={styles.stageTimeline}>
                    <Icon source={stageStyle.icon} size={20} color={stageStyle.color} />
                    {index < batch.stages.length - 1 && (
                      <View
                        style={[
                          styles.stageLine,
                          stage.status === 'completed' && styles.stageLineCompleted,
                        ]}
                      />
                    )}
                  </View>
                  <View style={styles.stageContent}>
                    <Text style={styles.stageItemName}>{stage.name}</Text>
                    <Text style={styles.stageItemDuration}>{stage.duration}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* 参与人员 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>参与人员</Text>
          <View style={styles.workersList}>
            {batch.workers.map((worker) => (
              <View key={worker.id} style={styles.workerItem}>
                <View style={styles.workerAvatar}>
                  <Text style={styles.workerAvatarText}>{worker.name.charAt(0)}</Text>
                </View>
                <View style={styles.workerInfo}>
                  <Text style={styles.workerName}>{worker.name}</Text>
                  <Text style={styles.workerRole}>{worker.role}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* 设备信息 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>使用设备</Text>
          <View style={styles.equipmentCard}>
            <Icon source="cog" size={24} color="#667eea" />
            <View style={styles.equipmentInfo}>
              <Text style={styles.equipmentName}>{batch.equipment.name}</Text>
              <Text style={styles.equipmentId}>{batch.equipment.equipmentId}</Text>
            </View>
            <View style={styles.equipmentStatus}>
              <Text style={styles.equipmentStatusText}>运行中</Text>
            </View>
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* 底部操作栏 */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => navigation.navigate('BatchStage', { batchId: batch.id, stageType: batch.currentStage, stageName: batch.currentStage })}
        >
          <Icon source="clipboard-text-play" size={20} color="#fff" />
          <Text style={styles.actionBtnText}>录入数据</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, styles.completeBtn]}
          onPress={() => navigation.navigate('BatchComplete', { batchId: batch.id })}
        >
          <Icon source="check-circle" size={20} color="#fff" />
          <Text style={styles.actionBtnText}>完成批次</Text>
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
  },
  batchCard: {
    backgroundColor: '#667eea',
    margin: 16,
    borderRadius: 12,
    padding: 16,
  },
  batchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  batchNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  statusBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    color: '#fff',
  },
  productName: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  progressSection: {
    marginTop: 16,
  },
  progressBar: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 4,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 4,
  },
  progressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  progressText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
  },
  progressPercent: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#fff',
  },
  timeRow: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 16,
  },
  timeItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginLeft: 4,
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  currentStageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
  },
  stageIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stageInfo: {
    flex: 1,
    marginLeft: 12,
  },
  stageName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  stageDuration: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  stagesList: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
  },
  stageItem: {
    flexDirection: 'row',
  },
  stageTimeline: {
    alignItems: 'center',
    width: 20,
  },
  stageLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: 4,
  },
  stageLineCompleted: {
    backgroundColor: '#52c41a',
  },
  stageContent: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginLeft: 12,
    paddingBottom: 16,
  },
  stageItemName: {
    fontSize: 14,
    color: '#333',
  },
  stageItemDuration: {
    fontSize: 13,
    color: '#999',
  },
  workersList: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 8,
  },
  workerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  workerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
  },
  workerAvatarText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  workerInfo: {
    marginLeft: 12,
  },
  workerName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  workerRole: {
    fontSize: 12,
    color: '#999',
  },
  equipmentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
  },
  equipmentInfo: {
    flex: 1,
    marginLeft: 12,
  },
  equipmentName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
  },
  equipmentId: {
    fontSize: 12,
    color: '#999',
  },
  equipmentStatus: {
    backgroundColor: '#f6ffed',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  equipmentStatusText: {
    fontSize: 12,
    color: '#52c41a',
  },
  footer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    gap: 12,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#667eea',
    borderRadius: 8,
    padding: 14,
  },
  completeBtn: {
    backgroundColor: '#52c41a',
  },
  actionBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 6,
  },
});

export default BatchDetailScreen;
