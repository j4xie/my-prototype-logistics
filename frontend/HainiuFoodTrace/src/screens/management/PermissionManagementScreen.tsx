import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';

interface PermissionManagementScreenProps {
  navigation: any;
}

export const PermissionManagementScreen: React.FC<PermissionManagementScreenProps> = ({ navigation }) => {
  const { user } = useAuthStore();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1500);
  };

  // 快速操作卡片
  const QuickActionCard = ({ title, icon, color, count, onPress }: any) => (
    <TouchableOpacity style={styles.actionCard} onPress={onPress}>
      <View style={[styles.actionIcon, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon} size={28} color={color} />
      </View>
      <View style={styles.actionInfo}>
        <Text style={styles.actionTitle}>{title}</Text>
        {count !== undefined && (
          <Text style={styles.actionCount}>{count} 项</Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={20} color="#CCC" />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* 头部 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>权限管理中心</Text>
          <Text style={styles.headerSubtitle}>跨部门用户和白名单管理</Text>
        </View>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* 统计概览 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>权限概览</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>156</Text>
              <Text style={styles.statLabel}>总用户数</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>23</Text>
              <Text style={styles.statLabel}>待审核</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>45</Text>
              <Text style={styles.statLabel}>白名单</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>5</Text>
              <Text style={styles.statLabel}>部门数</Text>
            </View>
          </View>
        </View>

        {/* 白名单管理 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>白名单管理</Text>
          <QuickActionCard
            title="全工厂白名单"
            icon="people"
            color="#4ECDC4"
            count={45}
            onPress={() => navigation.navigate('WhitelistManagement', { scope: 'all' })}
          />
          <QuickActionCard
            title="按部门筛选"
            icon="filter"
            color="#3182CE"
            onPress={() => navigation.navigate('WhitelistManagement', { scope: 'all', showDepartmentFilter: true })}
          />
        </View>

        {/* 用户审核 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>用户审核</Text>
          <QuickActionCard
            title="待审核用户"
            icon="hourglass"
            color="#F39C12"
            count={23}
            onPress={() => navigation.navigate('UserApproval', { status: 'pending' })}
          />
          <QuickActionCard
            title="已激活用户"
            icon="checkmark-circle"
            color="#4CAF50"
            count={133}
            onPress={() => navigation.navigate('UserApproval', { status: 'active' })}
          />
        </View>

        {/* 部门管理 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>部门管理</Text>
          {[
            { name: '养殖部', key: 'farming', color: '#10b981', users: 32 },
            { name: '加工部', key: 'processing', color: '#f59e0b', users: 45 },
            { name: '物流部', key: 'logistics', color: '#3b82f6', users: 28 },
            { name: '质检部', key: 'quality', color: '#8b5cf6', users: 21 },
            { name: '管理部', key: 'management', color: '#ec4899', users: 30 },
          ].map((dept) => (
            <QuickActionCard
              key={dept.key}
              title={dept.name}
              icon="business"
              color={dept.color}
              count={dept.users}
              onPress={() => navigation.navigate('DepartmentDetail', { department: dept.key })}
            />
          ))}
        </View>

        {/* 权限报表 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>权限报表</Text>
          <QuickActionCard
            title="用户权限分析"
            icon="analytics"
            color="#9B59B6"
            onPress={() => navigation.navigate('PermissionReport', { type: 'user' })}
          />
          <QuickActionCard
            title="部门权限分布"
            icon="pie-chart"
            color="#FF6B6B"
            onPress={() => navigation.navigate('PermissionReport', { type: 'department' })}
          />
          <QuickActionCard
            title="操作日志"
            icon="document-text"
            color="#667eea"
            onPress={() => navigation.navigate('PermissionLog')}
          />
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
  },
  backButton: {
    padding: 4,
  },
  headerTitleContainer: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  placeholder: {
    width: 32,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    marginTop: 20,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
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
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#4ECDC4',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    color: '#666',
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
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
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  actionInfo: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  actionCount: {
    fontSize: 13,
    color: '#999',
  },
});

export default PermissionManagementScreen;
