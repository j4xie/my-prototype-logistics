/**
 * 电子秤协议列表界面 (平台管理员)
 * 管理所有电子秤通信协议配置
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  FlatList,
  TextInput,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Icon } from 'react-native-paper';
import scaleApiClient, { ScaleProtocol, ConnectionType } from '../../../services/api/scaleApiClient';

type StackParamList = {
  ScaleProtocolList: undefined;
  ScaleProtocolDetail: { protocolId: string; isNew?: boolean };
};

type NavigationProp = NativeStackNavigationProp<StackParamList, 'ScaleProtocolList'>;

const CONNECTION_TYPES: { value: ConnectionType | 'all'; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'RS232', label: 'RS232' },
  { value: 'RS485', label: 'RS485' },
  { value: 'HTTP_API', label: 'HTTP API' },
  { value: 'MQTT', label: 'MQTT' },
  { value: 'MODBUS_RTU', label: 'Modbus RTU' },
  { value: 'MODBUS_TCP', label: 'Modbus TCP' },
];

export function ScaleProtocolListScreen() {
  const navigation = useNavigation<NavigationProp>();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [protocols, setProtocols] = useState<ScaleProtocol[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedType, setSelectedType] = useState<ConnectionType | 'all'>('all');

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const params: Parameters<typeof scaleApiClient.getProtocols>[0] = {};
      if (selectedType !== 'all') {
        params.connectionType = selectedType;
      }
      const data = await scaleApiClient.getProtocols(params);
      // 客户端过滤搜索
      const filtered = searchKeyword
        ? data.filter(
            p =>
              p.protocolName.toLowerCase().includes(searchKeyword.toLowerCase()) ||
              p.protocolCode.toLowerCase().includes(searchKeyword.toLowerCase())
          )
        : data;
      setProtocols(filtered);
    } catch (err) {
      console.error('加载协议列表失败:', err);
      setError('加载协议列表失败');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [searchKeyword, selectedType]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const handleDelete = useCallback(async (protocol: ScaleProtocol) => {
    if (protocol.isBuiltin) {
      Alert.alert('提示', '内置协议不可删除');
      return;
    }
    Alert.alert('确认删除', `确定要删除协议 "${protocol.protocolName}" 吗？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          try {
            await scaleApiClient.deleteProtocol(protocol.id);
            loadData();
          } catch (err) {
            console.error('删除失败:', err);
            Alert.alert('错误', '删除失败');
          }
        },
      },
    ]);
  }, [loadData]);

  const renderProtocolItem = ({ item }: { item: ScaleProtocol }) => (
    <TouchableOpacity
      style={styles.protocolCard}
      onPress={() => navigation.navigate('ScaleProtocolDetail', { protocolId: item.id })}
      activeOpacity={0.7}
    >
      <View style={styles.protocolHeader}>
        <View style={styles.protocolInfo}>
          <Icon source="file-document-outline" size={24} color="#3182ce" />
          <View style={styles.protocolTextInfo}>
            <Text style={styles.protocolName}>{item.protocolName}</Text>
            <Text style={styles.protocolCode}>{item.protocolCode}</Text>
          </View>
        </View>
        <View style={styles.protocolBadges}>
          {item.isBuiltin && (
            <View style={[styles.badge, styles.badgeBuiltin]}>
              <Text style={styles.badgeText}>内置</Text>
            </View>
          )}
          {item.isVerified && (
            <View style={[styles.badge, styles.badgeVerified]}>
              <Text style={styles.badgeText}>已验证</Text>
            </View>
          )}
          <View style={[styles.badge, item.isActive ? styles.badgeActive : styles.badgeInactive]}>
            <Text style={styles.badgeText}>{item.isActive ? '启用' : '禁用'}</Text>
          </View>
        </View>
      </View>

      <View style={styles.protocolDetails}>
        <View style={styles.detailRow}>
          <Icon source="connection" size={16} color="#718096" />
          <Text style={styles.detailText}>{item.connectionType}</Text>
        </View>
        {item.checksumType && item.checksumType !== 'NONE' && (
          <View style={styles.detailRow}>
            <Icon source="check-decagram" size={16} color="#718096" />
            <Text style={styles.detailText}>校验: {item.checksumType}</Text>
          </View>
        )}
        {item.readMode && (
          <View style={styles.detailRow}>
            <Icon source="sync" size={16} color="#718096" />
            <Text style={styles.detailText}>
              {item.readMode === 'CONTINUOUS' ? '连续输出' : item.readMode === 'POLL' ? '轮询' : '变化上报'}
            </Text>
          </View>
        )}
        {item.description && (
          <Text style={styles.description} numberOfLines={2}>
            {item.description}
          </Text>
        )}
      </View>

      <View style={styles.protocolFooter}>
        <TouchableOpacity
          style={styles.footerButton}
          onPress={() => navigation.navigate('ScaleProtocolDetail', { protocolId: item.id })}
        >
          <Icon source="pencil" size={16} color="#3182ce" />
          <Text style={styles.footerButtonText}>编辑</Text>
        </TouchableOpacity>
        {!item.isBuiltin && (
          <TouchableOpacity style={styles.footerButton} onPress={() => handleDelete(item)}>
            <Icon source="delete" size={16} color="#e53e3e" />
            <Text style={[styles.footerButtonText, { color: '#e53e3e' }]}>删除</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );

  const TypeFilterChips = () => (
    <View style={styles.filterContainer}>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={CONNECTION_TYPES}
        keyExtractor={item => item.value}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.filterChip, selectedType === item.value && styles.filterChipActive]}
            onPress={() => setSelectedType(item.value)}
          >
            <Text
              style={[styles.filterChipText, selectedType === item.value && styles.filterChipTextActive]}
            >
              {item.label}
            </Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3182ce" />
          <Text style={styles.loadingText}>加载中...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* 搜索框 */}
      <View style={styles.searchContainer}>
        <Icon source="magnify" size={20} color="#718096" />
        <TextInput
          style={styles.searchInput}
          placeholder="搜索协议名称或编码..."
          value={searchKeyword}
          onChangeText={setSearchKeyword}
          returnKeyType="search"
        />
        {searchKeyword.length > 0 && (
          <TouchableOpacity onPress={() => setSearchKeyword('')}>
            <Icon source="close-circle" size={20} color="#718096" />
          </TouchableOpacity>
        )}
      </View>

      {/* 类型筛选 */}
      <TypeFilterChips />

      {/* 协议列表 */}
      {error ? (
        <View style={styles.errorContainer}>
          <Icon source="alert-circle" size={48} color="#e53e3e" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadData}>
            <Text style={styles.retryButtonText}>重试</Text>
          </TouchableOpacity>
        </View>
      ) : protocols.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Icon source="file-document-outline" size={64} color="#a0aec0" />
          <Text style={styles.emptyTitle}>暂无协议</Text>
          <Text style={styles.emptySubtitle}>点击右下角按钮创建新协议</Text>
        </View>
      ) : (
        <FlatList
          data={protocols}
          renderItem={renderProtocolItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#3182ce']} />
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* 添加按钮 */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('ScaleProtocolDetail', { protocolId: '', isNew: true })}
        activeOpacity={0.8}
      >
        <Icon source="plus" size={24} color="#fff" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7fafc',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#718096',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  searchInput: {
    flex: 1,
    height: 44,
    marginLeft: 8,
    fontSize: 15,
    color: '#2d3748',
  },
  filterContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#edf2f7',
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: '#3182ce',
  },
  filterChipText: {
    fontSize: 13,
    color: '#4a5568',
  },
  filterChipTextActive: {
    color: '#fff',
    fontWeight: '500',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 80,
  },
  protocolCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  protocolHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  protocolInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  protocolTextInfo: {
    marginLeft: 12,
    flex: 1,
  },
  protocolName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2d3748',
  },
  protocolCode: {
    fontSize: 13,
    color: '#718096',
    marginTop: 2,
    fontFamily: 'monospace',
  },
  protocolBadges: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    maxWidth: 120,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeBuiltin: {
    backgroundColor: '#805ad5',
  },
  badgeVerified: {
    backgroundColor: '#48bb78',
  },
  badgeActive: {
    backgroundColor: '#3182ce',
  },
  badgeInactive: {
    backgroundColor: '#a0aec0',
  },
  badgeText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '500',
  },
  protocolDetails: {
    gap: 8,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 13,
    color: '#4a5568',
  },
  description: {
    fontSize: 13,
    color: '#718096',
    marginTop: 4,
    lineHeight: 18,
  },
  protocolFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#edf2f7',
    gap: 16,
  },
  footerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  footerButtonText: {
    fontSize: 13,
    color: '#3182ce',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorText: {
    fontSize: 15,
    color: '#718096',
    marginTop: 12,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: '#3182ce',
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#4a5568',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#718096',
    marginTop: 8,
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#3182ce',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#3182ce',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
});

export default ScaleProtocolListScreen;
