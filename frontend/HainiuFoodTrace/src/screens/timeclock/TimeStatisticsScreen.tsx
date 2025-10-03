import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { timeStatsApiClient } from '../../services/api/timeStatsApiClient';

const { width: screenWidth } = Dimensions.get('window');

interface StatsData {
  period: {
    startDate: string;
    endDate: string;
  };
  totalStats?: {
    totalDays: number;
    totalWorkMinutes: number;
    totalBreakMinutes: number;
    averageWorkMinutesPerDay: number;
  };
  dailyStats?: Array<{
    date: string;
    workMinutes: number;
    totalBreakMinutes: number;
    workTypes: { [key: string]: { minutes: number; count: number; color: string } };
  }>;
  workTypeStats?: Array<{
    workType: {
      id: string;
      typeName: string;
      colorCode?: string;
    };
    totalMinutes: number;
    totalSessions: number;
    averageMinutesPerSession: number;
    totalDays: number;
    percentage: number;
  }>;
  userStats?: {
    totalMinutes: number;
    workDays: number;
    totalSessions: number;
    averageSessionMinutes: number;
    averageDailyMinutes: number;
  };
  departmentAverage?: {
    averageSessionMinutes: number;
    averageDailyMinutes: number;
  } | null;
  trend?: {
    recentWeekAverage: number;
    previousWeekAverage: number;
    changePercentage: number;
  };
  performance?: {
    rating: string;
    suggestions: string[];
  };
}

type TabType = 'daily' | 'workType' | 'productivity';

export const TimeStatisticsScreen: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('daily');
  const [statsData, setStatsData] = useState<{ [key in TabType]?: StatsData }>({});

  const tabs = [
    { key: 'daily' as TabType, label: '日统计', icon: 'calendar' },
    { key: 'workType' as TabType, label: '工作类型', icon: 'pie-chart' },
    { key: 'productivity' as TabType, label: '效率分析', icon: 'analytics' },
  ];

  useEffect(() => {
    loadStatsData();
  }, [activeTab]);

  const loadStatsData = async () => {
    try {
      setLoading(true);
      
      let response;
      switch (activeTab) {
        case 'daily':
          response = await timeStatsApiClient.getDailyStats();
          break;
        case 'workType':
          response = await timeStatsApiClient.getStatsByWorkType();
          break;
        case 'productivity':
          response = await timeStatsApiClient.getProductivityAnalysis();
          break;
      }

      if (response.success) {
        setStatsData(prev => ({
          ...prev,
          [activeTab]: response.data
        }));
      }
    } catch (error) {
      console.error('加载统计数据失败:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadStatsData();
  };

  const formatMinutes = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h${mins > 0 ? `${mins}m` : ''}`;
    }
    return `${mins}m`;
  };

  const formatHoursDetailed = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}小时${mins}分钟`;
  };

  const renderTabBar = () => (
    <View style={styles.tabBar}>
      {tabs.map(tab => (
        <TouchableOpacity
          key={tab.key}
          style={[
            styles.tab,
            activeTab === tab.key && styles.tabActive
          ]}
          onPress={() => setActiveTab(tab.key)}
        >
          <Ionicons
            name={tab.icon as any}
            size={20}
            color={activeTab === tab.key ? '#007AFF' : '#666666'}
          />
          <Text style={[
            styles.tabText,
            activeTab === tab.key && styles.tabTextActive
          ]}>
            {tab.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderDailyStats = () => {
    const data = statsData.daily;
    if (!data) return null;

    return (
      <View style={styles.content}>
        {/* 总体统计 */}
        {data.totalStats && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>总体统计</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{data.totalStats.totalDays}</Text>
                <Text style={styles.statLabel}>工作天数</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>
                  {formatHoursDetailed(data.totalStats.totalWorkMinutes)}
                </Text>
                <Text style={styles.statLabel}>总工作时长</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>
                  {formatHoursDetailed(data.totalStats.averageWorkMinutesPerDay)}
                </Text>
                <Text style={styles.statLabel}>日均工作</Text>
              </View>
            </View>
          </View>
        )}

        {/* 近期记录 */}
        {data.dailyStats && data.dailyStats.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>近期记录</Text>
            {data.dailyStats.slice(0, 7).map(day => (
              <View key={day.date} style={styles.dayRecord}>
                <View style={styles.dayRecordHeader}>
                  <Text style={styles.dayDate}>
                    {new Date(day.date).toLocaleDateString('zh-CN', {
                      month: 'short',
                      day: 'numeric',
                      weekday: 'short'
                    })}
                  </Text>
                  <View style={styles.dayStats}>
                    <Text style={styles.dayWorkTime}>
                      工作 {formatMinutes(day.workMinutes)}
                    </Text>
                    {day.totalBreakMinutes > 0 && (
                      <Text style={styles.dayBreakTime}>
                        休息 {formatMinutes(day.totalBreakMinutes)}
                      </Text>
                    )}
                  </View>
                </View>
                
                {/* 工作类型条形图 */}
                <View style={styles.workTypeBar}>
                  {Object.entries(day.workTypes).map(([typeName, typeData]) => {
                    const width = (typeData.minutes / Math.max(day.workMinutes, 1)) * 100;
                    return (
                      <View
                        key={typeName}
                        style={[
                          styles.workTypeSegment,
                          { 
                            width: `${Math.max(width, 5)}%`,
                            backgroundColor: typeData.color
                          }
                        ]}
                      />
                    );
                  })}
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  const renderWorkTypeStats = () => {
    const data = statsData.workType;
    if (!data || !data.workTypeStats) return null;

    return (
      <View style={styles.content}>
        {/* 总计信息 */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>统计概览</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryText}>统计周期</Text>
            <Text style={styles.summaryValue}>
              {new Date(data.period.startDate).toLocaleDateString('zh-CN')} - {' '}
              {new Date(data.period.endDate).toLocaleDateString('zh-CN')}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryText}>总工作时长</Text>
            <Text style={styles.summaryValue}>
              {formatHoursDetailed(data.totalMinutes || 0)}
            </Text>
          </View>
        </View>

        {/* 工作类型分布 */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>工作类型分布</Text>
          {data.workTypeStats.map(stat => (
            <View key={stat.workType.id} style={styles.workTypeStatItem}>
              <View style={styles.workTypeStatHeader}>
                <View style={styles.workTypeStatInfo}>
                  <View style={[
                    styles.workTypeStatColor,
                    { backgroundColor: stat.workType.colorCode || '#007AFF' }
                  ]} />
                  <Text style={styles.workTypeStatName}>
                    {stat.workType.typeName}
                  </Text>
                </View>
                <Text style={styles.workTypeStatPercentage}>
                  {stat.percentage}%
                </Text>
              </View>
              
              <View style={styles.workTypeStatBar}>
                <View
                  style={[
                    styles.workTypeStatProgress,
                    { 
                      width: `${stat.percentage}%`,
                      backgroundColor: stat.workType.colorCode || '#007AFF'
                    }
                  ]}
                />
              </View>
              
              <View style={styles.workTypeStatDetails}>
                <Text style={styles.workTypeStatDetail}>
                  {formatHoursDetailed(stat.totalMinutes)} · {stat.totalSessions}次 · {stat.totalDays}天
                </Text>
                <Text style={styles.workTypeStatDetail}>
                  平均 {formatMinutes(stat.averageMinutesPerSession)}/次
                </Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    );
  };

  const renderProductivityStats = () => {
    const data = statsData.productivity;
    if (!data) return null;

    return (
      <View style={styles.content}>
        {/* 个人统计 */}
        {data.userStats && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>个人表现</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{data.userStats.workDays}</Text>
                <Text style={styles.statLabel}>工作天数</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>
                  {formatMinutes(data.userStats.averageDailyMinutes)}
                </Text>
                <Text style={styles.statLabel}>日均工时</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>
                  {formatMinutes(data.userStats.averageSessionMinutes)}
                </Text>
                <Text style={styles.statLabel}>平均时长</Text>
              </View>
            </View>
          </View>
        )}

        {/* 绩效评级 */}
        {data.performance && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>绩效评级</Text>
            <View style={styles.performanceRating}>
              <View style={styles.ratingContainer}>
                <Text style={styles.ratingText}>{data.performance.rating}</Text>
                <Ionicons
                  name={
                    data.performance.rating === '优秀' ? 'star' :
                    data.performance.rating === '良好' ? 'thumbs-up' :
                    data.performance.rating === '一般' ? 'remove' : 'thumbs-down'
                  }
                  size={24}
                  color={
                    data.performance.rating === '优秀' ? '#10b981' :
                    data.performance.rating === '良好' ? '#3b82f6' :
                    data.performance.rating === '一般' ? '#f59e0b' : '#ef4444'
                  }
                />
              </View>
            </View>
            
            <View style={styles.suggestions}>
              <Text style={styles.suggestionsTitle}>改进建议</Text>
              {data.performance.suggestions.map((suggestion, index) => (
                <View key={index} style={styles.suggestionItem}>
                  <Ionicons name="bulb" size={16} color="#f59e0b" />
                  <Text style={styles.suggestionText}>{suggestion}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* 部门对比 */}
        {data.departmentAverage && data.userStats && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>部门对比</Text>
            <View style={styles.comparisonContainer}>
              <View style={styles.comparisonItem}>
                <Text style={styles.comparisonLabel}>我的日均工时</Text>
                <Text style={styles.comparisonValue}>
                  {formatMinutes(data.userStats.averageDailyMinutes)}
                </Text>
              </View>
              <View style={styles.comparisonItem}>
                <Text style={styles.comparisonLabel}>部门平均</Text>
                <Text style={styles.comparisonValue}>
                  {formatMinutes(data.departmentAverage.averageDailyMinutes)}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* 趋势分析 */}
        {data.trend && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>趋势分析</Text>
            <View style={styles.trendContainer}>
              <View style={styles.trendItem}>
                <Text style={styles.trendLabel}>本周平均</Text>
                <Text style={styles.trendValue}>
                  {formatMinutes(data.trend.recentWeekAverage)}
                </Text>
              </View>
              <View style={styles.trendArrow}>
                <Ionicons
                  name={
                    data.trend.changePercentage > 0 ? 'trending-up' :
                    data.trend.changePercentage < 0 ? 'trending-down' : 'remove'
                  }
                  size={20}
                  color={
                    data.trend.changePercentage > 0 ? '#10b981' :
                    data.trend.changePercentage < 0 ? '#ef4444' : '#6b7280'
                  }
                />
                <Text style={[
                  styles.trendChange,
                  {
                    color: data.trend.changePercentage > 0 ? '#10b981' :
                           data.trend.changePercentage < 0 ? '#ef4444' : '#6b7280'
                  }
                ]}>
                  {Math.abs(data.trend.changePercentage)}%
                </Text>
              </View>
              <View style={styles.trendItem}>
                <Text style={styles.trendLabel}>上周平均</Text>
                <Text style={styles.trendValue}>
                  {formatMinutes(data.trend.previousWeekAverage)}
                </Text>
              </View>
            </View>
          </View>
        )}
      </View>
    );
  };

  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>加载中...</Text>
        </View>
      );
    }

    switch (activeTab) {
      case 'daily':
        return renderDailyStats();
      case 'workType':
        return renderWorkTypeStats();
      case 'productivity':
        return renderProductivityStats();
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>时间统计</Text>
        <Text style={styles.subtitle}>工作时间分析与统计</Text>
      </View>

      {renderTabBar()}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#007AFF"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {renderContent()}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E1E5E9',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#666666',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E1E5E9',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 6,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#007AFF',
  },
  tabText: {
    fontSize: 14,
    color: '#666666',
  },
  tabTextActive: {
    color: '#007AFF',
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  content: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666666',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666666',
    textAlign: 'center',
  },
  dayRecord: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  dayRecordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  dayDate: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1A1A1A',
  },
  dayStats: {
    flexDirection: 'row',
    gap: 12,
  },
  dayWorkTime: {
    fontSize: 12,
    color: '#10b981',
  },
  dayBreakTime: {
    fontSize: 12,
    color: '#f59e0b',
  },
  workTypeBar: {
    flexDirection: 'row',
    height: 4,
    backgroundColor: '#F0F0F0',
    borderRadius: 2,
    overflow: 'hidden',
  },
  workTypeSegment: {
    height: '100%',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryText: {
    fontSize: 14,
    color: '#666666',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1A1A1A',
  },
  workTypeStatItem: {
    marginBottom: 20,
  },
  workTypeStatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  workTypeStatInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  workTypeStatColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  workTypeStatName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1A1A1A',
    flex: 1,
  },
  workTypeStatPercentage: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  workTypeStatBar: {
    height: 6,
    backgroundColor: '#F0F0F0',
    borderRadius: 3,
    marginBottom: 8,
    overflow: 'hidden',
  },
  workTypeStatProgress: {
    height: '100%',
    borderRadius: 3,
  },
  workTypeStatDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  workTypeStatDetail: {
    fontSize: 12,
    color: '#666666',
  },
  performanceRating: {
    alignItems: 'center',
    marginBottom: 20,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ratingText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  suggestions: {
    marginTop: 16,
  },
  suggestionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
    gap: 8,
  },
  suggestionText: {
    flex: 1,
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
  },
  comparisonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  comparisonItem: {
    alignItems: 'center',
  },
  comparisonLabel: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 4,
  },
  comparisonValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  trendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  trendItem: {
    alignItems: 'center',
  },
  trendLabel: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 4,
  },
  trendValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  trendArrow: {
    alignItems: 'center',
    gap: 4,
  },
  trendChange: {
    fontSize: 14,
    fontWeight: '600',
  },
});