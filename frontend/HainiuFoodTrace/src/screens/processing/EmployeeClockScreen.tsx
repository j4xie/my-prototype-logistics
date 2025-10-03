import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BigButton, TimerDisplay } from '../../components/processing';
import { processingApiClient } from '../../services/api/processingApiClient';
import { useAuthStore } from '../../store/authStore';
import { WorkSession } from '../../types/costAccounting';
import { formatCurrency, formatDuration } from '../../types/costAccounting';

interface EmployeeClockScreenProps {
  navigation: any;
}

/**
 * 员工打卡界面
 * 工作流程2: 员工上下班打卡和工作记录
 */
export const EmployeeClockScreen: React.FC<EmployeeClockScreenProps> = ({ navigation }) => {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [activeSession, setActiveSession] = useState<WorkSession | null>(null);
  const [processedQuantity, setProcessedQuantity] = useState(0);
  const [batchId, setBatchId] = useState('');
  const [checkingSession, setCheckingSession] = useState(true);

  // 检查是否有活动的工作时段
  useEffect(() => {
    checkActiveSession();
  }, []);

  const checkActiveSession = async () => {
    try {
      setCheckingSession(true);
      const response = await processingApiClient.getActiveWorkSession();

      if (response.success && response.data) {
        setActiveSession(response.data);
        setBatchId(response.data.batchId);
      } else {
        setActiveSession(null);
      }
    } catch (error: any) {
      console.error('检查活动工作时段失败:', error);
    } finally {
      setCheckingSession(false);
    }
  };

  // 上班打卡
  const handleClockIn = async () => {
    if (!batchId) {
      Alert.alert('提示', '请先选择或扫描批次');
      return;
    }

    try {
      setLoading(true);
      const response = await processingApiClient.clockIn({
        batchId,
        notes: `${user?.fullName || '员工'} 上班打卡`,
      });

      if (response.success) {
        setActiveSession(response.data);
        Alert.alert('成功', '上班打卡成功！');
      } else {
        Alert.alert('失败', response.message || '打卡失败，请重试');
      }
    } catch (error: any) {
      console.error('上班打卡失败:', error);
      Alert.alert('错误', error.message || '网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  // 下班打卡
  const handleClockOut = async () => {
    if (!activeSession) {
      Alert.alert('提示', '未找到活动的工作时段');
      return;
    }

    Alert.alert(
      '确认下班打卡',
      `加工数量: ${processedQuantity}kg\n确认要下班打卡吗？`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确认',
          onPress: async () => {
            try {
              setLoading(true);
              const response = await processingApiClient.clockOut({
                sessionId: activeSession.id,
                processedQuantity,
                notes: `${user?.fullName || '员工'} 下班打卡`,
              });

              if (response.success) {
                // 显示工作总结
                Alert.alert(
                  '下班打卡成功',
                  `工作时长: ${formatDuration(response.data.totalMinutes)}\n` +
                  `加工数量: ${processedQuantity}kg\n` +
                  `人工成本: ${formatCurrency(response.data.laborCost)}`,
                  [
                    {
                      text: '查看详情',
                      onPress: () => navigation.navigate('WorkSessionDetail', { sessionId: response.data.id }),
                    },
                    {
                      text: '完成',
                      onPress: () => {
                        setActiveSession(null);
                        setProcessedQuantity(0);
                        setBatchId('');
                      },
                    },
                  ]
                );
              } else {
                Alert.alert('失败', response.message || '打卡失败，请重试');
              }
            } catch (error: any) {
              console.error('下班打卡失败:', error);
              Alert.alert('错误', error.message || '网络错误，请稍后重试');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  // 扫码选择批次
  const handleScanBatch = () => {
    Alert.alert('扫码功能', '扫码功能正在开发中\n请手动输入批次ID或从列表选择');
  };

  // 选择批次
  const handleSelectBatch = () => {
    navigation.navigate('BatchList', {
      onSelect: (selectedBatchId: string) => {
        setBatchId(selectedBatchId);
      },
    });
  };

  // 加工数量调整
  const adjustQuantity = (delta: number) => {
    setProcessedQuantity(prev => Math.max(0, prev + delta));
  };

  if (checkingSession) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>检查工作状态...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* 头部 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={28} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>员工打卡</Text>
        <TouchableOpacity onPress={checkActiveSession}>
          <Ionicons name="refresh" size={28} color="#3B82F6" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* 员工信息 */}
        <View style={styles.userCard}>
          <View style={styles.userAvatar}>
            <Ionicons name="person" size={32} color="#3B82F6" />
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{user?.fullName || '员工'}</Text>
            <Text style={styles.userDepartment}>{user?.department || '生产部'}</Text>
          </View>
          <View style={[
            styles.statusBadge,
            activeSession ? styles.statusBadgeActive : styles.statusBadgeInactive,
          ]}>
            <Text style={[
              styles.statusText,
              activeSession ? styles.statusTextActive : styles.statusTextInactive,
            ]}>
              {activeSession ? '工作中' : '未打卡'}
            </Text>
          </View>
        </View>

        {/* 批次选择 */}
        {!activeSession && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>选择批次</Text>
            <View style={styles.batchSelection}>
              <TouchableOpacity
                style={styles.batchButton}
                onPress={handleScanBatch}
              >
                <Ionicons name="scan" size={32} color="#3B82F6" />
                <Text style={styles.batchButtonText}>扫码选择</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.batchButton}
                onPress={handleSelectBatch}
              >
                <Ionicons name="list" size={32} color="#10B981" />
                <Text style={styles.batchButtonText}>列表选择</Text>
              </TouchableOpacity>
            </View>
            {batchId && (
              <View style={styles.selectedBatch}>
                <Text style={styles.selectedBatchLabel}>已选批次:</Text>
                <Text style={styles.selectedBatchValue}>{batchId}</Text>
              </View>
            )}
          </View>
        )}

        {/* 当前批次信息(已打卡) */}
        {activeSession && (
          <View style={styles.batchInfoCard}>
            <View style={styles.batchInfoHeader}>
              <Ionicons name="cube" size={24} color="#3B82F6" />
              <Text style={styles.batchInfoTitle}>当前批次</Text>
            </View>
            <Text style={styles.batchNumber}>{activeSession.batch.batchNumber}</Text>
            <Text style={styles.batchProduct}>{activeSession.batch.productType}</Text>
          </View>
        )}

        {/* 计时器显示(已打卡) */}
        {activeSession && (
          <View style={styles.section}>
            <TimerDisplay
              startTime={activeSession.startTime}
              ccrRate={activeSession.ccrRate}
              isActive={true}
            />
          </View>
        )}

        {/* 加工数量输入(已打卡) */}
        {activeSession && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>加工数量</Text>
            <View style={styles.quantityControl}>
              <TouchableOpacity
                style={styles.quantityButton}
                onPress={() => adjustQuantity(-10)}
              >
                <Ionicons name="remove-circle" size={48} color="#EF4444" />
              </TouchableOpacity>

              <View style={styles.quantityDisplay}>
                <Text style={styles.quantityValue}>{processedQuantity}</Text>
                <Text style={styles.quantityUnit}>kg</Text>
              </View>

              <TouchableOpacity
                style={styles.quantityButton}
                onPress={() => adjustQuantity(10)}
              >
                <Ionicons name="add-circle" size={48} color="#10B981" />
              </TouchableOpacity>
            </View>

            {/* 快捷调整按钮 */}
            <View style={styles.quickQuantityButtons}>
              <TouchableOpacity
                style={styles.quickQuantityButton}
                onPress={() => adjustQuantity(1)}
              >
                <Text style={styles.quickQuantityButtonText}>+1</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickQuantityButton}
                onPress={() => adjustQuantity(5)}
              >
                <Text style={styles.quickQuantityButtonText}>+5</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickQuantityButton}
                onPress={() => adjustQuantity(50)}
              >
                <Text style={styles.quickQuantityButtonText}>+50</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickQuantityButton}
                onPress={() => setProcessedQuantity(0)}
              >
                <Text style={[styles.quickQuantityButtonText, { color: '#EF4444' }]}>清零</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* 底部打卡按钮 */}
      <View style={styles.footer}>
        {!activeSession ? (
          <BigButton
            title={loading ? '打卡中...' : '上班打卡'}
            icon="log-in"
            variant="success"
            onPress={handleClockIn}
            disabled={loading || !batchId}
            loading={loading}
            size="xlarge"
          />
        ) : (
          <BigButton
            title={loading ? '打卡中...' : '下班打卡'}
            icon="log-out"
            variant="danger"
            onPress={handleClockOut}
            disabled={loading}
            loading={loading}
            size="xlarge"
          />
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  userAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  userDepartment: {
    fontSize: 14,
    color: '#6B7280',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusBadgeActive: {
    backgroundColor: '#D1FAE5',
  },
  statusBadgeInactive: {
    backgroundColor: '#F3F4F6',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  statusTextActive: {
    color: '#10B981',
  },
  statusTextInactive: {
    color: '#6B7280',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  batchSelection: {
    flexDirection: 'row',
    gap: 12,
  },
  batchButton: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  batchButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginTop: 8,
  },
  selectedBatch: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectedBatchLabel: {
    fontSize: 14,
    color: '#3B82F6',
    fontWeight: '500',
  },
  selectedBatchValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#3B82F6',
  },
  batchInfoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  batchInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  batchInfoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
    marginLeft: 8,
  },
  batchNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  batchProduct: {
    fontSize: 16,
    color: '#6B7280',
  },
  quantityControl: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  quantityButton: {
    padding: 8,
  },
  quantityDisplay: {
    alignItems: 'center',
  },
  quantityValue: {
    fontSize: 56,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  quantityUnit: {
    fontSize: 20,
    color: '#6B7280',
    marginTop: 4,
  },
  quickQuantityButtons: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 8,
  },
  quickQuantityButton: {
    flex: 1,
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  quickQuantityButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3B82F6',
  },
  footer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
});
