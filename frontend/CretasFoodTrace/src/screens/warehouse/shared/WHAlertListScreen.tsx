/**
 * 库存预警页面
 * 对应原型: warehouse/alert-list.html
 */

import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Text, Button, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation, CommonActions } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { WHInventoryStackParamList } from "../../../types/navigation";
import { alertApiClient, AlertDTO } from "../../../services/api/alertApiClient";
import { handleError } from "../../../utils/errorHandler";
import { useAuthStore } from "../../../store/authStore";
import { formatDateTimeFull } from "../../../utils/formatters";

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

// 告警统计接口
interface AlertStats {
  total: number;
  critical: number;
  warning: number;
  info: number;
  resolved: number;
}

export function WHAlertListScreen() {
  const theme = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuthStore();

  // 状态管理
  const [loading, setLoading] = useState(true);
  const [alertType, setAlertType] = useState<"ai" | "standard">("ai");
  const [urgentAlerts, setUrgentAlerts] = useState<StandardAlert[]>([]);
  const [warningAlerts, setWarningAlerts] = useState<StandardAlert[]>([]);
  const [alertStats, setAlertStats] = useState<AlertStats>({
    total: 0,
    critical: 0,
    warning: 0,
    info: 0,
    resolved: 0,
  });

  // AI智能告警 (示例数据，后续可接入AI分析服务)
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

  // 将 AlertDTO 转换为 StandardAlert 格式
  const alertToStandardAlert = (alert: AlertDTO): StandardAlert => {
    const isUrgent = alert.level === 'CRITICAL';
    const tags: StandardAlert['tags'] = [];

    // 根据告警类型和级别设置标签
    if (alert.level === 'CRITICAL') {
      tags.push({ text: '紧急', type: 'danger' });
    } else if (alert.level === 'WARNING') {
      tags.push({ text: '警告', type: 'warning' });
    } else {
      tags.push({ text: '提醒', type: 'normal' });
    }

    if (alert.alertType) {
      tags.push({ text: alert.alertType, type: 'normal' });
    }

    const rows: StandardAlert['rows'] = [
      { label: '设备', value: alert.equipmentName || alert.equipmentId || '-' },
      { label: '告警信息', value: alert.message || '-' },
      {
        label: '触发时间',
        value: alert.triggeredAt ? formatDateTimeFull(alert.triggeredAt) : '-'
      },
    ];

    if (alert.status === 'RESOLVED' && alert.resolvedAt) {
      rows.push({
        label: '解决时间',
        value: formatDateTimeFull(alert.resolvedAt),
        type: 'success',
      });
    }

    return {
      id: String(alert.id),
      name: alert.equipmentName || `设备告警 #${alert.id}`,
      level: isUrgent ? 'urgent' : 'warning',
      tags,
      rows,
    };
  };

  // 加载告警数据
  const loadAlerts = useCallback(async () => {
    try {
      setLoading(true);

      // 并行获取活跃告警和统计数据
      const [activeAlertsResponse, statsResponse] = await Promise.all([
        alertApiClient.getEquipmentAlerts({ status: 'ACTIVE', page: 1, size: 50 }),
        alertApiClient.getAlertStatistics(),
      ]);

      // 处理告警列表
      const allAlerts = activeAlertsResponse?.data?.content || [];

      // 分类为紧急和一般告警
      const urgent: StandardAlert[] = [];
      const warning: StandardAlert[] = [];

      allAlerts.forEach((alert: AlertDTO) => {
        const standardAlert = alertToStandardAlert(alert);
        if (alert.level === 'CRITICAL') {
          urgent.push(standardAlert);
        } else {
          warning.push(standardAlert);
        }
      });

      setUrgentAlerts(urgent);
      setWarningAlerts(warning);

      // 处理统计数据
      if (statsResponse?.data) {
        setAlertStats({
          total: statsResponse.data.total || 0,
          critical: statsResponse.data.critical || 0,
          warning: statsResponse.data.warning || 0,
          info: statsResponse.data.info || 0,
          resolved: statsResponse.data.resolved || 0,
        });
      }
    } catch (error) {
      handleError(error, { title: '加载告警数据失败' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  // 处理忽略告警
  const handleIgnoreAlert = async (alertId: string) => {
    try {
      await alertApiClient.ignoreAlert({
        factoryId: user?.factoryId || '',
        alertId,
        reason: '仓储管理员忽略',
      });
      Alert.alert('成功', '告警已忽略');
      loadAlerts(); // 刷新列表
    } catch (error) {
      handleError(error, { title: '忽略告警失败' });
    }
  };

  // 处理解决告警
  const handleResolveAlert = async (alertId: string) => {
    try {
      await alertApiClient.resolveAlert({
        factoryId: user?.factoryId || '',
        alertId,
        resolvedBy: user?.id || 0,
        resolutionNotes: '仓储管理员处理完成',
      });
      Alert.alert('成功', '告警已处理');
      loadAlerts(); // 刷新列表
    } catch (error) {
      handleError(error, { title: '处理告警失败' });
    }
  };

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
              onPress={() => navigation.dispatch(CommonActions.navigate("WHAlertHandle"))}
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
          onPress={() => navigation.dispatch(CommonActions.navigate("WHAlertHandle"))}
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

  const totalActiveAlerts = urgentAlerts.length + warningAlerts.length;

  // 加载状态
  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>库存预警</Text>
            <Text style={styles.headerSubtitle}>加载中...</Text>
          </View>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>加载告警数据中...</Text>
        </View>
      </SafeAreaView>
    );
  }

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
          <Text style={styles.headerSubtitle}>
            共 {totalActiveAlerts + aiAlerts.length} 条预警
          </Text>
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
              <Text style={styles.tabBadgeText}>{totalActiveAlerts}</Text>
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
              <Text style={styles.tabBadgeText}>{aiAlerts.length}</Text>
            </View>
          </TouchableOpacity>
        </View>

        {alertType === "ai" ? (
          /* AI 智能告警 */
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: "#7b1fa2" }]}>
              🤖 AI 智能分析告警
            </Text>
            {aiAlerts.length > 0 ? (
              aiAlerts.map(renderAIAlert)
            ) : (
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="robot-outline" size={48} color="#ccc" />
                <Text style={styles.emptyStateText}>暂无AI智能告警</Text>
              </View>
            )}
          </View>
        ) : (
          <>
            {/* 紧急预警 */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, styles.sectionTitleDanger]}>
                紧急预警 ({urgentAlerts.length})
              </Text>
              {urgentAlerts.length > 0 ? (
                urgentAlerts.map((alert) => renderStandardAlert(alert, true))
              ) : (
                <View style={styles.emptyStateSmall}>
                  <Text style={styles.emptyStateTextSmall}>暂无紧急预警</Text>
                </View>
              )}
            </View>

            {/* 一般预警 */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, styles.sectionTitleWarning]}>
                一般预警 ({warningAlerts.length})
              </Text>
              {warningAlerts.length > 0 ? (
                warningAlerts.map((alert) => renderStandardAlert(alert, false))
              ) : (
                <View style={styles.emptyStateSmall}>
                  <Text style={styles.emptyStateTextSmall}>暂无一般预警</Text>
                </View>
              )}
            </View>
          </>
        )}

        {/* 预警统计 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>预警统计</Text>
          <View style={styles.alertStatsContainer}>
            <View style={[styles.alertStatItem, styles.alertStatDanger]}>
              <Text style={[styles.alertStatValue, { color: "#f44336" }]}>
                {alertStats.critical}
              </Text>
              <Text style={styles.alertStatLabel}>紧急</Text>
            </View>
            <View style={[styles.alertStatItem, styles.alertStatWarning]}>
              <Text style={[styles.alertStatValue, { color: "#f57c00" }]}>
                {alertStats.warning}
              </Text>
              <Text style={styles.alertStatLabel}>一般</Text>
            </View>
            <View style={styles.alertStatItem}>
              <Text style={styles.alertStatValue}>{alertStats.info}</Text>
              <Text style={styles.alertStatLabel}>提醒</Text>
            </View>
            <View style={[styles.alertStatItem, styles.alertStatSuccess]}>
              <Text style={[styles.alertStatValue, { color: "#4CAF50" }]}>
                {alertStats.resolved}
              </Text>
              <Text style={styles.alertStatLabel}>已解决</Text>
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
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#666",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 32,
  },
  emptyStateText: {
    marginTop: 12,
    fontSize: 14,
    color: "#999",
  },
  emptyStateSmall: {
    alignItems: "center",
    paddingVertical: 16,
  },
  emptyStateTextSmall: {
    fontSize: 13,
    color: "#999",
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
  alertStatsContainer: {
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
