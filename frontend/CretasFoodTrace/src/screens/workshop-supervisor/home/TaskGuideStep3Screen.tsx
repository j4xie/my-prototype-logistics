/**
 * 任务执行引导 - 步骤3: 召集人员
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
import { useTranslation } from 'react-i18next';
import { WSHomeStackParamList } from '../../../types/navigation';

type NavigationProp = NativeStackNavigationProp<WSHomeStackParamList, 'TaskGuideStep3'>;
type RouteProps = RouteProp<WSHomeStackParamList, 'TaskGuideStep3'>;

interface AssignedWorker {
  id: number;
  name: string;
  employeeId: string;
  role: string;
  efficiency: number;
  status: 'ready' | 'pending' | 'absent';
}

export function TaskGuideStep3Screen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const { t } = useTranslation('workshop');
  const { batchId, batchNumber } = route.params || {};

  const [isAllReady, setIsAllReady] = useState(false);

  // 模拟分配的人员列表
  const [assignedWorkers] = useState<AssignedWorker[]>([
    { id: 1, name: '王建国', employeeId: 'EMP-001', role: '切片操作员', efficiency: 96, status: 'ready' },
    { id: 2, name: '李明辉', employeeId: 'EMP-002', role: '包装操作员', efficiency: 92, status: 'ready' },
    { id: 3, name: '刘晓峰', employeeId: 'EMP-003', role: '清洗操作员', efficiency: 88, status: 'ready' },
  ]);

  const readyCount = assignedWorkers.filter(w => w.status === 'ready').length;
  const allReady = readyCount === assignedWorkers.length;

  const handleStartProduction = () => {
    Alert.alert(
      t('taskGuideDetail.step3.confirmStart'),
      t('taskGuideDetail.step3.confirmStartMsg', { batchNumber: batchNumber || 'PB-20251227-001' }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('taskGuideDetail.step3.confirmButton'),
          onPress: () => {
            // 跳转到批次详情页
            navigation.navigate('BatchDetail', { batchId: batchId || '1' });
          },
        },
      ]
    );
  };

  const getEfficiencyGrade = (efficiency: number) => {
    if (efficiency >= 95) return { grade: 'A', color: '#52c41a' };
    if (efficiency >= 85) return { grade: 'B', color: '#1890ff' };
    if (efficiency >= 75) return { grade: 'C', color: '#faad14' };
    return { grade: 'D', color: '#ff4d4f' };
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 头部 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon source="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('taskGuideDetail.title')}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* 批次信息 */}
        <View style={styles.batchCard}>
          <Text style={styles.batchNumber}>{batchNumber || 'PB-20251227-001'}</Text>
          <Text style={styles.batchProduct}>{t('taskGuideDetail.batchProduct', { product: '带鱼片', target: '80' })}</Text>
        </View>

        {/* 步骤指示器 */}
        <View style={styles.stepIndicator}>
          <View style={[styles.stepDot, styles.stepDotCompleted]}>
            <Icon source="check" size={16} color="#fff" />
          </View>
          <View style={[styles.stepLine, styles.stepLineCompleted]} />
          <View style={[styles.stepDot, styles.stepDotCompleted]}>
            <Icon source="check" size={16} color="#fff" />
          </View>
          <View style={[styles.stepLine, styles.stepLineCompleted]} />
          <View style={[styles.stepDot, styles.stepDotActive]}>
            <Text style={styles.stepDotText}>3</Text>
          </View>
        </View>

        {/* 步骤标题 */}
        <View style={styles.stepHeader}>
          <Icon source="account-group" size={24} color="#667eea" />
          <Text style={styles.stepTitle}>{t('taskGuideDetail.step3.title')}</Text>
        </View>

        {/* 人员统计 */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: '#f6ffed' }]}>
            <Text style={[styles.statValue, { color: '#52c41a' }]}>{readyCount}</Text>
            <Text style={styles.statLabel}>{t('taskGuideDetail.step3.stats.ready')}</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#fff7e6' }]}>
            <Text style={[styles.statValue, { color: '#faad14' }]}>
              {assignedWorkers.length - readyCount}
            </Text>
            <Text style={styles.statLabel}>{t('taskGuideDetail.step3.stats.pending')}</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#f0f5ff' }]}>
            <Text style={[styles.statValue, { color: '#667eea' }]}>{assignedWorkers.length}</Text>
            <Text style={styles.statLabel}>{t('taskGuideDetail.step3.stats.total')}</Text>
          </View>
        </View>

        {/* 人员列表 */}
        <View style={styles.workersSection}>
          <Text style={styles.sectionTitle}>{t('taskGuideDetail.step3.assignedWorkers')}</Text>
          {assignedWorkers.map((worker) => {
            const effGrade = getEfficiencyGrade(worker.efficiency);
            return (
              <View key={worker.id} style={styles.workerCard}>
                <View style={styles.workerAvatar}>
                  <Text style={styles.workerAvatarText}>{worker.name.charAt(0)}</Text>
                  <View
                    style={[
                      styles.statusDot,
                      { backgroundColor: worker.status === 'ready' ? '#52c41a' : '#faad14' },
                    ]}
                  />
                </View>

                <View style={styles.workerInfo}>
                  <Text style={styles.workerName}>{worker.name}</Text>
                  <Text style={styles.workerMeta}>
                    {worker.employeeId} | {worker.role}
                  </Text>
                </View>

                <View style={styles.workerRight}>
                  <View style={styles.efficiencyBadge}>
                    <Text style={[styles.efficiencyText, { color: effGrade.color }]}>
                      {effGrade.grade}
                    </Text>
                  </View>
                  <Text style={styles.efficiencyValue}>{worker.efficiency}%</Text>
                </View>

                <Icon
                  source={worker.status === 'ready' ? 'check-circle' : 'clock-outline'}
                  size={24}
                  color={worker.status === 'ready' ? '#52c41a' : '#faad14'}
                />
              </View>
            );
          })}
        </View>

        {/* 确认人员到齐 */}
        <TouchableOpacity
          style={[styles.confirmBtn, isAllReady && styles.confirmBtnActive]}
          onPress={() => setIsAllReady(!isAllReady)}
        >
          <Icon
            source={isAllReady ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'}
            size={24}
            color={isAllReady ? '#52c41a' : '#999'}
          />
          <Text style={[styles.confirmText, isAllReady && styles.confirmTextActive]}>
            {t('taskGuideDetail.step3.personnelReady')}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* 底部按钮 */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.startBtn, !(isAllReady && allReady) && styles.startBtnDisabled]}
          onPress={handleStartProduction}
          disabled={!(isAllReady && allReady)}
        >
          <Icon source="play-circle" size={24} color="#fff" />
          <Text style={styles.startBtnText}>{t('taskGuideDetail.step3.startProduction')}</Text>
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
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 8,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 11,
    color: '#666',
    marginTop: 4,
  },
  workersSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 12,
  },
  workerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  workerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  workerAvatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  statusDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#fff',
  },
  workerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  workerName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  workerMeta: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  workerRight: {
    alignItems: 'center',
    marginRight: 12,
  },
  efficiencyBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f0f5ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  efficiencyText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  efficiencyValue: {
    fontSize: 10,
    color: '#999',
    marginTop: 2,
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
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#52c41a',
    borderRadius: 8,
    padding: 16,
  },
  startBtnDisabled: {
    backgroundColor: '#ccc',
  },
  startBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 8,
  },
});

export default TaskGuideStep3Screen;
