/**
 * 批次追溯页面
 * 对应原型: warehouse/batch-trace.html
 */

import React from "react";
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
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { WHInventoryStackParamList } from "../../../types/navigation";

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

  const traceData = {
    batchNumber: batchNumber || "MB-20251223-001",
    productName: "带鱼 (鲜品)",
    initialQty: 300,
    currentQty: 256,
  };

  const traceNodes: TraceNode[] = [
    {
      step: 1,
      title: "原料来源",
      type: "source",
      content: [
        { label: "供应商", value: "舟山渔业合作社" },
        { label: "捕捞日期", value: "2025-12-23" },
        { label: "捕捞区域", value: "东海渔场" },
        { label: "检验报告", value: "查看报告 >", status: "clickable" },
      ],
    },
    {
      step: 2,
      title: "入库验收",
      type: "inbound",
      content: [
        { label: "入库时间", value: "2025-12-23 08:30" },
        { label: "入库数量", value: "300 kg" },
        { label: "质检员", value: "李质检" },
        { label: "质量等级", value: "A级" },
        { label: "库位", value: "A区-冷藏库-01" },
      ],
    },
    {
      step: 3,
      title: "仓储管理",
      type: "storage",
      content: [
        { label: "储存温度", value: "2°C (符合要求)", status: "success" },
        { label: "温控记录", value: "查看记录 >", status: "clickable" },
        { label: "存储天数", value: "3天" },
      ],
    },
    {
      step: 4,
      title: "出库记录",
      type: "outbound",
      content: [],
      subItems: [
        {
          header: "订单: SH-20251225-001",
          qty: "-30kg",
          rows: [
            { label: "客户", value: "鲜味餐厅" },
            { label: "出库时间", value: "2025-12-25 15:00" },
          ],
        },
        {
          header: "生产批次: PB-001",
          qty: "-14kg",
          rows: [
            { label: "产品", value: "带鱼片" },
            { label: "消耗时间", value: "2025-12-24 14:00" },
          ],
        },
      ],
    },
    {
      step: 5,
      title: "当前状态",
      type: "current",
      content: [
        { label: "剩余数量", value: "256 kg" },
        { label: "到期时间", value: "2025-12-30 (3天后)", status: "warning" },
        { label: "库位", value: "A区-冷藏库-01" },
      ],
    },
  ];

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
