module.exports = ({ config }) => {
  // 从环境变量读取环境配置，默认为 test
  const env = process.env.EXPO_PUBLIC_ENV || 'test';

  return {
    ...config,
    name: 'CretasFoodTrace',
    slug: 'CretasFoodTrace',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    newArchEnabled: false,
    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.cretas.foodtrace',
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#ffffff',
      },
      edgeToEdgeEnabled: true,
      package: 'com.cretas.foodtrace',
    },
    web: {
      favicon: './assets/favicon.png',
      bundler: 'metro',
    },
    plugins: ['expo-secure-store'],
    extra: {
      // 将环境变量传递给应用
      env: env,
    },
  };
};
