/**
 * Factory Admin 个人中心
 * 包含: 用户信息、账户设置、帮助与支持、关于
 */
import React from "react";
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, Image } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Icon } from "react-native-paper";
import { FAProfileStackParamList } from "../../../types/navigation";
import { useAuthStore } from "../../../store/authStore";

type NavigationProp = NativeStackNavigationProp<FAProfileStackParamList, "FAProfile">;

interface MenuItemProps {
  icon: string;
  title: string;
  onPress: () => void;
  showArrow?: boolean;
  rightText?: string;
  danger?: boolean;
}

function MenuItem({ icon, title, onPress, showArrow = true, rightText, danger = false }: MenuItemProps) {
  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress}>
      <Icon source={icon} size={22} color={danger ? "#ff4d4f" : "#666"} />
      <Text style={[styles.menuTitle, danger && styles.dangerText]}>{title}</Text>
      <View style={styles.menuRight}>
        {rightText && <Text style={styles.rightText}>{rightText}</Text>}
        {showArrow && <Icon source="chevron-right" size={20} color="#ccc" />}
      </View>
    </TouchableOpacity>
  );
}

export function FAProfileScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>我的</Text>
        </View>

        {/* 用户信息卡片 */}
        <TouchableOpacity
          style={styles.userCard}
          onPress={() => navigation.navigate("PersonalInfo")}
        >
          <View style={styles.avatar}>
            <Icon source="account" size={40} color="#fff" />
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{user?.username || "用户"}</Text>
            <Text style={styles.userRole}>工厂管理员</Text>
          </View>
          <Icon source="chevron-right" size={24} color="#ccc" />
        </TouchableOpacity>

        {/* 账户设置 */}
        <View style={styles.menuSection}>
          <Text style={styles.sectionTitle}>账户设置</Text>
          <View style={styles.menuGroup}>
            <MenuItem
              icon="account-edit"
              title="个人信息"
              onPress={() => navigation.navigate("PersonalInfo")}
            />
            <MenuItem
              icon="lock-outline"
              title="修改密码"
              onPress={() => navigation.navigate("ChangePassword")}
            />
            <MenuItem
              icon="bell-outline"
              title="通知设置"
              onPress={() => navigation.navigate("NotificationSettings")}
            />
          </View>
        </View>

        {/* 系统设置 */}
        <View style={styles.menuSection}>
          <Text style={styles.sectionTitle}>系统设置</Text>
          <View style={styles.menuGroup}>
            <MenuItem
              icon="cog-outline"
              title="系统设置"
              onPress={() => navigation.navigate("SystemSettings")}
            />
            <MenuItem
              icon="download-outline"
              title="数据导出"
              onPress={() => navigation.navigate("DataExport", {})}
            />
          </View>
        </View>

        {/* 帮助与支持 */}
        <View style={styles.menuSection}>
          <Text style={styles.sectionTitle}>帮助与支持</Text>
          <View style={styles.menuGroup}>
            <MenuItem
              icon="help-circle-outline"
              title="帮助中心"
              onPress={() => navigation.navigate("HelpCenter")}
            />
            <MenuItem
              icon="message-text-outline"
              title="意见反馈"
              onPress={() => navigation.navigate("Feedback")}
            />
            <MenuItem
              icon="information-outline"
              title="关于"
              onPress={() => navigation.navigate("About")}
              rightText="v1.0.0"
            />
          </View>
        </View>

        {/* 退出登录 */}
        <View style={styles.menuSection}>
          <View style={styles.menuGroup}>
            <MenuItem
              icon="logout"
              title="退出登录"
              onPress={handleLogout}
              showArrow={false}
              danger
            />
          </View>
        </View>

        {/* 底部间距 */}
        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 20,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
  },
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    margin: 16,
    padding: 16,
    borderRadius: 12,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#667eea",
    alignItems: "center",
    justifyContent: "center",
  },
  userInfo: {
    flex: 1,
    marginLeft: 12,
  },
  userName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  userRole: {
    fontSize: 14,
    color: "#666",
    marginTop: 4,
  },
  menuSection: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 13,
    color: "#999",
    marginLeft: 20,
    marginBottom: 8,
  },
  menuGroup: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    borderRadius: 12,
    overflow: "hidden",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#f0f0f0",
  },
  menuTitle: {
    flex: 1,
    fontSize: 16,
    color: "#333",
    marginLeft: 12,
  },
  dangerText: {
    color: "#ff4d4f",
  },
  menuRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  rightText: {
    fontSize: 14,
    color: "#999",
    marginRight: 4,
  },
});

export default FAProfileScreen;
