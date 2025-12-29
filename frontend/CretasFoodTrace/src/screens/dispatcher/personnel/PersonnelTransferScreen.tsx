/**
 * 人员调动页面
 *
 * 功能:
 * - 选择源车间和目标车间
 * - 选择调动时间范围
 * - 选择要调动的员工
 * - 填写调动原因
 * - 预览调动影响
 * - 提交调动申请
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';

// 主题色
const DISPATCHER_THEME = {
  primary: '#722ed1',
  secondary: '#a18cd1',
  accent: '#fbc2eb',
  success: '#52c41a',
  warning: '#fa8c16',
  danger: '#ff4d4f',
  info: '#1890ff',
  background: '#f5f5f5',
  cardBackground: '#ffffff',
};

// 车间类型
interface Workshop {
  id: string;
  name: string;
  type: string;
  currentWorkers: number;
  maxCapacity: number;
  capacityPercent: number;
}

// 可调动员工
interface TransferableWorker {
  id: string;
  name: string;
  avatar: string;
  employeeCode: string;
  status: 'idle' | 'working';
  currentTask?: string;
  skill: string;
  efficiency: number;
  isTemporary?: boolean;
}

// 调动影响预览
interface TransferImpact {
  sourceWorkshop: {
    name: string;
    beforeWorkers: number;
    afterWorkers: number;
    beforeCapacity: number;
    afterCapacity: number;
  };
  targetWorkshop: {
    name: string;
    beforeWorkers: number;
    afterWorkers: number;
    beforeCapacity: number;
    afterCapacity: number;
  };
  warnings: string[];
}

// Mock 数据
const mockWorkshops: Workshop[] = [
  { id: 'W001', name: '切片车间', type: 'slicing', currentWorkers: 8, maxCapacity: 12, capacityPercent: 67 },
  { id: 'W002', name: '包装车间', type: 'packaging', currentWorkers: 6, maxCapacity: 10, capacityPercent: 60 },
  { id: 'W003', name: '冷冻车间', type: 'freezing', currentWorkers: 4, maxCapacity: 8, capacityPercent: 50 },
  { id: 'W004', name: '仓储车间', type: 'storage', currentWorkers: 3, maxCapacity: 6, capacityPercent: 50 },
];

const mockTransferableWorkers: TransferableWorker[] = [
  { id: 'E001', name: '张三丰', avatar: '张', employeeCode: '001', status: 'idle', skill: '切片', efficiency: 95 },
  { id: 'E002', name: '李四海', avatar: '李', employeeCode: '002', status: 'idle', skill: '切片', efficiency: 88 },
  { id: 'E003', name: '王五行', avatar: '王', employeeCode: '003', status: 'working', currentTask: 'PB20241227001', skill: '切片', efficiency: 92 },
  { id: 'E004', name: '赵六顺', avatar: '赵', employeeCode: '004', status: 'idle', skill: '质检', efficiency: 90 },
  { id: 'E005', name: '刘临时', avatar: '刘', employeeCode: '088', status: 'idle', skill: '包装', efficiency: 85, isTemporary: true },
];

const transferReasons = [
  '人员不足紧急调配',
  '技能匹配调整',
  '跨车间支援',
  '定期轮岗',
  '培训学习',
  '其他原因',
];

export default function PersonnelTransferScreen() {
  const navigation = useNavigation();
  const [refreshing, setRefreshing] = useState(false);

  // 表单状态
  const [sourceWorkshop, setSourceWorkshop] = useState<Workshop | null>(null);
  const [targetWorkshop, setTargetWorkshop] = useState<Workshop | null>(null);
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('18:00');
  const [selectedWorkers, setSelectedWorkers] = useState<Set<string>>(new Set());
  const [transferReason, setTransferReason] = useState('');
  const [customReason, setCustomReason] = useState('');

  // 下拉选择状态
  const [showSourceDropdown, setShowSourceDropdown] = useState(false);
  const [showTargetDropdown, setShowTargetDropdown] = useState(false);
  const [showReasonDropdown, setShowReasonDropdown] = useState(false);

  // 下拉刷新
  const onRefresh = async () => {
    setRefreshing(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setRefreshing(false);
  };

  // 切换员工选择
  const toggleWorkerSelection = (workerId: string) => {
    const newSelection = new Set(selectedWorkers);
    if (newSelection.has(workerId)) {
      newSelection.delete(workerId);
    } else {
      newSelection.add(workerId);
    }
    setSelectedWorkers(newSelection);
  };

  // 计算调动影响
  const calculateImpact = (): TransferImpact | null => {
    if (!sourceWorkshop || !targetWorkshop || selectedWorkers.size === 0) {
      return null;
    }

    const transferCount = selectedWorkers.size;

    const sourceAfterWorkers = sourceWorkshop.currentWorkers - transferCount;
    const targetAfterWorkers = targetWorkshop.currentWorkers + transferCount;

    const sourceAfterCapacity = Math.round((sourceAfterWorkers / sourceWorkshop.maxCapacity) * 100);
    const targetAfterCapacity = Math.round((targetAfterWorkers / targetWorkshop.maxCapacity) * 100);

    const warnings: string[] = [];
    if (sourceAfterCapacity < 50) {
      warnings.push(`${sourceWorkshop.name}调动后人员利用率将低于50%`);
    }
    if (targetAfterCapacity > 90) {
      warnings.push(`${targetWorkshop.name}调动后将接近满负荷`);
    }

    return {
      sourceWorkshop: {
        name: sourceWorkshop.name,
        beforeWorkers: sourceWorkshop.currentWorkers,
        afterWorkers: sourceAfterWorkers,
        beforeCapacity: sourceWorkshop.capacityPercent,
        afterCapacity: sourceAfterCapacity,
      },
      targetWorkshop: {
        name: targetWorkshop.name,
        beforeWorkers: targetWorkshop.currentWorkers,
        afterWorkers: targetAfterWorkers,
        beforeCapacity: targetWorkshop.capacityPercent,
        afterCapacity: targetAfterCapacity,
      },
      warnings,
    };
  };

  // 提交调动申请
  const handleSubmitTransfer = () => {
    if (!sourceWorkshop) {
      Alert.alert('提示', '请选择源车间');
      return;
    }
    if (!targetWorkshop) {
      Alert.alert('提示', '请选择目标车间');
      return;
    }
    if (sourceWorkshop.id === targetWorkshop.id) {
      Alert.alert('提示', '源车间和目标车间不能相同');
      return;
    }
    if (selectedWorkers.size === 0) {
      Alert.alert('提示', '请选择要调动的员工');
      return;
    }
    if (!transferReason) {
      Alert.alert('提示', '请选择调动原因');
      return;
    }
    if (transferReason === '其他原因' && !customReason.trim()) {
      Alert.alert('提示', '请填写具体原因');
      return;
    }

    Alert.alert(
      '确认调动',
      `确定将 ${selectedWorkers.size} 名员工从 ${sourceWorkshop.name} 调动到 ${targetWorkshop.name}？`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确认',
          onPress: () => {
            Alert.alert('成功', '调动申请已提交，等待审批');
            navigation.goBack();
          },
        },
      ]
    );
  };

  const impact = calculateImpact();

  // 渲染下拉选项
  const renderWorkshopDropdown = (
    workshops: Workshop[],
    onSelect: (workshop: Workshop) => void,
    onClose: () => void,
    excludeId?: string
  ) => (
    <View style={styles.dropdown}>
      {workshops.filter(w => w.id !== excludeId).map((workshop) => (
        <TouchableOpacity
          key={workshop.id}
          style={styles.dropdownItem}
          onPress={() => {
            onSelect(workshop);
            onClose();
          }}
        >
          <Text style={styles.dropdownItemText}>{workshop.name}</Text>
          <Text style={styles.dropdownItemSubtext}>
            {workshop.currentWorkers}/{workshop.maxCapacity}人 · {workshop.capacityPercent}%
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* 顶部渐变标题栏 */}
      <LinearGradient
        colors={[DISPATCHER_THEME.primary, DISPATCHER_THEME.secondary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.header}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>人员调动</Text>
        <View style={styles.headerRight} />
      </LinearGradient>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[DISPATCHER_THEME.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* 调动配置区 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>调动配置</Text>

          {/* 源车间选择 */}
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>源车间 *</Text>
            <TouchableOpacity
              style={styles.selectInput}
              onPress={() => {
                setShowSourceDropdown(!showSourceDropdown);
                setShowTargetDropdown(false);
                setShowReasonDropdown(false);
              }}
            >
              <Text style={[
                styles.selectInputText,
                !sourceWorkshop && styles.selectPlaceholder
              ]}>
                {sourceWorkshop ? sourceWorkshop.name : '请选择源车间'}
              </Text>
              <Ionicons
                name={showSourceDropdown ? 'chevron-up' : 'chevron-down'}
                size={20}
                color="#999"
              />
            </TouchableOpacity>
            {showSourceDropdown && renderWorkshopDropdown(
              mockWorkshops,
              setSourceWorkshop,
              () => setShowSourceDropdown(false),
              targetWorkshop?.id
            )}
          </View>

          {/* 目标车间选择 */}
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>目标车间 *</Text>
            <TouchableOpacity
              style={styles.selectInput}
              onPress={() => {
                setShowTargetDropdown(!showTargetDropdown);
                setShowSourceDropdown(false);
                setShowReasonDropdown(false);
              }}
            >
              <Text style={[
                styles.selectInputText,
                !targetWorkshop && styles.selectPlaceholder
              ]}>
                {targetWorkshop ? targetWorkshop.name : '请选择目标车间'}
              </Text>
              <Ionicons
                name={showTargetDropdown ? 'chevron-up' : 'chevron-down'}
                size={20}
                color="#999"
              />
            </TouchableOpacity>
            {showTargetDropdown && renderWorkshopDropdown(
              mockWorkshops,
              setTargetWorkshop,
              () => setShowTargetDropdown(false),
              sourceWorkshop?.id
            )}
          </View>

          {/* 时间范围 */}
          <View style={styles.timeRow}>
            <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.formLabel}>开始时间</Text>
              <View style={styles.timeInput}>
                <Ionicons name="time-outline" size={18} color="#999" />
                <TextInput
                  style={styles.timeInputText}
                  value={startTime}
                  onChangeText={setStartTime}
                  placeholder="08:00"
                />
              </View>
            </View>
            <View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
              <Text style={styles.formLabel}>结束时间</Text>
              <View style={styles.timeInput}>
                <Ionicons name="time-outline" size={18} color="#999" />
                <TextInput
                  style={styles.timeInputText}
                  value={endTime}
                  onChangeText={setEndTime}
                  placeholder="18:00"
                />
              </View>
            </View>
          </View>
        </View>

        {/* 员工选择区 */}
        {sourceWorkshop && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>选择员工</Text>
              <Text style={styles.selectionCount}>
                已选 {selectedWorkers.size} 人
              </Text>
            </View>

            {mockTransferableWorkers.map((worker) => (
              <TouchableOpacity
                key={worker.id}
                style={[
                  styles.workerCard,
                  selectedWorkers.has(worker.id) && styles.workerCardSelected,
                  worker.isTemporary && styles.workerCardTemporary,
                ]}
                onPress={() => toggleWorkerSelection(worker.id)}
              >
                <View style={styles.checkboxContainer}>
                  <View style={[
                    styles.checkbox,
                    selectedWorkers.has(worker.id) && styles.checkboxChecked
                  ]}>
                    {selectedWorkers.has(worker.id) && (
                      <Ionicons name="checkmark" size={14} color="#fff" />
                    )}
                  </View>
                </View>

                <LinearGradient
                  colors={worker.isTemporary
                    ? ['#fa8c16', '#ffc53d']
                    : [DISPATCHER_THEME.primary, DISPATCHER_THEME.secondary]}
                  style={styles.workerAvatar}
                >
                  <Text style={styles.workerAvatarText}>{worker.avatar}</Text>
                </LinearGradient>

                <View style={styles.workerInfo}>
                  <View style={styles.workerNameRow}>
                    <Text style={styles.workerName}>{worker.name}</Text>
                    <Text style={styles.workerCode}>({worker.employeeCode})</Text>
                    {worker.isTemporary && (
                      <View style={styles.tempBadge}>
                        <Text style={styles.tempBadgeText}>临时</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.workerMeta}>
                    <Text style={styles.workerSkill}>{worker.skill}</Text>
                    <Text style={styles.workerEfficiency}>效率 {worker.efficiency}%</Text>
                  </View>
                  {worker.status === 'working' && worker.currentTask && (
                    <Text style={styles.workerTask}>
                      当前任务: {worker.currentTask}
                    </Text>
                  )}
                </View>

                <View style={[
                  styles.workerStatus,
                  worker.status === 'idle' ? styles.statusIdle : styles.statusWorking
                ]}>
                  <Text style={[
                    styles.workerStatusText,
                    worker.status === 'idle' ? styles.statusIdleText : styles.statusWorkingText
                  ]}>
                    {worker.status === 'idle' ? '空闲' : '工作中'}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* 调动原因 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>调动原因 *</Text>

          <TouchableOpacity
            style={styles.selectInput}
            onPress={() => {
              setShowReasonDropdown(!showReasonDropdown);
              setShowSourceDropdown(false);
              setShowTargetDropdown(false);
            }}
          >
            <Text style={[
              styles.selectInputText,
              !transferReason && styles.selectPlaceholder
            ]}>
              {transferReason || '请选择调动原因'}
            </Text>
            <Ionicons
              name={showReasonDropdown ? 'chevron-up' : 'chevron-down'}
              size={20}
              color="#999"
            />
          </TouchableOpacity>

          {showReasonDropdown && (
            <View style={styles.dropdown}>
              {transferReasons.map((reason) => (
                <TouchableOpacity
                  key={reason}
                  style={styles.dropdownItem}
                  onPress={() => {
                    setTransferReason(reason);
                    setShowReasonDropdown(false);
                  }}
                >
                  <Text style={styles.dropdownItemText}>{reason}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {transferReason === '其他原因' && (
            <TextInput
              style={styles.customReasonInput}
              placeholder="请填写具体原因..."
              value={customReason}
              onChangeText={setCustomReason}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          )}
        </View>

        {/* 影响预览 */}
        {impact && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>调动影响预览</Text>

            <View style={styles.impactRow}>
              {/* 源车间影响 */}
              <View style={[styles.impactCard, styles.impactSource]}>
                <Text style={styles.impactCardTitle}>
                  <Ionicons name="arrow-up-circle" size={16} color="#ff4d4f" /> 源车间
                </Text>
                <Text style={styles.impactWorkshopName}>
                  {impact.sourceWorkshop.name}
                </Text>
                <View style={styles.impactMetric}>
                  <Text style={styles.impactLabel}>人员</Text>
                  <Text style={styles.impactValue}>
                    {impact.sourceWorkshop.beforeWorkers} → {impact.sourceWorkshop.afterWorkers}
                  </Text>
                </View>
                <View style={styles.impactMetric}>
                  <Text style={styles.impactLabel}>利用率</Text>
                  <Text style={[
                    styles.impactValue,
                    impact.sourceWorkshop.afterCapacity < 50 && styles.impactWarning
                  ]}>
                    {impact.sourceWorkshop.beforeCapacity}% → {impact.sourceWorkshop.afterCapacity}%
                  </Text>
                </View>
              </View>

              {/* 箭头 */}
              <View style={styles.impactArrow}>
                <Ionicons name="arrow-forward" size={24} color={DISPATCHER_THEME.primary} />
              </View>

              {/* 目标车间影响 */}
              <View style={[styles.impactCard, styles.impactTarget]}>
                <Text style={styles.impactCardTitle}>
                  <Ionicons name="arrow-down-circle" size={16} color="#52c41a" /> 目标车间
                </Text>
                <Text style={styles.impactWorkshopName}>
                  {impact.targetWorkshop.name}
                </Text>
                <View style={styles.impactMetric}>
                  <Text style={styles.impactLabel}>人员</Text>
                  <Text style={styles.impactValue}>
                    {impact.targetWorkshop.beforeWorkers} → {impact.targetWorkshop.afterWorkers}
                  </Text>
                </View>
                <View style={styles.impactMetric}>
                  <Text style={styles.impactLabel}>利用率</Text>
                  <Text style={[
                    styles.impactValue,
                    impact.targetWorkshop.afterCapacity > 90 && styles.impactWarning
                  ]}>
                    {impact.targetWorkshop.beforeCapacity}% → {impact.targetWorkshop.afterCapacity}%
                  </Text>
                </View>
              </View>
            </View>

            {/* 警告信息 */}
            {impact.warnings.length > 0 && (
              <View style={styles.warningsContainer}>
                {impact.warnings.map((warning, index) => (
                  <View key={index} style={styles.warningItem}>
                    <Ionicons name="warning" size={16} color="#fa8c16" />
                    <Text style={styles.warningText}>{warning}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* 底部间距 */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* 底部提交按钮 */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.cancelButtonText}>取消</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.submitButton,
            (!sourceWorkshop || !targetWorkshop || selectedWorkers.size === 0) &&
              styles.submitButtonDisabled
          ]}
          onPress={handleSubmitTransfer}
        >
          <LinearGradient
            colors={[DISPATCHER_THEME.primary, DISPATCHER_THEME.secondary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.submitButtonGradient}
          >
            <Ionicons name="swap-horizontal" size={20} color="#fff" />
            <Text style={styles.submitButtonText}>提交调动申请</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DISPATCHER_THEME.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  headerRight: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  section: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  selectionCount: {
    fontSize: 14,
    color: DISPATCHER_THEME.primary,
    fontWeight: '500',
  },
  formGroup: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  selectInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#e8e8e8',
  },
  selectInputText: {
    fontSize: 15,
    color: '#333',
  },
  selectPlaceholder: {
    color: '#999',
  },
  dropdown: {
    backgroundColor: '#fff',
    borderRadius: 8,
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#e8e8e8',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 100,
  },
  dropdownItem: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  dropdownItemText: {
    fontSize: 15,
    color: '#333',
  },
  dropdownItemSubtext: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  timeRow: {
    flexDirection: 'row',
  },
  timeInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#e8e8e8',
  },
  timeInputText: {
    flex: 1,
    fontSize: 15,
    color: '#333',
    marginLeft: 8,
  },
  workerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e8e8e8',
  },
  workerCardSelected: {
    borderColor: DISPATCHER_THEME.primary,
    backgroundColor: `${DISPATCHER_THEME.primary}08`,
  },
  workerCardTemporary: {
    backgroundColor: '#fffbe6',
  },
  checkboxContainer: {
    marginRight: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#d9d9d9',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  checkboxChecked: {
    backgroundColor: DISPATCHER_THEME.primary,
    borderColor: DISPATCHER_THEME.primary,
  },
  workerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  workerAvatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  workerInfo: {
    flex: 1,
  },
  workerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  workerName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  workerCode: {
    fontSize: 13,
    color: '#999',
    marginLeft: 4,
  },
  tempBadge: {
    backgroundColor: '#fa8c16',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 8,
  },
  tempBadgeText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '500',
  },
  workerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  workerSkill: {
    fontSize: 12,
    color: '#666',
  },
  workerEfficiency: {
    fontSize: 12,
    color: '#52c41a',
    marginLeft: 12,
  },
  workerTask: {
    fontSize: 11,
    color: '#999',
    marginTop: 4,
  },
  workerStatus: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusIdle: {
    backgroundColor: '#e6f7ff',
  },
  statusWorking: {
    backgroundColor: '#fff7e6',
  },
  workerStatusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  statusIdleText: {
    color: '#1890ff',
  },
  statusWorkingText: {
    color: '#fa8c16',
  },
  customReasonInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#333',
    marginTop: 12,
    minHeight: 80,
    borderWidth: 1,
    borderColor: '#e8e8e8',
  },
  impactRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  impactCard: {
    flex: 1,
    borderRadius: 8,
    padding: 12,
  },
  impactSource: {
    backgroundColor: '#fff2f0',
    borderWidth: 1,
    borderColor: '#ffccc7',
  },
  impactTarget: {
    backgroundColor: '#f6ffed',
    borderWidth: 1,
    borderColor: '#b7eb8f',
  },
  impactArrow: {
    paddingHorizontal: 8,
  },
  impactCardTitle: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  impactWorkshopName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  impactMetric: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  impactLabel: {
    fontSize: 12,
    color: '#999',
  },
  impactValue: {
    fontSize: 12,
    fontWeight: '500',
    color: '#333',
  },
  impactWarning: {
    color: '#fa8c16',
  },
  warningsContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#fffbe6',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ffe58f',
  },
  warningItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  warningText: {
    fontSize: 12,
    color: '#fa8c16',
    marginLeft: 8,
    flex: 1,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 28,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    marginRight: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d9d9d9',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#666',
  },
  submitButton: {
    flex: 2,
    borderRadius: 8,
    overflow: 'hidden',
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 8,
  },
});
