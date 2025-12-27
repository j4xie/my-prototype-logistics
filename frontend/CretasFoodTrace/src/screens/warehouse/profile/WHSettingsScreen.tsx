/**
 * 设置页面
 * 对应原型: warehouse/settings.html
 */

import React, { useState } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from "react-native";
import { Text, Switch, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { WHProfileStackParamList } from "../../../types/navigation";

type NavigationProp = NativeStackNavigationProp<WHProfileStackParamList>;

interface SettingItem {
  id: string;
  icon: string;
  title: string;
  description?: string;
  type: "toggle" | "link";
  value?: boolean;
}

export function WHSettingsScreen() {
  const theme = useTheme();
  const navigation = useNavigation<NavigationProp>();

  const [notifications, setNotifications] = useState({
    inbound: true,
    outbound: true,
    expire: true,
    temperature: true,
    inventory: true,
  });

  const [scanSettings, setScanSettings] = useState({
    sound: true,
    vibrate: true,
    continuous: false,
  });

  const [offlineMode, setOfflineMode] = useState(true);

  const handleClearCache = () => {
    Alert.alert("清除缓存", "确定要清除缓存吗？", [
      { text: "取消", style: "cancel" },
      {
        text: "确定",
        onPress: () => Alert.alert("成功", "缓存已清除"),
      },
    ]);
  };

  const handleThemeSelect = () => {
    Alert.alert("深色模式", "选择主题", [
      { text: "跟随系统", onPress: () => {} },
      { text: "浅色模式", onPress: () => {} },
      { text: "深色模式", onPress: () => {} },
    ]);
  };

  const handleFontSize = () => {
    Alert.alert("字体大小", "选择字体大小", [
      { text: "小", onPress: () => {} },
      { text: "标准", onPress: () => {} },
      { text: "大", onPress: () => {} },
    ]);
  };

  const handleLanguage = () => {
    Alert.alert("语言", "选择语言", [
      { text: "简体中文", onPress: () => {} },
      { text: "English", onPress: () => {} },
    ]);
  };

  const handleCheckUpdate = () => {
    Alert.alert("检查更新", "当前已是最新版本 v1.0.0");
  };

  const handlePrivacyPolicy = () => {
    Alert.alert("隐私政策", "查看隐私政策");
  };

  const handleUserAgreement = () => {
    Alert.alert("用户协议", "查看用户协议");
  };

  const renderSettingToggle = (
    icon: string,
    title: string,
    description: string,
    value: boolean,
    onValueChange: (value: boolean) => void
  ) => (
    <View style={styles.settingItem}>
      <View style={styles.settingInfo}>
        <View style={styles.settingIconContainer}>
          <MaterialCommunityIcons name={icon as any} size={20} color="#666" />
        </View>
        <View style={styles.settingText}>
          <Text style={styles.settingTitle}>{title}</Text>
          <Text style={styles.settingDesc}>{description}</Text>
        </View>
      </View>
      <Switch value={value} onValueChange={onValueChange} color="#4CAF50" />
    </View>
  );

  const renderSettingLink = (
    icon: string,
    title: string,
    description: string,
    onPress: () => void
  ) => (
    <TouchableOpacity style={styles.settingItem} onPress={onPress}>
      <View style={styles.settingInfo}>
        <View style={styles.settingIconContainer}>
          <MaterialCommunityIcons name={icon as any} size={20} color="#666" />
        </View>
        <View style={styles.settingText}>
          <Text style={styles.settingTitle}>{title}</Text>
          {description && <Text style={styles.settingDesc}>{description}</Text>}
        </View>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={20} color="#999" />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>设置</Text>
          <Text style={styles.headerSubtitle}>应用设置</Text>
        </View>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* 通知设置 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>通知设置</Text>

          {renderSettingToggle(
            "package-down",
            "入库提醒",
            "新入库单到达时通知",
            notifications.inbound,
            (value) => setNotifications({ ...notifications, inbound: value })
          )}

          {renderSettingToggle(
            "package-up",
            "出库提醒",
            "新出库订单到达时通知",
            notifications.outbound,
            (value) => setNotifications({ ...notifications, outbound: value })
          )}

          {renderSettingToggle(
            "alert-circle-outline",
            "过期预警",
            "物料即将过期时通知",
            notifications.expire,
            (value) => setNotifications({ ...notifications, expire: value })
          )}

          {renderSettingToggle(
            "thermometer-alert",
            "温控告警",
            "温度异常时通知",
            notifications.temperature,
            (value) => setNotifications({ ...notifications, temperature: value })
          )}

          {renderSettingToggle(
            "package-variant-closed",
            "库存预警",
            "库存不足时通知",
            notifications.inventory,
            (value) => setNotifications({ ...notifications, inventory: value })
          )}
        </View>

        {/* 显示设置 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>显示设置</Text>

          {renderSettingLink(
            "theme-light-dark",
            "深色模式",
            "跟随系统",
            handleThemeSelect
          )}

          {renderSettingLink(
            "format-size",
            "字体大小",
            "标准",
            handleFontSize
          )}

          {renderSettingLink(
            "translate",
            "语言",
            "简体中文",
            handleLanguage
          )}
        </View>

        {/* 扫码设置 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>扫码设置</Text>

          {renderSettingToggle(
            "volume-high",
            "扫码提示音",
            "扫码成功时播放提示音",
            scanSettings.sound,
            (value) => setScanSettings({ ...scanSettings, sound: value })
          )}

          {renderSettingToggle(
            "vibrate",
            "扫码震动",
            "扫码成功时震动反馈",
            scanSettings.vibrate,
            (value) => setScanSettings({ ...scanSettings, vibrate: value })
          )}

          {renderSettingToggle(
            "barcode-scan",
            "连续扫码",
            "扫码后自动继续扫描",
            scanSettings.continuous,
            (value) => setScanSettings({ ...scanSettings, continuous: value })
          )}
        </View>

        {/* 存储设置 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>存储设置</Text>

          {renderSettingLink(
            "delete-sweep",
            "清除缓存",
            "已使用 128 MB",
            handleClearCache
          )}

          {renderSettingToggle(
            "cloud-off-outline",
            "离线模式",
            "在无网络时使用离线数据",
            offlineMode,
            setOfflineMode
          )}
        </View>

        {/* 其他 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>其他</Text>

          {renderSettingLink(
            "shield-check-outline",
            "隐私政策",
            "",
            handlePrivacyPolicy
          )}

          {renderSettingLink(
            "file-document-outline",
            "用户协议",
            "",
            handleUserAgreement
          )}

          {renderSettingLink(
            "update",
            "检查更新",
            "当前版本 v1.0.0",
            handleCheckUpdate
          )}
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  header: {
    backgroundColor: "#4CAF50",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    padding: 4,
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
    marginRight: 28,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
  },
  headerSubtitle: {
    fontSize: 12,
    color: "rgba(255,255,255,0.8)",
    marginTop: 2,
  },
  headerRight: {
    width: 28,
  },
  content: {
    flex: 1,
  },
  section: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#999",
    marginBottom: 12,
  },
  settingItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  settingInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  settingIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "#f5f5f5",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  settingText: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 14,
    color: "#333",
    fontWeight: "500",
  },
  settingDesc: {
    fontSize: 12,
    color: "#999",
    marginTop: 2,
  },
});

export default WHSettingsScreen;
