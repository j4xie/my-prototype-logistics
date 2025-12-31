import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, Alert } from 'react-native';
import { Button, Card, Text, Divider, Chip } from 'react-native-paper';
import { pushNotificationService } from '../../services/pushNotificationService';
import { deviceAPI } from '../../services/api/deviceApiClient';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import { useAuthStore } from '../../store/authStore';

/**
 * 推送通知测试页面
 * 用于测试和调试推送通知功能
 */
export default function PushNotificationTestScreen() {
  const { user } = useAuthStore();
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [badgeCount, setBadgeCountState] = useState(0);
  const [isRegistered, setIsRegistered] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);

  const {
    registerDevice,
    unregisterDevice,
    clearAllNotifications,
    setBadgeCount,
    getBadgeCount,
  } = usePushNotifications({
    autoRegisterOnLogin: false,
    onNotificationReceived: (notification) => {
      console.log('收到通知:', notification);
      setNotifications((prev) => [notification, ...prev]);
      Alert.alert(
        notification.request.content.title || '通知',
        notification.request.content.body || ''
      );
    },
    onNotificationTapped: (response) => {
      console.log('点击通知:', response);
      Alert.alert('通知被点击', JSON.stringify(response.notification.request.content.data));
    },
  });

  useEffect(() => {
    loadPushToken();
    loadBadgeCount();
  }, []);

  const loadPushToken = async () => {
    try {
      const token = await pushNotificationService.getExpoPushToken();
      setPushToken(token);
    } catch (error) {
      console.error('获取 Push Token 失败', error);
    }
  };

  const loadBadgeCount = async () => {
    try {
      const count = await getBadgeCount();
      setBadgeCountState(count);
    } catch (error) {
      console.error('获取角标数量失败', error);
    }
  };

  const handleRegisterDevice = async () => {
    try {
      await registerDevice();
      setIsRegistered(true);
      Alert.alert('成功', '设备已注册');
    } catch (error: any) {
      Alert.alert('失败', error.message);
    }
  };

  const handleUnregisterDevice = async () => {
    try {
      await unregisterDevice();
      setIsRegistered(false);
      Alert.alert('成功', '设备已注销');
    } catch (error: any) {
      Alert.alert('失败', error.message);
    }
  };

  const handleTestNotification = async () => {
    try {
      // 调用后端测试接口
      const response = await fetch(
        `http://139.196.165.140:10010/api/mobile/${user?.factoryUser?.factoryId}/devices/test-notification`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${useAuthStore.getState().tokens?.accessToken}`,
          },
        }
      );

      if (response.ok) {
        Alert.alert('成功', '测试推送已发送，请检查通知栏');
      } else {
        const error = await response.text();
        Alert.alert('失败', error);
      }
    } catch (error: any) {
      Alert.alert('失败', error.message);
    }
  };

  const handleClearNotifications = async () => {
    try {
      await clearAllNotifications();
      setNotifications([]);
      Alert.alert('成功', '所有通知已清除');
    } catch (error: any) {
      Alert.alert('失败', error.message);
    }
  };

  const handleIncreaseBadge = async () => {
    try {
      const newCount = badgeCount + 1;
      await setBadgeCount(newCount);
      setBadgeCountState(newCount);
    } catch (error: any) {
      Alert.alert('失败', error.message);
    }
  };

  const handleResetBadge = async () => {
    try {
      await setBadgeCount(0);
      setBadgeCountState(0);
    } catch (error: any) {
      Alert.alert('失败', error.message);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Card style={styles.card}>
        <Card.Title title="推送通知测试" />
        <Card.Content>
          <Text variant="labelLarge">Push Token:</Text>
          <Text
            variant="bodySmall"
            style={styles.tokenText}
            selectable
          >
            {pushToken || '未获取'}
          </Text>

          <Divider style={styles.divider} />

          <Text variant="labelLarge">设备状态:</Text>
          <Chip
            icon={isRegistered ? 'check-circle' : 'circle-outline'}
            style={styles.chip}
          >
            {isRegistered ? '已注册' : '未注册'}
          </Chip>

          <Divider style={styles.divider} />

          <Text variant="labelLarge">应用角标: {badgeCount}</Text>
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Title title="设备管理" />
        <Card.Content>
          <Button
            mode="contained"
            onPress={handleRegisterDevice}
            style={styles.button}
            disabled={isRegistered}
          >
            注册设备
          </Button>

          <Button
            mode="outlined"
            onPress={handleUnregisterDevice}
            style={styles.button}
            disabled={!isRegistered}
          >
            注销设备
          </Button>
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Title title="推送测试" />
        <Card.Content>
          <Button
            mode="contained"
            onPress={handleTestNotification}
            style={styles.button}
            icon="send"
          >
            发送测试推送
          </Button>

          <Button
            mode="outlined"
            onPress={handleClearNotifications}
            style={styles.button}
            icon="delete"
          >
            清除所有通知
          </Button>
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Title title="角标管理" />
        <Card.Content>
          <Button
            mode="contained"
            onPress={handleIncreaseBadge}
            style={styles.button}
            icon="plus"
          >
            增加角标 (+1)
          </Button>

          <Button
            mode="outlined"
            onPress={handleResetBadge}
            style={styles.button}
            icon="refresh"
          >
            重置角标
          </Button>
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Title title="通知历史" subtitle={`共 ${notifications.length} 条`} />
        <Card.Content>
          {notifications.length === 0 ? (
            <Text variant="bodySmall" style={styles.emptyText}>
              暂无通知
            </Text>
          ) : (
            notifications.map((notification, index) => (
              <View key={index} style={styles.notificationItem}>
                <Text variant="labelMedium">
                  {notification.request.content.title}
                </Text>
                <Text variant="bodySmall" style={styles.notificationBody}>
                  {notification.request.content.body}
                </Text>
                <Text variant="bodySmall" style={styles.notificationTime}>
                  {new Date(notification.date).toLocaleString()}
                </Text>
                <Divider style={styles.notificationDivider} />
              </View>
            ))
          )}
        </Card.Content>
      </Card>

      <View style={styles.footer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  card: {
    margin: 16,
    marginBottom: 8,
  },
  tokenText: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
    fontFamily: 'monospace',
  },
  divider: {
    marginVertical: 16,
  },
  chip: {
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  button: {
    marginTop: 12,
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    marginVertical: 16,
  },
  notificationItem: {
    marginBottom: 12,
  },
  notificationBody: {
    marginTop: 4,
    color: '#666',
  },
  notificationTime: {
    marginTop: 4,
    color: '#999',
    fontSize: 11,
  },
  notificationDivider: {
    marginTop: 8,
  },
  footer: {
    height: 32,
  },
});
