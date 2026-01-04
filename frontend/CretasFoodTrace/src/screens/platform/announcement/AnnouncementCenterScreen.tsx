/**
 * AnnouncementCenterScreen - 公告中心页面
 *
 * 平台管理员公告管理页面，支持：
 * - 公告列表展示
 * - 公告类型标签（系统通知、功能更新、维护公告、紧急通知）
 * - 发布状态（草稿、已发布、已过期）
 * - 筛选: 按类型、按状态、按时间
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
  Alert,
} from 'react-native';
import { isAxiosError } from 'axios';
import {
  Text,
  Card,
  Chip,
  IconButton,
  TextInput,
  FAB,
  ActivityIndicator,
  Portal,
  Modal,
  Button,
  Divider,
} from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

// Types
interface Announcement {
  id: string;
  title: string;
  content: string;
  type: 'system' | 'feature' | 'maintenance' | 'urgent';
  status: 'draft' | 'published' | 'expired';
  isTop: boolean;
  targetFactories: string[] | 'all';
  targetRoles: string[] | 'all';
  publishedAt?: string;
  startTime?: string;
  endTime?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  viewCount: number;
}

type AnnouncementType = 'all' | 'system' | 'feature' | 'maintenance' | 'urgent';
type AnnouncementStatus = 'all' | 'draft' | 'published' | 'expired';

type RootStackParamList = {
  AnnouncementCenter: undefined;
  AnnouncementCreate: { announcementId?: string };
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'AnnouncementCenter'>;

// 公告类型配置
const ANNOUNCEMENT_TYPES = [
  { key: 'all', label: '全部', color: '#8c8c8c', icon: 'bulletin-board' },
  { key: 'system', label: '系统通知', color: '#1890ff', icon: 'information' },
  { key: 'feature', label: '功能更新', color: '#52c41a', icon: 'rocket-launch' },
  { key: 'maintenance', label: '维护公告', color: '#faad14', icon: 'wrench' },
  { key: 'urgent', label: '紧急通知', color: '#ff4d4f', icon: 'alert' },
];

// 状态配置
const STATUS_CONFIG = {
  draft: { label: '草稿', color: '#8c8c8c', bg: '#f5f5f5' },
  published: { label: '已发布', color: '#52c41a', bg: '#f6ffed' },
  expired: { label: '已过期', color: '#ff4d4f', bg: '#fff2f0' },
};

// TODO: 待后端实现公告管理API后替换
// 预期API: GET /api/platform/announcements
// 预期响应格式:
// {
//   success: true,
//   data: {
//     content: Announcement[],
//     totalElements: number,
//     totalPages: number,
//   }
// }

export function AnnouncementCenterScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { t } = useTranslation('platform');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<AnnouncementType>('all');
  const [selectedStatus, setSelectedStatus] = useState<AnnouncementStatus>('all');
  const [filterMenuVisible, setFilterMenuVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);

  // Load data
  const loadData = useCallback(async () => {
    try {
      // TODO: 后端实现公告API后启用以下代码
      // const response = await announcementApiClient.getAnnouncements({
      //   page: 1,
      //   size: 50,
      //   type: selectedType !== 'all' ? selectedType : undefined,
      //   status: selectedStatus !== 'all' ? selectedStatus : undefined,
      // });
      // if (response.success && response.data) {
      //   setAnnouncements(response.data.content);
      // }

      // 临时等待以模拟网络请求
      await new Promise((resolve) => setTimeout(resolve, 300));
      // API未实现前返回空数组
      setAnnouncements([]);
    } catch (error) {
      if (isAxiosError(error)) {
        Alert.alert('加载失败', error.response?.data?.message || '获取公告列表失败');
      } else if (error instanceof Error) {
        Alert.alert('加载失败', error.message);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  // Filter announcements
  const filteredAnnouncements = announcements.filter((ann) => {
    const matchSearch =
      !searchQuery ||
      ann.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ann.content.toLowerCase().includes(searchQuery.toLowerCase());

    const matchType = selectedType === 'all' || ann.type === selectedType;
    const matchStatus = selectedStatus === 'all' || ann.status === selectedStatus;

    return matchSearch && matchType && matchStatus;
  });

  // Sort: top first, then by updated time
  const sortedAnnouncements = [...filteredAnnouncements].sort((a, b) => {
    if (a.isTop !== b.isTop) return a.isTop ? -1 : 1;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  // Stats
  const stats = {
    total: announcements.length,
    published: announcements.filter((a) => a.status === 'published').length,
    draft: announcements.filter((a) => a.status === 'draft').length,
    expired: announcements.filter((a) => a.status === 'expired').length,
  };

  type TypeConfig = { key: string; label: string; color: string; icon: string };
  const defaultTypeConfig: TypeConfig = ANNOUNCEMENT_TYPES[0]!;
  const getTypeConfig = (type: Announcement['type']): TypeConfig => {
    return ANNOUNCEMENT_TYPES.find((t) => t.key === type) ?? defaultTypeConfig;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return '今天';
    if (days === 1) return '昨天';
    if (days < 7) return `${days}天前`;
    return dateStr.substring(0, 10);
  };

  const handleAnnouncementPress = (announcement: Announcement) => {
    setSelectedAnnouncement(announcement);
    setDetailModalVisible(true);
  };

  const handleEdit = (announcement: Announcement) => {
    setDetailModalVisible(false);
    navigation.navigate('AnnouncementCreate', { announcementId: announcement.id });
  };

  const renderAnnouncementCard = (announcement: Announcement) => {
    const typeConfig = getTypeConfig(announcement.type);
    const statusConfig = STATUS_CONFIG[announcement.status];

    return (
      <Pressable
        key={announcement.id}
        onPress={() => handleAnnouncementPress(announcement)}
      >
        <Card style={styles.announcementCard} mode="elevated">
          <Card.Content>
            <View style={styles.cardHeader}>
              <View style={styles.cardTitleRow}>
                {announcement.isTop && (
                  <View style={styles.topBadge}>
                    <Text style={styles.topBadgeText}>置顶</Text>
                  </View>
                )}
                <Chip
                  mode="flat"
                  compact
                  icon={typeConfig.icon}
                  textStyle={{ color: typeConfig.color, fontSize: 11 }}
                  style={{ backgroundColor: `${typeConfig.color}15`, height: 24 }}
                >
                  {typeConfig.label}
                </Chip>
                <Chip
                  mode="flat"
                  compact
                  textStyle={{ color: statusConfig.color, fontSize: 11 }}
                  style={{ backgroundColor: statusConfig.bg, height: 24 }}
                >
                  {statusConfig.label}
                </Chip>
              </View>
            </View>

            <Text variant="titleMedium" style={styles.announcementTitle} numberOfLines={1}>
              {announcement.title}
            </Text>

            <Text variant="bodySmall" style={styles.announcementContent} numberOfLines={2}>
              {announcement.content}
            </Text>

            <View style={styles.cardMeta}>
              <View style={styles.metaLeft}>
                <Text variant="bodySmall" style={styles.metaText}>
                  {announcement.createdBy}
                </Text>
                <Text variant="bodySmall" style={styles.metaText}>
                  {formatDate(announcement.updatedAt)}
                </Text>
              </View>
              <View style={styles.metaRight}>
                <IconButton icon="eye" size={14} iconColor="#8c8c8c" style={styles.metaIcon} />
                <Text variant="bodySmall" style={styles.metaText}>
                  {announcement.viewCount}
                </Text>
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
          <Text style={{ marginTop: 16, color: '#666' }}>加载公告列表...</Text>
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
            公告中心
          </Text>
          <Pressable onPress={() => navigation.navigate('AnnouncementCreate', {})}>
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
              placeholder="搜索公告标题..."
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

        {/* Type Filter Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipScroll}
        >
          {ANNOUNCEMENT_TYPES.map((type) => (
            <Pressable
              key={type.key}
              onPress={() => setSelectedType(type.key as AnnouncementType)}
            >
              <Chip
                mode="flat"
                selected={selectedType === type.key}
                style={[
                  styles.typeChip,
                  selectedType === type.key && styles.typeChipSelected,
                ]}
                textStyle={[
                  styles.typeChipText,
                  selectedType === type.key && styles.typeChipTextSelected,
                ]}
                showSelectedCheck={false}
              >
                {type.label}
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
          <Pressable
            style={[styles.statCard, selectedStatus === 'all' && styles.statCardActive]}
            onPress={() => setSelectedStatus('all')}
          >
            <Text style={styles.statValue}>{stats.total}</Text>
            <Text style={styles.statLabel}>全部</Text>
          </Pressable>
          <Pressable
            style={[styles.statCard, selectedStatus === 'published' && styles.statCardActive]}
            onPress={() => setSelectedStatus('published')}
          >
            <Text style={[styles.statValue, { color: '#52c41a' }]}>{stats.published}</Text>
            <Text style={styles.statLabel}>已发布</Text>
          </Pressable>
          <Pressable
            style={[styles.statCard, selectedStatus === 'draft' && styles.statCardActive]}
            onPress={() => setSelectedStatus('draft')}
          >
            <Text style={[styles.statValue, { color: '#faad14' }]}>{stats.draft}</Text>
            <Text style={styles.statLabel}>草稿</Text>
          </Pressable>
          <Pressable
            style={[styles.statCard, selectedStatus === 'expired' && styles.statCardActive]}
            onPress={() => setSelectedStatus('expired')}
          >
            <Text style={[styles.statValue, { color: '#ff4d4f' }]}>{stats.expired}</Text>
            <Text style={styles.statLabel}>已过期</Text>
          </Pressable>
        </View>

        {/* Section Header */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>公告列表</Text>
          <Text style={styles.sectionCount}>{sortedAnnouncements.length}条</Text>
        </View>

        {/* Announcement List */}
        {sortedAnnouncements.length === 0 ? (
          <View style={styles.emptyContainer}>
            <IconButton icon="bulletin-board" size={48} iconColor="#d9d9d9" />
            <Text style={styles.emptyText}>暂无公告</Text>
          </View>
        ) : (
          sortedAnnouncements.map(renderAnnouncementCard)
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* FAB */}
      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => navigation.navigate('AnnouncementCreate', {})}
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

          <Text style={styles.filterSectionLabel}>公告类型</Text>
          <View style={styles.filterOptions}>
            {ANNOUNCEMENT_TYPES.map((type) => (
              <Pressable
                key={type.key}
                style={[
                  styles.filterOption,
                  selectedType === type.key && styles.filterOptionSelected,
                ]}
                onPress={() => setSelectedType(type.key as AnnouncementType)}
              >
                <Text
                  style={[
                    styles.filterOptionText,
                    selectedType === type.key && styles.filterOptionTextSelected,
                  ]}
                >
                  {type.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.filterSectionLabel}>发布状态</Text>
          <View style={styles.filterOptions}>
            {[
              { key: 'all', label: '全部' },
              { key: 'draft', label: '草稿' },
              { key: 'published', label: '已发布' },
              { key: 'expired', label: '已过期' },
            ].map((status) => (
              <Pressable
                key={status.key}
                style={[
                  styles.filterOption,
                  selectedStatus === status.key && styles.filterOptionSelected,
                ]}
                onPress={() => setSelectedStatus(status.key as AnnouncementStatus)}
              >
                <Text
                  style={[
                    styles.filterOptionText,
                    selectedStatus === status.key && styles.filterOptionTextSelected,
                  ]}
                >
                  {status.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.filterActions}>
            <Button
              mode="outlined"
              onPress={() => {
                setSelectedType('all');
                setSelectedStatus('all');
              }}
            >
              重置
            </Button>
            <Button mode="contained" onPress={() => setFilterMenuVisible(false)}>
              确定
            </Button>
          </View>
        </Modal>
      </Portal>

      {/* Detail Modal */}
      <Portal>
        <Modal
          visible={detailModalVisible}
          onDismiss={() => setDetailModalVisible(false)}
          contentContainerStyle={styles.detailModal}
        >
          {selectedAnnouncement && (
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.detailHeader}>
                {selectedAnnouncement.isTop && (
                  <View style={styles.topBadge}>
                    <Text style={styles.topBadgeText}>置顶</Text>
                  </View>
                )}
                <Chip
                  mode="flat"
                  compact
                  icon={getTypeConfig(selectedAnnouncement.type).icon}
                  textStyle={{
                    color: getTypeConfig(selectedAnnouncement.type).color,
                    fontSize: 11,
                  }}
                  style={{
                    backgroundColor: `${getTypeConfig(selectedAnnouncement.type).color}15`,
                    height: 24,
                  }}
                >
                  {getTypeConfig(selectedAnnouncement.type).label}
                </Chip>
                <Chip
                  mode="flat"
                  compact
                  textStyle={{
                    color: STATUS_CONFIG[selectedAnnouncement.status].color,
                    fontSize: 11,
                  }}
                  style={{
                    backgroundColor: STATUS_CONFIG[selectedAnnouncement.status].bg,
                    height: 24,
                  }}
                >
                  {STATUS_CONFIG[selectedAnnouncement.status].label}
                </Chip>
              </View>

              <Text variant="titleLarge" style={styles.detailTitle}>
                {selectedAnnouncement.title}
              </Text>

              <View style={styles.detailMeta}>
                <Text style={styles.detailMetaText}>
                  发布者: {selectedAnnouncement.createdBy}
                </Text>
                <Text style={styles.detailMetaText}>
                  更新时间: {selectedAnnouncement.updatedAt}
                </Text>
                <Text style={styles.detailMetaText}>
                  浏览次数: {selectedAnnouncement.viewCount}
                </Text>
              </View>

              <Divider style={styles.detailDivider} />

              <Text style={styles.detailContent}>
                {selectedAnnouncement.content}
              </Text>

              <Divider style={styles.detailDivider} />

              <View style={styles.detailInfo}>
                <Text style={styles.detailInfoLabel}>目标工厂:</Text>
                <Text style={styles.detailInfoValue}>
                  {selectedAnnouncement.targetFactories === 'all'
                    ? '全部工厂'
                    : `${(selectedAnnouncement.targetFactories as string[]).length}个指定工厂`}
                </Text>
              </View>
              <View style={styles.detailInfo}>
                <Text style={styles.detailInfoLabel}>目标角色:</Text>
                <Text style={styles.detailInfoValue}>
                  {selectedAnnouncement.targetRoles === 'all'
                    ? '全部角色'
                    : `${(selectedAnnouncement.targetRoles as string[]).length}个指定角色`}
                </Text>
              </View>
              {selectedAnnouncement.startTime && (
                <View style={styles.detailInfo}>
                  <Text style={styles.detailInfoLabel}>有效期:</Text>
                  <Text style={styles.detailInfoValue}>
                    {selectedAnnouncement.startTime.substring(0, 10)} ~{' '}
                    {selectedAnnouncement.endTime?.substring(0, 10)}
                  </Text>
                </View>
              )}

              <View style={styles.detailActions}>
                <Button
                  mode="outlined"
                  onPress={() => setDetailModalVisible(false)}
                  style={styles.detailButton}
                >
                  关闭
                </Button>
                <Button
                  mode="contained"
                  onPress={() => handleEdit(selectedAnnouncement)}
                  style={styles.detailButton}
                >
                  编辑
                </Button>
              </View>
            </ScrollView>
          )}
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
  typeChip: {
    marginRight: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  typeChipSelected: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  typeChipText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
  },
  typeChipTextSelected: {
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
    gap: 8,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  statCardActive: {
    borderColor: '#667eea',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#667eea',
  },
  statLabel: {
    fontSize: 11,
    color: '#8c8c8c',
    marginTop: 2,
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
  announcementCard: {
    marginBottom: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  cardHeader: {
    marginBottom: 8,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  topBadge: {
    backgroundColor: '#ff4d4f',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  topBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  announcementTitle: {
    fontWeight: '600',
    color: '#262626',
    marginBottom: 4,
  },
  announcementContent: {
    color: '#8c8c8c',
    marginBottom: 12,
    lineHeight: 18,
  },
  cardMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaLeft: {
    flexDirection: 'row',
    gap: 12,
  },
  metaRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    color: '#8c8c8c',
    fontSize: 12,
  },
  metaIcon: {
    margin: 0,
    width: 20,
    height: 20,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    color: '#8c8c8c',
    fontSize: 14,
    marginTop: 8,
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
    maxHeight: '80%',
  },
  filterTitle: {
    fontWeight: '600',
    marginBottom: 16,
  },
  filterSectionLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#262626',
    marginBottom: 8,
    marginTop: 8,
  },
  filterOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  filterOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
  },
  filterOptionSelected: {
    backgroundColor: '#667eea',
  },
  filterOptionText: {
    color: '#595959',
    fontSize: 13,
  },
  filterOptionTextSelected: {
    color: '#fff',
    fontWeight: '500',
  },
  filterActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 16,
  },
  detailModal: {
    backgroundColor: '#fff',
    margin: 20,
    borderRadius: 16,
    padding: 20,
    maxHeight: '85%',
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  detailTitle: {
    fontWeight: '600',
    color: '#262626',
    marginBottom: 12,
  },
  detailMeta: {
    gap: 4,
  },
  detailMetaText: {
    fontSize: 12,
    color: '#8c8c8c',
  },
  detailDivider: {
    marginVertical: 16,
  },
  detailContent: {
    fontSize: 14,
    color: '#262626',
    lineHeight: 22,
  },
  detailInfo: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  detailInfoLabel: {
    fontSize: 13,
    color: '#8c8c8c',
    width: 80,
  },
  detailInfoValue: {
    fontSize: 13,
    color: '#262626',
    flex: 1,
  },
  detailActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 20,
  },
  detailButton: {
    minWidth: 80,
  },
});

export default AnnouncementCenterScreen;
