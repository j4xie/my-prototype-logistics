/**
 * 温控监控页面
 * 对应原型: warehouse/temperature-monitor.html
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
import { WHInventoryStackParamList } from "../../../types/navigation";

type NavigationProp = NativeStackNavigationProp<WHInventoryStackParamList>;

interface TempZone {
  id: string;
  name: string;
  currentTemp: number;
  targetMin: number;
  targetMax: number;
  status: "normal" | "warning" | "danger";
  maxTemp24h: number;
  minTemp24h: number;
  avgTemp24h: number;
}

interface AlertRecord {
  id: string;
  time: string;
  level: "warning" | "success" | "info";
  title: string;
  description: string;
  handled?: string;
}

interface ThresholdConfig {
  zone: string;
  upperLimit: string;
  lowerLimit: string;
}

export function WHTempMonitorScreen() {
  const theme = useTheme();
  const navigation = useNavigation<NavigationProp>();

  const [lastUpdate] = useState("13:45:32");

  const zones: TempZone[] = [
    {
      id: "A",
      name: "A区 - 冷藏库",
      currentTemp: 2.5,
      targetMin: 0,
      targetMax: 4,
      status: "normal",
      maxTemp24h: 3.2,
      minTemp24h: 1.8,
      avgTemp24h: 2.4,
    },
    {
      id: "B",
      name: "B区 - 冷冻库",
      currentTemp: -18.2,
      targetMin: -20,
      targetMax: -15,
      status: "normal",
      maxTemp24h: -16.5,
      minTemp24h: -19.2,
      avgTemp24h: -18.0,
    },
  ];

  const alertRecords: AlertRecord[] = [
    {
      id: "1",
      time: "12-25 14:30",
      level: "warning",
      title: "A区温度异常",
      description: "温度升至5.2°C，超出上限",
      handled: "已处理: 调整制冷设备",
    },
    {
      id: "2",
      time: "12-24 08:00",
      level: "success",
      title: "B区除霜完成",
      description: "温度已恢复正常",
    },
    {
      id: "3",
      time: "12-23 20:00",
      level: "info",
      title: "B区计划除霜",
      description: "除霜时间约2小时",
    },
  ];

  const thresholds: ThresholdConfig[] = [
    { zone: "A区 - 冷藏库", upperLimit: "4°C", lowerLimit: "-2°C" },
    { zone: "B区 - 冷冻库", upperLimit: "-15°C", lowerLimit: "-22°C" },
  ];

  const getStatusBadgeStyle = (status: TempZone["status"]) => {
    switch (status) {
      case "normal":
        return { bg: "#e8f5e9", color: "#4CAF50" };
      case "warning":
        return { bg: "#fff3e0", color: "#f57c00" };
      case "danger":
        return { bg: "#ffebee", color: "#f44336" };
    }
  };

  const getAlertLevelStyle = (level: AlertRecord["level"]) => {
    switch (level) {
      case "warning":
        return { bg: "#fff3e0", color: "#f57c00", border: "#f57c00" };
      case "success":
        return { bg: "#e8f5e9", color: "#4CAF50", border: "#4CAF50" };
      case "info":
        return { bg: "#e3f2fd", color: "#1976d2", border: "#1976d2" };
    }
  };

  const getAlertLevelText = (level: AlertRecord["level"]) => {
    switch (level) {
      case "warning":
        return "警告";
      case "success":
        return "恢复";
      case "info":
        return "通知";
    }
  };

  const handleExport = () => {
    Alert.alert("成功", "温度报表已导出");
  };

  const handleSetThreshold = () => {
    Alert.alert("提示", "告警阈值设置功能");
  };

  const renderZoneCard = (zone: TempZone) => {
    const statusStyle = getStatusBadgeStyle(zone.status);

    return (
      <View key={zone.id} style={styles.section}>
        <Text style={styles.sectionTitle}>{zone.name}</Text>

        <View style={styles.tempZoneDetail}>
          <View style={styles.tempMain}>
            <View style={styles.tempCurrent}>
              <Text style={styles.tempValueLarge}>{zone.currentTemp}</Text>
              <Text style={styles.tempUnitLarge}>°C</Text>
            </View>
            <View
              style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}
            >
              <Text style={[styles.statusText, { color: statusStyle.color }]}>
                {zone.status === "normal" ? "正常" : "异常"}
              </Text>
            </View>
          </View>

          <Text style={styles.tempRange}>
            目标范围: {zone.targetMin}°C ~ {zone.targetMax}°C
          </Text>

          <View style={styles.tempChart}>
            <Text style={styles.chartLine}>▁▂▃▂▁▂▃▂▁▂▃▂▁▂▃▂▁▂▃▂▁▂▃▂</Text>
            <Text style={styles.chartLabel}>24小时温度趋势</Text>
          </View>

          <View style={styles.tempStats}>
            <View style={styles.tempStat}>
              <Text style={styles.tempStatLabel}>最高</Text>
              <Text style={styles.tempStatValue}>{zone.maxTemp24h}°C</Text>
            </View>
            <View style={styles.tempStat}>
              <Text style={styles.tempStatLabel}>最低</Text>
              <Text style={styles.tempStatValue}>{zone.minTemp24h}°C</Text>
            </View>
            <View style={styles.tempStat}>
              <Text style={styles.tempStatLabel}>平均</Text>
              <Text style={styles.tempStatValue}>{zone.avgTemp24h}°C</Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  const renderAlertRecord = (record: AlertRecord) => {
    const levelStyle = getAlertLevelStyle(record.level);

    return (
      <View
        key={record.id}
        style={[
          styles.alertRecord,
          { borderLeftColor: levelStyle.border },
        ]}
      >
        <View style={styles.alertRecordHeader}>
          <Text style={styles.alertRecordTime}>{record.time}</Text>
          <View
            style={[styles.alertLevelBadge, { backgroundColor: levelStyle.bg }]}
          >
            <Text style={[styles.alertLevelText, { color: levelStyle.color }]}>
              {getAlertLevelText(record.level)}
            </Text>
          </View>
        </View>
        <View style={styles.alertRecordContent}>
          <Text style={styles.alertRecordTitle}>{record.title}</Text>
          <Text style={styles.alertRecordDesc}>{record.description}</Text>
        </View>
        {record.handled && (
          <View style={styles.alertRecordAction}>
            <Text style={styles.alertHandled}>{record.handled}</Text>
          </View>
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
          <Text style={styles.headerTitle}>温控监控</Text>
          <Text style={styles.headerSubtitle}>实时温度监控</Text>
        </View>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* 系统状态 */}
        <View style={styles.monitorStatus}>
          <View style={styles.statusIndicator} />
          <Text style={styles.statusTextOnline}>系统在线</Text>
          <Text style={styles.statusTime}>最后更新: {lastUpdate}</Text>
        </View>

        {/* 温区详情 */}
        {zones.map(renderZoneCard)}

        {/* 告警记录 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>告警记录</Text>
          {alertRecords.map(renderAlertRecord)}
        </View>

        {/* 告警阈值设置 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>告警阈值设置</Text>
          <View style={styles.thresholdList}>
            {thresholds.map((threshold, index) => (
              <View key={index} style={styles.thresholdItem}>
                <Text style={styles.thresholdZone}>{threshold.zone}</Text>
                <View style={styles.thresholdRange}>
                  <Text style={styles.thresholdText}>
                    上限: {threshold.upperLimit}
                  </Text>
                  <Text style={styles.thresholdText}>
                    下限: {threshold.lowerLimit}
                  </Text>
                </View>
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
            导出报表
          </Button>
          <Button
            mode="contained"
            onPress={handleSetThreshold}
            style={styles.actionBtnPrimary}
            labelStyle={{ color: "#fff" }}
          >
            设置阈值
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
  monitorStatus: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 8,
    padding: 12,
  },
  statusIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#4CAF50",
    marginRight: 8,
  },
  statusTextOnline: {
    fontSize: 14,
    fontWeight: "500",
    color: "#4CAF50",
    marginRight: 12,
  },
  statusTime: {
    fontSize: 12,
    color: "#999",
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
  tempZoneDetail: {
    backgroundColor: "#f9f9f9",
    borderRadius: 8,
    padding: 16,
  },
  tempMain: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  tempCurrent: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  tempValueLarge: {
    fontSize: 36,
    fontWeight: "bold",
    color: "#333",
  },
  tempUnitLarge: {
    fontSize: 18,
    color: "#666",
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "500",
  },
  tempRange: {
    fontSize: 13,
    color: "#666",
    marginBottom: 12,
  },
  tempChart: {
    alignItems: "center",
    backgroundColor: "#e8f5e9",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  chartLine: {
    fontSize: 16,
    color: "#4CAF50",
    letterSpacing: 2,
  },
  chartLabel: {
    fontSize: 11,
    color: "#999",
    marginTop: 4,
  },
  tempStats: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  tempStat: {
    alignItems: "center",
  },
  tempStatLabel: {
    fontSize: 12,
    color: "#999",
    marginBottom: 4,
  },
  tempStatValue: {
    fontSize: 15,
    fontWeight: "600",
    color: "#333",
  },
  alertRecord: {
    backgroundColor: "#f9f9f9",
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    borderLeftWidth: 3,
  },
  alertRecordHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  alertRecordTime: {
    fontSize: 12,
    color: "#999",
  },
  alertLevelBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  alertLevelText: {
    fontSize: 11,
    fontWeight: "500",
  },
  alertRecordContent: {
    marginBottom: 8,
  },
  alertRecordTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 2,
  },
  alertRecordDesc: {
    fontSize: 13,
    color: "#666",
  },
  alertRecordAction: {},
  alertHandled: {
    fontSize: 12,
    color: "#4CAF50",
  },
  thresholdList: {
    gap: 8,
  },
  thresholdItem: {
    backgroundColor: "#f9f9f9",
    borderRadius: 8,
    padding: 12,
  },
  thresholdZone: {
    fontSize: 13,
    fontWeight: "600",
    color: "#333",
    marginBottom: 6,
  },
  thresholdRange: {
    flexDirection: "row",
    gap: 16,
  },
  thresholdText: {
    fontSize: 12,
    color: "#666",
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

export default WHTempMonitorScreen;
