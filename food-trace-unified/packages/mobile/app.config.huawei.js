import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "食品溯源-华为版",
  slug: "food-trace-huawei",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "light",
  splash: {
    image: "./assets/splash.png",
    resizeMode: "contain",
    backgroundColor: "#ffffff"
  },
  assetBundlePatterns: [
    "**/*"
  ],
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.foodtrace.huawei",
    buildNumber: "1"
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#FFFFFF"
    },
    package: "com.foodtrace.huawei",
    versionCode: 1,
    // 华为特定配置
    googleServicesFile: false, // 禁用Google服务
    permissions: [
      "android.permission.CAMERA",
      "android.permission.RECORD_AUDIO",
      "android.permission.ACCESS_FINE_LOCATION",
      "android.permission.ACCESS_COARSE_LOCATION",
      "android.permission.WRITE_EXTERNAL_STORAGE",
      "android.permission.READ_EXTERNAL_STORAGE",
      "com.huawei.appmarket.service.commondata.permission.GET_COMMON_DATA",
      "com.huawei.android.launcher.permission.CHANGE_BADGE"
    ]
  },
  web: {
    favicon: "./assets/favicon.png"
  },
  plugins: [
    "expo-router",
    [
      "expo-camera",
      {
        cameraPermission: "允许应用访问相机以扫描二维码和拍摄照片。"
      }
    ],
    [
      "expo-location",
      {
        locationAlwaysAndWhenInUsePermission: "允许应用访问位置信息以提供基于位置的服务。"
      }
    ],
    // 华为HMS插件配置
    [
      "@react-native-async-storage/async-storage",
      {
        "exclude": ["expo-sqlite"]
      }
    ]
  ],
  experiments: {
    typedRoutes: true
  },
  extra: {
    // 华为特定环境变量
    targetPlatform: "huawei",
    hmsConfig: {
      appId: process.env.HUAWEI_APP_ID || "102345678",
      clientId: process.env.HUAWEI_CLIENT_ID || "102345678",
      clientSecret: process.env.HUAWEI_CLIENT_SECRET,
      agConnectConfig: "./agconnect-services.json"
    },
    apiUrl: process.env.EXPO_PUBLIC_API_URL || "https://api.food-trace.com",
    enableHMS: true,
    enableGoogleServices: false,
    eas: {
      projectId: process.env.EAS_PROJECT_ID || "your-eas-project-id"
    }
  }
});