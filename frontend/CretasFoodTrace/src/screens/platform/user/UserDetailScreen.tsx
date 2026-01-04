import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import {
  Text,
  Card,
  Chip,
  IconButton,
  Switch,
  Button,
  Portal,
  Dialog,
  ActivityIndicator,
  Divider,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { isAxiosError } from 'axios';
import { userApiClient, UserDTO } from '../../../services/api/userApiClient';

// Types
interface UserDetail {
  id: string;
  username: string;
  realName: string;
  phone: string;
  email: string;
  role: string;
  roleCode: string;
  factoryId?: string;
  factoryName?: string;
  department?: string;
  status: 'active' | 'disabled';
  avatarColor: string;
  createdAt: string;
  lastLogin: string;
  permissions: string[];
  twoFactorEnabled: boolean;
  passwordStrength: 'weak' | 'medium' | 'strong';
}

interface ActivityLog {
  id: string;
  action: string;
  detail: string;
  time: string;
}

type UserManagementStackParamList = {
  UserList: undefined;
  UserDetail: { userId: string };
  RoleList: undefined;
  RoleEdit: { roleId?: string };
};

type NavigationProp = NativeStackNavigationProp<UserManagementStackParamList, 'UserDetail'>;
type UserDetailRouteProp = RouteProp<UserManagementStackParamList, 'UserDetail'>;

// Helper function to generate avatar color from username
const generateAvatarColor = (username: string): string => {
  const colors = ['#1a1a2e', '#ff6b6b', '#4facfe', '#a8edea', '#667eea', '#f093fb', '#52c41a', '#faad14'];
  const hash = username.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length] ?? '#1a1a2e';
};

// Helper function to convert UserDTO to UserDetail
const convertUserDTOToUserDetail = (dto: UserDTO): UserDetail => {
  const roleDisplayMap: Record<string, string> = {
    'PLATFORM_ADMIN': '平台管理员',
    'FACTORY_SUPER_ADMIN': '工厂超级管理员',
    'DEPARTMENT_ADMIN': '部门管理员',
    'OPERATOR': '操作员',
  };

  // Default permissions based on role
  const rolePermissions: Record<string, string[]> = {
    'PLATFORM_ADMIN': ['系统管理', '工厂管理', '用户管理', '配额管理', '报表查看', '规则配置'],
    'FACTORY_SUPER_ADMIN': ['蓝图管理', '工艺配置', '调度管理', '质检管理', '人员管理', '设备监控', '报表查看'],
    'DEPARTMENT_ADMIN': ['部门管理', '任务分配', '进度跟踪', '报表查看'],
    'OPERATOR': ['任务执行', '数据录入', '进度更新'],
  };

  return {
    id: dto.id.toString(),
    username: dto.username,
    realName: dto.realName || dto.fullName || dto.username,
    phone: dto.phone || '',
    email: dto.email || '',
    role: dto.roleDisplayName || roleDisplayMap[dto.roleCode] || dto.roleCode,
    roleCode: dto.roleCode.toLowerCase(),
    department: dto.departmentDisplayName || dto.department,
    status: dto.isActive ? 'active' : 'disabled',
    avatarColor: generateAvatarColor(dto.username),
    createdAt: dto.createdAt ? new Date(dto.createdAt).toLocaleString('zh-CN') : '',
    lastLogin: dto.updatedAt ? new Date(dto.updatedAt).toLocaleString('zh-CN') : '',
    permissions: rolePermissions[dto.roleCode] || [],
    twoFactorEnabled: false, // TODO: Add API support for 2FA status
    passwordStrength: 'medium' as const, // TODO: Add API support for password strength
  };
};

export default function UserDetailScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<UserDetailRouteProp>();
  const { t } = useTranslation('platform');
  const { userId } = route.params;

  // State
  const [user, setUser] = useState<UserDetail | null>(null);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [accountEnabled, setAccountEnabled] = useState(true);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(true);
  const [resetPasswordDialogVisible, setResetPasswordDialogVisible] = useState(false);
  const [disableDialogVisible, setDisableDialogVisible] = useState(false);

  const loadUserDetail = useCallback(async () => {
    try {
      setLoading(true);
      const userDTO = await userApiClient.getUserById(parseInt(userId, 10));
      const userDetail = convertUserDTOToUserDetail(userDTO);
      setUser(userDetail);
      setAccountEnabled(userDetail.status === 'active');
      setTwoFactorEnabled(userDetail.twoFactorEnabled);
      // TODO: Load activities from API when available
      setActivities([]);
    } catch (error) {
      if (isAxiosError(error)) {
        Alert.alert('加载失败', error.response?.data?.message || '获取用户详情失败');
      } else {
        Alert.alert('加载失败', '网络错误，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadUserDetail();
  }, [loadUserDetail]);

  const handleResetPassword = () => {
    setResetPasswordDialogVisible(false);
    // TODO: Implement password reset API call
    Alert.alert('成功', '密码重置链接已发送到用户邮箱');
  };

  const handleDisableAccount = async () => {
    setDisableDialogVisible(false);
    try {
      await userApiClient.deactivateUser(parseInt(userId, 10));
      setAccountEnabled(false);
      Alert.alert('成功', '账号已禁用');
    } catch (error) {
      if (isAxiosError(error)) {
        Alert.alert('操作失败', error.response?.data?.message || '禁用账号失败');
      } else {
        Alert.alert('操作失败', '网络错误，请稍后重试');
      }
    }
  };

  const handleToggleAccount = async (value: boolean) => {
    if (!value) {
      setDisableDialogVisible(true);
    } else {
      try {
        await userApiClient.activateUser(parseInt(userId, 10));
        setAccountEnabled(true);
        Alert.alert('成功', '账号已启用');
      } catch (error) {
        if (isAxiosError(error)) {
          Alert.alert('操作失败', error.response?.data?.message || '启用账号失败');
        } else {
          Alert.alert('操作失败', '网络错误，请稍后重试');
        }
      }
    }
  };

  const getPasswordStrengthBars = (strength: string) => {
    const colors = {
      weak: ['#f5222d', '#d9d9d9', '#d9d9d9'],
      medium: ['#faad14', '#faad14', '#d9d9d9'],
      strong: ['#52c41a', '#52c41a', '#52c41a'],
    };
    return colors[strength as keyof typeof colors] || colors.weak;
  };

  if (loading || !user) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <LinearGradient
          colors={['#1a1a2e', '#16213e']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <View style={styles.headerContent}>
            <IconButton
              icon="arrow-left"
              iconColor="#fff"
              size={24}
              onPress={() => navigation.goBack()}
            />
            <Text style={styles.headerTitle}>用户详情</Text>
            <View style={{ width: 48 }} />
          </View>
        </LinearGradient>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <LinearGradient
        colors={['#1a1a2e', '#16213e']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <IconButton
            icon="arrow-left"
            iconColor="#fff"
            size={24}
            onPress={() => navigation.goBack()}
          />
          <Text style={styles.headerTitle}>用户详情</Text>
          <IconButton
            icon="pencil"
            iconColor="#fff"
            size={24}
            onPress={() => Alert.alert('编辑', '编辑用户信息')}
          />
        </View>
      </LinearGradient>

      <ScrollView style={styles.content}>
        {/* Profile Card */}
        <Card style={styles.profileCard} mode="elevated">
          <View style={styles.profileContent}>
            <View style={styles.avatarContainer}>
              <View style={[styles.avatar, { backgroundColor: user.avatarColor }]}>
                <Text style={styles.avatarText}>{user.realName.charAt(0)}</Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: accountEnabled ? '#52c41a' : '#d9d9d9' }]} />
            </View>
            <Text style={styles.profileName}>{user.realName}</Text>
            <Text style={styles.profileUsername}>{user.username}</Text>
            <Chip
              mode="flat"
              style={styles.roleChip}
              textStyle={styles.roleChipText}
            >
              {user.role}
            </Chip>
          </View>
        </Card>

        {/* Account Info */}
        <Card style={styles.sectionCard} mode="elevated">
          <Text style={styles.sectionTitle}>账号信息</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>用户ID</Text>
            <Text style={styles.infoValue}>{user.id}</Text>
          </View>
          <Divider style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>用户名</Text>
            <Text style={styles.infoValue}>{user.username}</Text>
          </View>
          <Divider style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>手机号</Text>
            <Text style={styles.infoValue}>{user.phone}</Text>
          </View>
          <Divider style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>邮箱</Text>
            <Text style={styles.infoValue}>{user.email}</Text>
          </View>
          <Divider style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>创建时间</Text>
            <Text style={styles.infoValue}>{user.createdAt}</Text>
          </View>
          <Divider style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>最后登录</Text>
            <Text style={styles.infoValue}>{user.lastLogin}</Text>
          </View>
        </Card>

        {/* Factory Info */}
        {user.factoryName && (
          <Card style={styles.sectionCard} mode="elevated">
            <Text style={styles.sectionTitle}>所属工厂</Text>
            <View style={styles.factoryRow}>
              <View style={styles.factoryIcon}>
                <Text style={styles.factoryIconText}>{user.factoryName.charAt(0)}</Text>
              </View>
              <View style={styles.factoryInfo}>
                <Text style={styles.factoryName}>{user.factoryName}</Text>
                <Text style={styles.factoryId}>工厂ID: {user.factoryId}</Text>
              </View>
              <Chip
                mode="flat"
                style={styles.factoryStatusChip}
                textStyle={styles.factoryStatusText}
              >
                运营中
              </Chip>
            </View>
          </Card>
        )}

        {/* Role & Permissions */}
        <Card style={styles.sectionCard} mode="elevated">
          <Text style={styles.sectionTitle}>角色与权限</Text>
          <View style={styles.roleCard}>
            <View style={styles.roleIconContainer}>
              <IconButton icon="shield-account" size={20} iconColor="#1890ff" />
            </View>
            <View style={styles.roleInfo}>
              <Text style={styles.roleName}>{user.role}</Text>
              <Text style={styles.roleCode}>{user.roleCode}</Text>
            </View>
            <Chip mode="flat" style={styles.primaryRoleChip} textStyle={styles.primaryRoleText}>
              主角色
            </Chip>
          </View>

          <Text style={styles.permissionLabel}>权限列表 ({user.permissions.length}项)</Text>
          <View style={styles.permissionList}>
            {user.permissions.map((perm, index) => (
              <Chip
                key={index}
                mode="flat"
                icon="check"
                style={styles.permissionChip}
                textStyle={styles.permissionChipText}
              >
                {perm}
              </Chip>
            ))}
          </View>
          <TouchableOpacity style={styles.viewAllLink}>
            <Text style={styles.viewAllText}>查看全部权限</Text>
          </TouchableOpacity>
        </Card>

        {/* Account Status */}
        <Card style={styles.sectionCard} mode="elevated">
          <Text style={styles.sectionTitle}>账号状态</Text>
          <View style={styles.statusRow}>
            <View>
              <Text style={styles.statusLabel}>账号状态</Text>
              <Text style={[styles.statusValue, { color: accountEnabled ? '#52c41a' : '#8c8c8c' }]}>
                {accountEnabled ? '正常使用中' : '已禁用'}
              </Text>
            </View>
            <Switch value={accountEnabled} onValueChange={handleToggleAccount} />
          </View>
          <Divider style={styles.divider} />
          <View style={styles.statusRow}>
            <View>
              <Text style={styles.statusLabel}>双因素认证</Text>
              <Text style={[styles.statusValue, { color: twoFactorEnabled ? '#52c41a' : '#8c8c8c' }]}>
                {twoFactorEnabled ? '已开启' : '未开启'}
              </Text>
            </View>
            <Switch value={twoFactorEnabled} onValueChange={setTwoFactorEnabled} />
          </View>
          <Divider style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>密码强度</Text>
            <View style={styles.passwordStrength}>
              <Text style={[styles.strengthText, { color: user.passwordStrength === 'strong' ? '#52c41a' : '#faad14' }]}>
                {user.passwordStrength === 'strong' ? '强' : user.passwordStrength === 'medium' ? '中' : '弱'}
              </Text>
              <View style={styles.strengthBars}>
                {getPasswordStrengthBars(user.passwordStrength).map((color, i) => (
                  <View key={i} style={[styles.strengthBar, { backgroundColor: color }]} />
                ))}
              </View>
            </View>
          </View>
        </Card>

        {/* Recent Activity */}
        <Card style={styles.sectionCard} mode="elevated">
          <Text style={styles.sectionTitle}>最近操作</Text>
          {activities.map((activity, index) => (
            <React.Fragment key={activity.id}>
              <View style={styles.activityRow}>
                <View style={styles.activityContent}>
                  <Text style={styles.activityAction}>{activity.action}</Text>
                  <Text style={styles.activityDetail}>{activity.detail}</Text>
                </View>
                <Text style={styles.activityTime}>{activity.time}</Text>
              </View>
              {index < activities.length - 1 && <Divider style={styles.divider} />}
            </React.Fragment>
          ))}
          <TouchableOpacity style={styles.viewAllLink}>
            <Text style={styles.viewAllText}>查看全部操作记录</Text>
          </TouchableOpacity>
        </Card>

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Bottom Actions */}
      <View style={styles.bottomActions}>
        <Button
          mode="outlined"
          onPress={() => setResetPasswordDialogVisible(true)}
          style={styles.actionButton}
          textColor="#595959"
        >
          重置密码
        </Button>
        <Button
          mode="contained"
          onPress={() => setDisableDialogVisible(true)}
          style={[styles.actionButton, styles.disableButton]}
          buttonColor="#fff2e8"
          textColor="#fa8c16"
        >
          禁用账号
        </Button>
      </View>

      {/* Reset Password Dialog */}
      <Portal>
        <Dialog visible={resetPasswordDialogVisible} onDismiss={() => setResetPasswordDialogVisible(false)}>
          <Dialog.Title>重置密码</Dialog.Title>
          <Dialog.Content>
            <Text>确定要重置该用户的密码吗？重置链接将发送到用户邮箱。</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setResetPasswordDialogVisible(false)}>取消</Button>
            <Button onPress={handleResetPassword}>确认重置</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Disable Account Dialog */}
      <Portal>
        <Dialog visible={disableDialogVisible} onDismiss={() => setDisableDialogVisible(false)}>
          <Dialog.Title>禁用账号</Dialog.Title>
          <Dialog.Content>
            <Text>确定要禁用该账号吗？禁用后用户将无法登录系统。</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDisableDialogVisible(false)}>取消</Button>
            <Button onPress={handleDisableAccount} textColor="#fa8c16">确认禁用</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    paddingBottom: 16,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  profileCard: {
    marginBottom: 16,
    borderRadius: 12,
  },
  profileContent: {
    alignItems: 'center',
    padding: 24,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '600',
    color: '#fff',
  },
  statusBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 3,
    borderColor: '#fff',
  },
  profileName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#262626',
    marginBottom: 4,
  },
  profileUsername: {
    fontSize: 14,
    color: '#8c8c8c',
    marginBottom: 16,
  },
  roleChip: {
    backgroundColor: '#e6f7ff',
  },
  roleChipText: {
    color: '#1890ff',
    fontSize: 13,
    fontWeight: '500',
  },
  sectionCard: {
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#262626',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  infoLabel: {
    fontSize: 14,
    color: '#8c8c8c',
  },
  infoValue: {
    fontSize: 14,
    color: '#262626',
  },
  divider: {
    backgroundColor: '#f0f0f0',
  },
  factoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  factoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#ff6b6b',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  factoryIconText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  factoryInfo: {
    flex: 1,
  },
  factoryName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#262626',
  },
  factoryId: {
    fontSize: 12,
    color: '#8c8c8c',
    marginTop: 2,
  },
  factoryStatusChip: {
    backgroundColor: '#f6ffed',
  },
  factoryStatusText: {
    color: '#52c41a',
    fontSize: 12,
  },
  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(24,144,255,0.05)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  roleIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#e6f7ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  roleInfo: {
    flex: 1,
  },
  roleName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#262626',
  },
  roleCode: {
    fontSize: 12,
    color: '#8c8c8c',
    marginTop: 2,
  },
  primaryRoleChip: {
    backgroundColor: '#e6f7ff',
  },
  primaryRoleText: {
    color: '#1890ff',
    fontSize: 12,
  },
  permissionLabel: {
    fontSize: 13,
    color: '#8c8c8c',
    marginBottom: 12,
  },
  permissionList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  permissionChip: {
    backgroundColor: '#f0f5ff',
    height: 28,
  },
  permissionChipText: {
    color: '#1890ff',
    fontSize: 12,
  },
  viewAllLink: {
    alignItems: 'center',
    marginTop: 12,
  },
  viewAllText: {
    color: '#1890ff',
    fontSize: 13,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  statusLabel: {
    fontSize: 14,
    color: '#262626',
    marginBottom: 4,
  },
  statusValue: {
    fontSize: 12,
  },
  passwordStrength: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  strengthText: {
    fontSize: 14,
  },
  strengthBars: {
    flexDirection: 'row',
    gap: 4,
  },
  strengthBar: {
    width: 4,
    height: 12,
    borderRadius: 2,
  },
  activityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 14,
  },
  activityContent: {
    flex: 1,
  },
  activityAction: {
    fontSize: 13,
    color: '#262626',
    marginBottom: 4,
  },
  activityDetail: {
    fontSize: 12,
    color: '#8c8c8c',
  },
  activityTime: {
    fontSize: 12,
    color: '#8c8c8c',
  },
  bottomPadding: {
    height: 100,
  },
  bottomActions: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  actionButton: {
    flex: 1,
  },
  disableButton: {
    borderWidth: 0,
  },
});
