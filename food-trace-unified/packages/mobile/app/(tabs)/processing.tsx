import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Alert } from 'react-native';
import { router } from 'expo-router';
import {
  Text,
  Card,
  Button,
  List,
  Chip,
  ActivityIndicator,
  FAB,
  Badge
} from 'react-native-paper';
import { useProcessingStore } from '@food-trace/core';

export default function ProcessingScreen() {
  const {
    batches,
    qualityChecks,
    equipment,
    fetchBatches,
    fetchQualityChecks,
    fetchEquipment,
    isLoading
  } = useProcessingStore();

  const [refreshing, setRefreshing] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'batches' | 'quality' | 'equipment'>('batches');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      await Promise.all([
        fetchBatches(),
        fetchQualityChecks(),
        fetchEquipment()
      ]);
    } catch (error) {
      Alert.alert('加载失败', '无法获取加工数据');
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleCreateBatch = () => {
    Alert.alert('功能开发中', '创建新批次功能正在开发中');
  };

  const handleQualityCheck = () => {
    Alert.alert('功能开发中', '质量检测功能正在开发中');
  };

  const handleBatchPress = (batchId: string) => {
    Alert.alert('功能开发中', `批次详情页面正在开发中\n批次ID: ${batchId}`);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return '#2196F3';
      case 'processing': return '#ff9800';
      case 'completed': return '#4caf50';
      case 'paused': return '#f44336';
      default: return '#757575';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active': return '进行中';
      case 'processing': return '加工中';
      case 'completed': return '已完成';
      case 'paused': return '已暂停';
      default: return '未知';
    }
  };

  const getQualityIcon = (result: string) => {
    switch (result) {
      case 'pass': return 'check-circle';
      case 'fail': return 'close-circle';
      case 'warning': return 'alert-circle';
      default: return 'help-circle';
    }
  };

  const getQualityColor = (result: string) => {
    switch (result) {
      case 'pass': return '#4caf50';
      case 'fail': return '#f44336';
      case 'warning': return '#ff9800';
      default: return '#757575';
    }
  };

  const renderTabContent = () => {
    switch (selectedTab) {
      case 'batches':
        return (
          <Card style={styles.contentCard}>
            <Card.Content>
              <Text variant="titleMedium" style={styles.cardTitle}>
                生产批次 ({batches?.length || 0})
              </Text>
              
              {isLoading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" />
                </View>
              ) : batches && batches.length > 0 ? (
                batches.slice(0, 10).map((batch, index) => (
                  <List.Item
                    key={batch.id}
                    title={batch.batchNumber}
                    description={`产品: ${batch.productName} | 数量: ${batch.quantity}${batch.unit}`}
                    left={() => (
                      <View style={styles.batchInfo}>
                        <Text variant="bodySmall" style={styles.dateText}>
                          {new Date(batch.createdAt).toLocaleDateString('zh-CN')}
                        </Text>
                        <Chip
                          style={[
                            styles.statusChip,
                            { backgroundColor: getStatusColor(batch.status) + '20' }
                          ]}
                          textStyle={{ color: getStatusColor(batch.status) }}
                          compact
                        >
                          {getStatusText(batch.status)}
                        </Chip>
                      </View>
                    )}
                    right={() => <List.Icon icon="chevron-right" />}
                    onPress={() => handleBatchPress(batch.id)}
                    style={styles.listItem}
                  />
                ))
              ) : (
                <View style={styles.emptyContainer}>
                  <Text variant="bodyMedium" style={styles.emptyText}>
                    暂无生产批次
                  </Text>
                  <Button mode="outlined" onPress={handleCreateBatch}>
                    创建批次
                  </Button>
                </View>
              )}
            </Card.Content>
          </Card>
        );

      case 'quality':
        return (
          <Card style={styles.contentCard}>
            <Card.Content>
              <Text variant="titleMedium" style={styles.cardTitle}>
                质量检测 ({qualityChecks?.length || 0})
              </Text>
              
              {isLoading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" />
                </View>
              ) : qualityChecks && qualityChecks.length > 0 ? (
                qualityChecks.slice(0, 10).map((check, index) => (
                  <List.Item
                    key={check.id}
                    title={check.checkType}
                    description={`批次: ${check.batchId} | 检测员: ${check.inspector}`}
                    left={() => (
                      <List.Icon
                        icon={getQualityIcon(check.result)}
                        color={getQualityColor(check.result)}
                      />
                    )}
                    right={() => (
                      <View style={styles.qualityResult}>
                        <Text
                          variant="bodySmall"
                          style={[
                            styles.resultText,
                            { color: getQualityColor(check.result) }
                          ]}
                        >
                          {check.result === 'pass' ? '合格' : 
                           check.result === 'fail' ? '不合格' : '警告'}
                        </Text>
                        <Text variant="bodySmall" style={styles.scoreText}>
                          {check.score}/100
                        </Text>
                      </View>
                    )}
                    style={styles.listItem}
                  />
                ))
              ) : (
                <View style={styles.emptyContainer}>
                  <Text variant="bodyMedium" style={styles.emptyText}>
                    暂无质量检测记录
                  </Text>
                  <Button mode="outlined" onPress={handleQualityCheck}>
                    开始检测
                  </Button>
                </View>
              )}
            </Card.Content>
          </Card>
        );

      case 'equipment':
        return (
          <Card style={styles.contentCard}>
            <Card.Content>
              <Text variant="titleMedium" style={styles.cardTitle}>
                设备状态 ({equipment?.length || 0})
              </Text>
              
              {isLoading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" />
                </View>
              ) : equipment && equipment.length > 0 ? (
                equipment.map((item, index) => (
                  <List.Item
                    key={item.id}
                    title={item.name}
                    description={`类型: ${item.type} | 位置: ${item.location}`}
                    left={() => (
                      <View style={styles.equipmentStatus}>
                        <Badge
                          style={{
                            backgroundColor: item.status === 'running' ? '#4caf50' : 
                                          item.status === 'maintenance' ? '#ff9800' : '#f44336'
                          }}
                        />
                        <Text variant="bodySmall" style={styles.equipmentType}>
                          {item.type === 'production' ? '生产' :
                           item.type === 'quality' ? '质检' :
                           item.type === 'packaging' ? '包装' : '其他'}
                        </Text>
                      </View>
                    )}
                    right={() => (
                      <Text variant="bodySmall" style={styles.equipmentStatus}>
                        {item.status === 'running' ? '运行中' :
                         item.status === 'maintenance' ? '维护中' : '停机'}
                      </Text>
                    )}
                    style={styles.listItem}
                  />
                ))
              ) : (
                <View style={styles.emptyContainer}>
                  <Text variant="bodyMedium" style={styles.emptyText}>
                    暂无设备信息
                  </Text>
                </View>
              )}
            </Card.Content>
          </Card>
        );

      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* 概览卡片 */}
        <Card style={styles.overviewCard}>
          <Card.Content>
            <Text variant="titleLarge" style={styles.cardTitle}>
              加工管理概览
            </Text>
            
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text variant="headlineMedium" style={styles.statNumber}>
                  {batches?.filter(b => b.status === 'active').length || 0}
                </Text>
                <Text variant="bodySmall">活跃批次</Text>
              </View>
              
              <View style={styles.statItem}>
                <Text variant="headlineMedium" style={styles.statNumber}>
                  {qualityChecks?.filter(q => q.result === 'pass').length || 0}
                </Text>
                <Text variant="bodySmall">合格检测</Text>
              </View>
              
              <View style={styles.statItem}>
                <Text variant="headlineMedium" style={styles.statNumber}>
                  {equipment?.filter(e => e.status === 'running').length || 0}
                </Text>
                <Text variant="bodySmall">运行设备</Text>
              </View>
              
              <View style={styles.statItem}>
                <Text variant="headlineMedium" style={[styles.statNumber, styles.efficiencyScore]}>
                  95%
                </Text>
                <Text variant="bodySmall">生产效率</Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* 选项卡 */}
        <Card style={styles.tabCard}>
          <Card.Content>
            <View style={styles.tabs}>
              <Chip
                selected={selectedTab === 'batches'}
                onPress={() => setSelectedTab('batches')}
                style={styles.tabChip}
              >
                生产批次
              </Chip>
              <Chip
                selected={selectedTab === 'quality'}
                onPress={() => setSelectedTab('quality')}
                style={styles.tabChip}
              >
                质量检测
              </Chip>
              <Chip
                selected={selectedTab === 'equipment'}
                onPress={() => setSelectedTab('equipment')}
                style={styles.tabChip}
              >
                设备状态
              </Chip>
            </View>
          </Card.Content>
        </Card>

        {/* 内容区域 */}
        {renderTabContent()}

        {/* 底部间距 */}
        <View style={styles.bottomSpacing} />
      </ScrollView>

      {/* 浮动按钮 */}
      <FAB
        icon="plus"
        label="新建批次"
        style={styles.fab}
        onPress={handleCreateBatch}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  overviewCard: {
    margin: 16,
    marginBottom: 8,
  },
  tabCard: {
    marginHorizontal: 16,
    marginBottom: 8,
  },
  contentCard: {
    marginHorizontal: 16,
    marginBottom: 8,
    minHeight: 300,
  },
  cardTitle: {
    marginBottom: 16,
    fontWeight: 'bold',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statItem: {
    width: '48%',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginBottom: 8,
  },
  statNumber: {
    fontWeight: 'bold',
    color: '#2196F3',
    marginBottom: 4,
  },
  efficiencyScore: {
    color: '#4caf50',
  },
  tabs: {
    flexDirection: 'row',
    gap: 8,
  },
  tabChip: {
    flex: 1,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    marginBottom: 16,
    opacity: 0.7,
  },
  listItem: {
    paddingVertical: 8,
  },
  batchInfo: {
    alignItems: 'flex-start',
    marginRight: 12,
    minWidth: 80,
  },
  dateText: {
    opacity: 0.7,
    marginBottom: 4,
    fontSize: 11,
  },
  statusChip: {
    marginTop: 4,
  },
  qualityResult: {
    alignItems: 'flex-end',
    marginLeft: 12,
  },
  resultText: {
    fontWeight: 'bold',
    marginBottom: 2,
  },
  scoreText: {
    opacity: 0.7,
  },
  equipmentStatus: {
    alignItems: 'center',
    marginRight: 12,
  },
  equipmentType: {
    marginTop: 4,
    fontSize: 11,
  },
  bottomSpacing: {
    height: 80,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    backgroundColor: '#2196F3',
  },
});