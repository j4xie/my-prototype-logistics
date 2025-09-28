import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { AlertService } from '../../services/alert/alertService';
import { AlertNotification } from '../../services/api/alertApiClient';
import { useAuthStore } from '../../store/authStore';
import { usePermission } from '../../hooks/usePermission';

interface RouteParams {
  alertId: string;
}

export const AlertDetailScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { alertId } = route.params as RouteParams;
  const { user } = useAuthStore();
  const { hasPermission } = usePermission();

  // 状态管理
  const [alert, setAlert] = useState<AlertNotification | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showAcknowledgeModal, setShowAcknowledgeModal] = useState(false);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [acknowledgeNotes, setAcknowledgeNotes] = useState('');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [correctiveActions, setCorrectiveActions] = useState('');
  const [error, setError] = useState<string | null>(null);

  // 权限检查
  const canManageAlerts = hasPermission('alerts:manage') || hasPermission('admin:all');
  const canResolveAlerts = hasPermission('alerts:resolve') || canManageAlerts;

  // 加载告警详情
  const loadAlertDetail = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await AlertService.getAlertDetail(alertId);
      
      if (response.success && response.alert) {
        setAlert(response.alert);
        console.log('告警详情加载成功:', response.alert);
      } else {
        throw new Error(response.message || '获取告警详情失败');
      }
    } catch (error) {
      console.error('加载告警详情失败:', error);
      setError(error.message || '加载失败');
      Alert.alert('加载失败', error.message || '无法获取告警详情，请重试');
    } finally {
      setLoading(false);
    }
  }, [alertId]);

  // 初始加载
  useEffect(() => {
    loadAlertDetail();
  }, [loadAlertDetail]);

  // 确认告警
  const handleAcknowledge = async () => {
    if (!acknowledgeNotes.trim()) {
      Alert.alert('提示', '请输入确认说明');
      return;
    }

    try {
      setActionLoading(true);
      
      const response = await AlertService.acknowledgeAlert(alertId, acknowledgeNotes);
      
      if (response.success && response.alert) {
        setAlert(response.alert);
        setShowAcknowledgeModal(false);
        setAcknowledgeNotes('');
        Alert.alert('成功', '告警已确认');
      } else {
        Alert.alert('确认失败', response.message || '操作失败');
      }
    } catch (error) {
      Alert.alert('确认失败', '网络错误，请重试');
    } finally {
      setActionLoading(false);
    }
  };

  // 解决告警
  const handleResolve = async () => {
    if (!resolutionNotes.trim()) {
      Alert.alert('提示', '请输入解决方案说明');
      return;
    }

    try {
      setActionLoading(true);
      
      const response = await AlertService.resolveAlert(alertId, {
        resolutionNotes,
        correctiveActions: correctiveActions.trim() || undefined
      });
      
      if (response.success && response.alert) {
        setAlert(response.alert);
        setShowResolveModal(false);
        setResolutionNotes('');
        setCorrectiveActions('');
        Alert.alert('成功', '告警已解决');
      } else {
        Alert.alert('解决失败', response.message || '操作失败');
      }
    } catch (error) {
      Alert.alert('解决失败', '网络错误，请重试');
    } finally {
      setActionLoading(false);
    }
  };

  // 渲染加载状态
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>加载告警详情...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // 渲染错误状态
  if (error || !alert) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="warning" size={48} color="#FF4444" />
          <Text style={styles.errorText}>{error || '告警不存在'}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadAlertDetail}>
            <Text style={styles.retryButtonText}>重试</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const severityInfo = AlertService.getSeverityDisplayInfo(alert.severity);
  const statusInfo = AlertService.getStatusDisplayInfo(alert.status);
  const typeInfo = AlertService.getTypeDisplayInfo(alert.alertType);

  return (
    <SafeAreaView style={styles.container}>
      {/* 头部 */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>告警详情</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={loadAlertDetail}
          >
            <Ionicons name="refresh" size={20} color="#007AFF" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* 告警概览卡片 */}
        <View style={styles.alertCard}>
          {/* 严重程度指示器 */}
          <View style={[styles.severityIndicator, { backgroundColor: severityInfo.color }]} />
          
          <View style={styles.alertHeader}>
            <View style={styles.alertMeta}>
              <View style={styles.typeTag}>
                <Ionicons name={typeInfo.icon as any} size={16} color={typeInfo.color} />
                <Text style={[styles.typeText, { color: typeInfo.color }]}>
                  {typeInfo.label}
                </Text>
              </View>
              
              <View style={[styles.severityTag, { backgroundColor: severityInfo.color + '20' }]}>
                <Text style={[styles.severityText, { color: severityInfo.color }]}>
                  {severityInfo.label}
                </Text>
              </View>
            </View>
            
            <Text style={styles.timeText}>
              {AlertService.formatTime(alert.createdAt)}
            </Text>
          </View>

          {/* 告警标题 */}
          <Text style={styles.alertTitle}>{alert.title}</Text>
          
          {/* 告警消息 */}
          <Text style={styles.alertMessage}>{alert.message}</Text>

          {/* 状态标签 */}
          <View style={styles.statusContainer}>
            <View style={[styles.statusTag, { backgroundColor: statusInfo.color }]}>
              <Ionicons name={statusInfo.icon as any} size={16} color="white" />
              <Text style={styles.statusText}>{statusInfo.label}</Text>
            </View>
          </View>
        </View>

        {/* 告警详细信息 */}
        <View style={styles.detailCard}>
          <Text style={styles.sectionTitle}>详细信息</Text>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>告警ID:</Text>
            <Text style={styles.detailValue}>{alert.id}</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>工厂ID:</Text>
            <Text style={styles.detailValue}>{alert.factoryId}</Text>
          </View>
          
          {alert.sourceId && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>来源ID:</Text>
              <Text style={styles.detailValue}>{alert.sourceId}</Text>
            </View>
          )}
          
          {alert.sourceType && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>来源类型:</Text>
              <Text style={styles.detailValue}>{alert.sourceType}</Text>
            </View>
          )}
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>创建时间:</Text>
            <Text style={styles.detailValue}>
              {new Date(alert.createdAt).toLocaleString('zh-CN')}
            </Text>
          </View>
        </View>

        {/* 处理历史 */}
        {(alert.status !== 'new') && (
          <View style={styles.historyCard}>
            <Text style={styles.sectionTitle}>处理历史</Text>
            
            {alert.status === 'acknowledged' && (
              <View style={styles.historyItem}>
                <View style={styles.historyIcon}>
                  <Ionicons name="checkmark-circle" size={20} color="#FFBB33" />
                </View>
                <View style={styles.historyContent}>
                  <Text style={styles.historyAction}>告警已确认</Text>
                  <Text style={styles.historyTime}>
                    {new Date(alert.createdAt).toLocaleString('zh-CN')}
                  </Text>
                </View>
              </View>
            )}
            
            {alert.resolvedAt && (
              <View style={styles.historyItem}>
                <View style={styles.historyIcon}>
                  <Ionicons name="checkmark-done" size={20} color="#00AA88" />
                </View>
                <View style={styles.historyContent}>
                  <Text style={styles.historyAction}>告警已解决</Text>
                  <Text style={styles.historyTime}>
                    {new Date(alert.resolvedAt).toLocaleString('zh-CN')}
                  </Text>
                  {alert.resolutionNotes && (
                    <Text style={styles.historyNotes}>{alert.resolutionNotes}</Text>
                  )}
                </View>
              </View>
            )}
          </View>
        )}

        {/* 操作按钮 */}
        {canResolveAlerts && alert.status !== 'resolved' && alert.status !== 'closed' && (
          <View style={styles.actionCard}>
            <Text style={styles.sectionTitle}>操作</Text>
            
            <View style={styles.actionButtons}>
              {alert.status === 'new' && (
                <TouchableOpacity
                  style={styles.acknowledgeButton}
                  onPress={() => setShowAcknowledgeModal(true)}
                  disabled={actionLoading}
                >
                  <Ionicons name="checkmark-circle" size={20} color="white" />
                  <Text style={styles.actionButtonText}>确认告警</Text>
                </TouchableOpacity>
              )}
              
              {(alert.status === 'new' || alert.status === 'acknowledged' || alert.status === 'in_progress') && (
                <TouchableOpacity
                  style={styles.resolveButton}
                  onPress={() => setShowResolveModal(true)}
                  disabled={actionLoading}
                >
                  <Ionicons name="checkmark-done" size={20} color="white" />
                  <Text style={styles.actionButtonText}>解决告警</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      </ScrollView>

      {/* 确认告警模态框 */}
      <Modal
        visible={showAcknowledgeModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAcknowledgeModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => setShowAcknowledgeModal(false)}
            >
              <Text style={styles.modalCancelText}>取消</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>确认告警</Text>
            <TouchableOpacity
              onPress={handleAcknowledge}
              disabled={actionLoading || !acknowledgeNotes.trim()}
            >
              <Text style={[
                styles.modalSaveText,
                (!acknowledgeNotes.trim() || actionLoading) && styles.modalSaveDisabled
              ]}>
                {actionLoading ? '处理中...' : '确认'}
              </Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.modalContent}>
            <Text style={styles.inputLabel}>确认说明 *</Text>
            <TextInput
              style={styles.textArea}
              value={acknowledgeNotes}
              onChangeText={setAcknowledgeNotes}
              placeholder="请描述确认情况或后续处理计划..."
              multiline
              numberOfLines={4}
              maxLength={500}
            />
            <Text style={styles.characterCount}>
              {acknowledgeNotes.length}/500
            </Text>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* 解决告警模态框 */}
      <Modal
        visible={showResolveModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowResolveModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => setShowResolveModal(false)}
            >
              <Text style={styles.modalCancelText}>取消</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>解决告警</Text>
            <TouchableOpacity
              onPress={handleResolve}
              disabled={actionLoading || !resolutionNotes.trim()}
            >
              <Text style={[
                styles.modalSaveText,
                (!resolutionNotes.trim() || actionLoading) && styles.modalSaveDisabled
              ]}>
                {actionLoading ? '处理中...' : '解决'}
              </Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.modalContent}>
            <Text style={styles.inputLabel}>解决方案说明 *</Text>
            <TextInput
              style={styles.textArea}
              value={resolutionNotes}
              onChangeText={setResolutionNotes}
              placeholder="请描述问题的解决方案和处理结果..."
              multiline
              numberOfLines={4}
              maxLength={500}
            />
            <Text style={styles.characterCount}>
              {resolutionNotes.length}/500
            </Text>
            
            <Text style={styles.inputLabel}>纠正措施 (可选)</Text>
            <TextInput
              style={styles.textArea}
              value={correctiveActions}
              onChangeText={setCorrectiveActions}
              placeholder="请描述预防类似问题的措施..."
              multiline
              numberOfLines={3}
              maxLength={300}
            />
            <Text style={styles.characterCount}>
              {correctiveActions.length}/300
            </Text>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
  },
  headerActions: {
    flexDirection: 'row',
  },
  refreshButton: {
    padding: 4,
  },
  content: {
    flex: 1,
  },
  alertCard: {
    backgroundColor: 'white',
    margin: 16,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  severityIndicator: {
    width: 4,
    borderRadius: 2,
    marginRight: 12,
  },
  alertHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
    flex: 1,
  },
  alertMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  typeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  typeText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 4,
  },
  severityTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  severityText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  timeText: {
    fontSize: 12,
    color: '#666666',
  },
  alertTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 8,
    flex: 1,
  },
  alertMessage: {
    fontSize: 16,
    color: '#666666',
    lineHeight: 24,
    marginBottom: 12,
    flex: 1,
  },
  statusContainer: {
    alignItems: 'flex-start',
    flex: 1,
  },
  statusTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    fontSize: 14,
    color: 'white',
    marginLeft: 6,
    fontWeight: '500',
  },
  detailCard: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  historyCard: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  actionCard: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  detailLabel: {
    fontSize: 14,
    color: '#666666',
    flex: 1,
  },
  detailValue: {
    fontSize: 14,
    color: '#333333',
    flex: 2,
    textAlign: 'right',
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 8,
  },
  historyIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  historyContent: {
    flex: 1,
  },
  historyAction: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333333',
    marginBottom: 2,
  },
  historyTime: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 4,
  },
  historyNotes: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  acknowledgeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFBB33',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    flex: 0.45,
    justifyContent: 'center',
  },
  resolveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00AA88',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    flex: 0.45,
    justifyContent: 'center',
  },
  actionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 6,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'white',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
  },
  modalCancelText: {
    fontSize: 16,
    color: '#666666',
  },
  modalSaveText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '500',
  },
  modalSaveDisabled: {
    color: '#CCCCCC',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333333',
    marginBottom: 8,
    marginTop: 8,
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333333',
    textAlignVertical: 'top',
    minHeight: 100,
  },
  characterCount: {
    fontSize: 12,
    color: '#999999',
    textAlign: 'right',
    marginTop: 4,
    marginBottom: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#FF4444',
    marginTop: 12,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#007AFF',
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
});

export default AlertDetailScreen;