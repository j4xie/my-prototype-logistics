/**
 * 出入库统计页面
 * 对应原型: warehouse/io-statistics.html
 */

import React, { useState } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from "react-native";
import { Text, Surface, Button, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useTranslation } from 'react-i18next';
import { WHInventoryStackParamList } from "../../../types/navigation";

type NavigationProp = NativeStackNavigationProp<WHInventoryStackParamList>;

type TimeFilter = "today" | "week" | "month" | "custom";
type AIPredictionPeriod = "7" | "14" | "30";

interface DailyStat {
  day: string;
  weekday: string;
  inbound: number;
  outbound: number;
}

interface CategoryStat {
  name: string;
  percent: number;
  inbound: number;
  outbound: number;
}

export function WHIOStatisticsScreen() {
  const { t } = useTranslation('warehouse');
  const theme = useTheme();
  const navigation = useNavigation<NavigationProp>();

  const [activeFilter, setActiveFilter] = useState<TimeFilter>("week");
  const [aiPeriod, setAIPeriod] = useState<AIPredictionPeriod>("7");

  const overviewData = {
    inboundTotal: 2580,
    inboundChange: 12,
    outboundTotal: 2150,
    outboundChange: 8,
  };

  const dailyStats: DailyStat[] = [
    { day: "26", weekday: "周四", inbound: 430, outbound: 380 },
    { day: "25", weekday: "周三", inbound: 520, outbound: 450 },
    { day: "24", weekday: "周二", inbound: 380, outbound: 420 },
    { day: "23", weekday: "周一", inbound: 450, outbound: 350 },
  ];

  const categoryStats: CategoryStat[] = [
    { name: "带鱼", percent: 35, inbound: 903, outbound: 752 },
    { name: "虾仁", percent: 28, inbound: 722, outbound: 602 },
    { name: "鲈鱼", percent: 22, inbound: 568, outbound: 473 },
    { name: "蟹类", percent: 15, inbound: 387, outbound: 323 },
  ];

  const aiPrediction = {
    expectedConsumption: -180,
    fishStockDays: 5,
    suggestedRestock: 200,
    confidence: 92,
    insights: [
      {
        type: "warning" as const,
        icon: "⚠️",
        text: "基于历史消耗趋势，带鱼库存将在5天后低于安全线，建议提前补货",
      },
      {
        type: "info" as const,
        icon: "📅",
        text: "下周为年货采购高峰期，预计出库量将增加30%",
      },
      {
        type: "success" as const,
        icon: "✅",
        text: "虾仁、鲈鱼库存充足，可支撑未来14天需求",
      },
    ],
  };

  const handleExport = () => {
    Alert.alert(t('inbound.create.success'), t('conversion.exportReport'));
  };

  const handleShare = () => {
    Alert.alert(t('inbound.create.alert'), t('conversion.generateReport'));
  };

  const getBalance = (inbound: number, outbound: number) => {
    return inbound - outbound;
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
          <Text style={styles.headerTitle}>{t('ioStatistics.title')}</Text>
          <Text style={styles.headerSubtitle}>{t('ioStatistics.headerSubtitle')}</Text>
        </View>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* 时间筛选 */}
        <View style={styles.filterTabs}>
          {[
            { key: "today" as TimeFilter, label: t('conversion.period.today') },
            { key: "week" as TimeFilter, label: t('conversion.period.week') },
            { key: "month" as TimeFilter, label: t('conversion.period.month') },
            { key: "custom" as TimeFilter, label: t('ioStatistics.dateRange') },
          ].map((filter) => (
            <TouchableOpacity
              key={filter.key}
              style={[
                styles.filterTab,
                activeFilter === filter.key && styles.filterTabActive,
              ]}
              onPress={() => setActiveFilter(filter.key)}
            >
              <Text
                style={[
                  styles.filterTabText,
                  activeFilter === filter.key && styles.filterTabTextActive,
                ]}
              >
                {filter.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* 总览数据 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('conversion.period.week')}</Text>
          <View style={styles.overviewRow}>
            <View style={[styles.overviewCard, styles.overviewCardInbound]}>
              <View style={styles.overviewIconContainer}>
                <Text style={styles.overviewIcon}>IN</Text>
              </View>
              <View style={styles.overviewContent}>
                <Text style={styles.overviewLabel}>{t('ioStatistics.totalInbound')}</Text>
                <Text style={styles.overviewValue}>
                  {overviewData.inboundTotal.toLocaleString()} kg
                </Text>
                <Text style={styles.overviewChangePositive}>
                  ↑ {overviewData.inboundChange}%
                </Text>
              </View>
            </View>
            <View style={[styles.overviewCard, styles.overviewCardOutbound]}>
              <View
                style={[
                  styles.overviewIconContainer,
                  styles.overviewIconOutbound,
                ]}
              >
                <Text style={styles.overviewIconOut}>OUT</Text>
              </View>
              <View style={styles.overviewContent}>
                <Text style={styles.overviewLabel}>{t('ioStatistics.totalOutbound')}</Text>
                <Text style={styles.overviewValue}>
                  {overviewData.outboundTotal.toLocaleString()} kg
                </Text>
                <Text style={styles.overviewChangePositive}>
                  ↑ {overviewData.outboundChange}%
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* 每日明细 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('ioStatistics.inboundStats')}</Text>
          {dailyStats.map((stat, index) => {
            const balance = getBalance(stat.inbound, stat.outbound);
            return (
              <View key={index} style={styles.dailyStatItem}>
                <View style={styles.dailyDate}>
                  <Text style={styles.dailyDay}>{stat.day}</Text>
                  <Text style={styles.dailyWeekday}>{stat.weekday}</Text>
                </View>
                <View style={styles.dailyData}>
                  <View style={styles.dailyRow}>
                    <Text style={styles.dailyLabel}>{t('conversion.input')}</Text>
                    <Text style={styles.dailyValue}>{stat.inbound} kg</Text>
                  </View>
                  <View style={styles.dailyRow}>
                    <Text style={styles.dailyLabel}>{t('conversion.output')}</Text>
                    <Text style={styles.dailyValue}>{stat.outbound} kg</Text>
                  </View>
                </View>
                <Text
                  style={[
                    styles.dailyBalance,
                    balance >= 0
                      ? styles.balancePositive
                      : styles.balanceNegative,
                  ]}
                >
                  {balance >= 0 ? "+" : ""}
                  {balance}
                </Text>
              </View>
            );
          })}
        </View>

        {/* 品类分析 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('conversion.categoryAnalysis')}</Text>
          {categoryStats.map((category, index) => (
            <View key={index} style={styles.categoryItem}>
              <View style={styles.categoryInfo}>
                <Text style={styles.categoryName}>{category.name}</Text>
                <Text style={styles.categoryPercent}>{category.percent}%</Text>
              </View>
              <View style={styles.categoryBarContainer}>
                <View
                  style={[
                    styles.categoryBar,
                    { width: `${category.percent}%` },
                  ]}
                />
              </View>
              <View style={styles.categoryValues}>
                <Text style={styles.categoryIn}>{t('conversion.input')}: {category.inbound} kg</Text>
                <Text style={styles.categoryOut}>
                  {t('conversion.output')}: {category.outbound} kg
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* 趋势图表 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('conversion.trendAnalysis')}</Text>
          <View style={styles.chartPlaceholder}>
            <View style={styles.chartBars}>
              {dailyStats.map((stat, index) => (
                <View key={index} style={styles.chartBarGroup}>
                  <View
                    style={[
                      styles.chartBarInbound,
                      { height: `${(stat.inbound / 600) * 100}%` },
                    ]}
                  />
                  <View
                    style={[
                      styles.chartBarOutbound,
                      { height: `${(stat.outbound / 600) * 100}%` },
                    ]}
                  />
                  <Text style={styles.chartBarLabel}>{stat.weekday}</Text>
                </View>
              ))}
            </View>
            <View style={styles.chartLegend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: "#4CAF50" }]} />
                <Text style={styles.legendText}>{t('conversion.input')}</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: "#f57c00" }]} />
                <Text style={styles.legendText}>{t('conversion.output')}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* AI 库存预测 */}
        <View style={styles.aiSection}>
          <View style={styles.aiHeader}>
            <View style={styles.aiTitleRow}>
              <Text style={styles.aiIcon}>🤖</Text>
              <Text style={styles.aiTitle}>{t('batch.detail.smartAnalysis')}</Text>
            </View>
            <View style={styles.aiPeriodTabs}>
              {(["7", "14", "30"] as AIPredictionPeriod[]).map((period) => (
                <TouchableOpacity
                  key={period}
                  style={[
                    styles.aiPeriodTab,
                    aiPeriod === period && styles.aiPeriodTabActive,
                  ]}
                  onPress={() => setAIPeriod(period)}
                >
                  <Text
                    style={[
                      styles.aiPeriodText,
                      aiPeriod === period && styles.aiPeriodTextActive,
                    ]}
                  >
                    {period}天
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* 预测图表 */}
          <View style={styles.aiChart}>
            <View style={[styles.aiChartBar, { height: 48 }]} />
            <View style={[styles.aiChartBar, { height: 44 }]} />
            <View style={[styles.aiChartBar, { height: 56 }]} />
            <View style={[styles.aiChartBar, { height: 40 }]} />
            <View style={[styles.aiChartBar, styles.aiChartBarPredicted, { height: 36 }]} />
            <View style={[styles.aiChartBar, styles.aiChartBarPredicted, { height: 32 }]} />
            <View style={[styles.aiChartBar, styles.aiChartBarPredicted, { height: 28 }]} />
          </View>

          <View style={styles.aiChartLegend}>
            <View style={styles.aiLegendItem}>
              <View style={[styles.aiLegendDot, { backgroundColor: "#4CAF50" }]} />
              <Text style={styles.aiLegendText}>{t('conversion.actualRate')}</Text>
            </View>
            <View style={styles.aiLegendItem}>
              <View style={[styles.aiLegendDot, { backgroundColor: "#81c784" }]} />
              <Text style={styles.aiLegendText}>{t('batch.detail.smartAnalysis')}</Text>
            </View>
          </View>

          {/* 预测摘要 */}
          <View style={styles.aiSummary}>
            <View style={styles.aiSummaryItem}>
              <Text style={styles.aiSummaryValue}>
                {aiPrediction.expectedConsumption} kg
              </Text>
              <Text style={styles.aiSummaryLabel}>{t('batch.detail.consumed')}</Text>
            </View>
            <View style={styles.aiSummaryItem}>
              <Text style={styles.aiSummaryValue}>
                {aiPrediction.fishStockDays} {String(t('inventoryStats.batchNumber')).split('/')[0]}
              </Text>
              <Text style={styles.aiSummaryLabel}>{t('inventoryDetail.availableStock')}</Text>
            </View>
            <View style={styles.aiSummaryItem}>
              <Text style={styles.aiSummaryValue}>
                {aiPrediction.suggestedRestock} kg
              </Text>
              <Text style={styles.aiSummaryLabel}>{t('inventory.warning.lowStock')}</Text>
            </View>
          </View>

          {/* 置信度 */}
          <View style={styles.aiConfidence}>
            <Text style={styles.aiConfidenceLabel}>{t('batch.detail.qualityScore')}:</Text>
            <View style={styles.aiConfidenceBadge}>
              <Text style={styles.aiConfidenceText}>
                高 ({aiPrediction.confidence}%)
              </Text>
            </View>
          </View>

          {/* AI 洞察 */}
          <View style={styles.aiInsights}>
            <View style={styles.aiInsightHeader}>
              <Text style={styles.aiInsightIcon}>💡</Text>
              <Text style={styles.aiInsightTitle}>{t('conversion.aiOptimization')}</Text>
            </View>
            {aiPrediction.insights.map((insight, index) => (
              <View
                key={index}
                style={[
                  styles.aiInsightItem,
                  insight.type === "warning" && styles.aiInsightWarning,
                  insight.type === "info" && styles.aiInsightInfo,
                  insight.type === "success" && styles.aiInsightSuccess,
                ]}
              >
                <Text style={styles.aiInsightItemIcon}>{insight.icon}</Text>
                <Text style={styles.aiInsightText}>{insight.text}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* 操作按钮 */}
        <View style={styles.actionButtons}>
          <Button
            mode="outlined"
            onPress={handleExport}
            style={styles.actionBtnSecondary}
            labelStyle={{ color: "#666" }}
          >
            {t('conversion.exportReport')}
          </Button>
          <Button
            mode="contained"
            onPress={handleShare}
            style={styles.actionBtnPrimary}
            labelStyle={{ color: "#fff" }}
          >
            {t('conversion.generateReport')}
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  filterTab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#fff",
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
  overviewRow: {
    flexDirection: "row",
    gap: 12,
  },
  overviewCard: {
    flex: 1,
    flexDirection: "row",
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
  },
  overviewCardInbound: {
    backgroundColor: "#e8f5e9",
  },
  overviewCardOutbound: {
    backgroundColor: "#fff3e0",
  },
  overviewIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#4CAF50",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  overviewIconOutbound: {
    backgroundColor: "#f57c00",
  },
  overviewIcon: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#fff",
  },
  overviewIconOut: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#fff",
  },
  overviewContent: {
    flex: 1,
  },
  overviewLabel: {
    fontSize: 11,
    color: "#666",
  },
  overviewValue: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginVertical: 2,
  },
  overviewChangePositive: {
    fontSize: 11,
    color: "#4CAF50",
  },
  dailyStatItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  dailyDate: {
    width: 50,
    alignItems: "center",
  },
  dailyDay: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
  dailyWeekday: {
    fontSize: 11,
    color: "#999",
  },
  dailyData: {
    flex: 1,
    marginLeft: 12,
  },
  dailyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  dailyLabel: {
    fontSize: 12,
    color: "#999",
  },
  dailyValue: {
    fontSize: 13,
    color: "#333",
  },
  dailyBalance: {
    fontSize: 14,
    fontWeight: "600",
    minWidth: 50,
    textAlign: "right",
  },
  balancePositive: {
    color: "#4CAF50",
  },
  balanceNegative: {
    color: "#f44336",
  },
  categoryItem: {
    marginBottom: 12,
  },
  categoryInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  categoryName: {
    fontSize: 13,
    fontWeight: "500",
    color: "#333",
  },
  categoryPercent: {
    fontSize: 13,
    color: "#4CAF50",
    fontWeight: "600",
  },
  categoryBarContainer: {
    height: 6,
    backgroundColor: "#e0e0e0",
    borderRadius: 3,
    marginBottom: 4,
  },
  categoryBar: {
    height: "100%",
    backgroundColor: "#4CAF50",
    borderRadius: 3,
  },
  categoryValues: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  categoryIn: {
    fontSize: 11,
    color: "#4CAF50",
  },
  categoryOut: {
    fontSize: 11,
    color: "#f57c00",
  },
  chartPlaceholder: {
    backgroundColor: "#f9f9f9",
    borderRadius: 8,
    padding: 16,
  },
  chartBars: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "flex-end",
    height: 100,
    marginBottom: 12,
  },
  chartBarGroup: {
    alignItems: "center",
    gap: 4,
  },
  chartBarInbound: {
    width: 16,
    backgroundColor: "#4CAF50",
    borderRadius: 2,
  },
  chartBarOutbound: {
    width: 16,
    backgroundColor: "#f57c00",
    borderRadius: 2,
  },
  chartBarLabel: {
    fontSize: 10,
    color: "#999",
    marginTop: 4,
  },
  chartLegend: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 20,
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
  aiSection: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e8f5e9",
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
    gap: 6,
  },
  aiIcon: {
    fontSize: 18,
  },
  aiTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#333",
  },
  aiPeriodTabs: {
    flexDirection: "row",
    gap: 4,
  },
  aiPeriodTab: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: "#f5f5f5",
  },
  aiPeriodTabActive: {
    backgroundColor: "#4CAF50",
  },
  aiPeriodText: {
    fontSize: 11,
    color: "#666",
  },
  aiPeriodTextActive: {
    color: "#fff",
    fontWeight: "500",
  },
  aiChart: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "flex-end",
    height: 80,
    marginBottom: 12,
  },
  aiChartBar: {
    width: 24,
    backgroundColor: "#4CAF50",
    borderRadius: 4,
  },
  aiChartBarPredicted: {
    backgroundColor: "#81c784",
  },
  aiChartLegend: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 20,
    marginBottom: 16,
  },
  aiLegendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  aiLegendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  aiLegendText: {
    fontSize: 11,
    color: "#666",
  },
  aiSummary: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 12,
  },
  aiSummaryItem: {
    alignItems: "center",
  },
  aiSummaryValue: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
  },
  aiSummaryLabel: {
    fontSize: 11,
    color: "#999",
    marginTop: 2,
  },
  aiConfidence: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  aiConfidenceLabel: {
    fontSize: 12,
    color: "#666",
    marginRight: 8,
  },
  aiConfidenceBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: "#e8f5e9",
    borderRadius: 12,
  },
  aiConfidenceText: {
    fontSize: 12,
    color: "#4CAF50",
    fontWeight: "500",
  },
  aiInsights: {
    backgroundColor: "#f9f9f9",
    borderRadius: 8,
    padding: 12,
  },
  aiInsightHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 12,
  },
  aiInsightIcon: {
    fontSize: 14,
  },
  aiInsightTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#333",
  },
  aiInsightItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 8,
    borderRadius: 6,
    marginBottom: 8,
  },
  aiInsightWarning: {
    backgroundColor: "#fff3e0",
  },
  aiInsightInfo: {
    backgroundColor: "#e3f2fd",
  },
  aiInsightSuccess: {
    backgroundColor: "#e8f5e9",
  },
  aiInsightItemIcon: {
    fontSize: 12,
    marginRight: 8,
    marginTop: 1,
  },
  aiInsightText: {
    flex: 1,
    fontSize: 12,
    color: "#333",
    lineHeight: 18,
  },
  actionButtons: {
    flexDirection: "row",
    paddingHorizontal: 16,
    marginTop: 16,
    gap: 12,
  },
  actionBtnSecondary: {
    flex: 1,
    borderRadius: 8,
    borderColor: "#ddd",
  },
  actionBtnPrimary: {
    flex: 1,
    borderRadius: 8,
    backgroundColor: "#4CAF50",
  },
});

export default WHIOStatisticsScreen;
