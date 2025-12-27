/**
 * 批次详情页面
 * 对应原型: warehouse/batch-detail.html
 */

import React from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { Text, Surface, Button, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { WHInventoryStackParamList } from "../../../types/navigation";

type NavigationProp = NativeStackNavigationProp<WHInventoryStackParamList>;
type RouteType = RouteProp<WHInventoryStackParamList, "WHBatchDetail">;

interface ConsumptionLog {
  id: string;
  time: string;
  action: string;
  type: "in" | "out";
}

export function WHBatchDetailScreen() {
  const theme = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteType>();
  const { batchId } = route.params;

  // 模拟批次数据
  const batchDetail = {
    batchNumber: "MB-20251223-001",
    materialName: "带鱼",
    materialType: "鲜品",
    status: "warning", // normal, warning, danger
    statusLabel: "即将过期",
    expiryDays: 3,
    currentQty: 256,
    initialQty: 300,
    consumed: 44,
    consumedPercent: 14.7,
    inboundTime: "2025-12-23 08:30",
    productionDate: "2025-12-23",
    shelfLife: "7天",
    expiryDate: "2025-12-30",
    location: "A区-冷藏库-01",
    temperature: "2°C",
    tempStatus: "符合要求",
    qualityGrade: "A级",
    supplier: "舟山渔业合作社",
    inboundNumber: "MB-20251223-001",
    inspector: "李质检",
    unitPrice: 30,
    batchValue: 7680,
    qualityScore: 94,
    qualityDetails: [
      { name: "新鲜度", value: 92 },
      { name: "温度合规", value: 98 },
      { name: "外观品质", value: 95 },
    ],
    correlationFactors: [
      { icon: "🏭", name: "供应商评级", score: "+12%", desc: "舟山渔业合作社 A级供应商", type: "positive" },
      { icon: "🌡️", name: "冷链控制", score: "+8%", desc: "全程2°C恒温，温度波动<0.5°C", type: "positive" },
      { icon: "📦", name: "库存周转", score: "持平", desc: "周转天数5天，行业平均5.2天", type: "neutral" },
      { icon: "⏰", name: "保质期压力", score: "-3%", desc: "剩余3天，建议加速消耗", type: "warning" },
    ],
    productionTrace: [
      {
        batch: "生产批次 PB-20251224-001",
        status: "合格",
        usage: "14kg",
        output: "12.8kg 带鱼片",
        conversionRate: "91.4%",
        qualityTag: "成品质检 A级",
      },
      {
        batch: "出货订单 SH-20251225-001",
        status: "已交付",
        usage: "30kg",
        output: "永辉超市",
        conversionRate: "★★★★★",
        qualityTag: "客户反馈 优秀",
      },
    ],
    consumptionLogs: [
      { id: "1", time: "12-25 15:00", action: "出库 -30kg (订单SH-20251225-001)", type: "out" },
      { id: "2", time: "12-24 14:00", action: "生产消耗 -14kg (生产批次PB-001)", type: "out" },
      { id: "3", time: "12-23 08:30", action: "入库 +300kg (张仓管)", type: "in" },
    ] as ConsumptionLog[],
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case "warning":
        return { color: "#f57c00", bgColor: "#fff3e0", icon: "!" };
      case "danger":
        return { color: "#d32f2f", bgColor: "#ffebee", icon: "!" };
      default:
        return { color: "#4CAF50", bgColor: "#e8f5e9", icon: "✓" };
    }
  };

  const statusStyle = getStatusStyle(batchDetail.status);

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
          <Text style={styles.headerTitle}>批次详情</Text>
          <Text style={styles.headerSubtitle}>{batchDetail.batchNumber}</Text>
        </View>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* 批次状态 */}
        <Surface
          style={[styles.statusCard, { backgroundColor: statusStyle.bgColor }]}
          elevation={1}
        >
          <View style={[styles.statusIcon, { backgroundColor: statusStyle.color }]}>
            <Text style={styles.statusIconText}>{statusStyle.icon}</Text>
          </View>
          <View style={styles.statusInfo}>
            <Text style={[styles.statusTitle, { color: statusStyle.color }]}>
              {batchDetail.statusLabel}
            </Text>
            <Text style={styles.statusDesc}>
              剩余 {batchDetail.expiryDays} 天 | 建议优先消耗
            </Text>
          </View>
        </Surface>

        {/* 批次信息 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>批次信息</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>批次号</Text>
            <Text style={styles.infoValue}>{batchDetail.batchNumber}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>物料名称</Text>
            <Text style={styles.infoValue}>{batchDetail.materialName}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>物料类型</Text>
            <Text style={styles.infoValue}>{batchDetail.materialType}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>当前数量</Text>
            <Text style={[styles.infoValue, styles.highlightValue]}>
              {batchDetail.currentQty} kg
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>初始数量</Text>
            <Text style={styles.infoValue}>{batchDetail.initialQty} kg</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>已消耗</Text>
            <Text style={styles.infoValue}>
              {batchDetail.consumed} kg ({batchDetail.consumedPercent}%)
            </Text>
          </View>
        </View>

        {/* 时间信息 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>时间信息</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>入库日期</Text>
            <Text style={styles.infoValue}>{batchDetail.inboundTime}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>生产日期</Text>
            <Text style={styles.infoValue}>{batchDetail.productionDate}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>保质期</Text>
            <Text style={styles.infoValue}>{batchDetail.shelfLife}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>到期日期</Text>
            <Text style={[styles.infoValue, { color: "#f57c00" }]}>
              {batchDetail.expiryDate} ({batchDetail.expiryDays}天后)
            </Text>
          </View>
        </View>

        {/* 储存信息 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>储存信息</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>库位</Text>
            <Text style={styles.infoValue}>{batchDetail.location}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>储存温度</Text>
            <Text style={[styles.infoValue, { color: "#4CAF50" }]}>
              {batchDetail.temperature} ({batchDetail.tempStatus})
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>质量等级</Text>
            <Text style={styles.infoValue}>{batchDetail.qualityGrade}</Text>
          </View>
        </View>

        {/* 来源信息 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>来源信息</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>供应商</Text>
            <Text style={styles.infoValue}>{batchDetail.supplier}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>入库单号</Text>
            <Text style={[styles.infoValue, { color: "#4CAF50" }]}>
              {batchDetail.inboundNumber}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>质检员</Text>
            <Text style={styles.infoValue}>{batchDetail.inspector}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>单价</Text>
            <Text style={styles.infoValue}>¥{batchDetail.unitPrice}/kg</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>批次价值</Text>
            <Text style={[styles.infoValue, styles.highlightValue]}>
              ¥{batchDetail.batchValue.toLocaleString()}
            </Text>
          </View>
        </View>

        {/* AI 质量关联分析 */}
        <View style={styles.aiSection}>
          <View style={styles.aiHeader}>
            <View style={styles.aiTitleRow}>
              <Text style={styles.aiIcon}>🤖</Text>
              <Text style={styles.aiTitle}>AI 质量关联分析</Text>
            </View>
            <View style={styles.aiBadge}>
              <Text style={styles.aiBadgeText}>智能分析</Text>
            </View>
          </View>

          {/* 质量评分 */}
          <View style={styles.qualityScoreCard}>
            <View style={styles.qualityScoreMain}>
              <Text style={styles.qualityScoreValue}>{batchDetail.qualityScore}</Text>
              <Text style={styles.qualityScoreLabel}>质量评分</Text>
            </View>
            <View style={styles.qualityDetails}>
              {batchDetail.qualityDetails.map((detail, index) => (
                <View key={index} style={styles.qualityDetailItem}>
                  <Text style={styles.qualityDetailLabel}>{detail.name}</Text>
                  <View style={styles.qualityDetailBar}>
                    <View
                      style={[styles.qualityBarFill, { width: `${detail.value}%` }]}
                    />
                  </View>
                  <Text style={styles.qualityDetailValue}>{detail.value}%</Text>
                </View>
              ))}
            </View>
          </View>

          {/* 关联因素 */}
          <View style={styles.correlationCard}>
            <Text style={styles.correlationTitle}>📊 关联因素分析</Text>
            {batchDetail.correlationFactors.map((factor, index) => (
              <View
                key={index}
                style={[
                  styles.correlationItem,
                  factor.type === "positive" && styles.correlationPositive,
                  factor.type === "warning" && styles.correlationWarning,
                ]}
              >
                <View style={styles.correlationFactor}>
                  <Text style={styles.correlationIcon}>{factor.icon}</Text>
                  <Text style={styles.correlationName}>{factor.name}</Text>
                </View>
                <View style={styles.correlationValue}>
                  <Text
                    style={[
                      styles.correlationScore,
                      factor.type === "positive" && { color: "#4CAF50" },
                      factor.type === "warning" && { color: "#f57c00" },
                    ]}
                  >
                    {factor.score}
                  </Text>
                  <Text style={styles.correlationDesc}>{factor.desc}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* 消耗记录 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>消耗记录</Text>
          <View style={styles.timeline}>
            {batchDetail.consumptionLogs.map((log, index) => (
              <View key={log.id} style={styles.timelineItem}>
                <View
                  style={[
                    styles.timelineDot,
                    log.type === "in" && styles.timelineDotIn,
                    log.type === "out" && styles.timelineDotOut,
                  ]}
                />
                {index < batchDetail.consumptionLogs.length - 1 && (
                  <View style={styles.timelineLine} />
                )}
                <View style={styles.timelineContent}>
                  <Text style={styles.timelineTime}>{log.time}</Text>
                  <Text style={styles.timelineText}>{log.action}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* 底部操作 */}
        <View style={styles.bottomActions}>
          <Button
            mode="outlined"
            onPress={() => navigation.navigate("WHBatchTrace", { batchId: batchId })}
            style={styles.actionBtn}
            labelStyle={{ color: "#666" }}
          >
            追溯查询
          </Button>
          <Button
            mode="outlined"
            onPress={() => navigation.navigate("WHExpireHandle" as any)}
            style={[styles.actionBtn, styles.warningActionBtn]}
            labelStyle={{ color: "#f57c00" }}
          >
            过期处理
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
  statusCard: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
  },
  statusIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  statusIconText: {
    fontSize: 20,
    color: "#fff",
    fontWeight: "bold",
  },
  statusInfo: {},
  statusTitle: {
    fontSize: 18,
    fontWeight: "bold",
  },
  statusDesc: {
    fontSize: 13,
    color: "#666",
    marginTop: 2,
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
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f5f5f5",
  },
  infoLabel: {
    fontSize: 14,
    color: "#666",
  },
  infoValue: {
    fontSize: 14,
    color: "#333",
  },
  highlightValue: {
    color: "#4CAF50",
    fontWeight: "600",
  },
  aiSection: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    padding: 16,
  },
  aiHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  aiTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  aiIcon: {
    fontSize: 20,
  },
  aiTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  aiBadge: {
    backgroundColor: "#e8f5e9",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  aiBadgeText: {
    fontSize: 12,
    color: "#4CAF50",
    fontWeight: "500",
  },
  qualityScoreCard: {
    backgroundColor: "#f9f9f9",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  qualityScoreMain: {
    alignItems: "center",
    marginBottom: 16,
  },
  qualityScoreValue: {
    fontSize: 48,
    fontWeight: "bold",
    color: "#4CAF50",
  },
  qualityScoreLabel: {
    fontSize: 14,
    color: "#666",
  },
  qualityDetails: {
    gap: 10,
  },
  qualityDetailItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  qualityDetailLabel: {
    width: 70,
    fontSize: 13,
    color: "#666",
  },
  qualityDetailBar: {
    flex: 1,
    height: 6,
    backgroundColor: "#e0e0e0",
    borderRadius: 3,
  },
  qualityBarFill: {
    height: "100%",
    backgroundColor: "#4CAF50",
    borderRadius: 3,
  },
  qualityDetailValue: {
    width: 40,
    fontSize: 13,
    color: "#333",
    textAlign: "right",
  },
  correlationCard: {
    backgroundColor: "#f9f9f9",
    borderRadius: 12,
    padding: 16,
  },
  correlationTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 12,
  },
  correlationItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  correlationPositive: {},
  correlationWarning: {},
  correlationFactor: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  correlationIcon: {
    fontSize: 16,
  },
  correlationName: {
    fontSize: 14,
    color: "#333",
    fontWeight: "500",
  },
  correlationValue: {
    marginLeft: 24,
  },
  correlationScore: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
  },
  correlationDesc: {
    fontSize: 12,
    color: "#999",
    marginTop: 2,
  },
  timeline: {},
  timelineItem: {
    flexDirection: "row",
    minHeight: 50,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#e0e0e0",
    marginTop: 4,
  },
  timelineDotIn: {
    backgroundColor: "#4CAF50",
  },
  timelineDotOut: {
    backgroundColor: "#f44336",
  },
  timelineLine: {
    position: "absolute",
    left: 4,
    top: 18,
    bottom: 0,
    width: 2,
    backgroundColor: "#e0e0e0",
  },
  timelineContent: {
    flex: 1,
    marginLeft: 12,
    paddingBottom: 16,
  },
  timelineTime: {
    fontSize: 12,
    color: "#999",
    marginBottom: 2,
  },
  timelineText: {
    fontSize: 14,
    color: "#333",
  },
  bottomActions: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  actionBtn: {
    flex: 1,
    borderRadius: 8,
    borderColor: "#ddd",
  },
  warningActionBtn: {
    borderColor: "#f57c00",
  },
});

export default WHBatchDetailScreen;
