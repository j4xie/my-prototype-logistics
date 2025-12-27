/**
 * 任务执行引导 - 步骤2: 确认设备
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
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Icon } from 'react-native-paper';
import { WSHomeStackParamList } from '../../../types/navigation';

type NavigationProp = NativeStackNavigationProp<WSHomeStackParamList, 'TaskGuideStep2'>;
type RouteProps = RouteProp<WSHomeStackParamList, 'TaskGuideStep2'>;

export function TaskGuideStep2Screen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const { batchId, batchNumber } = route.params || {};

  const [isEquipmentReady, setIsEquipmentReady] = useState(false);
  const [equipmentStatus, setEquipmentStatus] = useState<'idle' | 'starting' | 'running'>('idle');

  // 模拟设备信息
  const equipmentInfo = {
    name: '切片机A',
    equipmentId: 'EQ-001',
    status: 'idle',
    oee: 92,
    lastMaintenance: '2025-12-20',
    nextMaintenance: '2026-01-20',
  };

  const handleStartEquipment = () => {
    setEquipmentStatus('starting');
    setTimeout(() => {
      setEquipmentStatus('running');
      setIsEquipmentReady(true);
    }, 1500);
  };

  const handleReportIssue = () => {
    Alert.alert(
      '报告设备问题',
      '确定要报告设备故障吗？这将通知设备管理员。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确认报告',
          style: 'destructive',
          onPress: () => {
            Alert.alert('已提交', '设备故障报告已提交，设备管理员将尽快处理。');
          },
        },
      ]
    );
  };

  const handleNext = () => {
    navigation.navigate('TaskGuideStep3', { batchId, batchNumber });
  };

  const getStatusColor = () => {
    switch (equipmentStatus) {
      case 'running':
        return '#52c41a';
      case 'starting':
        return '#faad14';
      default:
        return '#8c8c8c';
    }
  };

  const getStatusText = () => {
    switch (equipmentStatus) {
      case 'running':
        return '运行中';
      case 'starting':
        return '启动中...';
      default:
        return '空闲';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 头部 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon source="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>任务执行</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* 批次信息 */}
        <View style={styles.batchCard}>
          <Text style={styles.batchNumber}>{batchNumber || 'PB-20251227-001'}</Text>
          <Text style={styles.batchProduct}>带鱼片 · 目标80kg</Text>
        </View>

        {/* 步骤指示器 */}
        <View style={styles.stepIndicator}>
          <View style={[styles.stepDot, styles.stepDotCompleted]}>
            <Icon source="check" size={16} color="#fff" />
          </View>
          <View style={[styles.stepLine, styles.stepLineCompleted]} />
          <View style={[styles.stepDot, styles.stepDotActive]}>
            <Text style={styles.stepDotText}>2</Text>
          </View>
          <View style={styles.stepLine} />
          <View style={styles.stepDot}>
            <Text style={styles.stepDotTextInactive}>3</Text>
          </View>
        </View>

        {/* 步骤标题 */}
        <View style={styles.stepHeader}>
          <Icon source="cog" size={24} color="#667eea" />
          <Text style={styles.stepTitle}>步骤 2/3: 确认设备</Text>
        </View>

        {/* 设备信息卡片 */}
        <View style={styles.equipmentCard}>
          <View style={styles.equipmentHeader}>
            <View style={[styles.equipmentIcon, { backgroundColor: getStatusColor() }]}>
              <Icon source="cog" size={24} color="#fff" />
            </View>
            <View style={styles.equipmentInfo}>
              <Text style={styles.equipmentName}>{equipmentInfo.name}</Text>
              <Text style={styles.equipmentId}>{equipmentInfo.equipmentId}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor()}20` }]}>
              <Text style={[styles.statusText, { color: getStatusColor() }]}>
                {getStatusText()}
              </Text>
            </View>
          </View>

          <View style={styles.equipmentStats}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{equipmentInfo.oee}%</Text>
              <Text style={styles.statLabel}>OEE</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{equipmentInfo.lastMaintenance}</Text>
              <Text style={styles.statLabel}>上次维护</Text>
            </View>
          </View>
        </View>

        {/* 操作按钮 */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[
              styles.startBtn,
              equipmentStatus !== 'idle' && styles.startBtnDisabled,
            ]}
            onPress={handleStartEquipment}
            disabled={equipmentStatus !== 'idle'}
          >
            <Icon
              source={equipmentStatus === 'running' ? 'check-circle' : 'power'}
              size={20}
              color="#fff"
            />
            <Text style={styles.startBtnText}>
              {equipmentStatus === 'running' ? '已启动' : equipmentStatus === 'starting' ? '启动中...' : '启动设备'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.issueBtn} onPress={handleReportIssue}>
            <Icon source="alert-circle" size={20} color="#ff4d4f" />
            <Text style={styles.issueBtnText}>报告故障</Text>
          </TouchableOpacity>
        </View>

        {/* 确认设备正常 */}
        <TouchableOpacity
          style={[styles.confirmBtn, isEquipmentReady && styles.confirmBtnActive]}
          onPress={() => setIsEquipmentReady(!isEquipmentReady)}
        >
          <Icon
            source={isEquipmentReady ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'}
            size={24}
            color={isEquipmentReady ? '#52c41a' : '#999'}
          />
          <Text style={[styles.confirmText, isEquipmentReady && styles.confirmTextActive]}>
            设备已启动并运行正常
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* 底部按钮 */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.nextBtn, !isEquipmentReady && styles.nextBtnDisabled]}
          onPress={handleNext}
          disabled={!isEquipmentReady}
        >
          <Text style={styles.nextBtnText}>下一步：召集人员</Text>
          <Icon source="arrow-right" size={20} color="#fff" />
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
  batchCard: {
    backgroundColor: '#667eea',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  batchNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  batchProduct: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  stepDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepDotActive: {
    backgroundColor: '#667eea',
  },
  stepDotCompleted: {
    backgroundColor: '#52c41a',
  },
  stepDotText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
  },
  stepDotTextInactive: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#999',
  },
  stepLine: {
    width: 40,
    height: 2,
    backgroundColor: '#e0e0e0',
  },
  stepLineCompleted: {
    backgroundColor: '#52c41a',
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
  },
  equipmentCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  equipmentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  equipmentIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  equipmentInfo: {
    flex: 1,
    marginLeft: 12,
  },
  equipmentName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  equipmentId: {
    fontSize: 13,
    color: '#999',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  equipmentStats: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 16,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  statLabel: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#f0f0f0',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  startBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#52c41a',
    borderRadius: 8,
    padding: 14,
  },
  startBtnDisabled: {
    backgroundColor: '#87d068',
  },
  startBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 8,
  },
  issueBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff1f0',
    borderRadius: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: '#ffccc7',
  },
  issueBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ff4d4f',
    marginLeft: 8,
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: '#e0e0e0',
  },
  confirmBtnActive: {
    borderColor: '#52c41a',
    backgroundColor: '#f6ffed',
  },
  confirmText: {
    fontSize: 16,
    color: '#999',
    marginLeft: 12,
  },
  confirmTextActive: {
    color: '#52c41a',
    fontWeight: '600',
  },
  footer: {
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#667eea',
    borderRadius: 8,
    padding: 16,
  },
  nextBtnDisabled: {
    backgroundColor: '#ccc',
  },
  nextBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginRight: 8,
  },
});

export default TaskGuideStep2Screen;
