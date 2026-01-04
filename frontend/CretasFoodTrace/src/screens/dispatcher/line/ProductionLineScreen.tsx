/**
 * 产线管理页面
 *
 * 功能：
 * - 产线列表（卡片式展示）
 * - 新建产线（FAB + Modal）
 * - 编辑产线信息
 * - 状态切换（active/inactive/maintenance）
 *
 * @version 1.0.0
 * @since 2025-01-03
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Alert, TouchableOpacity, RefreshControl } from 'react-native';
import {
  Text,
  Appbar,
  FAB,
  Card,
  List,
  Chip,
  Portal,
  Modal,
  TextInput,
  Button,
  ActivityIndicator,
  Menu,
  Divider,
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { schedulingApiClient, ProductionLine } from '../../../services/api/schedulingApiClient';
import { useAuthStore } from '../../../store/authStore';
import { logger } from '../../../utils/logger';
import { isAxiosError } from 'axios';

// 创建专用logger
const lineLogger = logger.createContextLogger('ProductionLineManagement');

// 产线状态配置
const STATUS_CONFIG = {
  active: {
    label: '运行中',
    color: '#4CAF50',
    bgColor: '#E8F5E9',
    icon: 'check-circle',
  },
  inactive: {
    label: '已停用',
    color: '#9E9E9E',
    bgColor: '#F5F5F5',
    icon: 'pause-circle',
  },
  maintenance: {
    label: '维护中',
    color: '#FF9800',
    bgColor: '#FFF3E0',
    icon: 'wrench',
  },
};

// 创建产线请求接口
interface CreateProductionLineRequest {
  name: string;
  capacity: number;  // 日产能 (kg)
  minWorkers?: number;
  maxWorkers?: number;
  requiredSkillLevel?: number;  // 1-5
  workshopId?: string;
  status?: 'active' | 'inactive' | 'maintenance';
}

// 表单数据接口
interface FormData {
  name: string;
  capacity: string;
  minWorkers: string;
  maxWorkers: string;
  requiredSkillLevel: string;
  workshopId: string;
}

// 技能等级选项
const SKILL_LEVEL_OPTIONS = [
  { value: '1', label: '1级 - 初级' },
  { value: '2', label: '2级 - 基础' },
  { value: '3', label: '3级 - 中级' },
  { value: '4', label: '4级 - 高级' },
  { value: '5', label: '5级 - 专家' },
];

export default function ProductionLineScreen() {
  const navigation = useNavigation();
  const { user } = useAuthStore();

  // 状态
  const [lines, setLines] = useState<ProductionLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<ProductionLine | null>(null);
  const [statusMenuVisible, setStatusMenuVisible] = useState<string | null>(null);
  const [skillMenuVisible, setSkillMenuVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  // 表单数据
  const [formData, setFormData] = useState<FormData>({
    name: '',
    capacity: '',
    minWorkers: '',
    maxWorkers: '',
    requiredSkillLevel: '3',
    workshopId: '',
  });

  // 加载产线列表
  const loadProductionLines = useCallback(async () => {
    try {
      setLoading(true);
      lineLogger.debug('加载产线列表');

      const response = await schedulingApiClient.getProductionLines();

      if (response.success && response.data) {
        lineLogger.info('产线列表加载成功', { count: response.data.length });
        setLines(response.data);
      } else {
        lineLogger.warn('产线列表为空');
        setLines([]);
      }
    } catch (error) {
      lineLogger.error('加载产线失败', error as Error);
      if (isAxiosError(error)) {
        const status = error.response?.status;
        if (status === 401) {
          Alert.alert('登录过期', '请重新登录');
        } else {
          Alert.alert('加载失败', error.response?.data?.message || '无法获取产线列表');
        }
      } else if (error instanceof Error) {
        Alert.alert('错误', error.message);
      }
      setLines([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // 刷新
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadProductionLines();
  }, [loadProductionLines]);

  // 初始加载
  useEffect(() => {
    loadProductionLines();
  }, [loadProductionLines]);

  // 打开新建弹窗
  const handleAdd = () => {
    setEditingItem(null);
    setFormData({
      name: '',
      capacity: '',
      minWorkers: '2',
      maxWorkers: '8',
      requiredSkillLevel: '3',
      workshopId: '',
    });
    setModalVisible(true);
  };

  // 打开编辑弹窗
  const handleEdit = (item: ProductionLine) => {
    setEditingItem(item);
    // 从 skillLevels 中提取第一个技能等级（简化处理）
    const skillLevel = item.skillLevels && Object.values(item.skillLevels).length > 0
      ? String(Math.round(Object.values(item.skillLevels)[0] || 3))
      : '3';

    setFormData({
      name: item.name,
      capacity: String(item.capacity),
      minWorkers: '2', // 后端未返回，使用默认值
      maxWorkers: '8', // 后端未返回，使用默认值
      requiredSkillLevel: skillLevel,
      workshopId: item.workshopId || '',
    });
    setModalVisible(true);
  };

  // 保存产线
  const handleSave = async () => {
    // 验证必填项
    if (!formData.name.trim()) {
      Alert.alert('提示', '请输入产线名称');
      return;
    }

    const capacity = parseFloat(formData.capacity);
    if (isNaN(capacity) || capacity <= 0) {
      Alert.alert('提示', '请输入有效的日产能');
      return;
    }

    const minWorkers = parseInt(formData.minWorkers, 10);
    const maxWorkers = parseInt(formData.maxWorkers, 10);
    if (minWorkers > maxWorkers) {
      Alert.alert('提示', '最少工人数不能大于最多工人数');
      return;
    }

    try {
      setSaving(true);

      const requestData: Partial<ProductionLine> = {
        name: formData.name.trim(),
        capacity,
        workshopId: formData.workshopId || undefined,
        skillLevels: {
          default: parseInt(formData.requiredSkillLevel, 10),
        },
      };

      if (editingItem) {
        // 更新
        await schedulingApiClient.updateProductionLine(editingItem.id, requestData);
        Alert.alert('成功', '产线更新成功');
        lineLogger.info('产线更新成功', { id: editingItem.id });
      } else {
        // 创建
        await schedulingApiClient.createProductionLine(requestData);
        Alert.alert('成功', '产线创建成功');
        lineLogger.info('产线创建成功', { name: formData.name });
      }

      setModalVisible(false);
      loadProductionLines();
    } catch (error) {
      lineLogger.error(editingItem ? '更新产线失败' : '创建产线失败', error as Error);
      if (isAxiosError(error)) {
        Alert.alert('操作失败', error.response?.data?.message || '请稍后重试');
      } else if (error instanceof Error) {
        Alert.alert('错误', error.message);
      }
    } finally {
      setSaving(false);
    }
  };

  // 切换状态
  const handleStatusChange = async (item: ProductionLine, newStatus: 'active' | 'inactive' | 'maintenance') => {
    if (item.status === newStatus) {
      setStatusMenuVisible(null);
      return;
    }

    try {
      await schedulingApiClient.updateProductionLineStatus(item.id, newStatus);
      Alert.alert('成功', `产线状态已更新为${STATUS_CONFIG[newStatus].label}`);
      lineLogger.info('产线状态更新成功', { id: item.id, status: newStatus });
      loadProductionLines();
    } catch (error) {
      lineLogger.error('状态更新失败', error as Error);
      if (isAxiosError(error)) {
        Alert.alert('操作失败', error.response?.data?.message || '请稍后重试');
      } else if (error instanceof Error) {
        Alert.alert('错误', error.message);
      }
    } finally {
      setStatusMenuVisible(null);
    }
  };

  // 渲染状态指示器
  const renderStatusBadge = (status: ProductionLine['status']) => {
    const config = STATUS_CONFIG[status] || STATUS_CONFIG.inactive;
    return (
      <Chip
        icon={config.icon}
        mode="flat"
        style={[styles.statusChip, { backgroundColor: config.bgColor }]}
        textStyle={{ fontSize: 12, fontWeight: '500', color: config.color }}
      >
        {config.label}
      </Chip>
    );
  };

  // 渲染产线卡片
  const renderLineCard = (item: ProductionLine) => {
    const config = STATUS_CONFIG[item.status] || STATUS_CONFIG.inactive;
    // 从 skillLevels 获取技能等级
    const skillLevel = item.skillLevels && Object.values(item.skillLevels).length > 0
      ? Math.round(Object.values(item.skillLevels)[0] || 3)
      : 3;

    return (
      <Card key={item.id} style={styles.lineCard} mode="elevated">
        <Card.Content>
          {/* Header */}
          <View style={styles.cardHeader}>
            <View style={styles.leftHeader}>
              <View style={[styles.iconContainer, { backgroundColor: config.color }]}>
                <List.Icon icon="factory" color="#fff" style={styles.iconStyle} />
              </View>
              <View style={styles.titleContainer}>
                <Text style={styles.lineName}>{item.name}</Text>
                {item.workshopName && (
                  <Text style={styles.workshopName}>{item.workshopName}</Text>
                )}
              </View>
            </View>

            <Menu
              visible={statusMenuVisible === item.id}
              onDismiss={() => setStatusMenuVisible(null)}
              anchor={
                <TouchableOpacity onPress={() => setStatusMenuVisible(item.id)}>
                  {renderStatusBadge(item.status)}
                </TouchableOpacity>
              }
            >
              <Menu.Item
                leadingIcon="check-circle"
                title="运行中"
                onPress={() => handleStatusChange(item, 'active')}
                titleStyle={item.status === 'active' ? { fontWeight: 'bold' } : undefined}
              />
              <Divider />
              <Menu.Item
                leadingIcon="wrench"
                title="维护中"
                onPress={() => handleStatusChange(item, 'maintenance')}
                titleStyle={item.status === 'maintenance' ? { fontWeight: 'bold' } : undefined}
              />
              <Divider />
              <Menu.Item
                leadingIcon="pause-circle"
                title="已停用"
                onPress={() => handleStatusChange(item, 'inactive')}
                titleStyle={item.status === 'inactive' ? { fontWeight: 'bold' } : undefined}
              />
            </Menu>
          </View>

          {/* Info Row */}
          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>日产能</Text>
              <Text style={styles.infoValue}>{item.capacity} kg</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>技能要求</Text>
              <Text style={styles.infoValue}>{skillLevel} 级</Text>
            </View>
          </View>

          {/* Tags */}
          <View style={styles.tagsRow}>
            <Chip mode="outlined" style={styles.tagChip} compact>
              产能: {item.capacity}kg/天
            </Chip>
            <Chip mode="outlined" style={styles.tagChip} compact>
              技能: {skillLevel}级
            </Chip>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionRow}>
            <Button
              mode="outlined"
              icon="pencil"
              onPress={() => handleEdit(item)}
              style={styles.actionButton}
              compact
            >
              编辑
            </Button>
            <Button
              mode="outlined"
              icon={item.status === 'active' ? 'pause' : 'play'}
              onPress={() => handleStatusChange(
                item,
                item.status === 'active' ? 'inactive' : 'active'
              )}
              style={styles.actionButton}
              compact
            >
              {item.status === 'active' ? '停用' : '启用'}
            </Button>
          </View>
        </Card.Content>
      </Card>
    );
  };

  // 渲染统计卡片
  const renderStatsCard = () => {
    const activeCount = lines.filter(l => l.status === 'active').length;
    const maintenanceCount = lines.filter(l => l.status === 'maintenance').length;
    const totalCapacity = lines
      .filter(l => l.status === 'active')
      .reduce((sum, l) => sum + l.capacity, 0);

    return (
      <Card style={styles.statsCard}>
        <Card.Content>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{lines.length}</Text>
              <Text style={styles.statLabel}>总产线</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: '#4CAF50' }]}>{activeCount}</Text>
              <Text style={styles.statLabel}>运行中</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: '#FF9800' }]}>{maintenanceCount}</Text>
              <Text style={styles.statLabel}>维护中</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: '#2196F3' }]}>{totalCapacity}</Text>
              <Text style={styles.statLabel}>日产能(kg)</Text>
            </View>
          </View>
        </Card.Content>
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="产线管理" />
        <Appbar.Action icon="refresh" onPress={handleRefresh} />
      </Appbar.Header>

      {/* Content */}
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Stats */}
        {renderStatsCard()}

        {/* Line List */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" />
            <Text style={styles.loadingText}>加载中...</Text>
          </View>
        ) : lines.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Card.Content style={styles.emptyContent}>
              <List.Icon icon="factory" color="#999" />
              <Text style={styles.emptyText}>暂无产线数据</Text>
              <Text style={styles.emptyHint}>点击右下角"+"按钮添加产线</Text>
            </Card.Content>
          </Card>
        ) : (
          lines.map(renderLineCard)
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Add/Edit Modal */}
      <Portal>
        <Modal
          visible={modalVisible}
          onDismiss={() => setModalVisible(false)}
          contentContainerStyle={styles.modalContent}
        >
          <Text style={styles.modalTitle}>
            {editingItem ? '编辑产线' : '新建产线'}
          </Text>

          <ScrollView style={styles.modalScrollView}>
            <TextInput
              label="产线名称 *"
              value={formData.name}
              onChangeText={(text) => setFormData({ ...formData, name: text })}
              mode="outlined"
              style={styles.input}
              placeholder="例如: 1号切片产线"
            />

            <TextInput
              label="日产能 (kg) *"
              value={formData.capacity}
              onChangeText={(text) => setFormData({ ...formData, capacity: text })}
              mode="outlined"
              style={styles.input}
              keyboardType="numeric"
              placeholder="例如: 500"
            />

            <View style={styles.rowInputs}>
              <TextInput
                label="最少工人数"
                value={formData.minWorkers}
                onChangeText={(text) => setFormData({ ...formData, minWorkers: text })}
                mode="outlined"
                style={[styles.input, styles.halfInput]}
                keyboardType="numeric"
                placeholder="例如: 2"
              />
              <TextInput
                label="最多工人数"
                value={formData.maxWorkers}
                onChangeText={(text) => setFormData({ ...formData, maxWorkers: text })}
                mode="outlined"
                style={[styles.input, styles.halfInput]}
                keyboardType="numeric"
                placeholder="例如: 8"
              />
            </View>

            {/* 技能等级下拉 */}
            <Menu
              visible={skillMenuVisible}
              onDismiss={() => setSkillMenuVisible(false)}
              anchor={
                <TextInput
                  label="所需技能等级"
                  value={
                    SKILL_LEVEL_OPTIONS.find(o => o.value === formData.requiredSkillLevel)?.label ||
                    '3级 - 中级'
                  }
                  mode="outlined"
                  style={styles.input}
                  editable={false}
                  right={
                    <TextInput.Icon
                      icon="menu-down"
                      onPress={() => setSkillMenuVisible(true)}
                    />
                  }
                  onPressIn={() => setSkillMenuVisible(true)}
                />
              }
            >
              {SKILL_LEVEL_OPTIONS.map((option) => (
                <Menu.Item
                  key={option.value}
                  title={option.label}
                  onPress={() => {
                    setFormData({ ...formData, requiredSkillLevel: option.value });
                    setSkillMenuVisible(false);
                  }}
                />
              ))}
            </Menu>

            <TextInput
              label="关联车间ID（可选）"
              value={formData.workshopId}
              onChangeText={(text) => setFormData({ ...formData, workshopId: text })}
              mode="outlined"
              style={styles.input}
              placeholder="例如: WS001"
            />
          </ScrollView>

          {/* Modal Actions */}
          <View style={styles.modalActions}>
            <Button
              mode="outlined"
              onPress={() => setModalVisible(false)}
              style={styles.modalButton}
              disabled={saving}
            >
              取消
            </Button>
            <Button
              mode="contained"
              onPress={handleSave}
              style={styles.modalButton}
              loading={saving}
              disabled={saving}
            >
              {editingItem ? '更新' : '创建'}
            </Button>
          </View>
        </Modal>
      </Portal>

      {/* FAB */}
      <FAB
        icon="plus"
        style={styles.fab}
        onPress={handleAdd}
        label="添加产线"
      />
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  statsCard: {
    margin: 16,
    marginBottom: 8,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  lineCard: {
    margin: 16,
    marginBottom: 12,
    borderRadius: 12,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  leftHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  iconStyle: {
    margin: 0,
    width: 28,
    height: 28,
  },
  titleContainer: {
    flex: 1,
  },
  lineName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#212121',
    marginBottom: 2,
  },
  workshopName: {
    fontSize: 13,
    color: '#757575',
  },
  statusChip: {
    height: 32,
    paddingHorizontal: 4,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    backgroundColor: '#FAFAFA',
    borderRadius: 8,
    marginBottom: 12,
  },
  infoItem: {
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  tagChip: {
    height: 28,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 8,
  },
  actionButton: {
    minWidth: 80,
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
  emptyHint: {
    fontSize: 14,
    color: '#bbb',
    marginTop: 8,
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
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  modalScrollView: {
    flexGrow: 0,
    flexShrink: 1,
  },
  input: {
    marginBottom: 16,
  },
  rowInputs: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
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
    height: 100,
  },
});
