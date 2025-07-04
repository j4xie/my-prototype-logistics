export default {
  expo: {
    name: "食品溯源系统",
    slug: "food-trace-mobile",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "automatic",
    scheme: "food-trace",
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
      bundleIdentifier: "com.foodtrace.mobile",
      buildNumber: "1.0.0",
      infoPlist: {
        NSCameraUsageDescription: "需要访问相机以扫描二维码和拍摄产品照片",
        NSLocationWhenInUseUsageDescription: "需要位置权限来记录产品位置信息",
        NSPhotoLibraryUsageDescription: "需要访问相册以选择产品图片"
      }
    },
    android: {
      applicationId: "com.foodtrace.mobile",
      versionCode: 1,
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff"
      },
      permissions: [
        "android.permission.CAMERA",
        "android.permission.ACCESS_FINE_LOCATION",
        "android.permission.ACCESS_COARSE_LOCATION",
        "android.permission.READ_EXTERNAL_STORAGE",
        "android.permission.WRITE_EXTERNAL_STORAGE"
      ]
    },
    web: {
      bundler: "metro",
      output: "static",
      favicon: "./assets/favicon.png"
    },
    plugins: [
      "expo-router",
      [
        "expo-splash-screen",
        {
          backgroundColor: "#ffffff",
          image: "./assets/splash.png",
          imageWidth: 200
        }
      ],
      [
        "expo-notifications",
        {
          icon: "./assets/notification-icon.png",
          color: "#ffffff"
        }
      ],
      [
        "expo-camera",
        {
          cameraPermission: "需要访问相机以扫描二维码和拍摄产品照片"
        }
      ],
      [
        "expo-location",
        {
          locationAlwaysAndWhenInUsePermission: "需要位置权限来记录产品位置信息"
        }
      ]
    ],
    experiments: {
      typedRoutes: true
    },
    extra: {
      router: {
        origin: false
      },
      eas: {
        projectId: "food-trace-project"
      }
    }
  }
};