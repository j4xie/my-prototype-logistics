/**
 * 个人中心页面
 * 对应原型: warehouse/profile.html
 */

import React from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from "react-native";
import {
  Text,
  Surface,
  Avatar,
  Button,
  Divider,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { WHProfileStackParamList } from "../../../types/navigation";
import { useAuthStore } from "../../../store/authStore";

type NavigationProp = NativeStackNavigationProp<WHProfileStackParamList>;

interface MenuItem {
  key: string;
  label: string;
  icon: string;
  screen?: keyof WHProfileStackParamList;
  badge?: number;
  description?: string;
  onPress?: () => void;
}

interface MenuSection {
  title: string;
  items: MenuItem[];
}

export function WHProfileScreen() {
  const theme = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { user, logout } = useAuthStore();

  // 用户信息
  const userInfo = {
    name: user?.username || "陈仓管",
    role: "仓储管理员",
    factory: user?.factoryId || "白垩纪食品加工厂",
    avatar: user?.username?.charAt(0).toUpperCase() || "U",
  };

  // 今日统计
  const todayStats = [
    { label: "入库单", value: 8 },
    { label: "出库单", value: 12 },
    { label: "盘点", value: 3 },
    { label: "异常", value: 2 },
  ];

  // 菜单配置
  const menuSections: MenuSection[] = [
    {
      title: "常用功能",
      items: [
        {
          key: "io-stats",
          label: "出入库统计",
          icon: "chart-bar",
          screen: "WHOperationLog",
        },
        {
          key: "operation-log",
          label: "操作记录",
          icon: "history",
          screen: "WHOperationLog",
        },
        {
          key: "check-record",
          label: "盘点记录",
          icon: "clipboard-check-outline",
          screen: "WHOperationLog",
        },
        {
          key: "expire-handle",
          label: "过期处理",
          icon: "clock-alert-outline",
          badge: 4,
          screen: "WHOperationLog",
        },
      ],
    },
    {
      title: "系统功能",
      items: [
        {
          key: "settings",
          label: "设置",
          icon: "cog-outline",
          screen: "WHSettings",
        },
        {
          key: "temp-monitor",
          label: "温控监控",
          icon: "thermometer",
          screen: "WHSettings",
        },
        {
          key: "scan",
          label: "扫码作业",
          icon: "qrcode-scan",
          screen: "WHSettings",
        },
        {
          key: "recall",
          label: "召回管理",
          icon: "package-variant-closed-remove",
          screen: "WHRecallManage",
        },
      ],
    },
    {
      title: "帮助与反馈",
      items: [
        {
          key: "help",
          label: "使用帮助",
          icon: "help-circle-outline",
          onPress: () => Alert.alert("使用帮助", "功能开发中..."),
        },
        {
          key: "feedback",
          label: "意见反馈",
          icon: "message-text-outline",
          onPress: () => Alert.alert("意见反馈", "功能开发中..."),
        },
        {
          key: "about",
          label: "关于",
          icon: "information-outline",
          description: "v1.0.0",
          onPress: () => Alert.alert("关于", "白垩纪食品溯源系统 v1.0.0"),
        },
      ],
    },
  ];

  const handleLogout = () => {
    Alert.alert("退出登录", "确定要退出登录吗？", [
      { text: "取消", style: "cancel" },
      {
        text: "确定",
        style: "destructive",
        onPress: () => {
          logout();
        },
      },
    ]);
  };

  const handleMenuPress = (item: MenuItem) => {
    if (item.onPress) {
      item.onPress();
    } else if (item.screen) {
      navigation.navigate(item.screen as any);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>我的</Text>
        <Text style={styles.headerSubtitle}>{userInfo.role}</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* 用户信息卡片 */}
        <Surface style={styles.profileCard} elevation={1}>
          <View style={styles.profileContent}>
            <Avatar.Text
              size={60}
              label={userInfo.avatar}
              style={styles.avatar}
            />
            <View style={styles.profileInfo}>
              <Text style={styles.userName}>{userInfo.name}</Text>
              <Text style={styles.userRole}>{userInfo.role}</Text>
              <Text style={styles.userFactory}>{userInfo.factory}</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => navigation.navigate("WHProfileEdit")}
          >
            <Text style={styles.editButtonText}>编辑</Text>
          </TouchableOpacity>
        </Surface>

        {/* 今日统计 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>今日统计</Text>
          <View style={styles.statsRow}>
            {todayStats.map((stat, index) => (
              <View key={stat.label} style={styles.statItem}>
                <Text
                  style={[
                    styles.statValue,
                    stat.label === "异常" && styles.statValueDanger,
                  ]}
                >
                  {stat.value}
                </Text>
                <Text style={styles.statLabel}>{stat.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* 菜单列表 */}
        {menuSections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.menuList}>
              {section.items.map((item, index) => (
                <React.Fragment key={item.key}>
                  <TouchableOpacity
                    style={styles.menuItem}
                    onPress={() => handleMenuPress(item)}
                    activeOpacity={0.7}
                  >
                    <MaterialCommunityIcons
                      name={item.icon as any}
                      size={22}
                      color="#666"
                      style={styles.menuIcon}
                    />
                    <Text style={styles.menuText}>{item.label}</Text>
                    {item.badge && (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>{item.badge}</Text>
                      </View>
                    )}
                    {item.description && (
                      <Text style={styles.menuDesc}>{item.description}</Text>
                    )}
                    <MaterialCommunityIcons
                      name="chevron-right"
                      size={20}
                      color="#ccc"
                    />
                  </TouchableOpacity>
                  {index < section.items.length - 1 && (
                    <Divider style={styles.divider} />
                  )}
                </React.Fragment>
              ))}
            </View>
          </View>
        ))}

        {/* 退出登录 */}
        <View style={styles.logoutSection}>
          <Button
            mode="outlined"
            onPress={handleLogout}
            style={styles.logoutButton}
            labelStyle={styles.logoutButtonLabel}
            icon="logout"
          >
            退出登录
          </Button>
        </View>

        <View style={{ height: 30 }} />
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
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
  },
  headerSubtitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.9)",
    marginTop: 4,
  },
  content: {
    flex: 1,
  },
  profileCard: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  profileContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    backgroundColor: "#4CAF50",
  },
  profileInfo: {
    marginLeft: 16,
  },
  userName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
  userRole: {
    fontSize: 13,
    color: "#666",
    marginTop: 4,
  },
  userFactory: {
    fontSize: 12,
    color: "#999",
    marginTop: 2,
  },
  editButton: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#4CAF50",
  },
  editButtonText: {
    fontSize: 13,
    color: "#4CAF50",
    fontWeight: "500",
  },
  section: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#999",
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: "row",
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#4CAF50",
  },
  statValueDanger: {
    color: "#f44336",
  },
  statLabel: {
    fontSize: 12,
    color: "#666",
    marginTop: 4,
  },
  menuList: {
    marginTop: -4,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
  },
  menuIcon: {
    marginRight: 12,
  },
  menuText: {
    flex: 1,
    fontSize: 15,
    color: "#333",
  },
  badge: {
    backgroundColor: "#f44336",
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
    marginRight: 8,
  },
  badgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "bold",
  },
  menuDesc: {
    fontSize: 13,
    color: "#999",
    marginRight: 8,
  },
  divider: {
    marginLeft: 34,
  },
  logoutSection: {
    marginHorizontal: 16,
    marginTop: 24,
  },
  logoutButton: {
    borderColor: "#f44336",
    borderRadius: 8,
  },
  logoutButtonLabel: {
    color: "#f44336",
    fontWeight: "600",
  },
});

export default WHProfileScreen;
