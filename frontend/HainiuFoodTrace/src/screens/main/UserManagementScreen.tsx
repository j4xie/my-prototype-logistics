import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { UserListComponent } from '../../components/user/UserListComponent';
import { PermissionGuard } from '../../components/auth/PermissionGuard';
import { useAuthStore } from '../../store/authStore';
import { usePermission } from '../../hooks/usePermission';
import { User } from '../../types/auth';

interface UserManagementScreenProps {
  navigation: any;
}

export const UserManagementScreen: React.FC<UserManagementScreenProps> = ({ navigation }) => {
  const { user: currentUser } = useAuthStore();
  const { hasPermission } = usePermission();
  
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const handleUserPress = (user: User) => {
    setSelectedUser(user);
    // 这里可以导航到用户详情页面或显示用户详情模态框
    console.log('用户点击:', user);
  };

  const statistics = {
    totalUsers: 24,
    activeUsers: 18,
    platformUsers: 6,
    factoryUsers: 18,
    recentRegistrations: 3,
  };

  return (
    <PermissionGuard
      module="admin_access"
      fallback={
        <View style={styles.noPermissionContainer}>
          <Ionicons name="shield-outline" size={64} color="#d1d5db" />
          <Text style={styles.noPermissionTitle}>权限不足</Text>
          <Text style={styles.noPermissionDescription}>
            您没有权限访问用户管理功能
          </Text>
        </View>
      }
      showFallback={true}
    >
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        
        {/* 头部统计信息 */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={24} color="#111827" />
            </TouchableOpacity>
            <View style={styles.headerTitleContainer}>
              <Text style={styles.headerTitle}>用户管理</Text>
              <Text style={styles.headerSubtitle}>管理系统中的所有用户</Text>
            </View>
          </View>
          
          <View style={styles.statsContainer}>
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statNumber}>{statistics.totalUsers}</Text>
                <Text style={styles.statLabel}>总用户数</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statNumber}>{statistics.activeUsers}</Text>
                <Text style={styles.statLabel}>活跃用户</Text>
              </View>
            </View>
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statNumber}>{statistics.platformUsers}</Text>
                <Text style={styles.statLabel}>平台用户</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statNumber}>{statistics.factoryUsers}</Text>
                <Text style={styles.statLabel}>工厂用户</Text>
              </View>
            </View>
          </View>
        </View>

        {/* 用户列表组件 */}
        <UserListComponent onUserPress={handleUserPress} />
      </SafeAreaView>
    </PermissionGuard>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  noPermissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    paddingHorizontal: 40,
  },
  noPermissionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#9ca3af',
    marginTop: 20,
    marginBottom: 12,
  },
  noPermissionDescription: {
    fontSize: 16,
    color: '#d1d5db',
    textAlign: 'center',
    lineHeight: 24,
  },
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#6b7280',
  },
  statsContainer: {
    gap: 12,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#3182ce',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
});