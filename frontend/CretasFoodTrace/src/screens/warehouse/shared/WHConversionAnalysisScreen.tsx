/**
 * 转换率分析页面
 * 对应原型: warehouse/conversion-analysis.html
 */

import React, { useState } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import { Text, Button, ProgressBar, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

const screenWidth = Dimensions.get("window").width;

interface CategoryConversion {
  id: string;
  name: string;
  rate: number;
  trend: "up" | "down" | "flat";
  trendValue: string;
  input: number;
  output: number;
  target: number;
  status: "good" | "warning" | "normal";
  statusText: string;
}

interface LossItem {
  reason: string;
  percent: number;
  level: "danger" | "warning" | "normal";
}

interface SupplierImpact {
  id: string;
  name: string;
  grade: "A" | "B" | "C";
  conversionRate: number;
  qualityRate: number;
  sharePercent: number;
  status: "good" | "warning" | "normal";
  insight: string;
  insightIcon: string;
}

interface AIInsight {
  id: string;
  type: "warning" | "info" | "success" | "tip";
  icon: string;
  content: string;
}

export function WHConversionAnalysisScreen() {
  const theme = useTheme();
  const navigation = useNavigation();

  const [selectedPeriod, setSelectedPeriod] = useState("week");

  const periods = [
    { key: "today", label: "今日" },
    { key: "week", label: "本周" },
    { key: "month", label: "本月" },
    { key: "quarter", label: "季度" },
  ];

  const overallConversion = {
    rate: 92.3,
    trend: "up",
    trendValue: "1.2",
    industryAvg: 91.0,
    target: 93.0,
    gap: -0.7,
  };

  const categoryConversions: CategoryConversion[] = [
    {
      id: "1",
      name: "带鱼片",
      rate: 94.5,
      trend: "up",
      trendValue: "0.8",
      input: 500,
      output: 472.5,
      target: 93,
      status: "good",
      statusText: "超过目标",
    },
    {
      id: "2",
      name: "虾仁",
      rate: 88.5,
      trend: "down",
      trendValue: "1.2",
      input: 300,
      output: 265.5,
      target: 91,
      status: "warning",
      statusText: "低于行业",
    },
    {
      id: "3",
      name: "鲈鱼片",
      rate: 92.0,
      trend: "flat",
      trendValue: "持平",
      input: 200,
      output: 184,
      target: 92,
      status: "normal",
      statusText: "达到目标",
    },
    {
      id: "4",
      name: "蟹肉",
      rate: 95.2,
      trend: "up",
      trendValue: "2.1",
      input: 150,
      output: 142.8,
      target: 90,
      status: "good",
      statusText: "优秀",
    },
  ];

  const lossSummary = {
    normal: 6.2,
    abnormal: 1.5,
  };

  const lossBreakdown: LossItem[] = [
    { reason: "去壳环节 - 虾仁", percent: 0.8, level: "danger" },
    { reason: "切片厚度不均 - 带鱼", percent: 0.4, level: "warning" },
    { reason: "原料损坏 - 鲈鱼", percent: 0.3, level: "normal" },
  ];

  const weeklyTrend = [
    { day: "周一", rate: 91.5 },
    { day: "周二", rate: 93.0 },
    { day: "周三", rate: 89.0 },
    { day: "周四", rate: 94.0 },
    { day: "周五", rate: 95.5 },
    { day: "周六", rate: 96.0 },
    { day: "周日", rate: 92.0 },
  ];

  const aiInsights: AIInsight[] = [
    {
      id: "1",
      type: "warning",
      icon: "alert",
      content: "虾仁去壳环节损耗率(88.5%)低于行业平均(91%)，建议：\n1. 检查去壳设备刀片磨损情况\n2. 对比A班与B班操作方法差异\n3. 优化后预计可提升转换率3-5%",
    },
    {
      id: "2",
      type: "info",
      icon: "chart-bar",
      content: "带鱼片转换率优秀(94.5%)，建议总结当前工艺流程，作为其他品类参考标准",
    },
    {
      id: "3",
      type: "success",
      icon: "check-circle",
      content: "蟹肉加工效率提升明显(↑2.1%)，与上周更换供应商相关，建议继续与\"阳澄湖蟹业\"保持合作",
    },
    {
      id: "4",
      type: "tip",
      icon: "lightbulb",
      content: "基于历史数据预测，若采纳全部优化建议，整体转换率可从92.3%提升至94.5%，每月可节约原材料成本约¥12,000",
    },
  ];

  const supplierImpacts: SupplierImpact[] = [
    {
      id: "1",
      name: "渔港直采",
      grade: "A",
      conversionRate: 94.8,
      qualityRate: 98.5,
      sharePercent: 45,
      status: "good",
      insight: "原料新鲜度高，损耗率低于平均1.2%",
      insightIcon: "lightbulb",
    },
    {
      id: "2",
      name: "海洋水产",
      grade: "B",
      conversionRate: 89.2,
      qualityRate: 92.0,
      sharePercent: 35,
      status: "warning",
      insight: "近2周质检合格率下降6%，建议加强入库检验",
      insightIcon: "alert",
    },
    {
      id: "3",
      name: "阳澄湖蟹业",
      grade: "A",
      conversionRate: 95.2,
      qualityRate: 99.0,
      sharePercent: 20,
      status: "normal",
      insight: "品质稳定，建议增加采购比例",
      insightIcon: "check-circle",
    },
  ];

  const getRateColor = (status: string) => {
    switch (status) {
      case "good": return "#4CAF50";
      case "warning": return "#f57c00";
      default: return "#666";
    }
  };

  const getInsightStyle = (type: AIInsight["type"]) => {
    switch (type) {
      case "warning": return { bg: "#fff3e0", border: "#f57c00", icon: "#f57c00" };
      case "info": return { bg: "#e3f2fd", border: "#1976d2", icon: "#1976d2" };
      case "success": return { bg: "#e8f5e9", border: "#4CAF50", icon: "#4CAF50" };
      case "tip": return { bg: "#f3e5f5", border: "#7b1fa2", icon: "#7b1fa2" };
    }
  };

  const getBarHeight = (rate: number) => {
    const minRate = 89;
    const maxRate = 96;
    const percentage = ((rate - minRate) / (maxRate - minRate)) * 100;
    return Math.max(10, Math.min(100, percentage));
  };

  const renderCategoryItem = (item: CategoryConversion) => (
    <View key={item.id} style={styles.categoryItem}>
      <View style={styles.categoryHeader}>
        <Text style={styles.categoryName}>{item.name}</Text>
        <View style={styles.categoryRate}>
          <Text style={[styles.rateValue, { color: getRateColor(item.status) }]}>
            {item.rate}%
          </Text>
          <Text style={[
            styles.rateTrend,
            { color: item.trend === "up" ? "#4CAF50" : item.trend === "down" ? "#f44336" : "#999" }
          ]}>
            {item.trend === "up" ? "↑" : item.trend === "down" ? "↓" : "→"}
            {item.trendValue}{item.trend !== "flat" && "%"}
          </Text>
        </View>
      </View>
      <View style={styles.categoryBar}>
        <View
          style={[
            styles.barFill,
            {
              width: `${item.rate}%`,
              backgroundColor: getRateColor(item.status),
            },
          ]}
        />
        <View style={[styles.barTarget, { left: `${item.target}%` }]} />
      </View>
      <View style={styles.categoryDetail}>
        <Text style={styles.detailText}>
          投入: {item.input}kg → 产出: {item.output}kg
        </Text>
        <Text style={[styles.statusText, { color: getRateColor(item.status) }]}>
          {item.statusText}
        </Text>
      </View>
    </View>
  );

  const renderSupplierItem = (item: SupplierImpact) => (
    <View
      key={item.id}
      style={[
        styles.supplierItem,
        item.status === "good" && styles.supplierGood,
        item.status === "warning" && styles.supplierWarning,
      ]}
    >
      <View style={styles.supplierHeader}>
        <Text style={styles.supplierName}>{item.name}</Text>
        <View style={[styles.gradeBadge, { backgroundColor: item.grade === "A" ? "#e8f5e9" : "#fff3e0" }]}>
          <Text style={[styles.gradeText, { color: item.grade === "A" ? "#4CAF50" : "#f57c00" }]}>
            {item.grade}级
          </Text>
        </View>
      </View>
      <View style={styles.supplierStats}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>供货转换率</Text>
          <Text style={[styles.statValue, { color: getRateColor(item.status) }]}>
            {item.conversionRate}%
          </Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>质检合格率</Text>
          <Text style={styles.statValue}>{item.qualityRate}%</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>供货占比</Text>
          <Text style={styles.statValue}>{item.sharePercent}%</Text>
        </View>
      </View>
      <View style={styles.supplierInsight}>
        <MaterialCommunityIcons
          name={item.insightIcon as any}
          size={14}
          color={item.status === "warning" ? "#f57c00" : "#4CAF50"}
        />
        <Text style={styles.insightText}>{item.insight}</Text>
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
          <Text style={styles.headerTitle}>转换率分析</Text>
          <Text style={styles.headerSubtitle}>AI 智能生产效率分析</Text>
        </View>
        <View style={styles.aiBadge}>
          <MaterialCommunityIcons name="robot" size={16} color="#fff" />
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* 核心转换率指标 */}
        <View style={styles.mainCard}>
          <View style={styles.mainCardHeader}>
            <View style={styles.mainCardTitle}>
              <MaterialCommunityIcons name="chart-box" size={20} color="#7c3aed" />
              <Text style={styles.mainCardTitleText}>本月整体转换率</Text>
            </View>
            <View style={styles.aiTag}>
              <Text style={styles.aiTagText}>AI分析</Text>
            </View>
          </View>

          <View style={styles.mainRate}>
            <View style={styles.rateMain}>
              <Text style={styles.rateMainValue}>{overallConversion.rate}</Text>
              <Text style={styles.rateMainUnit}>%</Text>
            </View>
            <View style={styles.rateTrendBox}>
              <Text style={styles.rateTrendUp}>↑ {overallConversion.trendValue}%</Text>
              <Text style={styles.rateTrendLabel}>较上月</Text>
            </View>
          </View>

          <View style={styles.comparison}>
            <View style={styles.comparisonItem}>
              <Text style={styles.comparisonLabel}>行业平均</Text>
              <Text style={styles.comparisonValue}>{overallConversion.industryAvg}%</Text>
            </View>
            <View style={styles.comparisonItem}>
              <Text style={styles.comparisonLabel}>配置目标</Text>
              <Text style={styles.comparisonValue}>{overallConversion.target}%</Text>
            </View>
            <View style={styles.comparisonItem}>
              <Text style={styles.comparisonLabel}>差距</Text>
              <Text style={[styles.comparisonValue, { color: "#f57c00" }]}>
                {overallConversion.gap}%
              </Text>
            </View>
          </View>
        </View>

        {/* 时间筛选 */}
        <View style={styles.filterTabs}>
          {periods.map((period) => (
            <TouchableOpacity
              key={period.key}
              style={[
                styles.filterTab,
                selectedPeriod === period.key && styles.filterTabActive,
              ]}
              onPress={() => setSelectedPeriod(period.key)}
            >
              <Text
                style={[
                  styles.filterTabText,
                  selectedPeriod === period.key && styles.filterTabTextActive,
                ]}
              >
                {period.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* 品类转换率 */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: "#7c3aed" }]}>
            品类转换率分析
          </Text>
          {categoryConversions.map(renderCategoryItem)}
        </View>

        {/* 损耗分析 */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: "#7c3aed" }]}>
            损耗分析
          </Text>
          <View style={styles.lossSummary}>
            <View style={styles.lossSummaryItem}>
              <View style={[styles.lossIcon, { backgroundColor: "#e8f5e9" }]}>
                <MaterialCommunityIcons name="check" size={16} color="#4CAF50" />
              </View>
              <View style={styles.lossInfo}>
                <Text style={styles.lossLabel}>正常损耗</Text>
                <Text style={styles.lossValue}>{lossSummary.normal}%</Text>
              </View>
            </View>
            <View style={styles.lossSummaryItem}>
              <View style={[styles.lossIcon, { backgroundColor: "#ffebee" }]}>
                <MaterialCommunityIcons name="alert" size={16} color="#f44336" />
              </View>
              <View style={styles.lossInfo}>
                <Text style={styles.lossLabel}>异常损耗</Text>
                <Text style={[styles.lossValue, { color: "#f44336" }]}>
                  {lossSummary.abnormal}%
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.lossBreakdown}>
            <Text style={styles.lossBreakdownTitle}>异常损耗明细</Text>
            {lossBreakdown.map((item, index) => (
              <View key={index} style={styles.lossBreakdownItem}>
                <Text style={styles.lossReason}>{item.reason}</Text>
                <Text style={[
                  styles.lossPercent,
                  { color: item.level === "danger" ? "#f44336" : item.level === "warning" ? "#f57c00" : "#666" }
                ]}>
                  {item.percent}%
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* 趋势图表 */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: "#7c3aed" }]}>
            转换率趋势
          </Text>
          <View style={styles.chartLegend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: "#7c3aed" }]} />
              <Text style={styles.legendText}>实际转换率</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: "#f57c00" }]} />
              <Text style={styles.legendText}>目标线(93%)</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: "#999" }]} />
              <Text style={styles.legendText}>行业平均(91%)</Text>
            </View>
          </View>
          <View style={styles.chartContainer}>
            <View style={styles.chartYAxis}>
              <Text style={styles.chartYLabel}>96%</Text>
              <Text style={styles.chartYLabel}>93%</Text>
              <Text style={styles.chartYLabel}>91%</Text>
              <Text style={styles.chartYLabel}>89%</Text>
            </View>
            <View style={styles.chartArea}>
              <View style={[styles.targetLine, { bottom: "57%" }]} />
              <View style={[styles.industryLine, { bottom: "29%" }]} />
              <View style={styles.barsContainer}>
                {weeklyTrend.map((item, index) => (
                  <View key={index} style={styles.barGroup}>
                    <View
                      style={[
                        styles.bar,
                        {
                          height: `${getBarHeight(item.rate)}%`,
                          backgroundColor: item.rate >= 93 ? "#4CAF50" : item.rate < 90 ? "#f57c00" : "#7c3aed",
                        },
                      ]}
                    />
                    <Text style={styles.barLabel}>{item.day}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </View>

        {/* AI 优化建议 */}
        <View style={styles.aiInsightCard}>
          <View style={styles.aiInsightHeader}>
            <MaterialCommunityIcons name="robot" size={20} color="#7c3aed" />
            <Text style={styles.aiInsightTitle}>AI 优化建议</Text>
            <View style={styles.aiTag}>
              <Text style={styles.aiTagText}>智能分析</Text>
            </View>
          </View>
          <View style={styles.aiInsightContent}>
            {aiInsights.map((insight) => {
              const style = getInsightStyle(insight.type);
              return (
                <View
                  key={insight.id}
                  style={[
                    styles.aiInsightItem,
                    { backgroundColor: style.bg, borderLeftColor: style.border },
                  ]}
                >
                  <MaterialCommunityIcons
                    name={insight.icon as any}
                    size={16}
                    color={style.icon}
                  />
                  <Text style={styles.aiInsightText}>{insight.content}</Text>
                </View>
              );
            })}
          </View>
          <View style={styles.aiInsightFooter}>
            <Text style={styles.aiTime}>AI分析于 3分钟前</Text>
            <TouchableOpacity style={styles.generateReportBtn}>
              <Text style={styles.generateReportText}>生成报告</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 供应商影响分析 */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: "#7c3aed" }]}>
            供应商影响分析
          </Text>
          {supplierImpacts.map(renderSupplierItem)}
        </View>

        {/* 操作按钮 */}
        <View style={styles.actionButtons}>
          <Button
            mode="outlined"
            onPress={() => {}}
            style={styles.secondaryBtn}
            labelStyle={{ color: "#666" }}
          >
            导出报表
          </Button>
          <Button
            mode="contained"
            onPress={() => {}}
            style={styles.primaryBtn}
            labelStyle={{ color: "#fff" }}
          >
            AI深度分析
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
    backgroundColor: "#7c3aed",
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
  aiBadge: {
    padding: 4,
  },
  content: {
    flex: 1,
  },
  mainCard: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e0d4f7",
  },
  mainCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  mainCardTitle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  mainCardTitleText: {
    fontSize: 14,
    color: "#333",
    fontWeight: "500",
  },
  aiTag: {
    backgroundColor: "#7c3aed",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  aiTagText: {
    fontSize: 10,
    color: "#fff",
    fontWeight: "500",
  },
  mainRate: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    marginBottom: 16,
  },
  rateMain: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  rateMainValue: {
    fontSize: 48,
    fontWeight: "700",
    color: "#7c3aed",
  },
  rateMainUnit: {
    fontSize: 24,
    fontWeight: "500",
    color: "#7c3aed",
    marginLeft: 4,
  },
  rateTrendBox: {
    alignItems: "center",
  },
  rateTrendUp: {
    fontSize: 16,
    fontWeight: "600",
    color: "#4CAF50",
  },
  rateTrendLabel: {
    fontSize: 12,
    color: "#999",
  },
  comparison: {
    flexDirection: "row",
    justifyContent: "space-around",
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
    paddingTop: 12,
  },
  comparisonItem: {
    alignItems: "center",
  },
  comparisonLabel: {
    fontSize: 12,
    color: "#999",
  },
  comparisonValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginTop: 4,
  },
  filterTabs: {
    flexDirection: "row",
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 8,
    padding: 4,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 6,
  },
  filterTabActive: {
    backgroundColor: "#7c3aed",
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
    marginBottom: 12,
  },
  categoryItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  categoryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  categoryName: {
    fontSize: 14,
    fontWeight: "500",
    color: "#333",
  },
  categoryRate: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  rateValue: {
    fontSize: 16,
    fontWeight: "600",
  },
  rateTrend: {
    fontSize: 12,
  },
  categoryBar: {
    height: 8,
    backgroundColor: "#f0f0f0",
    borderRadius: 4,
    position: "relative",
    marginBottom: 8,
  },
  barFill: {
    height: "100%",
    borderRadius: 4,
  },
  barTarget: {
    position: "absolute",
    top: -2,
    width: 2,
    height: 12,
    backgroundColor: "#f57c00",
  },
  categoryDetail: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  detailText: {
    fontSize: 12,
    color: "#999",
  },
  statusText: {
    fontSize: 12,
    fontWeight: "500",
  },
  lossSummary: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 16,
  },
  lossSummaryItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fafafa",
    padding: 12,
    borderRadius: 8,
    gap: 12,
  },
  lossIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  lossInfo: {},
  lossLabel: {
    fontSize: 12,
    color: "#999",
  },
  lossValue: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  lossBreakdown: {
    backgroundColor: "#fafafa",
    borderRadius: 8,
    padding: 12,
  },
  lossBreakdownTitle: {
    fontSize: 13,
    fontWeight: "500",
    color: "#666",
    marginBottom: 8,
  },
  lossBreakdownItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  lossReason: {
    fontSize: 13,
    color: "#333",
  },
  lossPercent: {
    fontSize: 13,
    fontWeight: "500",
  },
  chartLegend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    marginBottom: 12,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    color: "#666",
  },
  chartContainer: {
    flexDirection: "row",
    height: 150,
  },
  chartYAxis: {
    width: 40,
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  chartYLabel: {
    fontSize: 10,
    color: "#999",
  },
  chartArea: {
    flex: 1,
    position: "relative",
    backgroundColor: "#fafafa",
    borderRadius: 8,
  },
  targetLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "#f57c00",
    opacity: 0.5,
  },
  industryLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "#999",
    opacity: 0.5,
  },
  barsContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 8,
    paddingBottom: 20,
  },
  barGroup: {
    flex: 1,
    alignItems: "center",
  },
  bar: {
    width: 20,
    borderRadius: 4,
    minHeight: 10,
  },
  barLabel: {
    fontSize: 9,
    color: "#999",
    marginTop: 4,
    position: "absolute",
    bottom: 0,
  },
  aiInsightCard: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e0d4f7",
  },
  aiInsightHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  aiInsightTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  aiInsightContent: {
    gap: 8,
  },
  aiInsightItem: {
    flexDirection: "row",
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    gap: 8,
  },
  aiInsightText: {
    flex: 1,
    fontSize: 12,
    color: "#333",
    lineHeight: 18,
  },
  aiInsightFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },
  aiTime: {
    fontSize: 11,
    color: "#999",
  },
  generateReportBtn: {
    backgroundColor: "#7c3aed",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  generateReportText: {
    fontSize: 12,
    color: "#fff",
    fontWeight: "500",
  },
  supplierItem: {
    backgroundColor: "#fafafa",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: "#ddd",
  },
  supplierGood: {
    borderLeftColor: "#4CAF50",
  },
  supplierWarning: {
    borderLeftColor: "#f57c00",
  },
  supplierHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  supplierName: {
    fontSize: 14,
    fontWeight: "500",
    color: "#333",
  },
  gradeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  gradeText: {
    fontSize: 11,
    fontWeight: "500",
  },
  supplierStats: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  statItem: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 8,
    borderRadius: 6,
    alignItems: "center",
  },
  statLabel: {
    fontSize: 10,
    color: "#999",
  },
  statValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginTop: 2,
  },
  supplierInsight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  insightText: {
    fontSize: 12,
    color: "#666",
  },
  actionButtons: {
    flexDirection: "row",
    paddingHorizontal: 16,
    marginTop: 16,
    gap: 12,
  },
  secondaryBtn: {
    flex: 1,
    borderRadius: 8,
    borderColor: "#ddd",
  },
  primaryBtn: {
    flex: 1,
    borderRadius: 8,
    backgroundColor: "#7c3aed",
  },
});

export default WHConversionAnalysisScreen;
