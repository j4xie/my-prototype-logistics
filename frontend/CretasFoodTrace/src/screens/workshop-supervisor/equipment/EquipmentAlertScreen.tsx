/**
 * 设备告警详情页面
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
import { useTranslation } from 'react-i18next';
import { WSEquipmentStackParamList } from '../../../types/navigation';

type RouteProps = RouteProp<WSEquipmentStackParamList, 'EquipmentAlert'>;

export function EquipmentAlertScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProps>();
  const { t } = useTranslation('workshop');

  const [isHandled, setIsHandled] = useState(false);

  // 模拟告警数据
  const alert = {
    id: route.params?.alertId || '1',
    equipmentId: 'EQ-001',
    equipmentName: '切片机A',
    type: 'warning',
    title: '温度异常警告',
    description: '设备运行温度超过正常范围，当前温度82°C，正常范围60-75°C',
    timestamp: '2025-12-27 10:15:23',
    priority: 'high',
    status: 'active',
    location: '加工车间-A区-3号工位',
    suggestedActions: [
      '立即检查冷却系统是否正常运行',
      '检查通风口是否堵塞',
      '降低设备运行功率',
      '如持续报警，请联系维护工程师',
    ],
    history: [
      { time: '10:15:23', event: '触发告警', operator: '系统' },
      { time: '10:16:05', event: '通知已发送', operator: '系统' },
    ],
  };

  const getPriorityStyle = (priority: string) => {
    switch (priority) {
      case 'high':
        return { text: t('equipment.alert.priority.high'), color: '#ff4d4f', bg: '#fff1f0', icon: 'alert-circle' };
      case 'medium':
        return { text: t('equipment.alert.priority.medium'), color: '#faad14', bg: '#fff7e6', icon: 'alert' };
      case 'low':
        return { text: t('equipment.alert.priority.low'), color: '#1890ff', bg: '#e6f7ff', icon: 'information' };
      default:
        return { text: t('equipment.alert.priority.unknown'), color: '#999', bg: '#f5f5f5', icon: 'help-circle' };
    }
  };

  const priorityStyle = getPriorityStyle(alert.priority);

  const handleAcknowledge = () => {
    Alert.alert(
      t('equipment.alert.confirmHandle'),
      t('equipment.alert.confirmHandleMsg'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.confirm'),
          onPress: () => {
            setIsHandled(true);
            Alert.alert(t('common.confirm'), t('equipment.alert.handleSuccess'));
          },
        },
      ]
    );
  };

  const handleEscalate = () => {
    Alert.alert(
      t('equipment.alert.escalate'),
      t('equipment.alert.escalateMsg'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('equipment.alert.escalateConfirm'),
          onPress: () => {
            Alert.alert(t('common.confirm'), t('equipment.alert.escalateSuccess'));
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 头部 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon source="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('equipment.alert.title')}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* 告警卡片 */}
        <View style={[styles.alertCard, { borderLeftColor: priorityStyle.color }]}>
          <View style={styles.alertHeader}>
            <View style={[styles.priorityBadge, { backgroundColor: priorityStyle.bg }]}>
              <Icon source={priorityStyle.icon} size={16} color={priorityStyle.color} />
              <Text style={[styles.priorityText, { color: priorityStyle.color }]}>
                {priorityStyle.text}
              </Text>
            </View>
            {isHandled && (
              <View style={styles.handledBadge}>
                <Icon source="check" size={14} color="#52c41a" />
                <Text style={styles.handledText}>{t('equipment.alert.handled')}</Text>
              </View>
            )}
          </View>
          <Text style={styles.alertTitle}>{alert.title}</Text>
          <Text style={styles.alertDescription}>{alert.description}</Text>
          <View style={styles.alertMeta}>
            <Icon source="clock-outline" size={14} color="#999" />
            <Text style={styles.alertMetaText}>{alert.timestamp}</Text>
          </View>
        </View>

        {/* 设备信息 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('equipment.alert.equipmentInfo')}</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{t('equipment.alert.equipmentName')}</Text>
              <Text style={styles.infoValue}>{alert.equipmentName}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{t('equipment.alert.equipmentId')}</Text>
              <Text style={styles.infoValue}>{alert.equipmentId}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{t('equipment.alert.location')}</Text>
              <Text style={styles.infoValue}>{alert.location}</Text>
            </View>
          </View>
        </View>

        {/* 建议操作 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('equipment.alert.suggestedActions')}</Text>
          <View style={styles.suggestionsCard}>
            {alert.suggestedActions.map((action, index) => (
              <View key={index} style={styles.suggestionItem}>
                <View style={styles.suggestionNumber}>
                  <Text style={styles.suggestionNumberText}>{index + 1}</Text>
                </View>
                <Text style={styles.suggestionText}>{action}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* 处理历史 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('equipment.alert.handleHistory')}</Text>
          <View style={styles.historyCard}>
            {alert.history.map((item, index) => (
              <View key={index} style={styles.historyItem}>
                <View style={styles.historyDot} />
                <View style={styles.historyContent}>
                  <Text style={styles.historyEvent}>{item.event}</Text>
                  <Text style={styles.historyMeta}>
                    {item.time} · {item.operator}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* 底部按钮 */}
      {!isHandled && (
        <View style={styles.footer}>
          <TouchableOpacity style={styles.escalateBtn} onPress={handleEscalate}>
            <Icon source="arrow-up-circle" size={20} color="#667eea" />
            <Text style={styles.escalateBtnText}>{t('equipment.alert.escalate')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.acknowledgeBtn} onPress={handleAcknowledge}>
            <Icon source="check-circle" size={20} color="#fff" />
            <Text style={styles.acknowledgeBtnText}>{t('equipment.alert.confirmButton')}</Text>
          </TouchableOpacity>
        </View>
      )}
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
  alertCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    marginBottom: 20,
  },
  alertHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  priorityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  priorityText: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  handledBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#f6ffed',
    borderRadius: 10,
  },
  handledText: {
    fontSize: 12,
    color: '#52c41a',
    marginLeft: 4,
  },
  alertTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  alertDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 12,
  },
  alertMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  alertMetaText: {
    fontSize: 12,
    color: '#999',
    marginLeft: 4,
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
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f0f0f0',
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
  },
  infoValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  suggestionsCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
  },
  suggestionNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  suggestionNumberText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
  },
  suggestionText: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    lineHeight: 22,
  },
  historyCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
  },
  historyItem: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  historyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#667eea',
    marginTop: 6,
    marginRight: 12,
  },
  historyContent: {
    flex: 1,
  },
  historyEvent: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  historyMeta: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  footer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    gap: 12,
  },
  escalateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f5ff',
    borderWidth: 1,
    borderColor: '#667eea',
    borderRadius: 8,
    padding: 14,
    flex: 1,
  },
  escalateBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#667eea',
    marginLeft: 6,
  },
  acknowledgeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#52c41a',
    borderRadius: 8,
    padding: 14,
    flex: 2,
  },
  acknowledgeBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 6,
  },
});

export default EquipmentAlertScreen;
