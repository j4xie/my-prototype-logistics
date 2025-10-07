/**
 * 清除 AsyncStorage 缓存脚本
 * 用于清除旧的用户数据缓存
 */

const AsyncStorage = require('@react-native-async-storage/async-storage').default;

async function clearCache() {
  try {
    console.log('🧹 Clearing AsyncStorage cache...');

    // 清除认证相关的缓存
    await AsyncStorage.removeItem('auth-storage');
    await AsyncStorage.removeItem('user-credentials');
    await AsyncStorage.removeItem('biometric-enabled');

    console.log('✅ Cache cleared successfully!');
    console.log('💡 Please restart the app and login again.');
  } catch (error) {
    console.error('❌ Failed to clear cache:', error);
  }
}

clearCache();
