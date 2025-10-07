import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Card, Icon } from 'react-native-paper';
import { useAuthStore } from '../store/authStore';
import { hasPermission } from '../utils/navigationHelper';

interface PermissionGuardProps {
  requiredPermissions?: string[];
  requireAll?: boolean;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * 权限守卫组件
 * 根据用户权限决定是否显示子组件
 *
 * @param requiredPermissions 需要的权限列表
 * @param requireAll 是否需要所有权限 (默认false,只要有一个权限即可)
 * @param fallback 无权限时显示的内容
 * @param children 有权限时显示的内容
 */
export const PermissionGuard: React.FC<PermissionGuardProps> = ({
  requiredPermissions = [],
  requireAll = false,
  fallback,
  children,
}) => {
  const { user } = useAuthStore();

  // 如果没有指定权限要求,直接显示子组件
  if (requiredPermissions.length === 0) {
    return <>{children}</>;
  }

  // 如果用户未登录,显示fallback或null
  if (!user) {
    return <>{fallback || null}</>;
  }

  // 检查权限
  const checkPermissions = (): boolean => {
    if (requireAll) {
      // 需要所有权限
      return requiredPermissions.every(perm => hasPermission(user, perm));
    } else {
      // 只需要其中一个权限
      return requiredPermissions.some(perm => hasPermission(user, perm));
    }
  };

  const hasRequiredPermission = checkPermissions();

  if (!hasRequiredPermission) {
    // 无权限,显示fallback或默认提示
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <View style={styles.container}>
        <Card style={styles.card} mode="elevated">
          <Card.Content style={styles.content}>
            <Icon source="lock" size={48} color="#BDBDBD" />
            <Text variant="titleMedium" style={styles.title}>无权访问</Text>
            <Text variant="bodyMedium" style={styles.message}>
              您没有权限访问此功能
            </Text>
          </Card.Content>
        </Card>
      </View>
    );
  }

  // 有权限,显示子组件
  return <>{children}</>;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 400,
  },
  content: {
    alignItems: 'center',
    padding: 24,
  },
  title: {
    marginTop: 16,
    color: '#757575',
  },
  message: {
    marginTop: 8,
    color: '#9E9E9E',
    textAlign: 'center',
  },
});

export default PermissionGuard;
