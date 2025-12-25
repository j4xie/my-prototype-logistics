import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import {
  Text,
  Appbar,
  FAB,
  Card,
  Chip,
  Portal,
  Modal,
  TextInput,
  Button,
  ActivityIndicator,
  List,
  SegmentedButtons,
  Menu,
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { workSessionApiClient, WorkSession, StartSessionRequest } from '../../services/api/workSessionApiClient';
import { useAuthStore } from '../../store/authStore';
import { logger } from '../../utils/logger';

const sessionLogger = logger.createContextLogger('WorkSessionManagement');

/**
 * 工作会话管理页面
 * 权限：factory_super_admin、platform_admin
 * 功能：工作会话管理，开始/结束会话，工时统计
 */
export default function WorkSessionManagementScreen() {
  const navigation = useNavigation();
  const { user } = useAuthStore();

  const [sessions, setSessions] = useState<WorkSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [modalVisible, setModalVisible] = useState(false);
  const [endModalVisible, setEndModalVisible] = useState(false);
  const [selectedSession, setSelectedSession] = useState<WorkSession | null>(null);

  // 权限控制
  const userType = user?.userType || 'factory';
  const roleCode = user?.factoryUser?.role || user?.roleCode || 'viewer';
  const isPlatformAdmin = userType === 'platform';
  const isSuperAdmin = roleCode === 'factory_super_admin';
  const isPermissionAdmin = roleCode === 'permission_admin';
  const isDepartmentAdmin = roleCode === 'department_admin';
  const canManage = isPlatformAdmin || isSuperAdmin || isPermissionAdmin || isDepartmentAdmin;

  // 开始会话表单
  const [startFormData, setStartFormData] = useState<Partial<StartSessionRequest>>({
    userId: user?.id || 0,
    workTypeId: 1,
    hourlyRate: 0,
    notes: '',
  });

  // 结束会话表单
  const [endFormData, setEndFormData] = useState({
    breakMinutes: 0,
    notes: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const response = await workSessionApiClient.getWorkSessions({
        factoryId: user?.factoryId,
        page: 0,
        size: 100,
      });

      setSessions(response.data || []);
      sessionLogger.info('工作会话加载成功', {
        count: response.data?.length || 0,
      });
    } catch (error) {
      sessionLogger.error('加载工作会话失败', error as Error);
      Alert.alert('错误', '加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleStartSession = () => {
    setStartFormData({
      userId: user?.id || 0,
      workTypeId: 1,
      hourlyRate: 0,
      notes: '',
    });
    setModalVisible(true);
  };

  const handleSaveStart = async () => {
    if (!startFormData.userId || !startFormData.workTypeId) {
      Alert.alert('提示', '用户和工作类型不能为空');
      return;
    }

    try {
      await workSessionApiClient.startSession(
        startFormData as StartSessionRequest,
        user?.factoryId
      );
      sessionLogger.info('工作会话已开始', {
        userId: startFormData.userId,
        workTypeId: startFormData.workTypeId,
      });
      Alert.alert('成功', '工作会话已开始');
      setModalVisible(false);
      loadData();
    } catch (error) {
      sessionLogger.error('开始工作会话失败', error as Error);
      Alert.alert('错误', (error as any).response?.data?.message || '操作失败');
    }
  };

  const handleEndSession = (session: WorkSession) => {
    setSelectedSession(session);
    setEndFormData({ breakMinutes: 0, notes: '' });
    setEndModalVisible(true);
  };

  const handleSaveEnd = async () => {
    if (!selectedSession) return;

    try {
      await workSessionApiClient.endSession(
        selectedSession.id,
        endFormData,
        user?.factoryId
      );
      sessionLogger.info('工作会话已结束', { id: selectedSession.id });
      Alert.alert('成功', '工作会话已结束');
      setEndModalVisible(false);
      setSelectedSession(null);
      loadData();
    } catch (error) {
      sessionLogger.error('结束工作会话失败', error as Error);
      Alert.alert('错误', (error as any).response?.data?.message || '操作失败');
    }
  };

  const handleCancelSession = async (session: WorkSession) => {
    Alert.alert(
      '确认取消',
      '确定要取消此工作会话吗？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确认',
          style: 'destructive',
          onPress: async () => {
            try {
              await workSessionApiClient.cancelSession(session.id, user?.factoryId);
              sessionLogger.info('工作会话已取消', { id: session.id });
              Alert.alert('成功', '工作会话已取消');
              loadData();
            } catch (error) {
              sessionLogger.error('取消工作会话失败', error as Error);
              Alert.alert('错误', '操作失败');
            }
          },
        },
      ]
    );
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active': return '进行中';
      case 'completed': return '已完成';
      case 'cancelled': return '已取消';
      default: return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return { bg: '#E3F2FD', text: '#1565C0' };
      case 'completed': return { bg: '#E8F5E9', text: '#2E7D32' };
      case 'cancelled': return { bg: '#FFEBEE', text: '#C62828' };
      default: return { bg: '#F5F5F5', text: '#666' };
    }
  };

  const formatDuration = (minutes?: number) => {
    if (!minutes) return '-';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}小时${mins}分钟`;
  };

  // 筛选会话
  const filteredSessions = sessions.filter(s => {
    if (filterStatus !== 'all' && s.status !== filterStatus) return false;
    return true;
  });

  // 计算统计
  const stats = {
    total: sessions.length,
    active: sessions.filter(s => s.status === 'active').length,
    completed: sessions.filter(s => s.status === 'completed').length,
    totalMinutes: sessions.filter(s => s.status === 'completed')
      .reduce((sum, s) => sum + (s.actualWorkMinutes || 0), 0),
    totalCost: sessions.filter(s => s.status === 'completed')
      .reduce((sum, s) => sum + (s.laborCost || 0), 0),
  };

  if (!canManage) {
    return (
      <View style={styles.container}>
        <Appbar.Header>
          <Appbar.BackAction onPress={() => navigation.goBack()} />
          <Appbar.Content title="工作会话管理" />
        </Appbar.Header>
        <View style={styles.noPermission}>
          <List.Icon icon="lock" color="#999" />
          <Text style={styles.noPermissionText}>您没有权限访问此页面</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="工作会话管理" />
        <Appbar.Action icon="refresh" onPress={loadData} />
      </Appbar.Header>

      <ScrollView style={styles.content}>
        {/* Filter */}
        <Card style={styles.filterCard}>
          <Card.Content>
            <SegmentedButtons
              value={filterStatus}
              onValueChange={setFilterStatus}
              buttons={[
                { value: 'all', label: '全部' },
                { value: 'active', label: '进行中' },
                { value: 'completed', label: '已完成' },
              ]}
            />
          </Card.Content>
        </Card>

        {/* Stats */}
        <Card style={styles.statsCard}>
          <Card.Content>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{stats.total}</Text>
                <Text style={styles.statLabel}>总数</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: '#1565C0' }]}>{stats.active}</Text>
                <Text style={styles.statLabel}>进行中</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: '#2E7D32' }]}>{formatDuration(stats.totalMinutes)}</Text>
                <Text style={styles.statLabel}>总工时</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: '#E65100' }]}>¥{stats.totalCost.toFixed(0)}</Text>
                <Text style={styles.statLabel}>总人工成本</Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* List */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" />
            <Text style={styles.loadingText}>加载中...</Text>
          </View>
        ) : filteredSessions.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Card.Content style={styles.emptyContent}>
              <List.Icon icon="clock-outline" color="#999" />
              <Text style={styles.emptyText}>暂无工作会话</Text>
            </Card.Content>
          </Card>
        ) : (
          filteredSessions.map((session) => {
            const statusColor = getStatusColor(session.status);
            return (
              <Card key={session.id} style={styles.sessionCard}>
                <Card.Content>
                  <View style={styles.sessionHeader}>
                    <View style={styles.sessionTitleRow}>
                      <View>
                        <Text style={styles.sessionId}>会话 #{session.id}</Text>
                        <Text style={styles.sessionUser}>用户ID: {session.userId}</Text>
                      </View>
                      <Chip
                        mode="flat"
                        compact
                        style={[styles.statusChip, { backgroundColor: statusColor.bg }]}
                        textStyle={{ color: statusColor.text, fontSize: 11 }}
                      >
                        {getStatusLabel(session.status)}
                      </Chip>
                    </View>
                  </View>

                  <View style={styles.infoSection}>
                    <View style={styles.infoRow}>
                      <List.Icon icon="clock-start" style={styles.infoIcon} />
                      <Text style={styles.infoText}>开始: {session.startTime}</Text>
                    </View>
                    {session.endTime && (
                      <View style={styles.infoRow}>
                        <List.Icon icon="clock-end" style={styles.infoIcon} />
                        <Text style={styles.infoText}>结束: {session.endTime}</Text>
                      </View>
                    )}
                    {session.actualWorkMinutes !== undefined && (
                      <View style={styles.infoRow}>
                        <List.Icon icon="timer" style={styles.infoIcon} />
                        <Text style={styles.infoText}>
                          工时: {formatDuration(session.actualWorkMinutes)}
                        </Text>
                      </View>
                    )}
                    {session.laborCost !== undefined && session.laborCost > 0 && (
                      <View style={styles.infoRow}>
                        <List.Icon icon="currency-cny" style={styles.infoIcon} />
                        <Text style={styles.infoText}>
                          人工成本: ¥{session.laborCost.toFixed(2)}
                        </Text>
                      </View>
                    )}
                  </View>

                  {session.status === 'active' && (
                    <View style={styles.actionRow}>
                      <Button
                        mode="contained"
                        icon="stop"
                        onPress={() => handleEndSession(session)}
                        style={styles.actionButton}
                        compact
                      >
                        结束会话
                      </Button>
                      <Button
                        mode="outlined"
                        icon="close"
                        onPress={() => handleCancelSession(session)}
                        style={styles.actionButton}
                        compact
                        textColor="#C62828"
                      >
                        取消
                      </Button>
                    </View>
                  )}
                </Card.Content>
              </Card>
            );
          })
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Start Session Modal */}
      <Portal>
        <Modal
          visible={modalVisible}
          onDismiss={() => setModalVisible(false)}
          contentContainerStyle={styles.modalContent}
        >
          <Text style={styles.modalTitle}>开始工作会话</Text>

          <ScrollView style={styles.modalScrollView}>
            <TextInput
              label="用户ID"
              value={startFormData.userId?.toString() || ''}
              onChangeText={(text) => setStartFormData({ ...startFormData, userId: parseInt(text) || 0 })}
              mode="outlined"
              style={styles.input}
              keyboardType="numeric"
            />

            <TextInput
              label="工作类型ID"
              value={startFormData.workTypeId?.toString() || ''}
              onChangeText={(text) => setStartFormData({ ...startFormData, workTypeId: parseInt(text) || 1 })}
              mode="outlined"
              style={styles.input}
              keyboardType="numeric"
            />

            <TextInput
              label="时薪 (元/小时)"
              value={startFormData.hourlyRate?.toString() || ''}
              onChangeText={(text) => setStartFormData({ ...startFormData, hourlyRate: parseFloat(text) || 0 })}
              mode="outlined"
              style={styles.input}
              keyboardType="numeric"
            />

            <TextInput
              label="备注"
              value={startFormData.notes}
              onChangeText={(text) => setStartFormData({ ...startFormData, notes: text })}
              mode="outlined"
              style={styles.input}
              multiline
              numberOfLines={2}
            />
          </ScrollView>

          <View style={styles.modalActions}>
            <Button
              mode="outlined"
              onPress={() => setModalVisible(false)}
              style={styles.modalButton}
            >
              取消
            </Button>
            <Button
              mode="contained"
              onPress={handleSaveStart}
              style={styles.modalButton}
            >
              开始
            </Button>
          </View>
        </Modal>
      </Portal>

      {/* End Session Modal */}
      <Portal>
        <Modal
          visible={endModalVisible}
          onDismiss={() => setEndModalVisible(false)}
          contentContainerStyle={styles.modalContent}
        >
          <Text style={styles.modalTitle}>结束工作会话</Text>

          <ScrollView style={styles.modalScrollView}>
            <TextInput
              label="休息时间 (分钟)"
              value={endFormData.breakMinutes?.toString() || ''}
              onChangeText={(text) => setEndFormData({ ...endFormData, breakMinutes: parseInt(text) || 0 })}
              mode="outlined"
              style={styles.input}
              keyboardType="numeric"
            />

            <TextInput
              label="备注"
              value={endFormData.notes}
              onChangeText={(text) => setEndFormData({ ...endFormData, notes: text })}
              mode="outlined"
              style={styles.input}
              multiline
              numberOfLines={2}
            />
          </ScrollView>

          <View style={styles.modalActions}>
            <Button
              mode="outlined"
              onPress={() => setEndModalVisible(false)}
              style={styles.modalButton}
            >
              取消
            </Button>
            <Button
              mode="contained"
              onPress={handleSaveEnd}
              style={styles.modalButton}
            >
              确认结束
            </Button>
          </View>
        </Modal>
      </Portal>

      {/* FAB */}
      {canManage && (
        <FAB
          icon="play"
          style={styles.fab}
          onPress={handleStartSession}
          label="开始会话"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
  },
  noPermission: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  noPermissionText: {
    fontSize: 18,
    color: '#999',
    marginTop: 16,
  },
  filterCard: {
    margin: 16,
    marginBottom: 8,
  },
  statsCard: {
    margin: 16,
    marginBottom: 8,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    flexWrap: 'wrap',
  },
  statItem: {
    alignItems: 'center',
    minWidth: 70,
    marginBottom: 8,
  },
  statValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  statLabel: {
    fontSize: 11,
    color: '#666',
    marginTop: 4,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    color: '#666',
  },
  emptyCard: {
    margin: 16,
  },
  emptyContent: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 8,
  },
  sessionCard: {
    margin: 16,
    marginBottom: 8,
  },
  sessionHeader: {
    marginBottom: 12,
  },
  sessionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  sessionId: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  sessionUser: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  statusChip: {
    height: 24,
  },
  infoSection: {
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  infoIcon: {
    margin: 0,
    marginRight: 4,
    width: 28,
  },
  infoText: {
    fontSize: 13,
    color: '#666',
    flex: 1,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  actionButton: {
    flex: 1,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
  },
  modalContent: {
    backgroundColor: 'white',
    padding: 20,
    margin: 20,
    borderRadius: 8,
    maxHeight: '85%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  input: {
    marginBottom: 12,
  },
  modalScrollView: {
    flexGrow: 0,
    flexShrink: 1,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    paddingTop: 16,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  modalButton: {
    minWidth: 100,
  },
  bottomPadding: {
    height: 80,
  },
});
