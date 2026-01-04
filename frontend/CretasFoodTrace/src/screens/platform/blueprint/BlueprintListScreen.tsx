/**
 * BlueprintListScreen - Blueprint list with search, industry filters, version badges
 *
 * Platform admin screen for managing all blueprints
 *
 * @author Cretas Team
 * @version 1.0.0
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
  Dimensions,
  Alert,
} from 'react-native';
import {
  Text,
  Card,
  Chip,
  Button,
  IconButton,
  TextInput,
  FAB,
  ActivityIndicator,
  Badge,
  Portal,
  Modal,
} from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { isAxiosError } from 'axios';
import { apiClient } from '../../../services/api/apiClient';

// Types
interface Blueprint {
  id: string;
  name: string;
  description: string;
  industryType: string;
  version: string;
  status: 'active' | 'inactive' | 'draft';
  factoryCount: number;
  icon: string;
  iconColor: string;
  createdAt: string;
  updatedAt: string;
}

type RootStackParamList = {
  BlueprintList: undefined;
  BlueprintDetail: { blueprintId: string; blueprintName: string };
  BlueprintCreate: undefined;
  BlueprintEdit: { blueprintId: string };
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'BlueprintList'>;

// Industry types with colors
const INDUSTRY_TYPES = [
  { key: 'all', label: '全部', color: 'rgba(255,255,255,0.2)' },
  { key: 'seafood', label: '水产加工', color: '#1890ff' },
  { key: 'frozen', label: '速冻食品', color: '#03a9f4' },
  { key: 'meat', label: '肉类加工', color: '#e91e63' },
  { key: 'dairy', label: '乳制品', color: '#ff9800' },
  { key: 'vegetable', label: '果蔬加工', color: '#9c27b0' },
  { key: 'grain', label: '粮油加工', color: '#faad14' },
];

export function BlueprintListScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { t } = useTranslation('platform');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [blueprints, setBlueprints] = useState<Blueprint[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndustry, setSelectedIndustry] = useState('all');
  const [filterMenuVisible, setFilterMenuVisible] = useState(false);

  // Load data
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const params = selectedIndustry !== 'all' ? { industryType: selectedIndustry } : undefined;
      const response = await apiClient.get<{ success: boolean; data: Blueprint[] }>(
        '/api/platform/blueprints',
        { params }
      );
      if (response.success && response.data) {
        // Transform backend data to match frontend Blueprint interface
        const transformedBlueprints = response.data.map((bp: Record<string, unknown>) => ({
          id: (bp.id as string) || '',
          name: (bp.blueprintName as string) || (bp.name as string) || '',
          description: (bp.description as string) || '',
          industryType: (bp.industryType as string) || 'seafood',
          version: (bp.version as string) || '1.0',
          status: (bp.status as Blueprint['status']) || 'active',
          factoryCount: (bp.factoryCount as number) || 0,
          icon: (bp.icon as string) || '🏭',
          iconColor: (bp.iconColor as string) || '#667eea',
          createdAt: (bp.createdAt as string) || '',
          updatedAt: (bp.updatedAt as string) || '',
        }));
        setBlueprints(transformedBlueprints);
      }
    } catch (error) {
      if (isAxiosError(error)) {
        Alert.alert('加载失败', error.response?.data?.message || '网络错误');
      } else if (error instanceof Error) {
        Alert.alert('加载失败', error.message);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedIndustry]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  // Filter blueprints
  const filteredBlueprints = blueprints.filter((bp) => {
    const matchSearch =
      !searchQuery ||
      bp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      bp.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      bp.description.toLowerCase().includes(searchQuery.toLowerCase());

    const matchIndustry =
      selectedIndustry === 'all' || bp.industryType === selectedIndustry;

    return matchSearch && matchIndustry;
  });

  // Stats
  const stats = {
    total: blueprints.length,
    active: blueprints.filter((bp) => bp.status === 'active').length,
    boundFactories: blueprints.reduce((sum, bp) => sum + bp.factoryCount, 0),
  };

  const getStatusChip = (status: Blueprint['status']) => {
    switch (status) {
      case 'active':
        return { label: '已激活', color: '#52c41a', bg: '#f6ffed' };
      case 'inactive':
        return { label: '已停用', color: '#8c8c8c', bg: '#f5f5f5' };
      case 'draft':
        return { label: '草稿', color: '#faad14', bg: '#fffbe6' };
      default:
        return { label: status, color: '#8c8c8c', bg: '#f5f5f5' };
    }
  };

  const renderBlueprintCard = (blueprint: Blueprint) => {
    const statusConfig = getStatusChip(blueprint.status);

    return (
      <Pressable
        key={blueprint.id}
        onPress={() =>
          navigation.navigate('BlueprintDetail', {
            blueprintId: blueprint.id,
            blueprintName: blueprint.name,
          })
        }
      >
        <Card style={styles.blueprintCard} mode="elevated">
          <Card.Content>
            <View style={styles.cardRow}>
              <LinearGradient
                colors={[blueprint.iconColor, `${blueprint.iconColor}cc`]}
                style={styles.iconContainer}
              >
                <Text style={styles.iconText}>{blueprint.icon}</Text>
              </LinearGradient>
              <View style={styles.cardContent}>
                <View style={styles.cardHeader}>
                  <Text variant="titleMedium" style={styles.blueprintName}>
                    {blueprint.name}
                  </Text>
                  <Chip
                    mode="flat"
                    compact
                    textStyle={{ color: statusConfig.color, fontSize: 11 }}
                    style={{ backgroundColor: statusConfig.bg, height: 24 }}
                  >
                    {statusConfig.label}
                  </Chip>
                </View>
                <Text
                  variant="bodySmall"
                  style={styles.blueprintDesc}
                  numberOfLines={1}
                >
                  {blueprint.description}
                </Text>
                <View style={styles.cardMeta}>
                  <Text variant="bodySmall" style={styles.metaText}>
                    版本 {blueprint.version}
                  </Text>
                  <Text variant="bodySmall" style={styles.metaText}>
                    绑定 {blueprint.factoryCount} 个工厂
                  </Text>
                </View>
              </View>
            </View>
          </Card.Content>
        </Card>
      </Pressable>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#667eea" />
          <Text style={{ marginTop: 16, color: '#666' }}>加载蓝图列表...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <LinearGradient colors={['#667eea', '#764ba2']} style={styles.header}>
        <View style={styles.headerRow}>
          <IconButton
            icon="arrow-left"
            iconColor="#fff"
            onPress={() => navigation.goBack()}
          />
          <Text variant="titleLarge" style={styles.headerTitle}>
            蓝图列表
          </Text>
          <Pressable onPress={() => navigation.navigate('BlueprintCreate')}>
            <Text style={styles.headerAction}>新建</Text>
          </Pressable>
        </View>
      </LinearGradient>

      {/* Search and Filter */}
      <LinearGradient colors={['#1a1a2e', '#16213e']} style={styles.searchSection}>
        <View style={styles.searchRow}>
          <View style={styles.searchInput}>
            <IconButton icon="magnify" iconColor="rgba(255,255,255,0.6)" size={18} />
            <TextInput
              placeholder="搜索蓝图名称..."
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={styles.searchTextInput}
            />
          </View>
          <Pressable
            style={styles.filterButton}
            onPress={() => setFilterMenuVisible(true)}
          >
            <IconButton icon="tune-vertical" iconColor="#fff" size={18} />
          </Pressable>
        </View>

        {/* Industry Filter Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipScroll}
        >
          {INDUSTRY_TYPES.map((industry) => (
            <Pressable
              key={industry.key}
              onPress={() => setSelectedIndustry(industry.key)}
            >
              <Chip
                mode="flat"
                selected={selectedIndustry === industry.key}
                style={[
                  styles.industryChip,
                  selectedIndustry === industry.key && styles.industryChipSelected,
                ]}
                textStyle={[
                  styles.industryChipText,
                  selectedIndustry === industry.key && styles.industryChipTextSelected,
                ]}
                showSelectedCheck={false}
              >
                {industry.label}
              </Chip>
            </Pressable>
          ))}
        </ScrollView>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Stats Cards */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.total}</Text>
            <Text style={styles.statLabel}>蓝图总数</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: '#52c41a' }]}>{stats.active}</Text>
            <Text style={styles.statLabel}>已激活</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: '#1890ff' }]}>
              {stats.boundFactories}
            </Text>
            <Text style={styles.statLabel}>绑定工厂</Text>
          </View>
        </View>

        {/* Section Header */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>全部蓝图</Text>
          <Text style={styles.sectionCount}>{filteredBlueprints.length}个</Text>
        </View>

        {/* Blueprint List */}
        {filteredBlueprints.map(renderBlueprintCard)}

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* FAB */}
      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => navigation.navigate('BlueprintCreate')}
        color="#fff"
      />

      {/* Filter Modal */}
      <Portal>
        <Modal
          visible={filterMenuVisible}
          onDismiss={() => setFilterMenuVisible(false)}
          contentContainerStyle={styles.filterModal}
        >
          <Text variant="titleMedium" style={styles.filterTitle}>
            筛选条件
          </Text>
          <View style={styles.filterOptions}>
            {INDUSTRY_TYPES.map((industry) => (
              <Pressable
                key={industry.key}
                style={[
                  styles.filterOption,
                  selectedIndustry === industry.key && styles.filterOptionSelected,
                ]}
                onPress={() => {
                  setSelectedIndustry(industry.key);
                  setFilterMenuVisible(false);
                }}
              >
                <Text
                  style={[
                    styles.filterOptionText,
                    selectedIndustry === industry.key && styles.filterOptionTextSelected,
                  ]}
                >
                  {industry.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <Button mode="text" onPress={() => setFilterMenuVisible(false)}>
            关闭
          </Button>
        </Modal>
      </Portal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 16,
  },
  headerTitle: {
    color: '#fff',
    fontWeight: '600',
  },
  headerAction: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  searchSection: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    paddingHorizontal: 4,
  },
  searchTextInput: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    paddingVertical: 8,
    backgroundColor: 'transparent',
  },
  filterButton: {
    width: 40,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipScroll: {
    flexGrow: 0,
  },
  industryChip: {
    marginRight: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  industryChipSelected: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  industryChipText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
  },
  industryChipTextSelected: {
    color: '#fff',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#667eea',
  },
  statLabel: {
    fontSize: 12,
    color: '#8c8c8c',
    marginTop: 4,
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
    color: '#262626',
  },
  sectionCount: {
    fontSize: 13,
    color: '#8c8c8c',
  },
  blueprintCard: {
    marginBottom: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  cardRow: {
    flexDirection: 'row',
    gap: 12,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  cardContent: {
    flex: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  blueprintName: {
    fontWeight: '600',
    color: '#262626',
    flex: 1,
  },
  blueprintDesc: {
    color: '#8c8c8c',
    marginBottom: 8,
  },
  cardMeta: {
    flexDirection: 'row',
    gap: 12,
  },
  metaText: {
    color: '#8c8c8c',
    fontSize: 12,
  },
  bottomPadding: {
    height: 80,
  },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 24,
    backgroundColor: '#667eea',
    elevation: 4,
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  filterModal: {
    backgroundColor: '#fff',
    margin: 20,
    borderRadius: 16,
    padding: 20,
  },
  filterTitle: {
    fontWeight: '600',
    marginBottom: 16,
  },
  filterOptions: {
    gap: 8,
    marginBottom: 16,
  },
  filterOption: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
  },
  filterOptionSelected: {
    backgroundColor: '#667eea',
  },
  filterOptionText: {
    color: '#595959',
    textAlign: 'center',
  },
  filterOptionTextSelected: {
    color: '#fff',
    fontWeight: '500',
  },
});

export default BlueprintListScreen;
