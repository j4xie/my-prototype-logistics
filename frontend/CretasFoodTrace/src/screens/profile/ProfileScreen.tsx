import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { Text, Avatar, List, Divider, Portal, Dialog, TextInput, HelperText, ActivityIndicator } from 'react-native-paper';
import { useAuthStore } from '../../store/authStore';
import { useNavigation } from '@react-navigation/native';
import { userApiClient } from '../../services/api/userApiClient';
import { NeoCard, NeoButton, ScreenWrapper, StatusBadge } from '../../components/ui';
import { theme } from '../../theme';

export default function ProfileScreen() {
  const { user, logout } = useAuthStore();
  const navigation = useNavigation();

  const [passwordDialogVisible, setPasswordDialogVisible] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [showPasswords, setShowPasswords] = useState({ old: false, new: false, confirm: false });

  const validatePassword = () => {
    if (!oldPassword || !newPassword || !confirmPassword) return { valid: false, message: '请填写所有字段' };
    if (newPassword.length < 6) return { valid: false, message: '新密码至少6位' };
    if (newPassword === oldPassword) return { valid: false, message: '新密码不能与旧密码相同' };
    if (newPassword !== confirmPassword) return { valid: false, message: '两次密码不一致' };
    if (!(/[A-Za-z]/.test(newPassword) && /[0-9]/.test(newPassword))) return { valid: false, message: '需包含字母和数字' };
    return { valid: true };
  };

  const handleChangePassword = async () => {
    const validation = validatePassword();
    if (!validation.valid) return Alert.alert('验证失败', validation.message);

    try {
      setChangingPassword(true);
      const userId = user?.id;
      if (!userId) throw new Error('用户ID不存在');
      
      await userApiClient.changePassword(typeof userId === 'string' ? parseInt(userId, 10) : userId, { oldPassword, newPassword });

      setOldPassword(''); setNewPassword(''); setConfirmPassword('');
      setPasswordDialogVisible(false);
      Alert.alert('成功', '密码已修改，请使用新密码登录');
    } catch (error) {
      handleError(error, {
        title: '修改密码失败',
        customMessage: '请检查旧密码是否正确',
      });
    } finally {
      setChangingPassword(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('退出登录', '确定要退出吗？', [
      { text: '取消', style: 'cancel' },
      { text: '退出', style: 'destructive', onPress: async () => { await logout(); } }
    ]);
  };

  const displayName = user?.fullName || user?.username || '未知用户';
  const roleCode = user?.userType === 'platform' ? user?.platformUser?.role : (user?.factoryUser?.roleCode || user?.roleCode);
  const isPlatformAdmin = user?.userType === 'platform';

  const getRoleName = (role: string | undefined) => {
    const roleMap: Record<string, string> = {
      'developer': '系统开发者', 'platform_admin': '平台管理员', 'factory_super_admin': '工厂超级管理员',
      'permission_admin': '权限管理员', 'operator': '操作员', 'viewer': '查看者'
    };
    return roleMap[role || ''] || role || '未知角色';
  };

  return (
    <ScreenWrapper edges={['top']} backgroundColor={theme.colors.background}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
            <Text style={styles.headerTitle}>个人中心</Text>
        </View>

        {/* Profile Card */}
        <NeoCard style={styles.profileCard} padding="l">
            <View style={styles.profileHeader}>
                <Avatar.Text size={72} label={displayName.substring(0, 2)} style={styles.avatar} labelStyle={styles.avatarLabel} />
                <View style={styles.profileInfo}>
                    <Text style={styles.displayName}>{displayName}</Text>
                    <Text style={styles.username}>@{user?.username}</Text>
                    <View style={styles.badges}>
                        <StatusBadge status={isPlatformAdmin ? '平台管理员' : '工厂用户'} variant={isPlatformAdmin ? 'info' : 'success'} />
                        <StatusBadge status={getRoleName(roleCode)} variant="warning" />
                    </View>
                </View>
            </View>
        </NeoCard>

        {/* Info Sections */}
        <NeoCard style={styles.card} padding="m">
            <Text style={styles.sectionTitle}>账号信息</Text>
            <View style={styles.infoRow}>
                <List.Icon icon="account-outline" color={theme.colors.textSecondary} />
                <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>用户名</Text>
                    <Text style={styles.infoValue}>{user?.username}</Text>
                </View>
            </View>
            <Divider style={styles.divider} />
            <View style={styles.infoRow}>
                <List.Icon icon="email-outline" color={theme.colors.textSecondary} />
                <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>邮箱</Text>
                    <Text style={styles.infoValue}>{user?.email || '未设置'}</Text>
                </View>
            </View>
            <Divider style={styles.divider} />
            <View style={styles.infoRow}>
                <List.Icon icon="phone-outline" color={theme.colors.textSecondary} />
                <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>手机号</Text>
                    <Text style={styles.infoValue}>{user?.phone || '未设置'}</Text>
                </View>
            </View>
        </NeoCard>

        {/* Settings */}
        <NeoCard style={styles.card} padding="m">
            <Text style={styles.sectionTitle}>更多功能</Text>
            <TouchableOpacity style={styles.settingItem} onPress={() => setPasswordDialogVisible(true)}>
                <View style={styles.settingLeft}>
                    <List.Icon icon="lock-reset" color={theme.colors.primary} />
                    <Text style={styles.settingText}>修改密码</Text>
                </View>
                <List.Icon icon="chevron-right" color={theme.colors.textTertiary} />
            </TouchableOpacity>
            <Divider style={styles.divider} />
            <TouchableOpacity style={styles.settingItem} onPress={() => navigation.navigate('Feedback')}>
                <View style={styles.settingLeft}>
                    <List.Icon icon="message-alert-outline" color={theme.colors.primary} />
                    <Text style={styles.settingText}>意见反馈</Text>
                </View>
                <List.Icon icon="chevron-right" color={theme.colors.textTertiary} />
            </TouchableOpacity>
        </NeoCard>

        <NeoButton variant="danger" onPress={handleLogout} style={styles.logoutButton} icon="logout">退出登录</NeoButton>

      </ScrollView>

      {/* Password Dialog */}
      <Portal>
        <Dialog visible={passwordDialogVisible} onDismiss={() => !changingPassword && setPasswordDialogVisible(false)} style={styles.dialog}>
            <Dialog.Title>修改密码</Dialog.Title>
            <Dialog.Content>
                <TextInput label="旧密码" value={oldPassword} onChangeText={setOldPassword} secureTextEntry={!showPasswords.old} 
                    right={<TextInput.Icon icon={showPasswords.old ? "eye-off" : "eye"} onPress={() => setShowPasswords({...showPasswords, old: !showPasswords.old})} />} 
                    mode="outlined" style={styles.input} />
                <TextInput label="新密码" value={newPassword} onChangeText={setNewPassword} secureTextEntry={!showPasswords.new}
                    right={<TextInput.Icon icon={showPasswords.new ? "eye-off" : "eye"} onPress={() => setShowPasswords({...showPasswords, new: !showPasswords.new})} />}
                    mode="outlined" style={styles.input} />
                <TextInput label="确认新密码" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry={!showPasswords.confirm}
                    right={<TextInput.Icon icon={showPasswords.confirm ? "eye-off" : "eye"} onPress={() => setShowPasswords({...showPasswords, confirm: !showPasswords.confirm})} />}
                    mode="outlined" style={styles.input} />
            </Dialog.Content>
            <Dialog.Actions>
                <NeoButton variant="ghost" onPress={() => setPasswordDialogVisible(false)} disabled={changingPassword}>取消</NeoButton>
                <NeoButton variant="primary" onPress={handleChangePassword} loading={changingPassword}>确认修改</NeoButton>
            </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 40 },
  header: { paddingVertical: 16 },
  headerTitle: { fontSize: 28, fontWeight: '700', color: theme.colors.text },
  profileCard: { marginBottom: 16 },
  profileHeader: { flexDirection: 'row', alignItems: 'center' },
  avatar: { backgroundColor: theme.colors.primary },
  avatarLabel: { fontSize: 24, color: 'white' },
  profileInfo: { marginLeft: 16, flex: 1 },
  displayName: { fontSize: 20, fontWeight: '600', color: theme.colors.text },
  username: { fontSize: 14, color: theme.colors.textSecondary, marginBottom: 8 },
  badges: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  card: { marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12, color: theme.colors.text },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  infoContent: { marginLeft: 8 },
  infoLabel: { fontSize: 12, color: theme.colors.textSecondary },
  infoValue: { fontSize: 16, color: theme.colors.text },
  divider: { marginVertical: 8 },
  settingItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  settingLeft: { flexDirection: 'row', alignItems: 'center' },
  settingText: { fontSize: 16, color: theme.colors.text, marginLeft: 8 },
  logoutButton: { marginTop: 16 },
  dialog: { backgroundColor: 'white', borderRadius: 12 },
  input: { marginBottom: 12, backgroundColor: 'white' },
});
