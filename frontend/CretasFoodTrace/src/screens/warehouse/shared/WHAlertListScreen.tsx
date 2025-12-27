/**
 * 库存预警页面
 * 对应原型: warehouse/alert-list.html
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
import { WHInventoryStackParamList } from "../../../types/navigation";

type NavigationProp = NativeStackNavigationProp<WHInventoryStackParamList>;

interface AIAlert {
  id: string;
  title: string;
  content: string;
  priority: "high" | "medium" | "low";
  suggestions: string[];
  time: string;
}

interface StandardAlert {
  id: string;
  name: string;
  level: "urgent" | "warning" | "normal";
  tags: { text: string; type: "danger" | "warning" | "normal" }[];
  rows: { label: string; value: string; type?: "danger" | "warning" | "success" }[];
}

export function WHAlertListScreen() {
  const theme = useTheme();
  const navigation = useNavigation<NavigationProp>();

  const [alertType, setAlertType] = useState<"ai" | "standard">("ai");

  const aiAlerts: AIAlert[] = [
    {
      id: "1",
      title: "过期风险预警 - 带鱼批次",
      content:
        "批次 MB-20251220-001 (带鱼 85kg) 将在3天后过期，按当前消耗速率(28kg/天)，预计无法在过期前消耗完毕。",
      priority: "high",
      suggestions: [
        "优先安排该批次出库，调整FIFO顺序",
        "联系鲜食超市加急订单，可消化50kg",
        "考虑转冻品加工，保值约60%",
      ],
      time: "5分钟前",
    },
    {
      id: "2",
      title: "供应商质量波动预警",
      content:
        'AI检测到近2周来自"海洋水产"的带鱼批次质检合格率从98%下降至92%，存在质量下滑趋势。',
      priority: "medium",
      suggestions: [
        "加强该供应商来料检验力度",
        "下次采购时向供应商反馈问题",
        '评估备选供应商"渔港直采"的供货能力',
      ],
      time: "30分钟前",
    },
    {
      id: "3",
      title: "转换率优化建议",
      content:
        "AI发现虾仁加工生产线转换率(88.5%)低于行业平均水平(91%)，主要损耗发生在去壳环节。",
      priority: "low",
      suggestions: [
        "检查去壳设备刀片磨损情况",
        "对比其他班组操作方法",
        "预计优化后可提升产能3-5%",
      ],
      time: "2小时前",
    },
  ];

  const urgentAlerts: StandardAlert[] = [
    {
      id: "1",
      name: "带鱼 (鲜品)",
      level: "urgent",
      tags: [
        { text: "低库存", type: "danger" },
        { text: "3天后过期", type: "warning" },
      ],
      rows: [
        { label: "当前库存", value: "85 kg", type: "danger" },
        { label: "安全库存", value: "200 kg" },
        { label: "缺口", value: "-115 kg", type: "danger" },
      ],
    },
    {
      id: "2",
      name: "鲈鱼 (鲜品)",
      level: "urgent",
      tags: [{ text: "2天后过期", type: "danger" }],
      rows: [
        { label: "当前库存", value: "256 kg" },
        { label: "过期时间", value: "2025-12-28", type: "danger" },
        { label: "批次", value: "MB-20251223-001" },
      ],
    },
  ];

  const warningAlerts: StandardAlert[] = [
    {
      id: "3",
      name: "虾仁 (冻品)",
      level: "warning",
      tags: [{ text: "库存偏低", type: "warning" }],
      rows: [
        { label: "当前库存", value: "120 kg", type: "warning" },
        { label: "安全库存", value: "150 kg" },
        { label: "缺口", value: "-30 kg", type: "warning" },
      ],
    },
    {
      id: "4",
      name: "蟹类 (鲜品)",
      level: "warning",
      tags: [{ text: "5天后过期", type: "normal" }],
      rows: [
        { label: "当前库存", value: "180 kg" },
        { label: "过期时间", value: "2025-12-31" },
        { label: "批次", value: "MB-20251225-001" },
      ],
    },
  ];

  const getPriorityStyle = (priority: AIAlert["priority"]) => {
    switch (priority) {
      case "high":
        return { bg: "#ffebee", border: "#f44336", text: "高优先级", color: "#f44336" };
      case "medium":
        return { bg: "#fff3e0", border: "#f57c00", text: "中优先级", color: "#f57c00" };
      case "low":
        return { bg: "#e8f5e9", border: "#4CAF50", text: "低优先级", color: "#4CAF50" };
    }
  };

  const getTagStyle = (type: "danger" | "warning" | "normal") => {
    switch (type) {
      case "danger":
        return { bg: "#ffebee", color: "#f44336" };
      case "warning":
        return { bg: "#fff3e0", color: "#f57c00" };
      case "normal":
        return { bg: "#f5f5f5", color: "#666" };
    }
  };

  const getValueStyle = (type?: "danger" | "warning" | "success") => {
    switch (type) {
      case "danger":
        return { color: "#f44336" };
      case "warning":
        return { color: "#f57c00" };
      case "success":
        return { color: "#4CAF50" };
      default:
        return { color: "#333" };
    }
  };

  const renderAIAlert = (alert: AIAlert) => {
    const priorityStyle = getPriorityStyle(alert.priority);

    return (
      <View
        key={alert.id}
        style={[
          styles.aiAlertCard,
          { backgroundColor: priorityStyle.bg, borderLeftColor: priorityStyle.border },
        ]}
      >
        <View style={styles.aiAlertHeader}>
          <Text style={styles.aiAlertTitle}>{alert.title}</Text>
          <View style={[styles.priorityBadge, { backgroundColor: priorityStyle.color }]}>
            <Text style={styles.priorityText}>{priorityStyle.text}</Text>
          </View>
        </View>
        <Text style={styles.aiAlertContent}>{alert.content}</Text>
        <View style={styles.aiSuggestionBox}>
          <Text style={styles.aiSuggestionLabel}>🤖 AI 建议</Text>
          {alert.suggestions.map((suggestion, index) => (
            <Text key={index} style={styles.aiSuggestionText}>
              {index + 1}. {suggestion}
            </Text>
          ))}
        </View>
        <View style={styles.aiAlertFooter}>
          <Text style={styles.aiAlertTime}>AI分析于 {alert.time}</Text>
          <View style={styles.aiAlertActions}>
            <Button
              mode="outlined"
              compact
              onPress={() => {}}
              style={styles.aiAlertBtnSecondary}
              labelStyle={{ color: "#666", fontSize: 12 }}
            >
              忽略
            </Button>
            <Button
              mode="contained"
              compact
              onPress={() => navigation.navigate("WHAlertHandle" as any)}
              style={styles.aiAlertBtnPrimary}
              labelStyle={{ color: "#fff", fontSize: 12 }}
            >
              处理
            </Button>
          </View>
        </View>
      </View>
    );
  };

  const renderStandardAlert = (alert: StandardAlert, isUrgent: boolean) => (
    <View
      key={alert.id}
      style={[
        styles.standardAlertCard,
        isUrgent && styles.standardAlertCardUrgent,
      ]}
    >
      <View style={styles.standardAlertHeader}>
        <View style={styles.alertInfo}>
          <MaterialCommunityIcons name="package-variant" size={20} color="#666" />
          <Text style={styles.alertName}>{alert.name}</Text>
        </View>
        <View style={styles.alertTags}>
          {alert.tags.map((tag, index) => {
            const tagStyle = getTagStyle(tag.type);
            return (
              <View
                key={index}
                style={[styles.alertTag, { backgroundColor: tagStyle.bg }]}
              >
                <Text style={[styles.alertTagText, { color: tagStyle.color }]}>
                  {tag.text}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
      <View style={styles.alertContent}>
        {alert.rows.map((row, index) => (
          <View key={index} style={styles.alertRow}>
            <Text style={styles.alertLabel}>{row.label}</Text>
            <Text style={[styles.alertValue, getValueStyle(row.type)]}>
              {row.value}
            </Text>
          </View>
        ))}
      </View>
      <View style={styles.alertActions}>
        <Button
          mode="contained"
          compact
          onPress={() => navigation.navigate("WHAlertHandle" as any)}
          style={[
            styles.alertActionBtn,
            isUrgent ? styles.alertActionBtnPrimary : styles.alertActionBtnSecondary,
          ]}
          labelStyle={{ color: isUrgent ? "#fff" : "#666", fontSize: 12 }}
        >
          {isUrgent ? "立即处理" : "查看详情"}
        </Button>
      </View>
    </View>
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
          <Text style={styles.headerTitle}>库存预警</Text>
          <Text style={styles.headerSubtitle}>共 5 条预警</Text>
        </View>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* 告警类型切换 */}
        <View style={styles.alertTypeTabs}>
          <TouchableOpacity
            style={[
              styles.alertTypeTab,
              alertType === "standard" && styles.alertTypeTabActive,
            ]}
            onPress={() => setAlertType("standard")}
          >
            <Text
              style={[
                styles.alertTypeTabText,
                alertType === "standard" && styles.alertTypeTabTextActive,
              ]}
            >
              常规告警
            </Text>
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>5</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.alertTypeTab,
              alertType === "ai" && styles.alertTypeTabActive,
            ]}
            onPress={() => setAlertType("ai")}
          >
            <Text
              style={[
                styles.alertTypeTabText,
                alertType === "ai" && styles.alertTypeTabTextActive,
              ]}
            >
              AI智能告警
            </Text>
            <View style={[styles.tabBadge, styles.tabBadgeAI]}>
              <Text style={styles.tabBadgeText}>4</Text>
            </View>
          </TouchableOpacity>
        </View>

        {alertType === "ai" ? (
          /* AI 智能告警 */
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: "#7b1fa2" }]}>
              🤖 AI 智能分析告警
            </Text>
            {aiAlerts.map(renderAIAlert)}
          </View>
        ) : (
          <>
            {/* 紧急预警 */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, styles.sectionTitleDanger]}>
                紧急预警
              </Text>
              {urgentAlerts.map((alert) => renderStandardAlert(alert, true))}
            </View>

            {/* 一般预警 */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, styles.sectionTitleWarning]}>
                一般预警
              </Text>
              {warningAlerts.map((alert) => renderStandardAlert(alert, false))}
            </View>
          </>
        )}

        {/* 预警统计 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>预警统计</Text>
          <View style={styles.alertStats}>
            <View style={[styles.alertStatItem, styles.alertStatDanger]}>
              <Text style={[styles.alertStatValue, { color: "#f44336" }]}>2</Text>
              <Text style={styles.alertStatLabel}>紧急</Text>
            </View>
            <View style={[styles.alertStatItem, styles.alertStatWarning]}>
              <Text style={[styles.alertStatValue, { color: "#f57c00" }]}>2</Text>
              <Text style={styles.alertStatLabel}>一般</Text>
            </View>
            <View style={styles.alertStatItem}>
              <Text style={styles.alertStatValue}>1</Text>
              <Text style={styles.alertStatLabel}>提醒</Text>
            </View>
            <View style={[styles.alertStatItem, styles.alertStatSuccess]}>
              <Text style={[styles.alertStatValue, { color: "#4CAF50" }]}>12</Text>
              <Text style={styles.alertStatLabel}>正常</Text>
            </View>
          </View>
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
  alertTypeTabs: {
    flexDirection: "row",
    backgroundColor: "#fff",
    padding: 12,
    gap: 12,
  },
  alertTypeTab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#f5f5f5",
    gap: 8,
  },
  alertTypeTabActive: {
    backgroundColor: "#e8f5e9",
  },
  alertTypeTabText: {
    fontSize: 14,
    color: "#666",
  },
  alertTypeTabTextActive: {
    color: "#4CAF50",
    fontWeight: "600",
  },
  tabBadge: {
    backgroundColor: "#999",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  tabBadgeAI: {
    backgroundColor: "#7b1fa2",
  },
  tabBadgeText: {
    fontSize: 10,
    color: "#fff",
    fontWeight: "bold",
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
  sectionTitleDanger: {
    color: "#f44336",
  },
  sectionTitleWarning: {
    color: "#f57c00",
  },
  aiAlertCard: {
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
  },
  aiAlertHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  aiAlertTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    flex: 1,
    marginRight: 8,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  priorityText: {
    fontSize: 11,
    color: "#fff",
    fontWeight: "500",
  },
  aiAlertContent: {
    fontSize: 13,
    color: "#666",
    lineHeight: 20,
    marginBottom: 12,
  },
  aiSuggestionBox: {
    backgroundColor: "rgba(255,255,255,0.8)",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  aiSuggestionLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#7b1fa2",
    marginBottom: 8,
  },
  aiSuggestionText: {
    fontSize: 12,
    color: "#666",
    lineHeight: 18,
    marginBottom: 4,
  },
  aiAlertFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  aiAlertTime: {
    fontSize: 11,
    color: "#999",
  },
  aiAlertActions: {
    flexDirection: "row",
    gap: 8,
  },
  aiAlertBtnSecondary: {
    borderRadius: 6,
    borderColor: "#ddd",
  },
  aiAlertBtnPrimary: {
    borderRadius: 6,
    backgroundColor: "#4CAF50",
  },
  standardAlertCard: {
    backgroundColor: "#f9f9f9",
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  standardAlertCardUrgent: {
    borderWidth: 1,
    borderColor: "#ffcdd2",
    backgroundColor: "#fff",
  },
  standardAlertHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  alertInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  alertName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  alertTags: {
    flexDirection: "row",
    gap: 6,
  },
  alertTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  alertTagText: {
    fontSize: 11,
    fontWeight: "500",
  },
  alertContent: {
    gap: 6,
    marginBottom: 10,
  },
  alertRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  alertLabel: {
    fontSize: 13,
    color: "#666",
  },
  alertValue: {
    fontSize: 13,
    fontWeight: "500",
  },
  alertActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  alertActionBtn: {
    borderRadius: 6,
  },
  alertActionBtnPrimary: {
    backgroundColor: "#4CAF50",
  },
  alertActionBtnSecondary: {
    backgroundColor: "#f5f5f5",
  },
  alertStats: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  alertStatItem: {
    alignItems: "center",
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#f9f9f9",
    minWidth: 70,
  },
  alertStatDanger: {
    backgroundColor: "#ffebee",
  },
  alertStatWarning: {
    backgroundColor: "#fff3e0",
  },
  alertStatSuccess: {
    backgroundColor: "#e8f5e9",
  },
  alertStatValue: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
  },
  alertStatLabel: {
    fontSize: 12,
    color: "#666",
    marginTop: 4,
  },
});

export default WHAlertListScreen;
