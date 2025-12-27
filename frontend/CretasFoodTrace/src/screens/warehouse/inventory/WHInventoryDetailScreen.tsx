/**
 * 库存详情页面
 * 对应原型: warehouse/inventory-detail.html
 */

import React from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { Text, Surface, Button, Divider, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { WHInventoryStackParamList } from "../../../types/navigation";

type NavigationProp = NativeStackNavigationProp<WHInventoryStackParamList>;
type RouteType = RouteProp<WHInventoryStackParamList, "WHInventoryDetail">;

interface BatchItem {
  id: string;
  batchNumber: string;
  quantity: number;
  inboundDate: string;
  location: string;
  expiryDays: number;
  isNew?: boolean;
  isFifo?: boolean;
}

interface OperationLog {
  id: string;
  time: string;
  action: string;
  type: "in" | "out" | "normal";
}

export function WHInventoryDetailScreen() {
  const theme = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteType>();
  const { materialId } = route.params;

  // 模拟库存数据
  const inventoryDetail = {
    materialName: "带鱼",
    materialType: "鲜品",
    totalQuantity: 856,
    safetyStock: 200,
    status: "sufficient", // sufficient, warning, danger
    statusLabel: "充足",
    storageTemp: "0°C ~ 4°C (冷藏)",
    shelfLife: "7天",
    unitPrice: 30,
    totalValue: 25680,
    batches: [
      {
        id: "1",
        batchNumber: "MB-20251223-001",
        quantity: 256,
        inboundDate: "2025-12-23",
        location: "A区-冷藏库-01",
        expiryDays: 3,
        isFifo: true,
      },
      {
        id: "2",
        batchNumber: "MB-20251224-002",
        quantity: 320,
        inboundDate: "2025-12-24",
        location: "A区-冷藏库-02",
        expiryDays: 4,
      },
      {
        id: "3",
        batchNumber: "MB-20251226-001",
        quantity: 280,
        inboundDate: "2025-12-26",
        location: "A区-冷藏库-01",
        expiryDays: 7,
        isNew: true,
      },
    ] as BatchItem[],
    locationDistribution: [
      { name: "A区-冷藏库-01", quantity: 536 },
      { name: "A区-冷藏库-02", quantity: 320 },
    ],
    operationLogs: [
      { id: "1", time: "12-26 09:30", action: "入库 +280kg (张仓管)", type: "in" },
      { id: "2", time: "12-25 15:00", action: "出库 -80kg (订单SH-20251225-001)", type: "out" },
      { id: "3", time: "12-24 10:00", action: "入库 +320kg (李仓管)", type: "normal" },
    ] as OperationLog[],
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "sufficient":
        return { color: "#388e3c", bgColor: "#e8f5e9" };
      case "warning":
        return { color: "#f57c00", bgColor: "#fff3e0" };
      case "danger":
        return { color: "#d32f2f", bgColor: "#ffebee" };
      default:
        return { color: "#666", bgColor: "#f5f5f5" };
    }
  };

  const getExpiryTagStyle = (days: number, isNew?: boolean) => {
    if (isNew) return { color: "#388e3c", bgColor: "#e8f5e9", label: "新入库" };
    if (days <= 3) return { color: "#f57c00", bgColor: "#fff3e0", label: `${days}天后过期` };
    return { color: "#666", bgColor: "#f5f5f5", label: `${days}天后过期` };
  };

  const statusColor = getStatusColor(inventoryDetail.status);

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
          <Text style={styles.headerTitle}>库存详情</Text>
          <Text style={styles.headerSubtitle}>{inventoryDetail.materialName}</Text>
        </View>
        <View style={styles.headerRight} />
      </View>

      {/* 顶部操作按钮 */}
      <View style={styles.topActions}>
        <Button
          mode="outlined"
          onPress={() => navigation.navigate("WHInventoryTransfer" as any)}
          style={styles.topActionBtn}
          labelStyle={styles.topActionLabel}
        >
          调拨
        </Button>
        <Button
          mode="outlined"
          onPress={() => navigation.navigate("WHExpireHandle" as any)}
          style={[styles.topActionBtn, styles.warningBtn]}
          labelStyle={styles.warningBtnLabel}
        >
          过期处理
        </Button>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* 库存概览 */}
        <Surface style={styles.overviewCard} elevation={1}>
          <View style={styles.overviewMain}>
            <Text style={styles.overviewQty}>{inventoryDetail.totalQuantity}</Text>
            <Text style={styles.overviewUnit}>kg</Text>
          </View>
          <View style={styles.overviewMeta}>
            <View style={styles.overviewItem}>
              <Text style={styles.overviewLabel}>安全库存</Text>
              <Text style={styles.overviewValue}>{inventoryDetail.safetyStock} kg</Text>
            </View>
            <View style={styles.overviewItem}>
              <Text style={styles.overviewLabel}>库存状态</Text>
              <Text style={[styles.overviewValue, { color: statusColor.color }]}>
                {inventoryDetail.statusLabel}
              </Text>
            </View>
          </View>
        </Surface>

        {/* 基本信息 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>基本信息</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>物料名称</Text>
            <Text style={styles.infoValue}>{inventoryDetail.materialName}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>物料类型</Text>
            <Text style={styles.infoValue}>{inventoryDetail.materialType}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>储存温度</Text>
            <Text style={styles.infoValue}>{inventoryDetail.storageTemp}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>标准保质期</Text>
            <Text style={styles.infoValue}>{inventoryDetail.shelfLife}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>单价</Text>
            <Text style={styles.infoValue}>¥{inventoryDetail.unitPrice}/kg</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>库存价值</Text>
            <Text style={[styles.infoValue, styles.highlightValue]}>
              ¥{inventoryDetail.totalValue.toLocaleString()}
            </Text>
          </View>
        </View>

        {/* 批次列表 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            批次列表 ({inventoryDetail.batches.length}个)
          </Text>
          {inventoryDetail.batches.map((batch) => {
            const tagStyle = getExpiryTagStyle(batch.expiryDays, batch.isNew);
            return (
              <TouchableOpacity
                key={batch.id}
                style={styles.batchCard}
                onPress={() =>
                  navigation.navigate("WHBatchDetail", { batchId: batch.id })
                }
                activeOpacity={0.7}
              >
                <View style={styles.batchHeader}>
                  <Text style={styles.batchNumber}>{batch.batchNumber}</Text>
                  <View style={[styles.batchTag, { backgroundColor: tagStyle.bgColor }]}>
                    <Text style={[styles.batchTagText, { color: tagStyle.color }]}>
                      {tagStyle.label}
                    </Text>
                  </View>
                </View>
                <View style={styles.batchContent}>
                  <View style={styles.batchRow}>
                    <Text style={styles.batchLabel}>库存数量</Text>
                    <Text style={styles.batchValue}>{batch.quantity} kg</Text>
                  </View>
                  <View style={styles.batchRow}>
                    <Text style={styles.batchLabel}>入库日期</Text>
                    <Text style={styles.batchValue}>{batch.inboundDate}</Text>
                  </View>
                  <View style={styles.batchRow}>
                    <Text style={styles.batchLabel}>库位</Text>
                    <Text style={styles.batchValue}>{batch.location}</Text>
                  </View>
                </View>
                <View style={styles.batchFooter}>
                  <Text style={styles.batchHint}>
                    {batch.isFifo ? "优先消耗 (FIFO)" : batch.isNew ? `${batch.expiryDays}天保质期` : ""}
                  </Text>
                  <Text style={styles.batchAction}>查看详情 &gt;</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* 库位分布 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>库位分布</Text>
          {inventoryDetail.locationDistribution.map((loc, index) => (
            <View key={index} style={styles.locationItem}>
              <Text style={styles.locationName}>{loc.name}</Text>
              <Text style={styles.locationQty}>{loc.quantity} kg</Text>
            </View>
          ))}
        </View>

        {/* 操作记录 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>最近操作</Text>
          <View style={styles.timeline}>
            {inventoryDetail.operationLogs.map((log, index) => (
              <View key={log.id} style={styles.timelineItem}>
                <View
                  style={[
                    styles.timelineDot,
                    log.type === "in" && styles.timelineDotIn,
                    log.type === "out" && styles.timelineDotOut,
                  ]}
                />
                {index < inventoryDetail.operationLogs.length - 1 && (
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
  topActions: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
  },
  topActionBtn: {
    flex: 1,
    borderRadius: 8,
    borderColor: "#ddd",
  },
  topActionLabel: {
    color: "#666",
  },
  warningBtn: {
    borderColor: "#f57c00",
  },
  warningBtnLabel: {
    color: "#f57c00",
  },
  content: {
    flex: 1,
  },
  overviewCard: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    padding: 20,
  },
  overviewMain: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "center",
    marginBottom: 16,
  },
  overviewQty: {
    fontSize: 48,
    fontWeight: "bold",
    color: "#4CAF50",
  },
  overviewUnit: {
    fontSize: 20,
    color: "#4CAF50",
    marginLeft: 4,
  },
  overviewMeta: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  overviewItem: {
    alignItems: "center",
  },
  overviewLabel: {
    fontSize: 13,
    color: "#999",
    marginBottom: 4,
  },
  overviewValue: {
    fontSize: 15,
    fontWeight: "600",
    color: "#333",
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
  batchCard: {
    backgroundColor: "#f9f9f9",
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  batchHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  batchNumber: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  batchTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  batchTagText: {
    fontSize: 11,
    fontWeight: "500",
  },
  batchContent: {
    gap: 4,
  },
  batchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  batchLabel: {
    fontSize: 13,
    color: "#999",
  },
  batchValue: {
    fontSize: 13,
    color: "#333",
  },
  batchFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  batchHint: {
    fontSize: 12,
    color: "#f57c00",
  },
  batchAction: {
    fontSize: 12,
    color: "#4CAF50",
  },
  locationItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f5f5f5",
  },
  locationName: {
    fontSize: 14,
    color: "#333",
  },
  locationQty: {
    fontSize: 14,
    fontWeight: "600",
    color: "#4CAF50",
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
});

export default WHInventoryDetailScreen;
