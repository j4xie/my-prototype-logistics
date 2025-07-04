import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { router } from 'expo-router';
import {
  Text,
  Card,
  Button,
  Avatar,
  List,
  Divider,
  Switch,
  ActivityIndicator,
  Chip,
  Badge
} from 'react-native-paper';
import { useAuthStore } from '@food-trace/core';

export default function ProfileScreen() {
  const { user, logout, isLoading } = useAuthStore();
  const [profileStats, setProfileStats] = useState({
    totalBatches: 0,
    totalProducts: 0,
    qualityScore: 0,
    memberSince: '',
    lastActivity: '',
  });
  const [notificationSettings, setNotificationSettings] = useState({
    pushEnabled: true,
    emailEnabled: true,
    smsEnabled: false,
  });

  useEffect(() => {
    // 模拟加载用户统计数据
    const loadProfileStats = async () => {
      // 这里可以调用真实API
      setProfileStats({
        totalBatches: 156,
        totalProducts: 2340,
        qualityScore: 98.5,
        memberSince: '2023年5月',
        lastActivity: '2小时前',
      });
    };

    loadProfileStats();
  }, []);

  const handleLogout = () => {
    Alert.alert(
      '确认退出',
      '您确定要退出登录吗？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '退出',
          style: 'destructive',
          onPress: async () => {
            try {
              await logout();
              router.replace('/(auth)/login');
            } catch (error) {
              Alert.alert('退出失败', '请稍后重试');
            }
          }
        }
      ]
    );
  };

  const handleEditProfile = () => {
    // TODO: 实现编辑个人资料页面
    Alert.alert('功能开发中', '编辑个人资料功能正在开发中');
  };

  const handleSettings = () => {
    // TODO: 实现设置页面
    Alert.alert('功能开发中', '设置页面正在开发中');
  };

  const handleHelp = () => {
    // TODO: 实现帮助页面
    Alert.alert('功能开发中', '帮助页面正在开发中');
  };

  const handleFeedback = () => {
    // TODO: 实现反馈页面
    Alert.alert('功能开发中', '反馈页面正在开发中');
  };

  const getRoleDisplayName = (role?: string) => {
    const roleNames: Record<string, string> = {
      admin: '管理员',
      manager: '经理',
      user: '用户',
      farmer: '农户',
      processor: '加工商',
      logistics: '物流商',
      inspector: '检验员'
    };
    return roleNames[role || 'user'] || '用户';
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>加载中...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* 用户信息卡片 */}
      <Card style={styles.userCard}>
        <Card.Content>
          <View style={styles.userHeader}>
            <Avatar.Icon 
              size={80} 
              icon="account" 
              style={styles.avatar}
            />
            <View style={styles.userInfo}>
              <Text variant="headlineSmall" style={styles.userName}>
                {user?.username || '用户'}
              </Text>
              <Text variant="bodyMedium" style={styles.userEmail}>
                {user?.email || 'user@example.com'}
              </Text>
              <Chip 
                icon="shield-account" 
                style={styles.roleChip}
                compact
              >
                {getRoleDisplayName(user?.role)}
              </Chip>
            </View>
            <Button
              mode="outlined"
              onPress={handleEditProfile}
              style={styles.editButton}
              compact
            >
              编辑
            </Button>
          </View>
        </Card.Content>
      </Card>

      {/* 统计数据 */}
      <Card style={styles.statsCard}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            我的统计
          </Text>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text variant="headlineMedium" style={styles.statNumber}>
                {profileStats.totalBatches}
              </Text>
              <Text variant="bodySmall">总批次</Text>
            </View>
            <View style={styles.statItem}>
              <Text variant="headlineMedium" style={styles.statNumber}>
                {profileStats.totalProducts}
              </Text>
              <Text variant="bodySmall">总产品</Text>
            </View>
            <View style={styles.statItem}>
              <Text variant="headlineMedium" style={[styles.statNumber, styles.qualityScore]}>
                {profileStats.qualityScore}%
              </Text>
              <Text variant="bodySmall">质量评分</Text>
            </View>
            <View style={styles.statItem}>
              <Text variant="bodyMedium" style={styles.memberSince}>
                {profileStats.memberSince}
              </Text>
              <Text variant="bodySmall">加入时间</Text>
            </View>
          </View>
        </Card.Content>
      </Card>

      {/* 快捷通知设置 */}
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            通知设置
          </Text>
          
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text variant="bodyLarge">推送通知</Text>
              <Text variant="bodySmall" style={styles.settingDesc}>
                接收重要更新和提醒
              </Text>
            </View>
            <Switch
              value={notificationSettings.pushEnabled}
              onValueChange={(value) => 
                setNotificationSettings(prev => ({ ...prev, pushEnabled: value }))
              }
            />
          </View>

          <Divider style={styles.settingDivider} />

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text variant="bodyLarge">邮件通知</Text>
              <Text variant="bodySmall" style={styles.settingDesc}>
                接收批次状态和质量报告
              </Text>
            </View>
            <Switch
              value={notificationSettings.emailEnabled}
              onValueChange={(value) => 
                setNotificationSettings(prev => ({ ...prev, emailEnabled: value }))
              }
            />
          </View>
        </Card.Content>
      </Card>

      {/* 功能菜单 */}
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            功能菜单
          </Text>

          <List.Item
            title="账户设置"
            description="密码、安全设置"
            left={(props) => <List.Icon {...props} icon="cog" />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={handleSettings}
            style={styles.menuItem}
          />

          <Divider />

          <List.Item
            title="数据导出"
            description="导出个人数据"
            left={(props) => <List.Icon {...props} icon="download" />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => Alert.alert('功能开发中', '数据导出功能正在开发中')}
            style={styles.menuItem}
          />

          <Divider />

          <List.Item
            title="隐私设置"
            description="数据共享和隐私控制"
            left={(props) => <List.Icon {...props} icon="shield-lock" />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => Alert.alert('功能开发中', '隐私设置功能正在开发中')}
            style={styles.menuItem}
          />

          <Divider />

          <List.Item
            title="帮助与支持"
            description="常见问题和技术支持"
            left={(props) => <List.Icon {...props} icon="help-circle" />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={handleHelp}
            style={styles.menuItem}
          />

          <Divider />

          <List.Item
            title="意见反馈"
            description="改进建议和问题报告"
            left={(props) => <List.Icon {...props} icon="message-text" />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={handleFeedback}
            style={styles.menuItem}
          />
        </Card.Content>
      </Card>

      {/* 应用信息 */}
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            应用信息
          </Text>
          
          <View style={styles.appInfo}>
            <Text variant="bodyMedium">版本号: 1.0.0</Text>
            <Text variant="bodyMedium">最后登录: {profileStats.lastActivity}</Text>
            <Text variant="bodyMedium">构建号: 2025.01.07</Text>
          </View>
        </Card.Content>
      </Card>

      {/* 退出登录按钮 */}
      <Card style={[styles.card, styles.logoutCard]}>
        <Card.Content>
          <Button
            mode="contained"
            onPress={handleLogout}
            style={styles.logoutButton}
            buttonColor="#f44336"
            textColor="#ffffff"
            icon="logout"
          >
            退出登录
          </Button>
        </Card.Content>
      </Card>

      {/* 底部间距 */}
      <View style={styles.bottomSpacing} />
    </ScrollView>
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
  loadingText: {
    marginTop: 16,
  },
  userCard: {
    margin: 16,
    marginBottom: 8,
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    marginRight: 16,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontWeight: 'bold',
    marginBottom: 4,
  },
  userEmail: {
    opacity: 0.7,
    marginBottom: 8,
  },
  roleChip: {
    alignSelf: 'flex-start',
  },
  editButton: {
    marginLeft: 8,
  },
  statsCard: {
    marginHorizontal: 16,
    marginBottom: 8,
  },
  card: {
    marginHorizontal: 16,
    marginBottom: 8,
  },
  sectionTitle: {
    marginBottom: 16,
    fontWeight: 'bold',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statItem: {
    width: '48%',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginBottom: 8,
  },
  statNumber: {
    fontWeight: 'bold',
    color: '#2196F3',
    marginBottom: 4,
  },
  qualityScore: {
    color: '#4caf50',
  },
  memberSince: {
    fontWeight: '500',
    color: '#757575',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  settingInfo: {
    flex: 1,
  },
  settingDesc: {
    opacity: 0.7,
    marginTop: 2,
  },
  settingDivider: {
    marginVertical: 12,
  },
  menuItem: {
    paddingVertical: 4,
  },
  appInfo: {
    gap: 8,
  },
  logoutCard: {
    marginBottom: 16,
  },
  logoutButton: {
    marginTop: 8,
  },
  bottomSpacing: {
    height: 24,
  },
});