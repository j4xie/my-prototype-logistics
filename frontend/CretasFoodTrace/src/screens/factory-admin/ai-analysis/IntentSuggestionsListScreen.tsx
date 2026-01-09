/**
 * 意图建议列表页面
 * 显示待审批的意图优化建议
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Icon, Chip, Badge } from 'react-native-paper';
import { useTranslation, TFunction } from 'react-i18next';
import { FAAIStackParamList } from '../../../types/navigation';
import {
  intentAnalysisApiClient,
  IntentOptimizationSuggestion,
  SuggestionStats,
  SuggestionType,
} from '../../../services/api/intentAnalysisApiClient';

type NavigationProp = NativeStackNavigationProp<FAAIStackParamList, 'IntentSuggestionsList'>;

type FilterType = 'ALL' | 'CREATE_INTENT' | 'UPDATE_INTENT';

interface FilterChipProps {
  label: string;
  selected: boolean;
  count?: number;
  onPress: () => void;
}

function FilterChip({ label, selected, count, onPress }: FilterChipProps) {
  return (
    <TouchableOpacity onPress={onPress}>
      <Chip
        selected={selected}
        style={[styles.filterChip, selected && styles.filterChipSelected]}
        textStyle={[styles.filterChipText, selected && styles.filterChipTextSelected]}
      >
        {label}
        {count !== undefined && count > 0 && (
          <Text style={styles.chipCount}> ({count})</Text>
        )}
      </Chip>
    </TouchableOpacity>
  );
}

function getSuggestionTypeLabel(type: SuggestionType, t: TFunction): string {
  switch (type) {
    case 'CREATE_INTENT':
      return t('intentSuggestions.createIntent');
    case 'UPDATE_INTENT':
      return t('intentSuggestions.updateIntent');
    case 'UPDATE_KEYWORDS':
      return t('intentSuggestions.updateKeywords');
    default:
      return type;
  }
}

function getSuggestionTypeColor(type: SuggestionType): string {
  switch (type) {
    case 'CREATE_INTENT':
      return '#52c41a';
    case 'UPDATE_INTENT':
      return '#1890ff';
    case 'UPDATE_KEYWORDS':
      return '#fa8c16';
    default:
      return '#999';
  }
}

interface SuggestionItemProps {
  item: IntentOptimizationSuggestion;
  onPress: () => void;
  t: TFunction;
  locale: string;
}

function SuggestionItem({ item, onPress, t, locale }: SuggestionItemProps) {
  const typeColor = getSuggestionTypeColor(item.suggestionType);

  return (
    <TouchableOpacity style={styles.suggestionItem} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.suggestionHeader}>
        <View style={[styles.typeTag, { backgroundColor: typeColor + '20' }]}>
          <Text style={[styles.typeTagText, { color: typeColor }]}>
            {getSuggestionTypeLabel(item.suggestionType, t)}
          </Text>
        </View>
        <View style={styles.confidenceBadge}>
          <Text style={styles.confidenceText}>
            {Math.round(item.llmConfidence * 100)}%
          </Text>
        </View>
      </View>

      <View style={styles.suggestionBody}>
        {item.suggestionType === 'CREATE_INTENT' ? (
          <>
            <Text style={styles.suggestionTitle} numberOfLines={1}>
              {item.suggestedIntentName || item.suggestedIntentCode}
            </Text>
            <Text style={styles.suggestionSubtitle} numberOfLines={1}>
              {t('intentSuggestions.code')}: {item.suggestedIntentCode}
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.suggestionTitle} numberOfLines={1}>
              {item.intentCode}
            </Text>
            <Text style={styles.suggestionSubtitle} numberOfLines={1}>
              {t('intentSuggestions.suggestUpdateKeywordsOrDesc')}
            </Text>
          </>
        )}

        {item.originalInput && (
          <View style={styles.originalInputContainer}>
            <Icon source="format-quote-open" size={14} color="#999" />
            <Text style={styles.originalInput} numberOfLines={2}>
              {item.originalInput}
            </Text>
          </View>
        )}

        {item.suggestedKeywords && item.suggestedKeywords.length > 0 && (
          <View style={styles.keywordsContainer}>
            {item.suggestedKeywords.slice(0, 3).map((keyword, index) => (
              <View key={index} style={styles.keywordTag}>
                <Text style={styles.keywordText}>{keyword}</Text>
              </View>
            ))}
            {item.suggestedKeywords.length > 3 && (
              <Text style={styles.moreKeywords}>+{item.suggestedKeywords.length - 3}</Text>
            )}
          </View>
        )}
      </View>

      <View style={styles.suggestionFooter}>
        <View style={styles.frequencyContainer}>
          <Icon source="fire" size={14} color="#fa8c16" />
          <Text style={styles.frequencyText}>{t('intentSuggestions.triggeredTimes', { count: item.frequency })}</Text>
        </View>
        <View style={styles.dateContainer}>
          <Text style={styles.dateText}>
            {new Date(item.createdAt).toLocaleDateString(locale)}
          </Text>
          <Icon source="chevron-right" size={20} color="#ccc" />
        </View>
      </View>
    </TouchableOpacity>
  );
}

export function IntentSuggestionsListScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { t, i18n } = useTranslation('home');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [suggestions, setSuggestions] = useState<IntentOptimizationSuggestion[]>([]);
  const [stats, setStats] = useState<SuggestionStats | null>(null);
  const [filter, setFilter] = useState<FilterType>('ALL');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadStats = useCallback(async () => {
    try {
      const statsData = await intentAnalysisApiClient.getSuggestionStats();
      setStats(statsData);
    } catch (err) {
      // API 可能不存在，使用默认值
      console.warn('Load stats failed, using defaults:', err);
      setStats({
        pendingCount: 0,
        approvedCount: 0,
        rejectedCount: 0,
        totalCount: 0,
        createIntentCount: 0,
        updateIntentCount: 0,
      });
    }
  }, []);

  const loadSuggestions = useCallback(async (pageNum: number, isRefresh = false) => {
    try {
      let response;
      switch (filter) {
        case 'CREATE_INTENT':
          response = await intentAnalysisApiClient.getCreateIntentSuggestions(pageNum, 20);
          break;
        case 'UPDATE_INTENT':
          response = await intentAnalysisApiClient.getUpdateIntentSuggestions(pageNum, 20);
          break;
        default:
          response = await intentAnalysisApiClient.getPendingSuggestions(pageNum, 20);
      }

      if (isRefresh || pageNum === 1) {
        setSuggestions(response.content);
      } else {
        setSuggestions(prev => [...prev, ...response.content]);
      }
      setHasMore(pageNum < response.totalPages);
    } catch (err) {
      console.error('Load suggestions failed:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [filter]);

  useEffect(() => {
    setLoading(true);
    setPage(1);
    loadSuggestions(1, true);
    loadStats();
  }, [filter, loadSuggestions, loadStats]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setPage(1);
    loadSuggestions(1, true);
    loadStats();
  }, [loadSuggestions, loadStats]);

  const onLoadMore = useCallback(() => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    setPage(nextPage);
    loadSuggestions(nextPage);
  }, [hasMore, loadingMore, page, loadSuggestions]);

  const navigateToDetail = useCallback((suggestion: IntentOptimizationSuggestion) => {
    navigation.navigate('IntentSuggestionDetail', { suggestionId: suggestion.id });
  }, [navigation]);

  const renderItem = useCallback(({ item }: { item: IntentOptimizationSuggestion }) => (
    <SuggestionItem item={item} onPress={() => navigateToDetail(item)} t={t} locale={i18n.language} />
  ), [navigateToDetail, t, i18n.language]);

  const renderFooter = useCallback(() => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color="#667eea" />
      </View>
    );
  }, [loadingMore]);

  const renderEmpty = useCallback(() => {
    if (loading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Icon source="check-circle-outline" size={64} color="#52c41a" />
        <Text style={styles.emptyTitle}>{t('intentSuggestions.noPendingSuggestions')}</Text>
        <Text style={styles.emptySubtitle}>
          {filter === 'ALL'
            ? t('intentSuggestions.allProcessed')
            : filter === 'CREATE_INTENT'
              ? t('intentSuggestions.noCreateIntentSuggestions')
              : t('intentSuggestions.noUpdateIntentSuggestions')
          }
        </Text>
      </View>
    );
  }, [loading, filter, t]);

  return (
    <View style={styles.container}>
      {/* 统计卡片 */}
      {stats && (
        <View style={styles.statsCard}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.pendingCount}</Text>
            <Text style={styles.statLabel}>{t('intentSuggestions.pending')}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: '#52c41a' }]}>{stats.approvedCount}</Text>
            <Text style={styles.statLabel}>{t('intentSuggestions.approved')}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: '#e53e3e' }]}>{stats.rejectedCount}</Text>
            <Text style={styles.statLabel}>{t('intentSuggestions.rejected')}</Text>
          </View>
        </View>
      )}

      {/* 筛选器 */}
      <View style={styles.filterContainer}>
        <FilterChip
          label={t('intentSuggestions.all')}
          selected={filter === 'ALL'}
          count={stats?.pendingCount}
          onPress={() => setFilter('ALL')}
        />
        <FilterChip
          label={t('intentSuggestions.createIntent')}
          selected={filter === 'CREATE_INTENT'}
          count={stats?.createIntentCount}
          onPress={() => setFilter('CREATE_INTENT')}
        />
        <FilterChip
          label={t('intentSuggestions.updateIntent')}
          selected={filter === 'UPDATE_INTENT'}
          count={stats?.updateIntentCount}
          onPress={() => setFilter('UPDATE_INTENT')}
        />
      </View>

      {/* 列表 */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#667eea" />
          <Text style={styles.loadingText}>{t('loading')}</Text>
        </View>
      ) : (
        <FlatList
          data={suggestions}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#667eea']} />
          }
          onEndReached={onLoadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={renderEmpty}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#667eea',
  },
  statLabel: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#f0f0f0',
    marginVertical: 4,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  filterChip: {
    backgroundColor: '#fff',
  },
  filterChipSelected: {
    backgroundColor: '#667eea',
  },
  filterChipText: {
    color: '#666',
  },
  filterChipTextSelected: {
    color: '#fff',
  },
  chipCount: {
    fontSize: 12,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  suggestionItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  suggestionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f0f0f0',
  },
  typeTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  typeTagText: {
    fontSize: 12,
    fontWeight: '500',
  },
  confidenceBadge: {
    backgroundColor: '#667eea20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  confidenceText: {
    fontSize: 12,
    color: '#667eea',
    fontWeight: '600',
  },
  suggestionBody: {
    padding: 12,
  },
  suggestionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a202c',
  },
  suggestionSubtitle: {
    fontSize: 13,
    color: '#999',
    marginTop: 4,
  },
  originalInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#f9f9f9',
    padding: 10,
    borderRadius: 8,
    marginTop: 10,
    gap: 6,
  },
  originalInput: {
    flex: 1,
    fontSize: 13,
    color: '#666',
    fontStyle: 'italic',
  },
  keywordsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
    gap: 6,
  },
  keywordTag: {
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  keywordText: {
    fontSize: 12,
    color: '#1976d2',
  },
  moreKeywords: {
    fontSize: 12,
    color: '#999',
    alignSelf: 'center',
  },
  suggestionFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#f0f0f0',
  },
  frequencyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  frequencyText: {
    fontSize: 12,
    color: '#fa8c16',
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 12,
    color: '#999',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#666',
  },
  footerLoader: {
    paddingVertical: 20,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a202c',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
});

export default IntentSuggestionsListScreen;
