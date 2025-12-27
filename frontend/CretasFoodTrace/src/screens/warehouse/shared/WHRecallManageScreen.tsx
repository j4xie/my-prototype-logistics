/**
 * 召回管理页面
 * 对应原型: warehouse/recall-manage.html
 */

import React, { useState } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from "react-native";
import { Text, Button, ProgressBar, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { WHInventoryStackParamList } from "../../../types/navigation";

type NavigationProp = NativeStackNavigationProp<WHInventoryStackParamList>;

interface RecallItem {
  id: string;
  number: string;
  level: "urgent" | "normal";
  status: "processing" | "completed";
  reason: string;
  batch: string;
  quantity: number;
  startTime: string;
  completeTime?: string;
  progress?: number;
  scope?: {
    icon: string;
    label: string;
    value: string;
    status: "success" | "warning";
  }[];
}

interface FlowStep {
  number: number;
  title: string;
  description: string;
  status: "completed" | "active" | "pending";
}

export function WHRecallManageScreen() {
  const theme = useTheme();
  const navigation = useNavigation<NavigationProp>();

  const [selectedTab, setSelectedTab] = useState("active");

  const tabs = [
    { key: "active", label: "进行中(1)" },
    { key: "completed", label: "已完成(3)" },
    { key: "create", label: "新建召回" },
  ];

  const activeRecalls: RecallItem[] = [
    {
      id: "1",
      number: "RC-20251226-001",
      level: "urgent",
      status: "processing",
      reason: "供应商质检问题",
      batch: "MB-20251220-005",
      quantity: 200,
      startTime: "2025-12-26 09:00",
      progress: 0.6,
      scope: [
        { icon: "1", label: "库存在库", value: "50 kg", status: "success" },
        { icon: "2", label: "已出货", value: "100 kg → 3家客户", status: "warning" },
        { icon: "3", label: "已消耗", value: "50 kg → 2个生产批次", status: "warning" },
      ],
    },
  ];

  const completedRecalls: RecallItem[] = [
    {
      id: "2",
      number: "RC-20251210-001",
      level: "normal",
      status: "completed",
      reason: "温控异常",
      batch: "",
      quantity: 80,
      startTime: "",
      completeTime: "2025-12-15",
    },
    {
      id: "3",
      number: "RC-20251128-002",
      level: "normal",
      status: "completed",
      reason: "客户投诉",
      batch: "",
      quantity: 30,
      startTime: "",
      completeTime: "2025-12-02",
    },
  ];

  const flowSteps: FlowStep[] = [
    { number: 1, title: "冻结库存", description: "锁定问题批次", status: "completed" },
    { number: 2, title: "通知客户", description: "发送召回通知", status: "completed" },
    { number: 3, title: "回收产品", description: "客户退货处理", status: "active" },
    { number: 4, title: "处置记录", description: "销毁/处理", status: "pending" },
    { number: 5, title: "原因分析", description: "根因分析报告", status: "pending" },
    { number: 6, title: "关闭召回", description: "完成闭环", status: "pending" },
  ];

  const handleCreateRecall = () => {
    Alert.alert("发起召回", "选择需要召回的批次");
  };

  const getStepStyle = (status: FlowStep["status"]) => {
    switch (status) {
      case "completed":
        return { bg: "#4CAF50", color: "#fff", connector: "#4CAF50" };
      case "active":
        return { bg: "#1976d2", color: "#fff", connector: "#e0e0e0" };
      case "pending":
        return { bg: "#e0e0e0", color: "#999", connector: "#e0e0e0" };
    }
  };

  const renderActiveRecall = (recall: RecallItem) => (
    <View key={recall.id} style={styles.recallCardActive}>
      <View style={styles.recallHeader}>
        <View style={styles.recallInfo}>
          <Text style={styles.recallNumber}>{recall.number}</Text>
          <View
            style={[
              styles.recallLevel,
              recall.level === "urgent" && styles.recallLevelUrgent,
            ]}
          >
            <Text style={styles.recallLevelText}>
              {recall.level === "urgent" ? "紧急" : "一般"}
            </Text>
          </View>
        </View>
        <View style={styles.recallStatus}>
          <Text style={styles.recallStatusText}>执行中</Text>
        </View>
      </View>

      <View style={styles.recallContent}>
        <View style={styles.recallRow}>
          <Text style={styles.recallLabel}>召回原因</Text>
          <Text style={styles.recallValue}>{recall.reason}</Text>
        </View>
        <View style={styles.recallRow}>
          <Text style={styles.recallLabel}>涉及批次</Text>
          <Text style={styles.recallValue}>{recall.batch}</Text>
        </View>
        <View style={styles.recallRow}>
          <Text style={styles.recallLabel}>涉及数量</Text>
          <Text style={[styles.recallValue, { color: "#f44336" }]}>
            {recall.quantity} kg
          </Text>
        </View>
        <View style={styles.recallRow}>
          <Text style={styles.recallLabel}>发起时间</Text>
          <Text style={styles.recallValue}>{recall.startTime}</Text>
        </View>
      </View>

      {recall.scope && (
        <View style={styles.recallScope}>
          <Text style={styles.recallScopeTitle}>追溯范围</Text>
          {recall.scope.map((item, index) => (
            <View key={index} style={styles.scopeItem}>
              <View style={styles.scopeIcon}>
                <Text style={styles.scopeIconText}>{item.icon}</Text>
              </View>
              <View style={styles.scopeContent}>
                <Text style={styles.scopeLabel}>{item.label}</Text>
                <Text style={styles.scopeValue}>{item.value}</Text>
              </View>
              <View
                style={[
                  styles.scopeStatus,
                  item.status === "success"
                    ? styles.scopeStatusSuccess
                    : styles.scopeStatusWarning,
                ]}
              >
                <Text
                  style={[
                    styles.scopeStatusText,
                    item.status === "success"
                      ? styles.scopeStatusTextSuccess
                      : styles.scopeStatusTextWarning,
                  ]}
                >
                  {item.status === "success" ? "已冻结" : "通知中"}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {recall.progress !== undefined && (
        <View style={styles.recallProgress}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>处理进度</Text>
            <Text style={styles.progressValue}>{Math.round(recall.progress * 100)}%</Text>
          </View>
          <ProgressBar
            progress={recall.progress}
            color="#4CAF50"
            style={styles.progressBar}
          />
        </View>
      )}

      <View style={styles.recallActions}>
        <Button
          mode="outlined"
          compact
          onPress={() => {}}
          style={styles.recallBtnSecondary}
          labelStyle={{ color: "#666", fontSize: 12 }}
        >
          查看详情
        </Button>
        <Button
          mode="contained"
          compact
          onPress={() => {}}
          style={styles.recallBtnPrimary}
          labelStyle={{ color: "#fff", fontSize: 12 }}
        >
          继续处理
        </Button>
      </View>
    </View>
  );

  const renderCompletedRecall = (recall: RecallItem) => (
    <View key={recall.id} style={styles.recallCard}>
      <View style={styles.recallHeader}>
        <View style={styles.recallInfo}>
          <Text style={styles.recallNumber}>{recall.number}</Text>
          <View style={styles.recallLevel}>
            <Text style={styles.recallLevelTextNormal}>
              {recall.level === "urgent" ? "紧急" : "一般"}
            </Text>
          </View>
        </View>
        <View style={styles.recallStatusCompleted}>
          <Text style={styles.recallStatusTextCompleted}>已完成</Text>
        </View>
      </View>
      <View style={styles.recallContent}>
        <View style={styles.recallRow}>
          <Text style={styles.recallLabel}>召回原因</Text>
          <Text style={styles.recallValue}>{recall.reason}</Text>
        </View>
        <View style={styles.recallRow}>
          <Text style={styles.recallLabel}>涉及数量</Text>
          <Text style={styles.recallValue}>{recall.quantity} kg</Text>
        </View>
        <View style={styles.recallRow}>
          <Text style={styles.recallLabel}>完成时间</Text>
          <Text style={styles.recallValue}>{recall.completeTime}</Text>
        </View>
      </View>
    </View>
  );

  const renderFlowStep = (step: FlowStep, index: number) => {
    const stepStyle = getStepStyle(step.status);
    const isLast = index === flowSteps.length - 1;

    return (
      <View key={step.number} style={styles.flowStepContainer}>
        <View style={styles.flowStepRow}>
          <View style={[styles.flowNumber, { backgroundColor: stepStyle.bg }]}>
            {step.status === "completed" ? (
              <MaterialCommunityIcons name="check" size={14} color="#fff" />
            ) : (
              <Text style={[styles.flowNumberText, { color: stepStyle.color }]}>
                {step.number}
              </Text>
            )}
          </View>
          <View style={styles.flowContent}>
            <Text
              style={[
                styles.flowTitle,
                step.status === "pending" && styles.flowTitlePending,
              ]}
            >
              {step.title}
            </Text>
            <Text style={styles.flowDesc}>{step.description}</Text>
          </View>
        </View>
        {!isLast && (
          <View
            style={[styles.flowConnector, { backgroundColor: stepStyle.connector }]}
          />
        )}
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
          <Text style={styles.headerTitle}>召回管理</Text>
          <Text style={styles.headerSubtitle}>产品召回追溯</Text>
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
              onPress={() => {
                if (tab.key === "create") {
                  handleCreateRecall();
                } else {
                  setSelectedTab(tab.key);
                }
              }}
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

        {selectedTab === "active" && (
          <>
            {/* 进行中的召回 */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, styles.sectionTitleDanger]}>
                进行中的召回
              </Text>
              {activeRecalls.map(renderActiveRecall)}
            </View>

            {/* 召回流程说明 */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>召回流程</Text>
              <View style={styles.flowContainer}>
                {flowSteps.map((step, index) => renderFlowStep(step, index))}
              </View>
            </View>
          </>
        )}

        {selectedTab === "completed" && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>历史召回记录</Text>
            {completedRecalls.map(renderCompletedRecall)}
          </View>
        )}

        {/* 操作按钮 */}
        <View style={styles.actionButtons}>
          <Button
            mode="contained"
            onPress={handleCreateRecall}
            style={styles.actionBtnPrimary}
            labelStyle={{ color: "#fff" }}
            icon="plus"
          >
            发起新召回
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
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#f5f5f5",
    alignItems: "center",
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
  sectionTitleDanger: {
    color: "#f44336",
  },
  recallCardActive: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: "#ffcdd2",
  },
  recallCard: {
    backgroundColor: "#f9f9f9",
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  recallHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  recallInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  recallNumber: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  recallLevel: {
    backgroundColor: "#f5f5f5",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  recallLevelUrgent: {
    backgroundColor: "#f44336",
  },
  recallLevelText: {
    fontSize: 11,
    color: "#fff",
    fontWeight: "500",
  },
  recallLevelTextNormal: {
    fontSize: 11,
    color: "#666",
  },
  recallStatus: {
    backgroundColor: "#fff3e0",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  recallStatusText: {
    fontSize: 12,
    color: "#f57c00",
    fontWeight: "500",
  },
  recallStatusCompleted: {
    backgroundColor: "#e8f5e9",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  recallStatusTextCompleted: {
    fontSize: 12,
    color: "#4CAF50",
    fontWeight: "500",
  },
  recallContent: {
    gap: 6,
    marginBottom: 12,
  },
  recallRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  recallLabel: {
    fontSize: 13,
    color: "#666",
  },
  recallValue: {
    fontSize: 13,
    color: "#333",
  },
  recallScope: {
    backgroundColor: "#f9f9f9",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  recallScopeTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#666",
    marginBottom: 10,
  },
  scopeItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  scopeIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#e0e0e0",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  scopeIconText: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#666",
  },
  scopeContent: {
    flex: 1,
  },
  scopeLabel: {
    fontSize: 12,
    color: "#999",
  },
  scopeValue: {
    fontSize: 13,
    color: "#333",
    fontWeight: "500",
  },
  scopeStatus: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  scopeStatusSuccess: {
    backgroundColor: "#e8f5e9",
  },
  scopeStatusWarning: {
    backgroundColor: "#fff3e0",
  },
  scopeStatusText: {
    fontSize: 11,
    fontWeight: "500",
  },
  scopeStatusTextSuccess: {
    color: "#4CAF50",
  },
  scopeStatusTextWarning: {
    color: "#f57c00",
  },
  recallProgress: {
    marginBottom: 12,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  progressLabel: {
    fontSize: 12,
    color: "#666",
  },
  progressValue: {
    fontSize: 12,
    fontWeight: "600",
    color: "#4CAF50",
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "#e0e0e0",
  },
  recallActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
  recallBtnSecondary: {
    borderRadius: 6,
    borderColor: "#ddd",
  },
  recallBtnPrimary: {
    borderRadius: 6,
    backgroundColor: "#4CAF50",
  },
  flowContainer: {
    paddingLeft: 8,
  },
  flowStepContainer: {
    marginBottom: 4,
  },
  flowStepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  flowNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  flowNumberText: {
    fontSize: 12,
    fontWeight: "bold",
  },
  flowContent: {
    flex: 1,
    paddingTop: 2,
  },
  flowTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  flowTitlePending: {
    color: "#999",
  },
  flowDesc: {
    fontSize: 12,
    color: "#999",
    marginTop: 2,
  },
  flowConnector: {
    width: 2,
    height: 20,
    marginLeft: 11,
    marginVertical: 4,
  },
  actionButtons: {
    paddingHorizontal: 16,
    marginTop: 16,
  },
  actionBtnPrimary: {
    borderRadius: 8,
    backgroundColor: "#4CAF50",
  },
});

export default WHRecallManageScreen;
