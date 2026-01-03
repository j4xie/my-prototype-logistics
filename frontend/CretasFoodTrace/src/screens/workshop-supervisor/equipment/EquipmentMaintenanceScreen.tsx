/**
 * 设备维护记录页面
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Alert,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Icon } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { WSEquipmentStackParamList } from '../../../types/navigation';

type RouteProps = RouteProp<WSEquipmentStackParamList, 'EquipmentMaintenance'>;

interface MaintenanceRecord {
  id: string;
  type: 'routine' | 'repair' | 'inspection';
  title: string;
  description: string;
  date: string;
  duration: string;
  technician: string;
  status: 'completed' | 'pending' | 'scheduled';
}

export function EquipmentMaintenanceScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProps>();
  const { t } = useTranslation('workshop');

  // 设备信息
  const equipment = {
    id: route.params?.equipmentId || 'EQ-001',
    name: '切片机A',
    lastMaintenance: '2025-12-20',
    nextMaintenance: '2026-01-20',
    maintenanceCycle: 30,
    status: 'normal',
  };

  // 维护记录
  const records: MaintenanceRecord[] = [
    {
      id: '1',
      type: 'routine',
      title: '定期保养',
      description: '更换润滑油、检查传动带、清洁过滤器',
      date: '2025-12-20',
      duration: '2小时',
      technician: '刘工',
      status: 'completed',
    },
    {
      id: '2',
      type: 'repair',
      title: '刀片更换',
      description: '更换磨损刀片，调整切片厚度',
      date: '2025-12-15',
      duration: '1.5小时',
      technician: '张工',
      status: 'completed',
    },
    {
      id: '3',
      type: 'inspection',
      title: '安全检查',
      description: '检查安全防护装置、紧急停止功能',
      date: '2025-12-10',
      duration: '0.5小时',
      technician: '王工',
      status: 'completed',
    },
    {
      id: '4',
      type: 'routine',
      title: '定期保养',
      description: '计划性维护保养',
      date: '2026-01-20',
      duration: '预计2小时',
      technician: '待分配',
      status: 'scheduled',
    },
  ];

  const getTypeStyle = (type: string) => {
    switch (type) {
      case 'routine':
        return { text: t('equipment.maintenance.types.routine'), color: '#52c41a', bg: '#f6ffed', icon: 'wrench' };
      case 'repair':
        return { text: t('equipment.maintenance.types.repair'), color: '#faad14', bg: '#fff7e6', icon: 'tools' };
      case 'inspection':
        return { text: t('equipment.maintenance.types.inspection'), color: '#1890ff', bg: '#e6f7ff', icon: 'clipboard-check' };
      default:
        return { text: t('equipment.maintenance.types.other'), color: '#999', bg: '#f5f5f5', icon: 'help-circle' };
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'completed':
        return { text: t('equipment.maintenance.status.completed'), color: '#52c41a' };
      case 'pending':
        return { text: t('equipment.maintenance.status.pending'), color: '#1890ff' };
      case 'scheduled':
        return { text: t('equipment.maintenance.status.scheduled'), color: '#999' };
      default:
        return { text: t('equipment.maintenance.status.unknown'), color: '#999' };
    }
  };

  const handleRequestMaintenance = () => {
    Alert.alert(
      t('equipment.maintenance.requestMaintenance'),
      t('equipment.maintenance.requestConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.confirm'),
          onPress: () => {
            Alert.alert(t('common.confirm'), t('equipment.maintenance.requestSuccess'));
          },
        },
      ]
    );
  };

  const renderRecord = ({ item }: { item: MaintenanceRecord }) => {
    const typeStyle = getTypeStyle(item.type);
    const statusStyle = getStatusStyle(item.status);

    return (
      <View style={styles.recordItem}>
        <View style={[styles.typeIcon, { backgroundColor: typeStyle.bg }]}>
          <Icon source={typeStyle.icon} size={20} color={typeStyle.color} />
        </View>
        <View style={styles.recordContent}>
          <View style={styles.recordHeader}>
            <Text style={styles.recordTitle}>{item.title}</Text>
            <Text style={[styles.recordStatus, { color: statusStyle.color }]}>
              {statusStyle.text}
            </Text>
          </View>
          <Text style={styles.recordDescription}>{item.description}</Text>
          <View style={styles.recordMeta}>
            <View style={styles.recordMetaItem}>
              <Icon source="calendar" size={12} color="#999" />
              <Text style={styles.recordMetaText}>{item.date}</Text>
            </View>
            <View style={styles.recordMetaItem}>
              <Icon source="clock-outline" size={12} color="#999" />
              <Text style={styles.recordMetaText}>{item.duration}</Text>
            </View>
            <View style={styles.recordMetaItem}>
              <Icon source="account" size={12} color="#999" />
              <Text style={styles.recordMetaText}>{item.technician}</Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  // 计算距下次维护天数
  const daysUntilNext = Math.ceil(
    (new Date(equipment.nextMaintenance).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* 头部 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon source="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('equipment.maintenance.title')}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* 设备信息卡片 */}
        <View style={styles.equipmentCard}>
          <View style={styles.equipmentHeader}>
            <View style={styles.equipmentIcon}>
              <Icon source="cog" size={24} color="#fff" />
            </View>
            <View style={styles.equipmentInfo}>
              <Text style={styles.equipmentName}>{equipment.name}</Text>
              <Text style={styles.equipmentId}>{equipment.id}</Text>
            </View>
          </View>

          <View style={styles.maintenanceStats}>
            <View style={styles.maintenanceStatItem}>
              <Text style={styles.maintenanceStatLabel}>{t('equipment.maintenance.lastMaintenance')}</Text>
              <Text style={styles.maintenanceStatValue}>{equipment.lastMaintenance}</Text>
            </View>
            <View style={styles.maintenanceStatDivider} />
            <View style={styles.maintenanceStatItem}>
              <Text style={styles.maintenanceStatLabel}>{t('equipment.maintenance.nextMaintenance')}</Text>
              <Text style={[styles.maintenanceStatValue, daysUntilNext <= 7 && { color: '#faad14' }]}>
                {equipment.nextMaintenance}
              </Text>
              <Text style={styles.maintenanceStatNote}>
                {daysUntilNext > 0 ? t('equipment.maintenance.daysRemaining', { days: daysUntilNext }) : t('equipment.maintenance.overdue')}
              </Text>
            </View>
            <View style={styles.maintenanceStatDivider} />
            <View style={styles.maintenanceStatItem}>
              <Text style={styles.maintenanceStatLabel}>{t('equipment.maintenance.maintenanceCycle')}</Text>
              <Text style={styles.maintenanceStatValue}>{t('equipment.maintenance.days', { days: equipment.maintenanceCycle })}</Text>
            </View>
          </View>
        </View>

        {/* 维护记录列表 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('equipment.maintenance.history')}</Text>
          <View style={styles.recordsList}>
            {records.map((record) => (
              <View key={record.id}>
                {renderRecord({ item: record })}
              </View>
            ))}
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* 底部按钮 */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.requestBtn} onPress={handleRequestMaintenance}>
          <Icon source="plus-circle" size={20} color="#fff" />
          <Text style={styles.requestBtnText}>{t('equipment.maintenance.requestMaintenance')}</Text>
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
  equipmentCard: {
    backgroundColor: '#667eea',
    margin: 16,
    borderRadius: 12,
    padding: 16,
  },
  equipmentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  equipmentIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  equipmentInfo: {
    marginLeft: 12,
  },
  equipmentName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  equipmentId: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  maintenanceStats: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 8,
    padding: 12,
  },
  maintenanceStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  maintenanceStatDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  maintenanceStatLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
  },
  maintenanceStatValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
    marginTop: 4,
  },
  maintenanceStatNote: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  recordsList: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 8,
  },
  recordItem: {
    flexDirection: 'row',
    padding: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f0f0f0',
  },
  typeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordContent: {
    flex: 1,
    marginLeft: 12,
  },
  recordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recordTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
  },
  recordStatus: {
    fontSize: 12,
  },
  recordDescription: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
    lineHeight: 18,
  },
  recordMeta: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 12,
  },
  recordMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recordMetaText: {
    fontSize: 11,
    color: '#999',
    marginLeft: 4,
  },
  footer: {
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  requestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#667eea',
    borderRadius: 8,
    padding: 16,
  },
  requestBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 8,
  },
});

export default EquipmentMaintenanceScreen;
