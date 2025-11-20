import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import {
  Text,
  Card,
  List,
  Divider,
  Button,
  Avatar,
  Chip,
  Appbar,
  Dialog,
  Portal,
  TextInput,
  HelperText,
  ActivityIndicator,
} from 'react-native-paper';
import { useAuthStore } from '../../store/authStore';
import { useNavigation } from '@react-navigation/native';
import { userApiClient } from '../../services/api/userApiClient';

/**
 * 个人中心页面
 */
export default function ProfileScreen() {
  const { user, logout } = useAuthStore();
  const navigation = useNavigation();

  // Password change state
  const [passwordDialogVisible, setPasswordDialogVisible] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [oldPasswordVisible, setOldPasswordVisible] = useState(false);
  const [newPasswordVisible, setNewPasswordVisible] = useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);

  // Password validation
  const validatePassword = (): { valid: boolean; message?: string } => {
    if (!oldPassword || !newPassword || !confirmPassword) {
      return { valid: false, message: '请填写所有密码字段' };
    }

    if (newPassword.length < 6) {
      return { valid: false, message: '新密码长度至少为6位' };
    }

    if (newPassword === oldPassword) {
      return { valid: false, message: '新密码不能与旧密码相同' };
    }

    if (newPassword !== confirmPassword) {
      return { valid: false, message: '两次输入的新密码不一致' };
    }

    // 密码强度验证（可选）
    const hasUpperCase = /[A-Z]/.test(newPassword);
    const hasLowerCase = /[a-z]/.test(newPassword);
    const hasNumber = /[0-9]/.test(newPassword);

    if (!(hasUpperCase || hasLowerCase) || !hasNumber) {
      return {
        valid: false,
        message: '新密码必须包含字母和数字'
      };
    }

    return { valid: true };
  };

  const handleChangePassword = async () => {
    const validation = validatePassword();
    if (!validation.valid) {
      Alert.alert('验证失败', validation.message);
      return;
    }

    try {
      setChangingPassword(true);
      console.log('📤 Submitting password change request...');

      // Get user ID
      const userId = user?.id;
      if (!userId) {
        throw new Error('用户ID不存在');
      }

      // Call API
      await userApiClient.changePassword(
        typeof userId === 'string' ? parseInt(userId, 10) : userId,
        {
          oldPassword,
          newPassword,
        }
      );

      console.log('✅ Password changed successfully');

      // Reset form
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordDialogVisible(false);

      // Show success message
      Alert.alert(
        '修改成功',
        '密码已成功修改，下次登录请使用新密码。',
        [{ text: '确定' }]
      );
    } catch (error: any) {
      console.error('❌ Failed to change password:', error);

      const errorMessage = error.response?.data?.message || error.message || '修改密码失败，请检查旧密码是否正确';

      Alert.alert('修改失败', errorMessage);
    } finally {
      setChangingPassword(false);
    }
  };

  const openPasswordDialog = () => {
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordDialogVisible(true);
  };

  const closePasswordDialog = () => {
    if (changingPassword) {
      return; // 正在提交时不允许关闭
    }
    setPasswordDialogVisible(false);
  };

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

        {/* 更多功能 - Phase 3 P2 */}
        <Card style={styles.card}>
          <Card.Title title="更多功能" />
          <Card.Content>
            <List.Item
              title="修改密码"
              description="修改您的登录密码"
              left={props => <List.Icon {...props} icon="lock-reset" />}
              right={props => <List.Icon {...props} icon="chevron-right" />}
              onPress={openPasswordDialog}
            />
            <Divider />
            <List.Item
              title="数据导出"
              description="导出生产、成本、工时报表"
              left={props => <List.Icon {...props} icon="file-download" />}
              right={props => <List.Icon {...props} icon="chevron-right" />}
              onPress={() => navigation.navigate('DataExport', { reportType: 'production' })}
            />
            <Divider />
            <List.Item
              title="工厂设置"
              description="工厂信息、工作时间等设置"
              left={props => <List.Icon {...props} icon="cog" />}
              right={props => <List.Icon {...props} icon="chevron-right" />}
              onPress={() => navigation.navigate('ManagementTab', {
                screen: 'FactorySettings'
              })}
            />
            <Divider />
            <List.Item
              title="意见反馈"
              description="提交问题反馈或功能建议"
              left={props => <List.Icon {...props} icon="message-alert" />}
              right={props => <List.Icon {...props} icon="chevron-right" />}
              onPress={() => navigation.navigate('Feedback')}
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

      {/* Password Change Dialog */}
      <Portal>
        <Dialog
          visible={passwordDialogVisible}
          onDismiss={closePasswordDialog}
          style={styles.dialog}
        >
          <Dialog.Title>修改密码</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={styles.dialogDescription}>
              请输入旧密码和新密码，新密码长度至少6位，且必须包含字母和数字。
            </Text>

            {/* Old Password */}
            <TextInput
              label="旧密码"
              value={oldPassword}
              onChangeText={setOldPassword}
              secureTextEntry={!oldPasswordVisible}
              right={
                <TextInput.Icon
                  icon={oldPasswordVisible ? 'eye-off' : 'eye'}
                  onPress={() => setOldPasswordVisible(!oldPasswordVisible)}
                />
              }
              mode="outlined"
              style={styles.passwordInput}
              disabled={changingPassword}
              autoCapitalize="none"
            />

            {/* New Password */}
            <TextInput
              label="新密码"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry={!newPasswordVisible}
              right={
                <TextInput.Icon
                  icon={newPasswordVisible ? 'eye-off' : 'eye'}
                  onPress={() => setNewPasswordVisible(!newPasswordVisible)}
                />
              }
              mode="outlined"
              style={styles.passwordInput}
              disabled={changingPassword}
              autoCapitalize="none"
            />
            <HelperText type="info" visible={newPassword.length > 0}>
              密码强度: {newPassword.length < 6
                ? '弱'
                : /[A-Za-z]/.test(newPassword) && /[0-9]/.test(newPassword)
                ? '强'
                : '中'}
            </HelperText>

            {/* Confirm Password */}
            <TextInput
              label="确认新密码"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!confirmPasswordVisible}
              right={
                <TextInput.Icon
                  icon={confirmPasswordVisible ? 'eye-off' : 'eye'}
                  onPress={() => setConfirmPasswordVisible(!confirmPasswordVisible)}
                />
              }
              mode="outlined"
              style={styles.passwordInput}
              disabled={changingPassword}
              autoCapitalize="none"
            />
            {confirmPassword.length > 0 && (
              <HelperText
                type={newPassword === confirmPassword ? 'info' : 'error'}
                visible={true}
              >
                {newPassword === confirmPassword ? '✓ 密码一致' : '✗ 密码不一致'}
              </HelperText>
            )}

            {changingPassword && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" />
                <Text style={styles.loadingText}>正在修改密码...</Text>
              </View>
            )}
          </Dialog.Content>

          <Dialog.Actions>
            <Button onPress={closePasswordDialog} disabled={changingPassword}>
              取消
            </Button>
            <Button
              onPress={handleChangePassword}
              disabled={changingPassword || !oldPassword || !newPassword || !confirmPassword}
              mode="contained"
            >
              确认修改
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
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
  dialog: {
    maxWidth: 500,
    alignSelf: 'center',
    width: '90%',
  },
  dialogDescription: {
    marginBottom: 16,
    color: '#666',
    lineHeight: 20,
  },
  passwordInput: {
    marginTop: 8,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    padding: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
  },
  loadingText: {
    marginLeft: 12,
    color: '#666',
  },
});
