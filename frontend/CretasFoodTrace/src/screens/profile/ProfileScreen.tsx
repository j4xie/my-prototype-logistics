import React from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, Card, List, Divider, Button, Avatar, Chip, Appbar } from 'react-native-paper';
import { useAuthStore } from '../../store/authStore';
import { useNavigation } from '@react-navigation/native';

/**
 * 个人中心页面
 */
export default function ProfileScreen() {
  const { user, logout } = useAuthStore();
  const navigation = useNavigation();

  const handleLogout = () => {
    Alert.alert(
      '退出登录',
      '确定要退出当前账号吗？',
      [
        {
          text: '取消',
          style: 'cancel',
        },
        {
          text: '退出',
          style: 'destructive',
          onPress: async () => {
            try {
              await logout();
              console.log('✅ 用户已退出登录');
            } catch (error) {
              console.error('❌ 退出登录失败:', error);
              Alert.alert('错误', '退出登录失败，请重试');
            }
          },
        },
      ]
    );
  };

  // 获取用户信息
  const userType = user?.userType || 'factory';
  const isPlatformAdmin = userType === 'platform';
  const isFactoryUser = userType === 'factory';

  const displayName = user?.fullName || user?.username || '未知用户';
  const username = user?.username || '';
  const email = user?.email || '';
  const phone = user?.phone || '';
  const roleCode = isPlatformAdmin
    ? user?.platformUser?.role
    : user?.factoryUser?.roleCode || user?.roleCode;
  const department = user?.factoryUser?.department || user?.department;
  const factoryId = user?.factoryId || user?.factoryUser?.factoryId;

  // 角色显示名称
  const getRoleName = (role: string | undefined) => {
    const roleMap: Record<string, string> = {
      'developer': '系统开发者',
      'platform_admin': '平台管理员',
      'platform_super_admin': '平台超级管理员',
      'factory_super_admin': '工厂超级管理员',
      'permission_admin': '权限管理员',
      'department_admin': '部门管理员',
      'operator': '操作员',
      'viewer': '查看者',
    };
    return roleMap[role || ''] || role || '未知角色';
  };

  // 部门显示名称
  const getDepartmentName = (dept: string | undefined) => {
    const deptMap: Record<string, string> = {
      'farming': '养殖部门',
      'processing': '加工部门',
      'logistics': '物流部门',
      'quality': '质检部门',
      'management': '管理部门',
    };
    return deptMap[dept || ''] || dept || '--';
  };

  return (
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.Content title="个人中心" />
      </Appbar.Header>

      <ScrollView style={styles.content}>
        {/* 用户信息卡片 */}
        <Card style={styles.profileCard}>
          <Card.Content>
            <View style={styles.profileHeader}>
              <Avatar.Text
                size={64}
                label={displayName.substring(0, 2)}
                style={styles.avatar}
              />
              <View style={styles.profileInfo}>
                <Text variant="headlineSmall" style={styles.displayName}>
                  {displayName}
                </Text>
                <Text variant="bodyMedium" style={styles.username}>
                  @{username}
                </Text>
                <View style={styles.badges}>
                  <Chip
                    mode="flat"
                    compact
                    style={[
                      styles.badge,
                      isPlatformAdmin ? styles.platformBadge : styles.factoryBadge
                    ]}
                    textStyle={styles.badgeText}
                  >
                    {isPlatformAdmin ? '平台管理员' : '工厂用户'}
                  </Chip>
                  <Chip
                    mode="flat"
                    compact
                    style={styles.roleBadge}
                    textStyle={styles.badgeText}
                  >
                    {getRoleName(roleCode)}
                  </Chip>
                </View>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* 账号信息 */}
        <Card style={styles.card}>
          <Card.Title title="账号信息" />
          <Card.Content>
            <List.Item
              title="用户名"
              description={username}
              left={props => <List.Icon {...props} icon="account" />}
            />
            <Divider />
            <List.Item
              title="邮箱"
              description={email || '未设置'}
              left={props => <List.Icon {...props} icon="email" />}
            />
            <Divider />
            <List.Item
              title="手机号"
              description={phone || '未设置'}
              left={props => <List.Icon {...props} icon="phone" />}
            />
            {isFactoryUser && (
              <>
                <Divider />
                <List.Item
                  title="所属工厂"
                  description={factoryId || '未设置'}
                  left={props => <List.Icon {...props} icon="factory" />}
                />
                <Divider />
                <List.Item
                  title="所属部门"
                  description={getDepartmentName(department)}
                  left={props => <List.Icon {...props} icon="office-building" />}
                />
              </>
            )}
          </Card.Content>
        </Card>

        {/* 权限信息 */}
        <Card style={styles.card}>
          <Card.Title title="权限信息" />
          <Card.Content>
            <List.Item
              title="角色"
              description={getRoleName(roleCode)}
              left={props => <List.Icon {...props} icon="shield-account" />}
            />
            <Divider />
            <List.Item
              title="用户类型"
              description={isPlatformAdmin ? '平台管理员（只读模式）' : '工厂用户（可操作）'}
              left={props => <List.Icon {...props} icon="badge-account" />}
            />
          </Card.Content>
        </Card>

        {/* 系统信息 */}
        <Card style={styles.card}>
          <Card.Title title="系统信息" />
          <Card.Content>
            <List.Item
              title="应用版本"
              description="v1.0.0"
              left={props => <List.Icon {...props} icon="information" />}
            />
            <Divider />
            <List.Item
              title="系统名称"
              description="白垩纪食品溯源系统"
              left={props => <List.Icon {...props} icon="application" />}
            />
          </Card.Content>
        </Card>

        {/* 退出登录 */}
        <Card style={styles.card}>
          <Card.Content>
            <Button
              mode="contained"
              icon="logout"
              onPress={handleLogout}
              style={styles.logoutButton}
              buttonColor="#F44336"
            >
              退出登录
            </Button>
          </Card.Content>
        </Card>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  content: {
    flex: 1,
  },
  profileCard: {
    margin: 16,
    marginBottom: 8,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  avatar: {
    backgroundColor: '#2196F3',
  },
  profileInfo: {
    flex: 1,
    marginLeft: 16,
  },
  displayName: {
    fontWeight: '600',
    marginBottom: 4,
  },
  username: {
    color: '#666',
    marginBottom: 8,
  },
  badges: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  badge: {
    height: 24,
  },
  platformBadge: {
    backgroundColor: '#E3F2FD',
  },
  factoryBadge: {
    backgroundColor: '#E8F5E9',
  },
  roleBadge: {
    backgroundColor: '#FFF3E0',
  },
  badgeText: {
    fontSize: 11,
  },
  card: {
    margin: 16,
    marginTop: 0,
    marginBottom: 8,
  },
  logoutButton: {
    marginTop: 8,
  },
  bottomPadding: {
    height: 32,
  },
});
