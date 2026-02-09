import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export class StorageService {
  // 普通存储 (AsyncStorage)
  static async setItem(key: string, value: string | null): Promise<void> {
    // 如果值为null或undefined，删除该key而不是保存null
    if (value === null || value === undefined) {
      await this.removeItem(key);
      return;
    }
    await AsyncStorage.setItem(key, value);
  }

  static async getItem(key: string): Promise<string | null> {
    return await AsyncStorage.getItem(key);
  }

  static async removeItem(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
  }

  static async setObject(key: string, value: any): Promise<void> {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  }

  static async getObject<T>(key: string): Promise<T | null> {
    const value = await AsyncStorage.getItem(key);
    return value ? JSON.parse(value) : null;
  }

  // 安全存储 (SecureStore) - 用于敏感数据
  // Web平台回退到AsyncStorage (SecureStore是原生模块，Web上不可用)
  static async setSecureItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      await AsyncStorage.setItem(key, value);
    } else {
      await SecureStore.setItemAsync(key, value);
    }
  }

  static async getSecureItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      return await AsyncStorage.getItem(key);
    }
    return await SecureStore.getItemAsync(key);
  }

  static async removeSecureItem(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      await AsyncStorage.removeItem(key);
    } else {
      await SecureStore.deleteItemAsync(key);
    }
  }

  // 清理所有存储
  static async clear(): Promise<void> {
    await AsyncStorage.clear();
    // 注意：SecureStore 没有清除所有的方法，需要逐个删除
  }

  // 获取所有普通存储的key
  static async getAllKeys(): Promise<readonly string[]> {
    return await AsyncStorage.getAllKeys();
  }

  // 认证相关便捷方法
  
  // Token管理
  static async setAuthTokens(accessToken: string, refreshToken: string, expiresIn?: number): Promise<void> {
    await Promise.all([
      this.setSecureItem('access_token', accessToken),
      this.setSecureItem('refresh_token', refreshToken),
      ...(expiresIn ? [this.setItem('token_expires_at', (Date.now() + expiresIn * 1000).toString())] : [])
    ]);
  }

  static async getAuthTokens(): Promise<{ accessToken: string | null; refreshToken: string | null }> {
    const [accessToken, refreshToken] = await Promise.all([
      this.getSecureItem('access_token'),
      this.getSecureItem('refresh_token')
    ]);
    
    return { accessToken, refreshToken };
  }

  static async clearAuthTokens(): Promise<void> {
    await Promise.all([
      this.removeSecureItem('access_token'),
      this.removeSecureItem('refresh_token'),
      this.removeSecureItem('temp_token'),
      this.removeItem('token_expires_at'),
      this.removeItem('user_info'),
      this.removeItem('user_role')
    ]);
  }

  // 用户信息管理
  static async setUserInfo(user: any): Promise<void> {
    await this.setObject('user_info', user);
    if (user.role) {
      await this.setItem('user_role', user.role);
    }
  }

  static async getUserInfo<T>(): Promise<T | null> {
    return await this.getObject<T>('user_info');
  }

  // 设备绑定管理
  static async setDeviceBinding(deviceId: string, deviceToken: string): Promise<void> {
    await Promise.all([
      this.setSecureItem('device_id', deviceId),
      this.setSecureItem('device_token', deviceToken),
      this.setItem('device_bound', 'true'),
      this.setItem('device_bound_at', new Date().toISOString())
    ]);
  }

  static async getDeviceBinding(): Promise<{ deviceId: string | null; deviceToken: string | null; isBound: boolean }> {
    const [deviceId, deviceToken, isBound] = await Promise.all([
      this.getSecureItem('device_id'),
      this.getSecureItem('device_token'),
      this.getItem('device_bound')
    ]);

    return {
      deviceId,
      deviceToken,
      isBound: isBound === 'true'
    };
  }

  static async clearDeviceBinding(): Promise<void> {
    await Promise.all([
      this.removeSecureItem('device_id'),
      this.removeSecureItem('device_token'),
      this.removeItem('device_bound'),
      this.removeItem('device_bound_at')
    ]);
  }

  // 生物识别设置
  static async setBiometricEnabled(enabled: boolean): Promise<void> {
    await this.setItem('biometric_enabled', enabled.toString());
  }

  static async isBiometricEnabled(): Promise<boolean> {
    const enabled = await this.getItem('biometric_enabled');
    return enabled === 'true';
  }

  // 离线数据管理
  static async setOfflineData(key: string, data: any, timestamp?: number): Promise<void> {
    const offlineItem = {
      data,
      timestamp: timestamp || Date.now(),
      synced: false
    };
    await this.setObject(`offline_${key}`, offlineItem);
  }

  static async getOfflineData<T>(key: string): Promise<{ data: T; timestamp: number; synced: boolean } | null> {
    return await this.getObject<{ data: T; timestamp: number; synced: boolean }>(`offline_${key}`);
  }

  static async markOfflineDataSynced(key: string): Promise<void> {
    const item = await this.getOfflineData(key);
    if (item) {
      item.synced = true;
      await this.setObject(`offline_${key}`, item);
    }
  }

  // 获取所有未同步的离线数据
  static async getPendingOfflineData(): Promise<string[]> {
    const allKeys = await this.getAllKeys();
    const offlineKeys: string[] = [];

    for (const key of allKeys) {
      if (key.startsWith('offline_')) {
        const item = await this.getOfflineData(key.replace('offline_', ''));
        if (item && !item.synced) {
          offlineKeys.push(key.replace('offline_', ''));
        }
      }
    }

    return offlineKeys;
  }
}