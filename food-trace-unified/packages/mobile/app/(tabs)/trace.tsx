import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { router } from 'expo-router';
import {
  Text,
  Chip,
  List,
  Searchbar,
  FAB
} from 'react-native-paper';
import { traceApi } from '@food-trace/core';
import { 
  Card, 
  Button, 
  Loading, 
  TraceCard, 
  TraceData,
  QuickScanButton 
} from '@food-trace/ui-shared';

interface TraceItem {
  id: string;
  batchNumber: string;
  productName: string;
  status: string;
  createdAt: string;
  location: string;
  category: string;
}

export default function TraceScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [traceList, setTraceList] = useState<TraceItem[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([
    'BATCH20250101001',
    'BATCH20250102003',
    'BATCH20241230015'
  ]);
  const [selectedFilter, setSelectedFilter] = useState<string>('all');

  const filters = [
    { key: 'all', label: '全部' },
    { key: 'active', label: '进行中' },
    { key: 'completed', label: '已完成' },
    { key: 'shipped', label: '已发货' },
  ];

  useEffect(() => {
    loadTraceList();
  }, [selectedFilter]);

  const loadTraceList = async () => {
    setIsLoading(true);
    try {
      // 模拟API调用
      const mockData: TraceItem[] = [
        {
          id: 'trace1',
          batchNumber: 'BATCH20250107001',
          productName: '有机大米',
          status: 'active',
          createdAt: '2025-01-07T10:30:00Z',
          location: '山东省济南市',
          category: '粮食'
        },
        {
          id: 'trace2',
          batchNumber: 'BATCH20250106012',
          productName: '新鲜蔬菜',
          status: 'shipped',
          createdAt: '2025-01-06T14:20:00Z',
          location: '江苏省南京市',
          category: '蔬菜'
        },
        {
          id: 'trace3',
          batchNumber: 'BATCH20250105008',
          productName: '优质牛肉',
          status: 'completed',
          createdAt: '2025-01-05T09:15:00Z',
          location: '内蒙古呼和浩特市',
          category: '肉类'
        }
      ];

      // 根据筛选条件过滤
      const filteredData = selectedFilter === 'all' 
        ? mockData 
        : mockData.filter(item => item.status === selectedFilter);

      setTraceList(filteredData);
    } catch (error) {
      Alert.alert('加载失败', '无法获取溯源列表');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      Alert.alert('提示', '请输入批次号或产品名称');
      return;
    }

    setIsLoading(true);
    try {
      // 添加到最近搜索
      if (!recentSearches.includes(searchQuery)) {
        setRecentSearches(prev => [searchQuery, ...prev.slice(0, 4)]);
      }

      // 模拟搜索API调用
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // 检查是否找到结果
      const found = traceList.find(item => 
        item.batchNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.productName.toLowerCase().includes(searchQuery.toLowerCase())
      );

      if (found) {
        router.push(`/trace/detail/${found.id}`);
      } else {
        Alert.alert('未找到结果', '没有找到匹配的溯源信息');
      }
    } catch (error) {
      Alert.alert('搜索失败', '请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  const handleScanQR = () => {
    // TODO: 实现二维码扫描功能
    Alert.alert('功能开发中', '二维码扫描功能正在开发中');
  };

  const handleTraceItemPress = (item: TraceItem) => {
    router.push(`/trace/detail/${item.id}`);
  };

  const handleRecentSearchPress = (query: string) => {
    setSearchQuery(query);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return '#2196F3';
      case 'completed': return '#4caf50';
      case 'shipped': return '#ff9800';
      default: return '#757575';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active': return '进行中';
      case 'completed': return '已完成';
      case 'shipped': return '已发货';
      default: return '未知';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* 搜索区域 */}
        <Card style={styles.searchCard}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              溯源查询
            </Text>
            
            <Searchbar
              placeholder="输入批次号或产品名称"
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearch}
              style={styles.searchBar}
              loading={isLoading}
            />

            <View style={styles.actionButtons}>
              <Button
                mode="contained"
                onPress={handleSearch}
                style={styles.searchButton}
                disabled={isLoading}
                loading={isLoading}
              >
                搜索
              </Button>
              <Button
                mode="outlined"
                onPress={handleScanQR}
                style={styles.scanButton}
                icon="qrcode-scan"
              >
                扫码
              </Button>
            </View>
          </Card.Content>
        </Card>

        {/* 最近搜索 */}
        {recentSearches.length > 0 && (
          <Card style={styles.card}>
            <Card.Content>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                最近搜索
              </Text>
              <View style={styles.recentSearches}>
                {recentSearches.map((query, index) => (
                  <Chip
                    key={index}
                    onPress={() => handleRecentSearchPress(query)}
                    style={styles.searchChip}
                    icon="history"
                  >
                    {query}
                  </Chip>
                ))}
              </View>
            </Card.Content>
          </Card>
        )}

        {/* 筛选器 */}
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              溯源列表
            </Text>
            <View style={styles.filters}>
              {filters.map((filter) => (
                <Chip
                  key={filter.key}
                  selected={selectedFilter === filter.key}
                  onPress={() => setSelectedFilter(filter.key)}
                  style={styles.filterChip}
                >
                  {filter.label}
                </Chip>
              ))}
            </View>
          </Card.Content>
        </Card>

        {/* 溯源列表 */}
        <Card style={styles.listCard}>
          <Card.Content>
            {isLoading ? (
              <Loading text="加载溯源数据..." />
            ) : traceList.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text variant="bodyLarge" style={styles.emptyText}>
                  暂无溯源数据
                </Text>
                <Button
                  mode="outlined"
                  onPress={loadTraceList}
                  style={styles.retryButton}
                >
                  重新加载
                </Button>
              </View>
            ) : (
              traceList.map((item, index) => (
                <React.Fragment key={item.id}>
                  <List.Item
                    title={item.productName}
                    description={`批次号: ${item.batchNumber}`}
                    left={() => (
                      <View style={styles.listItemLeft}>
                        <Text variant="bodySmall" style={styles.dateText}>
                          {formatDate(item.createdAt)}
                        </Text>
                        <Chip
                          style={[
                            styles.statusChip,
                            { backgroundColor: getStatusColor(item.status) + '20' }
                          ]}
                          textStyle={{ color: getStatusColor(item.status) }}
                          compact
                        >
                          {getStatusText(item.status)}
                        </Chip>
                      </View>
                    )}
                    right={() => (
                      <View style={styles.listItemRight}>
                        <Text variant="bodySmall" style={styles.locationText}>
                          {item.location}
                        </Text>
                        <List.Icon icon="chevron-right" />
                      </View>
                    )}
                    onPress={() => handleTraceItemPress(item)}
                    style={styles.listItem}
                  />
                  {index < traceList.length - 1 && <List.Subheader />}
                </React.Fragment>
              ))
            )}
          </Card.Content>
        </Card>

        {/* 底部间距 */}
        <View style={styles.bottomSpacing} />
      </ScrollView>

      {/* 浮动按钮 */}
      <FAB
        icon="qrcode-scan"
        label="扫码溯源"
        style={styles.fab}
        onPress={handleScanQR}
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
  searchCard: {
    margin: 16,
    marginBottom: 8,
  },
  card: {
    marginHorizontal: 16,
    marginBottom: 8,
  },
  listCard: {
    marginHorizontal: 16,
    marginBottom: 8,
    minHeight: 200,
  },
  sectionTitle: {
    marginBottom: 16,
    fontWeight: 'bold',
  },
  searchBar: {
    marginBottom: 16,
    backgroundColor: 'transparent',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  searchButton: {
    flex: 2,
  },
  scanButton: {
    flex: 1,
  },
  recentSearches: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  searchChip: {
    marginBottom: 4,
  },
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    marginBottom: 4,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    marginBottom: 16,
    opacity: 0.7,
  },
  retryButton: {
    marginTop: 8,
  },
  listItem: {
    paddingVertical: 8,
  },
  listItemLeft: {
    alignItems: 'flex-start',
    marginRight: 12,
    minWidth: 80,
  },
  listItemRight: {
    alignItems: 'flex-end',
    marginLeft: 12,
    minWidth: 100,
  },
  dateText: {
    opacity: 0.7,
    marginBottom: 4,
    fontSize: 11,
  },
  statusChip: {
    marginTop: 4,
  },
  locationText: {
    opacity: 0.7,
    marginBottom: 4,
    textAlign: 'right',
    fontSize: 11,
  },
  bottomSpacing: {
    height: 80, // 为FAB留出空间
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    backgroundColor: '#2196F3',
  },
});