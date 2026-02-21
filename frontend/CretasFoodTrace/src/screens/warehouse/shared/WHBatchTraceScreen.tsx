/**
 * 批次追溯页面
 * 对应原型: warehouse/batch-trace.html
 */

import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Text, Surface, Button, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { WHInventoryStackParamList } from "../../../types/navigation";
import { materialBatchApiClient, MaterialBatch } from "../../../services/api/materialBatchApiClient";
import { traceabilityApiClient, FullTraceResponse } from "../../../services/api/traceabilityApiClient";
import { handleError } from "../../../utils/errorHandler";
import { formatDate, formatDateTime } from "../../../utils/formatters";

type NavigationProp = NativeStackNavigationProp<WHInventoryStackParamList>;
type RouteType = RouteProp<WHInventoryStackParamList, "WHBatchTrace">;

interface TraceNode {
  step: number;
  title: string;
  type: "source" | "inbound" | "storage" | "outbound" | "current";
  content: { label: string; value: string; status?: "success" | "warning" | "clickable" }[];
  subItems?: {
    header: string;
    qty: string;
    rows: { label: string; value: string }[];
  }[];
}

export function WHBatchTraceScreen() {
  const theme = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteType>();
  const { batchId, batchNumber } = route.params;

  const [loading, setLoading] = useState(true);
  const [traceData, setTraceData] = useState<{
    batchNumber: string;
    productName: string;
    initialQty: number;
    currentQty: number;
  } | null>(null);
  const [traceNodes, setTraceNodes] = useState<TraceNode[]>([]);

  const loadTraceData = useCallback(async () => {
    try {
      setLoading(true);

      const [batchResult, fullTraceResult, usageResult] = await Promise.allSettled([
        materialBatchApiClient.getBatchById(batchId),
        traceabilityApiClient.getFullTrace(batchNumber),
        materialBatchApiClient.getBatchUsageHistory(batchId),
      ]);

      // Extract batch info
      const batch: MaterialBatch | null =
        batchResult.status === 'fulfilled' && batchResult.value?.data
          ? batchResult.value.data
          : null;

      const fullTrace: FullTraceResponse | null =
        fullTraceResult.status === 'fulfilled' ? fullTraceResult.value : null;

      const usageHistory: any[] =
        usageResult.status === 'fulfilled' && usageResult.value?.data
          ? (Array.isArray(usageResult.value.data) ? usageResult.value.data : [])
          : [];

      if (!batch) {
        setTraceData(null);
        setTraceNodes([]);
        return;
      }

      // Build trace overview
      setTraceData({
        batchNumber: batch.batchNumber,
        productName: batch.materialName || batch.materialCategory || '-',
        initialQty: batch.inboundQuantity ?? 0,
        currentQty: batch.remainingQuantity ?? 0,
      });

      // Build trace nodes from real data
      const nodes: TraceNode[] = [];

      // Node 1: 原料来源
      nodes.push({
        step: 1,
        title: "原料来源",
        type: "source",
        content: [
          { label: "供应商", value: batch.supplierName || '-' },
          { label: "入库日期", value: batch.inboundDate ? formatDate(batch.inboundDate) : '-' },
          { label: "库位", value: batch.storageLocation || '-' },
          ...(batch.productionDate
            ? [{ label: "生产日期", value: formatDate(batch.productionDate) }]
            : []),
        ],
      });

      // Node 2: 入库验收
      const firstQC = fullTrace?.qualityInspections?.[0];
      nodes.push({
        step: 2,
        title: "入库验收",
        type: "inbound",
        content: [
          { label: "入库时间", value: batch.inboundDate ? formatDateTime(batch.inboundDate) : '-' },
          { label: "入库数量", value: `${batch.inboundQuantity ?? 0} kg` },
          ...(firstQC ? [
            { label: "质检员", value: firstQC.inspectorName || '-' },
            { label: "质检结果", value: firstQC.result || '-', status: firstQC.result === '合格' ? 'success' as const : undefined },
          ] : []),
          { label: "库位", value: batch.storageLocation || '-' },
        ],
      });

      // Node 3: 仓储管理
      const daysSinceReceipt = batch.inboundDate
        ? Math.max(0, Math.floor((Date.now() - new Date(batch.inboundDate).getTime()) / (1000 * 60 * 60 * 24)))
        : 0;
      const storageTypeLabel = batch.storageType === 'frozen' ? '冷冻' : batch.storageType === 'fresh' ? '冷藏' : batch.storageType === 'dry' ? '常温' : '-';
      nodes.push({
        step: 3,
        title: "仓储管理",
        type: "storage",
        content: [
          { label: "存储类型", value: storageTypeLabel },
          { label: "存储天数", value: `${daysSinceReceipt}天` },
          { label: "库位", value: batch.storageLocation || '-' },
        ],
      });

      // Node 4: 出库记录
      const outboundSubItems: TraceNode['subItems'] = [];

      // From usage history
      if (usageHistory.length > 0) {
        for (const record of usageHistory) {
          outboundSubItems.push({
            header: record.productionPlanId ? `生产计划: ${record.productionPlanId}` : `使用记录`,
            qty: `-${record.quantity ?? record.usedQuantity ?? 0}kg`,
            rows: [
              ...(record.reason ? [{ label: "用途", value: record.reason }] : []),
              ...(record.createdAt ? [{ label: "时间", value: formatDateTime(record.createdAt) }] : []),
            ],
          });
        }
      }

      // From fullTrace shipments
      if (fullTrace?.shipments?.length) {
        for (const shipment of fullTrace.shipments) {
          outboundSubItems.push({
            header: `出货: ${shipment.shipmentNumber}`,
            qty: shipment.quantity ? `-${shipment.quantity}kg` : '-',
            rows: [
              { label: "客户", value: shipment.customerName || '-' },
              { label: "出库时间", value: shipment.shipmentDate ? formatDateTime(shipment.shipmentDate) : '-' },
            ],
          });
        }
      }

      nodes.push({
        step: 4,
        title: "出库记录",
        type: "outbound",
        content: outboundSubItems.length === 0
          ? [{ label: "记录", value: "暂无出库记录" }]
          : [],
        subItems: outboundSubItems.length > 0 ? outboundSubItems : undefined,
      });

      // Node 5: 当前状态
      const daysUntilExpiry = batch.expiryDate
        ? Math.ceil((new Date(batch.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        : null;
      const expiryDisplay = batch.expiryDate
        ? `${formatDate(batch.expiryDate)}${daysUntilExpiry !== null ? ` (${daysUntilExpiry > 0 ? daysUntilExpiry + '天后' : '已过期'})` : ''}`
        : '-';
      nodes.push({
        step: 5,
        title: "当前状态",
        type: "current",
        content: [
          { label: "剩余数量", value: `${batch.remainingQuantity ?? 0} kg` },
          { label: "到期时间", value: expiryDisplay, status: daysUntilExpiry !== null && daysUntilExpiry <= 7 ? "warning" : undefined },
          { label: "库位", value: batch.storageLocation || '-' },
          { label: "状态", value: batch.status || '-' },
        ],
      });

      setTraceNodes(nodes);
    } catch (error) {
      handleError(error, { title: '加载追溯数据失败' });
    } finally {
      setLoading(false);
    }
  }, [batchId, batchNumber]);

  useEffect(() => {
    loadTraceData();
  }, [loadTraceData]);

  const getNodeStyle = (type: TraceNode["type"]) => {
    switch (type) {
      case "source":
        return { bg: "#e3f2fd", border: "#1976d2" };
      case "inbound":
        return { bg: "#e8f5e9", border: "#4CAF50" };
      case "storage":
        return { bg: "#f3e5f5", border: "#7b1fa2" };
      case "outbound":
        return { bg: "#fff3e0", border: "#f57c00" };
      case "current":
        return { bg: "#e0f7fa", border: "#0097a7" };
    }
  };

  const handleExportReport = () => {
    Alert.alert("成功", "追溯报告已导出");
  };

  const handleRecall = () => {
    Alert.alert("确认", "确定要发起召回吗？", [
      { text: "取消", style: "cancel" },
      {
        text: "确定",
        style: "destructive",
        onPress: () => navigation.navigate("WHRecallManage" as any),
      },
    ]);
  };

  const renderTraceNode = (node: TraceNode, index: number) => {
    const nodeStyle = getNodeStyle(node.type);

    return (
      <View key={node.step}>
        <View
          style={[
            styles.traceNode,
            { backgroundColor: nodeStyle.bg, borderLeftColor: nodeStyle.border },
          ]}
        >
          <View style={styles.traceNodeHeader}>
            <View style={[styles.traceNodeIcon, { backgroundColor: nodeStyle.border }]}>
              <Text style={styles.traceNodeIconText}>{node.step}</Text>
            </View>
            <Text style={styles.traceNodeTitle}>{node.title}</Text>
          </View>

          <View style={styles.traceNodeContent}>
            {node.content.map((row, rowIndex) => (
              <View key={rowIndex} style={styles.traceRow}>
                <Text style={styles.traceLabel}>{row.label}</Text>
                <Text
                  style={[
                    styles.traceValue,
                    row.status === "success" && styles.traceValueSuccess,
                    row.status === "warning" && styles.traceValueWarning,
                    row.status === "clickable" && styles.traceValueClickable,
                  ]}
                >
                  {row.value}
                </Text>
              </View>
            ))}

            {node.subItems?.map((subItem, subIndex) => (
              <View key={subIndex} style={styles.traceSubItem}>
                <View style={styles.traceSubHeader}>
                  <Text style={styles.traceSubHeaderText}>{subItem.header}</Text>
                  <Text style={styles.traceSubQty}>{subItem.qty}</Text>
                </View>
                {subItem.rows.map((row, rowIdx) => (
                  <View key={rowIdx} style={styles.traceRow}>
                    <Text style={styles.traceLabel}>{row.label}</Text>
                    <Text style={styles.traceValue}>{row.value}</Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        </View>

        {index < traceNodes.length - 1 && (
          <View style={styles.traceConnector}>
            <View style={styles.traceConnectorLine} />
          </View>
        )}
      </View>
    );
  };

  // Loading state
  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>批次追溯</Text>
            <Text style={styles.headerSubtitle}>{batchNumber || '-'}</Text>
          </View>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>加载追溯数据...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Empty state
  if (!traceData) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>批次追溯</Text>
            <Text style={styles.headerSubtitle}>{batchNumber || '-'}</Text>
          </View>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.loadingContainer}>
          <MaterialCommunityIcons name="file-search-outline" size={64} color="#ddd" />
          <Text style={styles.loadingText}>未找到批次数据</Text>
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
          <Text style={styles.headerTitle}>批次追溯</Text>
          <Text style={styles.headerSubtitle}>{traceData.batchNumber}</Text>
        </View>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* 批次概览 */}
        <Surface style={styles.traceOverview} elevation={1}>
          <Text style={styles.traceBatch}>{traceData.batchNumber}</Text>
          <Text style={styles.traceProduct}>{traceData.productName}</Text>
          <Text style={styles.traceQty}>
            初始: {traceData.initialQty}kg | 当前: {traceData.currentQty}kg
          </Text>
        </Surface>

        {/* 追溯链条 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>完整追溯链</Text>

          <View style={styles.traceTimeline}>
            {traceNodes.map((node, index) => renderTraceNode(node, index))}
          </View>
        </View>

        {/* 操作按钮 */}
        <View style={styles.actionButtons}>
          <Button
            mode="outlined"
            onPress={handleExportReport}
            style={styles.actionBtnSecondary}
            labelStyle={{ color: "#666" }}
          >
            导出报告
          </Button>
          <Button
            mode="contained"
            onPress={handleRecall}
            style={styles.actionBtnDanger}
            labelStyle={{ color: "#fff" }}
          >
            发起召回
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
  content: {
    flex: 1,
  },
  traceOverview: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  traceBatch: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#4CAF50",
    marginBottom: 4,
  },
  traceProduct: {
    fontSize: 14,
    color: "#333",
    marginBottom: 4,
  },
  traceQty: {
    fontSize: 13,
    color: "#666",
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
    marginBottom: 16,
  },
  traceTimeline: {},
  traceNode: {
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 4,
  },
  traceNodeHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  traceNodeIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  traceNodeIconText: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#fff",
  },
  traceNodeTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  traceNodeContent: {
    marginLeft: 34,
  },
  traceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  traceLabel: {
    fontSize: 13,
    color: "#666",
  },
  traceValue: {
    fontSize: 13,
    color: "#333",
  },
  traceValueSuccess: {
    color: "#4CAF50",
  },
  traceValueWarning: {
    color: "#f57c00",
  },
  traceValueClickable: {
    color: "#1976d2",
  },
  traceSubItem: {
    backgroundColor: "rgba(255,255,255,0.7)",
    borderRadius: 6,
    padding: 10,
    marginTop: 8,
  },
  traceSubHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.05)",
  },
  traceSubHeaderText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#333",
  },
  traceSubQty: {
    fontSize: 12,
    fontWeight: "600",
    color: "#f44336",
  },
  traceConnector: {
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  traceConnectorLine: {
    width: 2,
    height: "100%",
    backgroundColor: "#e0e0e0",
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
  actionBtnDanger: {
    flex: 1,
    borderRadius: 8,
    backgroundColor: "#f44336",
  },
});

export default WHBatchTraceScreen;
