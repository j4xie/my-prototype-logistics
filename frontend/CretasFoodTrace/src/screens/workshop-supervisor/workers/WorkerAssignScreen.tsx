/**
 * 员工分配页面
 * 将员工分配到批次任务
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
import { WSWorkersStackParamList } from '../../../types/navigation';

type RouteProps = RouteProp<WSWorkersStackParamList, 'WorkerAssign'>;

export function WorkerAssignScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProps>();

  // 可选的员工列表
  const [workers, setWorkers] = useState([
    { id: 1, name: '王建国', role: '切片操作员', efficiency: 96, status: 'available', selected: false },
    { id: 2, name: '李明辉', role: '包装操作员', efficiency: 92, status: 'available', selected: false },
    { id: 3, name: '张伟', role: '切片操作员', efficiency: 85, status: 'available', selected: false },
    { id: 4, name: '赵丽华', role: '质检员', efficiency: 91, status: 'busy', selected: false },
    { id: 5, name: '周婷', role: '包装操作员', efficiency: 88, status: 'available', selected: false },
    { id: 6, name: '陈志强', role: '操作员', efficiency: 82, status: 'off_duty', selected: false },
  ]);

  // 待分配的批次
  const batch = {
    batchNumber: route.params?.batchNumber || 'PB-20251227-001',
    productName: '带鱼片',
    requiredWorkers: 3,
  };

  const selectedCount = workers.filter((w) => w.selected).length;

  const toggleWorker = (id: number) => {
    setWorkers(
      workers.map((w) =>
        w.id === id ? { ...w, selected: !w.selected } : w
      )
    );
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'available':
        return { text: '可用', color: '#52c41a', bg: '#f6ffed' };
      case 'busy':
        return { text: '忙碌', color: '#faad14', bg: '#fff7e6' };
      case 'off_duty':
        return { text: '不在岗', color: '#999', bg: '#f5f5f5' };
      default:
        return { text: '未知', color: '#999', bg: '#f5f5f5' };
    }
  };

  const getEfficiencyColor = (efficiency: number) => {
    if (efficiency >= 90) return '#52c41a';
    if (efficiency >= 80) return '#1890ff';
    return '#faad14';
  };

  const handleConfirm = () => {
    const selectedWorkers = workers.filter((w) => w.selected);
    if (selectedWorkers.length < batch.requiredWorkers) {
      Alert.alert('提示', `请至少选择 ${batch.requiredWorkers} 名员工`);
      return;
    }

    Alert.alert(
      '确认分配',
      `确定将 ${selectedWorkers.map((w) => w.name).join('、')} 分配到批次 ${batch.batchNumber}？`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确认',
          onPress: () => {
            Alert.alert('成功', '员工分配成功！', [
              { text: '确定', onPress: () => navigation.goBack() },
            ]);
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
        <Text style={styles.headerTitle}>分配员工</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* 批次信息 */}
        <View style={styles.batchCard}>
          <Text style={styles.batchNumber}>{batch.batchNumber}</Text>
          <Text style={styles.productName}>{batch.productName}</Text>
          <View style={styles.requiredRow}>
            <Icon source="account-group" size={16} color="#667eea" />
            <Text style={styles.requiredText}>
              需要 {batch.requiredWorkers} 名员工 · 已选 {selectedCount} 名
            </Text>
          </View>
        </View>

        {/* 员工列表 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>选择员工</Text>
          <View style={styles.workersList}>
            {workers.map((worker) => {
              const statusStyle = getStatusStyle(worker.status);
              const isDisabled = worker.status !== 'available';
              return (
                <TouchableOpacity
                  key={worker.id}
                  style={[
                    styles.workerItem,
                    worker.selected && styles.workerItemSelected,
                    isDisabled && styles.workerItemDisabled,
                  ]}
                  onPress={() => !isDisabled && toggleWorker(worker.id)}
                  disabled={isDisabled}
                >
                  <View style={styles.workerLeft}>
                    <View
                      style={[
                        styles.checkbox,
                        worker.selected && styles.checkboxSelected,
                      ]}
                    >
                      {worker.selected && (
                        <Icon source="check" size={14} color="#fff" />
                      )}
                    </View>
                    <View style={styles.workerAvatar}>
                      <Text style={styles.workerAvatarText}>
                        {worker.name.charAt(0)}
                      </Text>
                    </View>
                    <View style={styles.workerInfo}>
                      <Text
                        style={[
                          styles.workerName,
                          isDisabled && styles.textDisabled,
                        ]}
                      >
                        {worker.name}
                      </Text>
                      <Text style={styles.workerRole}>{worker.role}</Text>
                    </View>
                  </View>
                  <View style={styles.workerRight}>
                    <View
                      style={[
                        styles.efficiencyBadge,
                        { backgroundColor: `${getEfficiencyColor(worker.efficiency)}15` },
                      ]}
                    >
                      <Text
                        style={[
                          styles.efficiencyText,
                          { color: getEfficiencyColor(worker.efficiency) },
                        ]}
                      >
                        效率 {worker.efficiency}%
                      </Text>
                    </View>
                    <View
                      style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}
                    >
                      <Text style={[styles.statusText, { color: statusStyle.color }]}>
                        {statusStyle.text}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* 底部按钮 */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.confirmBtn,
            selectedCount < batch.requiredWorkers && styles.confirmBtnDisabled,
          ]}
          onPress={handleConfirm}
        >
          <Icon source="account-check" size={20} color="#fff" />
          <Text style={styles.confirmBtnText}>
            确认分配 ({selectedCount}/{batch.requiredWorkers})
          </Text>
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
  productName: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  requiredRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
  },
  requiredText: {
    fontSize: 13,
    color: '#fff',
    marginLeft: 6,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  workersList: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 8,
  },
  workerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 8,
    marginBottom: 4,
  },
  workerItemSelected: {
    backgroundColor: '#f0f5ff',
    borderWidth: 1,
    borderColor: '#667eea',
  },
  workerItemDisabled: {
    opacity: 0.5,
  },
  workerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#d9d9d9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#667eea',
    borderColor: '#667eea',
  },
  workerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  workerAvatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  workerInfo: {
    marginLeft: 12,
  },
  workerName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
  },
  workerRole: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  textDisabled: {
    color: '#999',
  },
  workerRight: {
    alignItems: 'flex-end',
  },
  efficiencyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginBottom: 4,
  },
  efficiencyText: {
    fontSize: 11,
    fontWeight: '500',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  statusText: {
    fontSize: 11,
  },
  footer: {
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#667eea',
    borderRadius: 8,
    padding: 16,
  },
  confirmBtnDisabled: {
    backgroundColor: '#ccc',
  },
  confirmBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 8,
  },
});

export default WorkerAssignScreen;
