import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { timeclockApiClient, ClockRecord } from '../../services/api/timeclockApiClient';

interface GroupedRecord {
  date: string;
  records: ClockRecord[];
  workMinutes?: number;
  breakMinutes?: number;
}

export const ClockHistoryScreen: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [records, setRecords] = useState<ClockRecord[]>([]);
  const [groupedRecords, setGroupedRecords] = useState<GroupedRecord[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    loadClockHistory();
  }, []);

  useEffect(() => {
    // 对记录进行分组
    groupRecordsByDate();
  }, [records]);

  const loadClockHistory = async (page = 1, isRefresh = false) => {
    try {
      if (page === 1) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      const response = await timeclockApiClient.getClockHistory({
        page,
        limit: pagination.limit,
      });

      if (response.success) {
        const newRecords = response.data.records;
        
        if (isRefresh || page === 1) {
          setRecords(newRecords);
        } else {
          setRecords(prev => [...prev, ...newRecords]);
        }

        setPagination(response.data.pagination);
        setHasMore(response.data.pagination.page < response.data.pagination.totalPages);
      } else {
        Alert.alert('错误', '获取打卡历史失败');
      }
    } catch (error) {
      console.error('获取打卡历史失败:', error);
      Alert.alert('错误', '获取打卡历史失败，请重试');
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  };

  const groupRecordsByDate = () => {
    const grouped: { [key: string]: ClockRecord[] } = {};
    
    records.forEach(record => {
      const date = new Date(record.clockTime).toLocaleDateString('zh-CN');
      if (!grouped[date]) {
        grouped[date] = [];
      }
      grouped[date].push(record);
    });

    // 转换为数组并按日期排序
    const groupedArray: GroupedRecord[] = Object.keys(grouped)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
      .map(date => {
        const dayRecords = grouped[date].sort((a, b) => 
          new Date(a.clockTime).getTime() - new Date(b.clockTime).getTime()
        );

        // 计算当天工作时长和休息时长
        let workMinutes = 0;
        let breakMinutes = 0;

        const clockIn = dayRecords.find(r => r.clockType === 'clock_in');
        const clockOut = dayRecords.find(r => r.clockType === 'clock_out');
        const breakStarts = dayRecords.filter(r => r.clockType === 'break_start');
        const breakEnds = dayRecords.filter(r => r.clockType === 'break_end');

        if (clockIn && clockOut) {
          const totalMinutes = Math.floor(
            (new Date(clockOut.clockTime).getTime() - new Date(clockIn.clockTime).getTime()) / (1000 * 60)
          );

          // 计算休息时长
          breakStarts.forEach((start, index) => {
            const end = breakEnds[index];
            if (end) {
              breakMinutes += Math.floor(
                (new Date(end.clockTime).getTime() - new Date(start.clockTime).getTime()) / (1000 * 60)
              );
            }
          });

          workMinutes = Math.max(0, totalMinutes - breakMinutes);
        }

        return {
          date,
          records: dayRecords,
          workMinutes,
          breakMinutes,
        };
      });

    setGroupedRecords(groupedArray);
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadClockHistory(1, true);
  };

  const loadMore = () => {
    if (!loadingMore && hasMore) {
      loadClockHistory(pagination.page + 1);
    }
  };

  const getClockTypeText = (type: string) => {
    switch (type) {
      case 'clock_in': return '上班打卡';
      case 'clock_out': return '下班打卡';
      case 'break_start': return '开始休息';
      case 'break_end': return '结束休息';
      default: return type;
    }
  };

  const getClockTypeIcon = (type: string) => {
    switch (type) {
      case 'clock_in': return 'play-circle';
      case 'clock_out': return 'stop-circle';
      case 'break_start': return 'pause-circle';
      case 'break_end': return 'play-circle';
      default: return 'time';
    }
  };

  const getClockTypeColor = (type: string) => {
    switch (type) {
      case 'clock_in': return '#10b981';
      case 'clock_out': return '#ef4444';
      case 'break_start': return '#f59e0b';
      case 'break_end': return '#10b981';
      default: return '#6b7280';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'normal': return '#10b981';
      case 'late': return '#f59e0b';
      case 'early': return '#3b82f6';
      case 'invalid': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'normal': return '正常';
      case 'late': return '迟到';
      case 'early': return '早退';
      case 'invalid': return '异常';
      default: return status;
    }
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatMinutes = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h${mins}m` : `${mins}m`;
  };

  const renderClockRecord = ({ item }: { item: ClockRecord }) => (
    <View style={styles.recordItem}>
      <View style={styles.recordTime}>
        <Text style={styles.timeText}>{formatTime(item.clockTime)}</Text>
      </View>
      
      <View style={styles.recordMain}>
        <View style={styles.recordHeader}>
          <View style={styles.recordTitleRow}>
            <Ionicons
              name={getClockTypeIcon(item.clockType) as any}
              size={18}
              color={getClockTypeColor(item.clockType)}
            />
            <Text style={styles.recordTitle}>
              {getClockTypeText(item.clockType)}
            </Text>
          </View>
          
          <View style={[
            styles.statusBadge,
            { backgroundColor: getStatusColor(item.status) + '20' }
          ]}>
            <Text style={[
              styles.statusText,
              { color: getStatusColor(item.status) }
            ]}>
              {getStatusText(item.status)}
            </Text>
          </View>
        </View>

        {item.workType && (
          <View style={styles.workTypeInfo}>
            <View style={[
              styles.workTypeColor,
              { backgroundColor: item.workType.colorCode || '#007AFF' }
            ]} />
            <Text style={styles.workTypeName}>{item.workType.typeName}</Text>
          </View>
        )}

        {item.notes && (
          <Text style={styles.recordNotes} numberOfLines={2}>
            {item.notes}
          </Text>
        )}
      </View>
    </View>
  );

  const renderDateGroup = ({ item }: { item: GroupedRecord }) => (
    <View style={styles.dateGroup}>
      {/* 日期头部 */}
      <View style={styles.dateHeader}>
        <Text style={styles.dateText}>{item.date}</Text>
        <View style={styles.dateSummary}>
          {item.workMinutes !== undefined && item.workMinutes > 0 && (
            <View style={styles.summaryItem}>
              <Ionicons name="time" size={14} color="#10b981" />
              <Text style={styles.summaryText}>
                工作 {formatMinutes(item.workMinutes)}
              </Text>
            </View>
          )}
          {item.breakMinutes !== undefined && item.breakMinutes > 0 && (
            <View style={styles.summaryItem}>
              <Ionicons name="pause" size={14} color="#f59e0b" />
              <Text style={styles.summaryText}>
                休息 {formatMinutes(item.breakMinutes)}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* 当天的打卡记录 */}
      <View style={styles.recordsList}>
        {item.records.map((record, index) => (
          <View key={record.id}>
            {renderClockRecord({ item: record })}
            {index < item.records.length - 1 && <View style={styles.recordSeparator} />}
          </View>
        ))}
      </View>
    </View>
  );

  const renderFooter = () => {
    if (!loadingMore) return null;
    
    return (
      <View style={styles.footer}>
        <ActivityIndicator size="small" color="#007AFF" />
        <Text style={styles.footerText}>加载更多...</Text>
      </View>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="time-outline" size={64} color="#CCCCCC" />
      <Text style={styles.emptyText}>暂无打卡记录</Text>
      <Text style={styles.emptySubtext}>开始工作后打卡记录将显示在这里</Text>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>加载中...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>打卡历史</Text>
        <Text style={styles.subtitle}>
          共 {pagination.total} 条记录
        </Text>
      </View>

      <FlatList
        data={groupedRecords}
        renderItem={renderDateGroup}
        keyExtractor={(item) => item.date}
        style={styles.list}
        contentContainerStyle={[
          styles.listContent,
          groupedRecords.length === 0 && styles.listContentEmpty
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#007AFF"
          />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmpty}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666666',
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
  list: {
    flex: 1,
  },
  listContent: {
    padding: 16,
  },
  listContentEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  dateGroup: {
    marginBottom: 20,
  },
  dateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  dateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  dateSummary: {
    flexDirection: 'row',
    gap: 12,
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  summaryText: {
    fontSize: 12,
    color: '#666666',
  },
  recordsList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  recordItem: {
    flexDirection: 'row',
    padding: 16,
  },
  recordTime: {
    width: 60,
    alignItems: 'center',
    marginRight: 16,
  },
  timeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    fontFamily: 'monospace',
  },
  recordMain: {
    flex: 1,
  },
  recordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  recordTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  recordTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1A1A1A',
    marginLeft: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  workTypeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  workTypeColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  workTypeName: {
    fontSize: 14,
    color: '#666666',
  },
  recordNotes: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
  },
  recordSeparator: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginLeft: 76,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
  },
  footerText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666666',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    color: '#666666',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999999',
    textAlign: 'center',
    lineHeight: 20,
  },
});