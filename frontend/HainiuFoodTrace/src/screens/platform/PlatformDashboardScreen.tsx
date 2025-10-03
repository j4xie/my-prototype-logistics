import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';

interface PlatformDashboardScreenProps {
  navigation: any;
}

export const PlatformDashboardScreen: React.FC<PlatformDashboardScreenProps> = ({ navigation }) => {
  const { user } = useAuthStore();
  const [refreshing, setRefreshing] = useState(false);

  // 模拟刷新
  const handleRefresh = async () => {
    setRefreshing(true);
    // TODO: 调用实际的刷新API
    setTimeout(() => setRefreshing(false), 1500);
  };

  // 快速操作卡片
  const QuickActionCard = ({ title, icon, color, onPress, badge }: any) => (
    <TouchableOpacity style={styles.quickActionCard} onPress={onPress}>
      <View style={[styles.quickActionIcon, { backgroundColor: color }]}>
        <Ionicons name={icon} size={28} color="#FFFFFF" />
        {badge > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        )}
      </View>
      <Text style={styles.quickActionTitle}>{title}</Text>
    </TouchableOpacity>
  );

  // 统计卡片
  const StatCard = ({ title, value, icon, trend }: any) => (
    <View style={styles.statCard}>
      <View style={styles.statHeader}>
        <Ionicons name={icon} size={24} color="#4ECDC4" />
        <Text style={styles.statTitle}>{title}</Text>
      </View>
      <Text style={styles.statValue}>{value}</Text>
      {trend && (
        <View style={styles.trendContainer}>
          <Ionicons
            name={trend.direction === 'up' ? 'trending-up' : 'trending-down'}
            size={16}
            color={trend.direction === 'up' ? '#4CAF50' : '#F44336'}
          />
          <Text style={[styles.trendText, { color: trend.direction === 'up' ? '#4CAF50' : '#F44336' }]}>
            {trend.value}
          </Text>
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      {/* 头部 */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>你好，</Text>
          <Text style={styles.username}>{user?.username || '平台管理员'}</Text>
        </View>
        <TouchableOpacity
          style={styles.profileButton}
          onPress={() => navigation.navigate('Profile')}
        >
          <Ionicons name="person-circle" size={40} color="#4ECDC4" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* 快速操作 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>快速操作</Text>
          <View style={styles.quickActionsGrid}>
            <QuickActionCard
              title="查看所有工厂"
              icon="eye"
              color="#3182CE"
              onPress={() => navigation.navigate('FactoryList', { mode: 'view' })}
            />
            <QuickActionCard
              title="管理所有工厂"
              icon="settings"
              color="#FF6B6B"
              onPress={() => navigation.navigate('FactoryList', { mode: 'manage' })}
            />
            <QuickActionCard
              title="用户管理"
              icon="people"
              color="#9B59B6"
              badge={5}
              onPress={() => navigation.navigate('UserManagement')}
            />
            <QuickActionCard
              title="系统监控"
              icon="pulse"
              color="#F39C12"
              onPress={() => navigation.navigate('SystemMonitor')}
            />
          </View>
        </View>

        {/* 统计概览 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>平台统计</Text>
          <View style={styles.statsGrid}>
            <StatCard
              title="工厂总数"
              value="23"
              icon="business"
              trend={{ direction: 'up', value: '+3' }}
            />
            <StatCard
              title="活跃用户"
              value="156"
              icon="people"
              trend={{ direction: 'up', value: '+12' }}
            />
            <StatCard
              title="今日溯源"
              value="342"
              icon="search"
              trend={{ direction: 'down', value: '-8' }}
            />
            <StatCard
              title="系统告警"
              value="5"
              icon="warning"
            />
          </View>
        </View>

        {/* 最近活动 */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>最近活动</Text>
            <TouchableOpacity>
              <Text style={styles.viewAllText}>查看全部</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.activityList}>
            {[
              { icon: 'business-outline', text: '新工厂注册: 白垩纪食品加工厂', time: '2小时前', color: '#4ECDC4' },
              { icon: 'person-add-outline', text: '新用户注册: 张三 (加工部)', time: '5小时前', color: '#3182CE' },
              { icon: 'warning-outline', text: '系统告警: 服务器CPU使用率过高', time: '8小时前', color: '#FF6B6B' },
              { icon: 'checkmark-circle-outline', text: '工厂审核通过: 白垩纪养殖场', time: '1天前', color: '#4CAF50' },
            ].map((item, index) => (
              <View key={index} style={styles.activityItem}>
                <View style={[styles.activityIcon, { backgroundColor: item.color + '20' }]}>
                  <Ionicons name={item.icon as any} size={20} color={item.color} />
                </View>
                <View style={styles.activityContent}>
                  <Text style={styles.activityText}>{item.text}</Text>
                  <Text style={styles.activityTime}>{item.time}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* 系统健康状态 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>系统健康状态</Text>
          <View style={styles.healthCard}>
            <View style={styles.healthItem}>
              <Text style={styles.healthLabel}>数据库</Text>
              <View style={[styles.healthDot, { backgroundColor: '#4CAF50' }]} />
            </View>
            <View style={styles.healthItem}>
              <Text style={styles.healthLabel}>API服务</Text>
              <View style={[styles.healthDot, { backgroundColor: '#4CAF50' }]} />
            </View>
            <View style={styles.healthItem}>
              <Text style={styles.healthLabel}>文件存储</Text>
              <View style={[styles.healthDot, { backgroundColor: '#F39C12' }]} />
            </View>
            <View style={styles.healthItem}>
              <Text style={styles.healthLabel}>消息队列</Text>
              <View style={[styles.healthDot, { backgroundColor: '#4CAF50' }]} />
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
  },
  greeting: {
    fontSize: 14,
    color: '#666',
  },
  username: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 4,
  },
  profileButton: {
    padding: 4,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    marginTop: 20,
    paddingHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  viewAllText: {
    fontSize: 14,
    color: '#4ECDC4',
    fontWeight: '500',
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  quickActionCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  quickActionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#FF6B6B',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  quickActionTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    textAlign: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statTitle: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  trendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trendText: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  activityList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
  activityTime: {
    fontSize: 12,
    color: '#999',
  },
  healthCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  healthItem: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  healthLabel: {
    fontSize: 14,
    color: '#666',
  },
  healthDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
});

export default PlatformDashboardScreen;
