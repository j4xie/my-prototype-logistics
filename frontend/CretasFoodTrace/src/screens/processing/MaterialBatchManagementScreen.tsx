import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import {
  Text,
  Appbar,
  Card,
  Chip,
  ActivityIndicator,
  List,
  Searchbar,
  SegmentedButtons,
  ProgressBar,
  FAB,
  IconButton,
  Menu,
  Portal,
  Dialog,
  Button,
  TextInput,
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { materialBatchApiClient, MaterialBatch } from '../../services/api/materialBatchApiClient';
import { useAuthStore } from '../../store/authStore';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { API_CONFIG } from '../../constants/config';
import { handleError } from '../../utils/errorHandler';

/**
 * 原材料批次管理页面
 * P3-库存: 集成CRUD、导出、批量操作API
 *
 * 功能：
 * - 批次列表、FIFO查询、过期预警、低库存预警
 * - CRUD操作：创建、编辑、删除批次
 * - 批量操作：预留、释放、消耗、调整
 * - 库存导出：Excel格式
 */
export default function MaterialBatchManagementScreen() {
  const navigation = useNavigation();
  const { user } = useAuthStore();

  const [batches, setBatches] = useState<MaterialBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState('all');
  const [handlingExpired, setHandlingExpired] = useState(false);

  // P3-库存: CRUD状态
  const [selectedBatch, setSelectedBatch] = useState<MaterialBatch | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showBatchOpsMenu, setShowBatchOpsMenu] = useState(false);
  const [exporting, setExporting] = useState(false);

  // P3-库存: 批量操作状态
  const [showReserveDialog, setShowReserveDialog] = useState(false);
  const [showReleaseDialog, setShowReleaseDialog] = useState(false);
  const [showConsumeDialog, setShowConsumeDialog] = useState(false);
  const [showAdjustDialog, setShowAdjustDialog] = useState(false);
  const [batchOpsLoading, setBatchOpsLoading] = useState(false);
  const [convertingToFrozen, setConvertingToFrozen] = useState(false);

  // 批次表单状态
  const [formData, setFormData] = useState({
    materialTypeId: '',
    batchNumber: '',
    inboundQuantity: '',
    unitPrice: '',
    storageLocation: '',
    qualityGrade: '',
  });

  // 批量操作表单状态
  const [batchOpsData, setBatchOpsData] = useState({
    quantity: '',
    productionPlanId: '',
    reason: '',
    newQuantity: '',
  });

  useEffect(() => {
    loadBatches();
  }, [filterTab]);

  const loadBatches = async () => {
    try {
      setLoading(true);
      let response;

      console.log('🔍 Loading batches with filter:', filterTab);

      switch (filterTab) {
        case 'expiring':
          // API: 即将过期批次（7天内）
          response = await materialBatchApiClient.getExpiringBatches(7, user?.factoryId);
          setBatches(Array.isArray(response.data) ? response.data : response.data?.content || []);
          break;
        case 'expired':
          // API: 已过期批次
          response = await materialBatchApiClient.getExpiredBatches(user?.factoryId);
          setBatches(Array.isArray(response.data) ? response.data : response.data?.content || []);
          break;
        case 'low_stock':
          // API: 低库存批次
          response = await materialBatchApiClient.getLowStockBatches(user?.factoryId);
          setBatches(Array.isArray(response.data) ? response.data : response.data?.content || []);
          break;
        default:
          // API: 所有批次
          response = await materialBatchApiClient.getMaterialBatches({
            factoryId: user?.factoryId,
            page: 1, // 后端要求 page >= 1
            size: 100,
          });
          setBatches(Array.isArray(response.data) ? response.data : response.data?.content || []);
      }

      console.log('✅ Batches loaded:', batches.length, 'batches');
    } catch (error) {
      console.error('❌ Failed to load batches:', error);
      handleError(error, {
        showAlert: true,
        title: '加载失败',
        customMessage: '加载批次列表失败',
      });

      // 清空数据（不降级）
      setBatches([]);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return '#4CAF50';
      case 'reserved': return '#FF9800';
      case 'depleted': return '#9E9E9E';
      case 'expired': return '#F44336';
      default: return '#999';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'available': return '可用';
      case 'reserved': return '预留';
      case 'depleted': return '耗尽';
      case 'expired': return '过期';
      default: return status;
    }
  };

  const getQualityColor = (grade?: string) => {
    switch (grade) {
      case 'A': return '#4CAF50';
      case 'B': return '#FF9800';
      case 'C': return '#F44336';
      default: return '#2196F3';
    }
  };

  const calculateDaysUntilExpiry = (expiryDate?: string) => {
    if (!expiryDate) return null;
    const now = new Date();
    const expiry = new Date(expiryDate);
    const diffTime = expiry.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getExpiryWarning = (days: number | null) => {
    if (days === null) return null;
    if (days < 0) return { text: '已过期', color: '#F44336', level: 'expired' };
    if (days === 0) return { text: '今天过期', color: '#F44336', level: 'critical' };
    if (days === 1) return { text: '明天过期', color: '#F44336', level: 'critical' };
    if (days <= 3) return { text: `${days}天后过期`, color: '#F44336', level: 'urgent' };
    if (days <= 7) return { text: `${days}天后过期`, color: '#FF9800', level: 'warning' };
    return { text: `${days}天后过期`, color: '#666', level: 'normal' };
  };

  /**
   * P3-库存: 导出库存数据到Excel
   */
  const handleExportInventory = async () => {
    try {
      setExporting(true);
      console.log('📥 Exporting inventory...');

      const factoryId = user?.factoryId || user?.factoryUser?.factoryId;
      if (!factoryId) {
        Alert.alert('错误', '无法获取工厂信息');
        return;
      }

      // 调用导出API
      const apiUrl = `${API_CONFIG.BASE_URL}/api/mobile/${factoryId}/material-batches/export`;
      const timestamp = new Date().getTime();
      const fileName = `inventory_${timestamp}.xlsx`;
      const fileUri = `${FileSystem.documentDirectory}${fileName}`;

      console.log('📥 Downloading to:', fileUri);
      const downloadResult = await FileSystem.downloadAsync(apiUrl, fileUri);

      if (downloadResult.status !== 200) {
        throw new Error(`下载失败，HTTP状态码: ${downloadResult.status}`);
      }

      console.log('✅ Export completed:', downloadResult.uri);

      // 获取文件信息
      const fileInfo = await FileSystem.getInfoAsync(downloadResult.uri);
      const isAvailable = await Sharing.isAvailableAsync();

      if (isAvailable) {
        Alert.alert(
          '导出成功',
          `库存数据已导出\n\n文件大小：${((fileInfo.size || 0) / 1024).toFixed(2)} KB`,
          [
            { text: '稍后查看', style: 'cancel' },
            {
              text: '分享文件',
              onPress: async () => {
                try {
                  await Sharing.shareAsync(downloadResult.uri);
                } catch (error) {
                  console.error('分享失败:', error);
                  Alert.alert('分享失败', '无法分享文件');
                }
              },
            },
          ]
        );
      } else {
        Alert.alert('导出成功', `文件已保存到：${downloadResult.uri}`);
      }
    } catch (error) {
      console.error('❌ Export failed:', error);
      handleError(error, {
        showAlert: true,
        title: '导出失败',
        customMessage: '导出库存数据失败，请稍后重试',
      });
    } finally {
      setExporting(false);
    }
  };

  /**
   * P3-库存: 创建批次
   */
  const handleCreateBatch = async () => {
    try {
      // 验证表单
      if (!formData.materialTypeId.trim()) {
        Alert.alert('验证错误', '请输入原料类型ID');
        return;
      }
      if (!formData.batchNumber.trim()) {
        Alert.alert('验证错误', '请输入批次号');
        return;
      }
      if (!formData.inboundQuantity || Number(formData.inboundQuantity) <= 0) {
        Alert.alert('验证错误', '请输入有效的入库数量');
        return;
      }
      if (!formData.unitPrice || Number(formData.unitPrice) <= 0) {
        Alert.alert('验证错误', '请输入有效的单价');
        return;
      }

      setLoading(true);
      console.log('➕ Creating batch:', formData);

      const batchData = {
        materialTypeId: formData.materialTypeId.trim(),
        batchNumber: formData.batchNumber.trim(),
        inboundQuantity: Number(formData.inboundQuantity),
        unitPrice: Number(formData.unitPrice),
        storageLocation: formData.storageLocation.trim() || undefined,
        qualityGrade: formData.qualityGrade.trim() || undefined,
      };

      const response = await materialBatchApiClient.createBatch(batchData, user?.factoryId);
      console.log('✅ Batch created:', response);

      Alert.alert('创建成功', `批次 ${formData.batchNumber} 创建成功！`);

      // 重置表单
      setFormData({
        materialTypeId: '',
        batchNumber: '',
        inboundQuantity: '',
        unitPrice: '',
        storageLocation: '',
        qualityGrade: '',
      });
      setShowCreateDialog(false);

      // 刷新列表
      await loadBatches();
    } catch (error) {
      console.error('❌ Failed to create batch:', error);
      Alert.alert('创建失败', error.response?.data?.message || error.message || '创建批次失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  /**
   * P3-库存: 更新批次
   */
  const handleUpdateBatch = async () => {
    if (!selectedBatch) return;

    try {
      setLoading(true);
      console.log('✏️ Updating batch:', selectedBatch.id, formData);

      const updateData = {
        materialTypeId: formData.materialTypeId.trim(),
        storageLocation: formData.storageLocation.trim() || undefined,
        qualityGrade: formData.qualityGrade.trim() || undefined,
        unitPrice: Number(formData.unitPrice),
      };

      const response = await materialBatchApiClient.updateBatch(selectedBatch.id, updateData, user?.factoryId);
      console.log('✅ Batch updated:', response);

      Alert.alert('更新成功', '批次信息已更新！');

      setShowEditDialog(false);
      setSelectedBatch(null);

      // 刷新列表
      await loadBatches();
    } catch (error) {
      console.error('❌ Failed to update batch:', error);
      Alert.alert('更新失败', error.response?.data?.message || error.message || '更新批次失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  /**
   * P3-库存: 删除批次
   */
  const handleDeleteBatch = async () => {
    if (!selectedBatch) return;

    try {
      setLoading(true);
      console.log('🗑️ Deleting batch:', selectedBatch.id);

      await materialBatchApiClient.deleteBatch(selectedBatch.id, user?.factoryId);
      console.log('✅ Batch deleted');

      Alert.alert('删除成功', `批次 ${selectedBatch.batchNumber} 已删除`);

      setShowDeleteDialog(false);
      setSelectedBatch(null);

      // 刷新列表
      await loadBatches();
    } catch (error) {
      console.error('❌ Failed to delete batch:', error);
      Alert.alert('删除失败', error.response?.data?.message || error.message || '删除批次失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 打开编辑对话框
   */
  const openEditDialog = (batch: MaterialBatch) => {
    setSelectedBatch(batch);
    setFormData({
      materialTypeId: batch.materialTypeId || '',
      batchNumber: batch.batchNumber,
      inboundQuantity: batch.inboundQuantity.toString(),
      unitPrice: batch.unitPrice.toString(),
      storageLocation: batch.storageLocation || '',
      qualityGrade: batch.qualityGrade || '',
    });
    setShowEditDialog(true);
  };

  /**
   * 打开删除对话框
   */
  const openDeleteDialog = (batch: MaterialBatch) => {
    setSelectedBatch(batch);
    setShowDeleteDialog(true);
  };

  /**
   * P3-库存: 预留批次
   */
  const handleReserveBatch = async () => {
    if (!selectedBatch) return;

    try {
      // 验证
      if (!batchOpsData.quantity || Number(batchOpsData.quantity) <= 0) {
        Alert.alert('验证错误', '请输入有效的预留数量');
        return;
      }
      if (Number(batchOpsData.quantity) > selectedBatch.remainingQuantity) {
        Alert.alert('验证错误', `预留数量不能超过剩余数量 ${selectedBatch.remainingQuantity} kg`);
        return;
      }
      if (!batchOpsData.productionPlanId || Number(batchOpsData.productionPlanId) <= 0) {
        Alert.alert('验证错误', '请输入有效的生产计划ID');
        return;
      }

      setBatchOpsLoading(true);
      console.log('🔒 Reserving batch:', selectedBatch.id, batchOpsData);

      await materialBatchApiClient.reserveBatch(
        selectedBatch.id,
        Number(batchOpsData.quantity),
        Number(batchOpsData.productionPlanId),
        user?.factoryId
      );

      console.log('✅ Batch reserved');
      Alert.alert(
        '预留成功',
        `已预留批次 ${selectedBatch.batchNumber}\n数量: ${batchOpsData.quantity} kg`
      );

      setShowReserveDialog(false);
      setSelectedBatch(null);
      setBatchOpsData({ quantity: '', productionPlanId: '', reason: '', newQuantity: '' });

      // 刷新列表
      await loadBatches();
    } catch (error) {
      console.error('❌ Failed to reserve batch:', error);
      Alert.alert('预留失败', error.response?.data?.message || error.message || '预留批次失败，请重试');
    } finally {
      setBatchOpsLoading(false);
    }
  };

  /**
   * P3-库存: 释放批次
   */
  const handleReleaseBatch = async () => {
    if (!selectedBatch) return;

    try {
      // 验证
      if (!batchOpsData.quantity || Number(batchOpsData.quantity) <= 0) {
        Alert.alert('验证错误', '请输入有效的释放数量');
        return;
      }
      if (Number(batchOpsData.quantity) > selectedBatch.reservedQuantity) {
        Alert.alert('验证错误', `释放数量不能超过预留数量 ${selectedBatch.reservedQuantity} kg`);
        return;
      }
      if (!batchOpsData.productionPlanId || Number(batchOpsData.productionPlanId) <= 0) {
        Alert.alert('验证错误', '请输入有效的生产计划ID');
        return;
      }

      setBatchOpsLoading(true);
      console.log('🔓 Releasing batch:', selectedBatch.id, batchOpsData);

      await materialBatchApiClient.releaseBatch(
        selectedBatch.id,
        Number(batchOpsData.quantity),
        Number(batchOpsData.productionPlanId),
        user?.factoryId
      );

      console.log('✅ Batch released');
      Alert.alert(
        '释放成功',
        `已释放批次 ${selectedBatch.batchNumber}\n数量: ${batchOpsData.quantity} kg`
      );

      setShowReleaseDialog(false);
      setSelectedBatch(null);
      setBatchOpsData({ quantity: '', productionPlanId: '', reason: '', newQuantity: '' });

      // 刷新列表
      await loadBatches();
    } catch (error) {
      console.error('❌ Failed to release batch:', error);
      Alert.alert('释放失败', error.response?.data?.message || error.message || '释放批次失败，请重试');
    } finally {
      setBatchOpsLoading(false);
    }
  };

  /**
   * P3-库存: 消耗批次
   */
  const handleConsumeBatch = async () => {
    if (!selectedBatch) return;

    try {
      // 验证
      if (!batchOpsData.quantity || Number(batchOpsData.quantity) <= 0) {
        Alert.alert('验证错误', '请输入有效的消耗数量');
        return;
      }
      if (Number(batchOpsData.quantity) > selectedBatch.remainingQuantity) {
        Alert.alert('验证错误', `消耗数量不能超过剩余数量 ${selectedBatch.remainingQuantity} kg`);
        return;
      }
      if (!batchOpsData.productionPlanId || Number(batchOpsData.productionPlanId) <= 0) {
        Alert.alert('验证错误', '请输入有效的生产计划ID');
        return;
      }

      setBatchOpsLoading(true);
      console.log('📦 Consuming batch:', selectedBatch.id, batchOpsData);

      await materialBatchApiClient.consumeBatch(
        selectedBatch.id,
        Number(batchOpsData.quantity),
        Number(batchOpsData.productionPlanId),
        user?.factoryId
      );

      console.log('✅ Batch consumed');
      Alert.alert(
        '消耗成功',
        `已消耗批次 ${selectedBatch.batchNumber}\n数量: ${batchOpsData.quantity} kg`
      );

      setShowConsumeDialog(false);
      setSelectedBatch(null);
      setBatchOpsData({ quantity: '', productionPlanId: '', reason: '', newQuantity: '' });

      // 刷新列表
      await loadBatches();
    } catch (error) {
      console.error('❌ Failed to consume batch:', error);
      Alert.alert('消耗失败', error.response?.data?.message || error.message || '消耗批次失败，请重试');
    } finally {
      setBatchOpsLoading(false);
    }
  };

  /**
   * P3-库存: 调整批次
   */
  const handleAdjustBatch = async () => {
    if (!selectedBatch) return;

    try {
      // 验证
      if (!batchOpsData.newQuantity || Number(batchOpsData.newQuantity) < 0) {
        Alert.alert('验证错误', '请输入有效的新数量');
        return;
      }
      if (!batchOpsData.reason || !batchOpsData.reason.trim()) {
        Alert.alert('验证错误', '请输入调整原因');
        return;
      }

      setBatchOpsLoading(true);
      console.log('⚖️ Adjusting batch:', selectedBatch.id, batchOpsData);

      await materialBatchApiClient.adjustBatch(
        selectedBatch.id,
        Number(batchOpsData.newQuantity),
        batchOpsData.reason.trim(),
        user?.factoryId
      );

      console.log('✅ Batch adjusted');
      Alert.alert(
        '调整成功',
        `已调整批次 ${selectedBatch.batchNumber}\n原数量: ${selectedBatch.remainingQuantity} kg\n新数量: ${batchOpsData.newQuantity} kg`
      );

      setShowAdjustDialog(false);
      setSelectedBatch(null);
      setBatchOpsData({ quantity: '', productionPlanId: '', reason: '', newQuantity: '' });

      // 刷新列表
      await loadBatches();
    } catch (error) {
      console.error('❌ Failed to adjust batch:', error);
      Alert.alert('调整失败', error.response?.data?.message || error.message || '调整批次失败，请重试');
    } finally {
      setBatchOpsLoading(false);
    }
  };

  // P1-006: 转冻品功能
  const handleConvertToFrozen = async (batch: MaterialBatch) => {
    try {
      setConvertingToFrozen(true);
      console.log('❄️ Converting to frozen:', batch.id);

      // 获取当前日期
      const today = new Date().toISOString().split('T')[0];

      // 调用API
      await materialBatchApiClient.convertToFrozen(
        batch.id,
        {
          convertedBy: user?.id ?? 0,
          convertedDate: today,
          storageLocation: batch.storageLocation || '冷冻库',
          notes: `批次 ${batch.batchNumber} 转为冻品`,
        },
        user?.factoryId
      );

      console.log('✅ Successfully converted to frozen');
      Alert.alert(
        '转换成功',
        `批次 ${batch.batchNumber} 已成功转为冻品\n保质期已延长，存储位置已更新`
      );

      // 刷新列表
      await loadBatches();
    } catch (error: any) {
      console.error('❌ Failed to convert to frozen:', error);
      Alert.alert(
        '转换失败',
        error.response?.data?.message || error.message || '转冻品失败，请重试'
      );
    } finally {
      setConvertingToFrozen(false);
    }
  };

  /**
   * 打开批量操作对话框
   */
  const openBatchOpsDialog = (batch: MaterialBatch, operation: 'reserve' | 'release' | 'consume' | 'adjust') => {
    setSelectedBatch(batch);
    setBatchOpsData({ quantity: '', productionPlanId: '', reason: '', newQuantity: '' });

    switch (operation) {
      case 'reserve':
        setShowReserveDialog(true);
        break;
      case 'release':
        setShowReleaseDialog(true);
        break;
      case 'consume':
        setShowConsumeDialog(true);
        break;
      case 'adjust':
        setBatchOpsData({ ...batchOpsData, newQuantity: batch.remainingQuantity.toString() });
        setShowAdjustDialog(true);
        break;
    }
  };

  // FIFO推荐：返回应优先使用的批次
  const getFIFORecommendation = () => {
    const availableBatches = batches.filter(b =>
      b.status === 'available' && b.remainingQuantity > 0
    );

    if (availableBatches.length === 0) return null;

    // 按入库日期排序，最早的优先
    const sortedByDate = [...availableBatches].sort((a, b) =>
      new Date(a.inboundDate).getTime() - new Date(b.inboundDate).getTime()
    );

    return sortedByDate[0];
  };

  const fifoRecommended = getFIFORecommendation();

  const calculateUsagePercentage = (batch: MaterialBatch) => {
    if (batch.inboundQuantity === 0) return 0;
    return (batch.usedQuantity / batch.inboundQuantity) * 100;
  };

  const calculateRemainingPercentage = (batch: MaterialBatch) => {
    if (batch.inboundQuantity === 0) return 0;
    return (batch.remainingQuantity / batch.inboundQuantity) * 100;
  };

  // 筛选批次
  const filteredBatches = batches.filter(batch => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      batch.batchNumber.toLowerCase().includes(query) ||
      batch.materialTypeId?.toLowerCase().includes(query) ||
      batch.storageLocation?.toLowerCase().includes(query)
    );
  });

  return (
    <View style={styles.container}>
      {/* Header */}
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="原材料批次管理" />
        <Appbar.Action icon="download" onPress={handleExportInventory} />
        <Appbar.Action icon="refresh" onPress={loadBatches} />
      </Appbar.Header>

      <ScrollView style={styles.content}>
        {/* Search */}
        <Searchbar
          placeholder="搜索批次号、原料类型、储存位置"
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchbar}
        />

        {/* Tab Filter */}
        <Card style={styles.filterCard}>
          <Card.Content>
            <SegmentedButtons
              value={filterTab}
              onValueChange={setFilterTab}
              buttons={[
                { value: 'all', label: '全部' },
                { value: 'expiring', label: '即将过期' },
                { value: 'expired', label: '已过期' },
                { value: 'low_stock', label: '低库存' },
              ]}
            />
          </Card.Content>
        </Card>

        {/* Stats */}
        <Card style={styles.statsCard}>
          <Card.Content>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{batches.length}</Text>
                <Text style={styles.statLabel}>批次总数</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {batches.filter(b => b.status === 'available').length}
                </Text>
                <Text style={styles.statLabel}>可用</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {batches.filter(b => {
                    const days = calculateDaysUntilExpiry(b.expiryDate);
                    return days !== null && days <= 7 && days >= 0;
                  }).length}
                </Text>
                <Text style={styles.statLabel}>预警</Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Handle Expired Batches Button */}
        {filterTab === 'expired' && batches.length > 0 && (
          <Card style={styles.actionCard}>
            <Card.Content>
              <Text variant="bodyMedium" style={styles.actionDescription}>
                发现 {batches.length} 个过期批次。您可以批量处理这些批次，系统将自动更新其状态。
              </Text>
              <Button
                mode="contained"
                icon="alert-circle-check"
                onPress={async () => {
                  Alert.alert(
                    '批量处理过期批次',
                    `确定要处理 ${batches.length} 个过期批次吗？\n\n系统将自动标记这些批次为已过期状态。`,
                    [
                      { text: '取消', style: 'cancel' },
                      {
                        text: '确认处理',
                        onPress: async () => {
                          try {
                            setHandlingExpired(true);
                            console.log('🔄 Handling expired batches...');

                            // API integration - POST /material-batches/handle-expired
                            const response = await materialBatchApiClient.handleExpiredBatches(user?.factoryId);

                            console.log('✅ Expired batches handled:', response);

                            Alert.alert(
                              '处理成功',
                              `已成功处理 ${batches.length} 个过期批次`,
                              [
                                {
                                  text: '确定',
                                  onPress: () => {
                                    // 刷新列表
                                    loadBatches();
                                  },
                                },
                              ]
                            );
                          } catch (error) {
                            console.error('❌ Failed to handle expired batches:', error);
                            Alert.alert('处理失败', error.response?.data?.message || '无法处理过期批次，请稍后重试');
                          } finally {
                            setHandlingExpired(false);
                          }
                        },
                      },
                    ]
                  );
                }}
                loading={handlingExpired}
                disabled={handlingExpired}
                style={styles.actionButton}
                buttonColor="#FF9800"
              >
                {handlingExpired ? '处理中...' : '批量处理过期批次'}
              </Button>
            </Card.Content>
          </Card>
        )}

        {/* FIFO Recommendation - P1-006 */}
        {fifoRecommended && (
          <Card style={styles.fifoCard}>
            <Card.Content>
              <View style={styles.fifoHeader}>
                <List.Icon icon="arrow-right-bold-circle" color="#2196F3" />
                <Text style={styles.fifoTitle}>FIFO推荐</Text>
                <Chip mode="flat" style={styles.fifoChip}>优先使用</Chip>
              </View>
              <Text style={styles.fifoDescription}>
                根据先进先出(FIFO)原则，建议优先使用以下批次：
              </Text>
              <View style={styles.fifoRecommendation}>
                <Text style={styles.fifoBatchNumber}>{fifoRecommended.batchNumber}</Text>
                <Text style={styles.fifoMaterialType}>{fifoRecommended.materialTypeId}</Text>
                <View style={styles.fifoDetails}>
                  <Text style={styles.fifoDetailText}>
                    入库日期: {new Date(fifoRecommended.inboundDate).toLocaleDateString()}
                  </Text>
                  <Text style={styles.fifoDetailText}>
                    剩余: {fifoRecommended.remainingQuantity.toFixed(2)} kg
                  </Text>
                </View>
              </View>
            </Card.Content>
          </Card>
        )}

        {/* Batches List */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" />
            <Text style={styles.loadingText}>加载中...</Text>
          </View>
        ) : filteredBatches.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Card.Content style={styles.emptyContent}>
              <List.Icon icon="package-variant" color="#999" />
              <Text style={styles.emptyText}>暂无批次数据</Text>
              <Text style={styles.emptyHint}>
                {filterTab === 'expiring' ? '✅ 没有即将过期的批次' :
                 filterTab === 'expired' ? '✅ 没有已过期的批次' :
                 filterTab === 'low_stock' ? '✅ 没有低库存批次' :
                 '暂无原材料批次'}
              </Text>
            </Card.Content>
          </Card>
        ) : (
          filteredBatches.map((batch) => {
            const daysUntilExpiry = calculateDaysUntilExpiry(batch.expiryDate);
            const expiryWarning = getExpiryWarning(daysUntilExpiry);
            const usagePercent = calculateUsagePercentage(batch);
            const remainingPercent = calculateRemainingPercentage(batch);

            const isFIFORecommended = fifoRecommended?.id === batch.id;

            return (
              <Card
                key={batch.id}
                style={[
                  styles.batchCard,
                  isFIFORecommended && styles.fifoRecommendedCard
                ]}
              >
                <Card.Content>
                  {/* Header */}
                  <View style={styles.batchHeader}>
                    <View style={styles.batchTitleRow}>
                      <View style={styles.batchTitleLeft}>
                        <View style={styles.batchNumberRow}>
                          <Text style={styles.batchNumber}>{batch.batchNumber}</Text>
                          {isFIFORecommended && (
                            <Chip
                              mode="flat"
                              compact
                              icon="arrow-right-bold"
                              style={styles.fifoRecommendedBadge}
                              textStyle={styles.fifoRecommendedBadgeText}
                            >
                              建议优先
                            </Chip>
                          )}
                        </View>
                        <Text style={styles.materialType}>
                          {batch.materialTypeId || '未知原料'}
                        </Text>
                      </View>
                      <View style={styles.chips}>
                        <Chip
                          mode="flat"
                          compact
                          style={[
                            styles.statusChip,
                            { backgroundColor: `${getStatusColor(batch.status)}20` }
                          ]}
                          textStyle={{ color: getStatusColor(batch.status), fontSize: 11 }}
                        >
                          {getStatusText(batch.status)}
                        </Chip>
                        {batch.qualityGrade && (
                          <Chip
                            mode="flat"
                            compact
                            style={[
                              styles.qualityChip,
                              { backgroundColor: `${getQualityColor(batch.qualityGrade)}20` }
                            ]}
                            textStyle={{ color: getQualityColor(batch.qualityGrade), fontSize: 11 }}
                          >
                            {batch.qualityGrade}级
                          </Chip>
                        )}
                      </View>
                    </View>

                    {/* P3-库存: Edit/Delete/BatchOps Actions */}
                    <View style={styles.actionButtons}>
                      <Menu
                        visible={showBatchOpsMenu && selectedBatch?.id === batch.id}
                        onDismiss={() => {
                          setShowBatchOpsMenu(false);
                          setSelectedBatch(null);
                        }}
                        anchor={
                          <IconButton
                            icon="dots-vertical"
                            size={20}
                            onPress={() => {
                              setSelectedBatch(batch);
                              setShowBatchOpsMenu(true);
                            }}
                            style={styles.actionIcon}
                          />
                        }
                      >
                        <Menu.Item
                          leadingIcon="lock"
                          onPress={() => {
                            setShowBatchOpsMenu(false);
                            openBatchOpsDialog(batch, 'reserve');
                          }}
                          title="预留批次"
                        />
                        <Menu.Item
                          leadingIcon="lock-open"
                          onPress={() => {
                            setShowBatchOpsMenu(false);
                            openBatchOpsDialog(batch, 'release');
                          }}
                          title="释放批次"
                        />
                        <Menu.Item
                          leadingIcon="package-variant-closed"
                          onPress={() => {
                            setShowBatchOpsMenu(false);
                            openBatchOpsDialog(batch, 'consume');
                          }}
                          title="消耗批次"
                        />
                        <Menu.Item
                          leadingIcon="tune"
                          onPress={() => {
                            setShowBatchOpsMenu(false);
                            openBatchOpsDialog(batch, 'adjust');
                          }}
                          title="调整数量"
                        />
                      </Menu>

                      <IconButton
                        icon="pencil"
                        size={20}
                        onPress={() => openEditDialog(batch)}
                        style={styles.actionIcon}
                      />
                      <IconButton
                        icon="delete"
                        size={20}
                        onPress={() => openDeleteDialog(batch)}
                        style={styles.actionIcon}
                        iconColor="#F44336"
                      />
                    </View>
                  </View>

                  {/* Quantity Info */}
                  <View style={styles.quantitySection}>
                    <View style={styles.quantityRow}>
                      <Text style={styles.quantityLabel}>剩余/总量：</Text>
                      <Text style={styles.quantityValue}>
                        {batch.remainingQuantity.toFixed(2)} / {batch.inboundQuantity.toFixed(2)} kg
                      </Text>
                    </View>
                    <ProgressBar
                      progress={remainingPercent / 100}
                      color={remainingPercent > 20 ? '#4CAF50' : '#F44336'}
                      style={styles.progressBar}
                    />
                    <View style={styles.quantityDetails}>
                      <Text style={styles.quantityDetailText}>
                        已用: {batch.usedQuantity.toFixed(2)} kg ({usagePercent.toFixed(1)}%)
                      </Text>
                      {batch.reservedQuantity > 0 && (
                        <Text style={styles.quantityDetailText}>
                          预留: {batch.reservedQuantity.toFixed(2)} kg
                        </Text>
                      )}
                    </View>
                  </View>

                  {/* Info */}
                  <View style={styles.batchInfo}>
                    <View style={styles.infoRow}>
                      <List.Icon icon="calendar-import" style={styles.infoIcon} />
                      <Text style={styles.infoText}>
                        入库: {new Date(batch.inboundDate).toLocaleDateString()}
                      </Text>
                    </View>
                    {batch.expiryDate && (
                      <View style={styles.infoRow}>
                        <List.Icon icon="calendar-alert" style={styles.infoIcon} />
                        <Text style={styles.infoText}>
                          到期: {new Date(batch.expiryDate).toLocaleDateString()}
                        </Text>
                        {expiryWarning && (
                          <Chip
                            mode="flat"
                            compact
                            style={[
                              styles.expiryWarningChip,
                              { backgroundColor: `${expiryWarning.color}20` }
                            ]}
                            textStyle={{ color: expiryWarning.color, fontSize: 10 }}
                          >
                            {expiryWarning.text}
                          </Chip>
                        )}
                      </View>
                    )}
                    {batch.storageLocation && (
                      <View style={styles.infoRow}>
                        <List.Icon icon="map-marker" style={styles.infoIcon} />
                        <Text style={styles.infoText}>{batch.storageLocation}</Text>
                      </View>
                    )}
                    <View style={styles.infoRow}>
                      <List.Icon icon="currency-cny" style={styles.infoIcon} />
                      <Text style={styles.infoText}>
                        单价: ¥{batch.unitPrice.toFixed(2)}/kg |
                        总价: ¥{batch.totalCost.toFixed(2)}
                      </Text>
                    </View>
                  </View>

                  {/* Fresh to Frozen Conversion - P1-006 */}
                  {expiryWarning && (expiryWarning.level === 'critical' || expiryWarning.level === 'urgent') && (
                    <View style={styles.conversionSection}>
                      <Button
                        mode="outlined"
                        icon="snowflake"
                        onPress={() => {
                          Alert.alert(
                            '转为冻品',
                            `确定将批次 ${batch.batchNumber} 转为冻品吗？\n这将延长保质期并更新库存状态。`,
                            [
                              { text: '取消', style: 'cancel' },
                              {
                                text: '确认转换',
                                onPress: async () => {
                                  await handleConvertToFrozen(batch);
                                }
                              }
                            ]
                          );
                        }}
                        style={styles.conversionButton}
                        buttonColor="#E3F2FD"
                        textColor="#1976D2"
                      >
                        转为冻品
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

      {/* P3-库存: Create/Edit/Delete Dialogs */}
      <Portal>
        {/* Create Dialog */}
        <Dialog visible={showCreateDialog} onDismiss={() => setShowCreateDialog(false)}>
          <Dialog.Title>创建批次</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="原料类型ID *"
              value={formData.materialTypeId}
              onChangeText={(text) => setFormData({ ...formData, materialTypeId: text })}
              mode="outlined"
              style={styles.dialogInput}
            />
            <TextInput
              label="批次号 *"
              value={formData.batchNumber}
              onChangeText={(text) => setFormData({ ...formData, batchNumber: text })}
              mode="outlined"
              style={styles.dialogInput}
            />
            <TextInput
              label="入库数量 (kg) *"
              value={formData.inboundQuantity}
              onChangeText={(text) => setFormData({ ...formData, inboundQuantity: text })}
              keyboardType="numeric"
              mode="outlined"
              style={styles.dialogInput}
            />
            <TextInput
              label="单价 (元/kg) *"
              value={formData.unitPrice}
              onChangeText={(text) => setFormData({ ...formData, unitPrice: text })}
              keyboardType="numeric"
              mode="outlined"
              style={styles.dialogInput}
            />
            <TextInput
              label="储存位置"
              value={formData.storageLocation}
              onChangeText={(text) => setFormData({ ...formData, storageLocation: text })}
              mode="outlined"
              style={styles.dialogInput}
            />
            <TextInput
              label="质量等级 (A/B/C)"
              value={formData.qualityGrade}
              onChangeText={(text) => setFormData({ ...formData, qualityGrade: text.toUpperCase() })}
              mode="outlined"
              style={styles.dialogInput}
              maxLength={1}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowCreateDialog(false)}>取消</Button>
            <Button onPress={handleCreateBatch} loading={loading} disabled={loading}>
              创建
            </Button>
          </Dialog.Actions>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog visible={showEditDialog} onDismiss={() => setShowEditDialog(false)}>
          <Dialog.Title>编辑批次</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="批次号"
              value={formData.batchNumber}
              editable={false}
              mode="outlined"
              style={styles.dialogInput}
            />
            <TextInput
              label="原料类型ID"
              value={formData.materialTypeId}
              onChangeText={(text) => setFormData({ ...formData, materialTypeId: text })}
              mode="outlined"
              style={styles.dialogInput}
            />
            <TextInput
              label="单价 (元/kg)"
              value={formData.unitPrice}
              onChangeText={(text) => setFormData({ ...formData, unitPrice: text })}
              keyboardType="numeric"
              mode="outlined"
              style={styles.dialogInput}
            />
            <TextInput
              label="储存位置"
              value={formData.storageLocation}
              onChangeText={(text) => setFormData({ ...formData, storageLocation: text })}
              mode="outlined"
              style={styles.dialogInput}
            />
            <TextInput
              label="质量等级 (A/B/C)"
              value={formData.qualityGrade}
              onChangeText={(text) => setFormData({ ...formData, qualityGrade: text.toUpperCase() })}
              mode="outlined"
              style={styles.dialogInput}
              maxLength={1}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowEditDialog(false)}>取消</Button>
            <Button onPress={handleUpdateBatch} loading={loading} disabled={loading}>
              保存
            </Button>
          </Dialog.Actions>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog visible={showDeleteDialog} onDismiss={() => setShowDeleteDialog(false)}>
          <Dialog.Title>确认删除</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              确定要删除批次 <Text style={{ fontWeight: 'bold' }}>{selectedBatch?.batchNumber}</Text> 吗？
            </Text>
            <Text variant="bodySmall" style={{ marginTop: 8, color: '#666' }}>
              此操作不可撤销。
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowDeleteDialog(false)}>取消</Button>
            <Button
              onPress={handleDeleteBatch}
              loading={loading}
              disabled={loading}
              textColor="#F44336"
            >
              删除
            </Button>
          </Dialog.Actions>
        </Dialog>

        {/* P3-库存: Reserve Batch Dialog */}
        <Dialog visible={showReserveDialog} onDismiss={() => setShowReserveDialog(false)}>
          <Dialog.Title>预留批次</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={{ marginBottom: 16 }}>
              批次号: <Text style={{ fontWeight: 'bold' }}>{selectedBatch?.batchNumber}</Text>
            </Text>
            <Text variant="bodySmall" style={{ marginBottom: 8, color: '#666' }}>
              剩余数量: {selectedBatch?.remainingQuantity} kg
            </Text>
            <TextInput
              label="预留数量 (kg) *"
              value={batchOpsData.quantity}
              onChangeText={(text) => setBatchOpsData({ ...batchOpsData, quantity: text })}
              keyboardType="numeric"
              mode="outlined"
              style={styles.dialogInput}
            />
            <TextInput
              label="生产计划ID *"
              value={batchOpsData.productionPlanId}
              onChangeText={(text) => setBatchOpsData({ ...batchOpsData, productionPlanId: text })}
              keyboardType="numeric"
              mode="outlined"
              style={styles.dialogInput}
              placeholder="关联的生产计划编号"
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowReserveDialog(false)}>取消</Button>
            <Button
              onPress={handleReserveBatch}
              loading={batchOpsLoading}
              disabled={batchOpsLoading}
            >
              预留
            </Button>
          </Dialog.Actions>
        </Dialog>

        {/* P3-库存: Release Batch Dialog */}
        <Dialog visible={showReleaseDialog} onDismiss={() => setShowReleaseDialog(false)}>
          <Dialog.Title>释放批次</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={{ marginBottom: 16 }}>
              批次号: <Text style={{ fontWeight: 'bold' }}>{selectedBatch?.batchNumber}</Text>
            </Text>
            <Text variant="bodySmall" style={{ marginBottom: 8, color: '#666' }}>
              已预留数量: {selectedBatch?.reservedQuantity} kg
            </Text>
            <TextInput
              label="释放数量 (kg) *"
              value={batchOpsData.quantity}
              onChangeText={(text) => setBatchOpsData({ ...batchOpsData, quantity: text })}
              keyboardType="numeric"
              mode="outlined"
              style={styles.dialogInput}
            />
            <TextInput
              label="生产计划ID *"
              value={batchOpsData.productionPlanId}
              onChangeText={(text) => setBatchOpsData({ ...batchOpsData, productionPlanId: text })}
              keyboardType="numeric"
              mode="outlined"
              style={styles.dialogInput}
              placeholder="关联的生产计划编号"
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowReleaseDialog(false)}>取消</Button>
            <Button
              onPress={handleReleaseBatch}
              loading={batchOpsLoading}
              disabled={batchOpsLoading}
            >
              释放
            </Button>
          </Dialog.Actions>
        </Dialog>

        {/* P3-库存: Consume Batch Dialog */}
        <Dialog visible={showConsumeDialog} onDismiss={() => setShowConsumeDialog(false)}>
          <Dialog.Title>消耗批次</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={{ marginBottom: 16 }}>
              批次号: <Text style={{ fontWeight: 'bold' }}>{selectedBatch?.batchNumber}</Text>
            </Text>
            <Text variant="bodySmall" style={{ marginBottom: 8, color: '#666' }}>
              剩余数量: {selectedBatch?.remainingQuantity} kg
            </Text>
            <TextInput
              label="消耗数量 (kg) *"
              value={batchOpsData.quantity}
              onChangeText={(text) => setBatchOpsData({ ...batchOpsData, quantity: text })}
              keyboardType="numeric"
              mode="outlined"
              style={styles.dialogInput}
            />
            <TextInput
              label="生产计划ID *"
              value={batchOpsData.productionPlanId}
              onChangeText={(text) => setBatchOpsData({ ...batchOpsData, productionPlanId: text })}
              keyboardType="numeric"
              mode="outlined"
              style={styles.dialogInput}
              placeholder="关联的生产计划编号"
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowConsumeDialog(false)}>取消</Button>
            <Button
              onPress={handleConsumeBatch}
              loading={batchOpsLoading}
              disabled={batchOpsLoading}
            >
              消耗
            </Button>
          </Dialog.Actions>
        </Dialog>

        {/* P3-库存: Adjust Batch Dialog */}
        <Dialog visible={showAdjustDialog} onDismiss={() => setShowAdjustDialog(false)}>
          <Dialog.Title>调整批次数量</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={{ marginBottom: 16 }}>
              批次号: <Text style={{ fontWeight: 'bold' }}>{selectedBatch?.batchNumber}</Text>
            </Text>
            <Text variant="bodySmall" style={{ marginBottom: 8, color: '#666' }}>
              当前数量: {selectedBatch?.remainingQuantity} kg
            </Text>
            <TextInput
              label="新数量 (kg) *"
              value={batchOpsData.newQuantity}
              onChangeText={(text) => setBatchOpsData({ ...batchOpsData, newQuantity: text })}
              keyboardType="numeric"
              mode="outlined"
              style={styles.dialogInput}
            />
            <TextInput
              label="调整原因 *"
              value={batchOpsData.reason}
              onChangeText={(text) => setBatchOpsData({ ...batchOpsData, reason: text })}
              mode="outlined"
              style={styles.dialogInput}
              placeholder="例如：盘点调整、损耗补充、错误修正"
              multiline
              numberOfLines={2}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowAdjustDialog(false)}>取消</Button>
            <Button
              onPress={handleAdjustBatch}
              loading={batchOpsLoading}
              disabled={batchOpsLoading}
            >
              调整
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* P3-库存: FAB for Creating New Batch */}
      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => {
          setFormData({
            materialTypeId: '',
            batchNumber: '',
            inboundQuantity: '',
            unitPrice: '',
            storageLocation: '',
            qualityGrade: '',
          });
          setShowCreateDialog(true);
        }}
        label="创建批次"
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
  searchbar: {
    margin: 16,
    marginBottom: 8,
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
  },
  actionCard: {
    margin: 16,
    marginBottom: 8,
    backgroundColor: '#FFF3E0',
  },
  actionDescription: {
    color: '#666',
    marginBottom: 12,
  },
  actionButton: {
    marginTop: 4,
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
  emptyHint: {
    fontSize: 14,
    color: '#bbb',
    marginTop: 8,
  },
  batchCard: {
    margin: 16,
    marginBottom: 8,
  },
  batchHeader: {
    marginBottom: 12,
  },
  batchTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  batchTitleLeft: {
    flex: 1,
  },
  batchNumber: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  materialType: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  chips: {
    flexDirection: 'row',
    gap: 4,
    flexWrap: 'wrap',
  },
  statusChip: {
    height: 24,
  },
  qualityChip: {
    height: 24,
  },
  quantitySection: {
    marginBottom: 12,
    padding: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
  },
  quantityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  quantityLabel: {
    fontSize: 13,
    color: '#666',
  },
  quantityValue: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#333',
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    marginBottom: 8,
  },
  quantityDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  quantityDetailText: {
    fontSize: 11,
    color: '#999',
  },
  batchInfo: {
    marginTop: 4,
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
  expiryWarningChip: {
    height: 20,
    marginLeft: 8,
  },
  conversionSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  conversionButton: {
    borderColor: '#1976D2',
    borderWidth: 1,
  },
  bottomPadding: {
    height: 80,
  },
  // P3-库存: CRUD操作样式
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  actionIcon: {
    margin: 0,
  },
  dialogInput: {
    marginBottom: 12,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    backgroundColor: '#2196F3',
  },
  batchNumberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fifoCard: {
    margin: 16,
    marginBottom: 8,
    backgroundColor: '#E3F2FD',
  },
  fifoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  fifoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1976D2',
    flex: 1,
    marginLeft: 8,
  },
  fifoChip: {
    backgroundColor: '#2196F3',
  },
  fifoDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  fifoRecommendation: {
    backgroundColor: '#FFF',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  fifoBatchNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#212121',
    marginBottom: 4,
  },
  fifoMaterialType: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  fifoDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  fifoDetailText: {
    fontSize: 13,
    color: '#999',
  },
  fifoRecommendedCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  fifoRecommendedBadge: {
    backgroundColor: '#2196F3',
  },
  fifoRecommendedBadgeText: {
    color: '#FFF',
    fontSize: 11,
  },
});
