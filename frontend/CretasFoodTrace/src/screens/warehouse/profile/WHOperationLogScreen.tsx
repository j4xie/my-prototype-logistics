/**
 * 操作记录页面
 * 对应原型: warehouse/operation-log.html
 */

import React, { useState } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { Text, Button, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { WHProfileStackParamList } from "../../../types/navigation";

type NavigationProp = NativeStackNavigationProp<WHProfileStackParamList>;

interface LogItem {
  id: string;
  type: "inbound" | "outbound" | "quality" | "transfer" | "scan" | "check" | "alert" | "dispose";
  title: string;
  description: string;
  time: string;
  location: string;
  status: "success" | "warning" | "danger";
  statusText: string;
}

interface LogGroup {
  date: string;
  dateLabel: string;
  items: LogItem[];
}

export function WHOperationLogScreen() {
  const theme = useTheme();
  const navigation = useNavigation<NavigationProp>();

  const [selectedTab, setSelectedTab] = useState("all");

  const tabs = [
    { key: "all", label: "全部" },
    { key: "inbound", label: "入库" },
    { key: "outbound", label: "出库" },
    { key: "check", label: "盘点" },
  ];

  const logGroups: LogGroup[] = [
    {
      date: "12-26",
      dateLabel: "今日 (12-26)",
      items: [
        {
          id: "1",
          type: "inbound",
          title: "确认入库",
          description: "MB-20251226-001 带鱼 150kg",
          time: "13:45",
          location: "A区-冷藏库-01",
          status: "success",
          statusText: "成功",
        },
        {
          id: "2",
          type: "outbound",
          title: "确认出库",
          description: "SH-20251226-001 带鱼片 80kg",
          time: "12:30",
          location: "鲜食超市",
          status: "success",
          statusText: "成功",
        },
        {
          id: "3",
          type: "quality",
          title: "质检验收",
          description: "MB-20251226-002 虾仁 80kg (A级)",
          time: "11:20",
          location: "质检区",
          status: "success",
          statusText: "通过",
        },
        {
          id: "4",
          type: "transfer",
          title: "库位转移",
          description: "MB-20251225-003 从A区-01转至B区-01",
          time: "10:15",
          location: "转冻品处理",
          status: "success",
          statusText: "成功",
        },
        {
          id: "5",
          type: "scan",
          title: "扫码入库",
          description: "MB-20251226-003 鲈鱼 200kg",
          time: "09:30",
          location: "A区-冷藏库-02",
          status: "success",
          statusText: "成功",
        },
      ],
    },
    {
      date: "12-25",
      dateLabel: "昨日 (12-25)",
      items: [
        {
          id: "6",
          type: "check",
          title: "库存盘点",
          description: "A区-冷藏库 完成盘点",
          time: "16:30",
          location: "差异: 0",
          status: "success",
          statusText: "完成",
        },
        {
          id: "7",
          type: "outbound",
          title: "确认出库",
          description: "SH-20251225-003 虾仁 50kg",
          time: "15:00",
          location: "城市生鲜店",
          status: "success",
          statusText: "成功",
        },
        {
          id: "8",
          type: "alert",
          title: "温度异常处理",
          description: "A区温度5.2°C 调整制冷设备",
          time: "14:30",
          location: "A区-冷藏库",
          status: "warning",
          statusText: "已处理",
        },
        {
          id: "9",
          type: "inbound",
          title: "确认入库",
          description: "MB-20251225-001 蟹类 120kg",
          time: "10:00",
          location: "A区-冷藏库-03",
          status: "success",
          statusText: "成功",
        },
      ],
    },
    {
      date: "earlier",
      dateLabel: "更早",
      items: [
        {
          id: "10",
          type: "quality",
          title: "质检不合格",
          description: "MB-20251224-005 带鱼 30kg 已退回",
          time: "12-24 11:30",
          location: "退回供应商",
          status: "danger",
          statusText: "退回",
        },
        {
          id: "11",
          type: "dispose",
          title: "过期报损",
          description: "MB-20251218-002 虾仁 15kg",
          time: "12-23 16:00",
          location: "报损处理",
          status: "danger",
          statusText: "已销毁",
        },
      ],
    },
  ];

  const getLogIcon = (type: LogItem["type"]) => {
    switch (type) {
      case "inbound":
        return { icon: "package-down", bg: "#e8f5e9", color: "#4CAF50" };
      case "outbound":
        return { icon: "package-up", bg: "#e3f2fd", color: "#1976d2" };
      case "quality":
        return { icon: "clipboard-check-outline", bg: "#f3e5f5", color: "#7b1fa2" };
      case "transfer":
        return { icon: "swap-horizontal", bg: "#fff3e0", color: "#f57c00" };
      case "scan":
        return { icon: "barcode-scan", bg: "#e0f7fa", color: "#0097a7" };
      case "check":
        return { icon: "clipboard-list-outline", bg: "#fce4ec", color: "#c2185b" };
      case "alert":
        return { icon: "alert-circle-outline", bg: "#fff3e0", color: "#f57c00" };
      case "dispose":
        return { icon: "delete-outline", bg: "#ffebee", color: "#f44336" };
      default:
        return { icon: "file-document-outline", bg: "#f5f5f5", color: "#666" };
    }
  };

  const getStatusStyle = (status: LogItem["status"]) => {
    switch (status) {
      case "success":
        return { bg: "#e8f5e9", color: "#4CAF50" };
      case "warning":
        return { bg: "#fff3e0", color: "#f57c00" };
      case "danger":
        return { bg: "#ffebee", color: "#f44336" };
    }
  };

  const filterLogs = (group: LogGroup): LogItem[] => {
    if (selectedTab === "all") return group.items;
    return group.items.filter((item) => {
      if (selectedTab === "inbound") return item.type === "inbound" || item.type === "scan";
      if (selectedTab === "outbound") return item.type === "outbound";
      if (selectedTab === "check") return item.type === "check";
      return true;
    });
  };

  const renderLogItem = (item: LogItem) => {
    const iconStyle = getLogIcon(item.type);
    const statusStyle = getStatusStyle(item.status);

    return (
      <View key={item.id} style={styles.logItem}>
        <View style={[styles.logIcon, { backgroundColor: iconStyle.bg }]}>
          <MaterialCommunityIcons
            name={iconStyle.icon as any}
            size={18}
            color={iconStyle.color}
          />
        </View>
        <View style={styles.logContent}>
          <Text style={styles.logTitle}>{item.title}</Text>
          <Text style={styles.logDesc}>{item.description}</Text>
          <View style={styles.logMeta}>
            <Text style={styles.logTime}>{item.time}</Text>
            <Text style={styles.logLocation}>{item.location}</Text>
          </View>
        </View>
        <View style={[styles.logStatus, { backgroundColor: statusStyle.bg }]}>
          <Text style={[styles.logStatusText, { color: statusStyle.color }]}>
            {item.statusText}
          </Text>
        </View>
      </View>
    );
  };

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
          <Text style={styles.headerTitle}>操作记录</Text>
          <Text style={styles.headerSubtitle}>我的操作历史</Text>
        </View>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* 筛选标签 */}
        <View style={styles.filterTabs}>
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.filterTab,
                selectedTab === tab.key && styles.filterTabActive,
              ]}
              onPress={() => setSelectedTab(tab.key)}
            >
              <Text
                style={[
                  styles.filterTabText,
                  selectedTab === tab.key && styles.filterTabTextActive,
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* 日志列表 */}
        {logGroups.map((group) => {
          const filteredItems = filterLogs(group);
          if (filteredItems.length === 0) return null;

          return (
            <View key={group.date} style={styles.section}>
              <Text style={styles.sectionTitle}>{group.dateLabel}</Text>
              {filteredItems.map(renderLogItem)}
            </View>
          );
        })}

        {/* 加载更多 */}
        <View style={styles.loadMore}>
          <Button
            mode="outlined"
            onPress={() => {}}
            style={styles.loadMoreBtn}
            labelStyle={{ color: "#666" }}
          >
            加载更多
          </Button>
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
  filterTabs: {
    flexDirection: "row",
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#f5f5f5",
  },
  filterTabActive: {
    backgroundColor: "#4CAF50",
  },
  filterTabText: {
    fontSize: 13,
    color: "#666",
  },
  filterTabTextActive: {
    color: "#fff",
    fontWeight: "500",
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
  logItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  logIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  logContent: {
    flex: 1,
  },
  logTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  logDesc: {
    fontSize: 13,
    color: "#666",
    marginTop: 2,
  },
  logMeta: {
    flexDirection: "row",
    marginTop: 6,
    gap: 12,
  },
  logTime: {
    fontSize: 12,
    color: "#999",
  },
  logLocation: {
    fontSize: 12,
    color: "#999",
  },
  logStatus: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginLeft: 8,
  },
  logStatusText: {
    fontSize: 11,
    fontWeight: "500",
  },
  loadMore: {
    paddingHorizontal: 16,
    marginTop: 16,
  },
  loadMoreBtn: {
    borderRadius: 8,
    borderColor: "#ddd",
  },
});

export default WHOperationLogScreen;
