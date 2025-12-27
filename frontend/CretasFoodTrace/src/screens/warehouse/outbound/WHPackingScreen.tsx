/**
 * 打包作业页面
 * 对应原型: warehouse/packing.html
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
import {
  Text,
  Surface,
  Button,
  Checkbox,
  ProgressBar,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { WHOutboundStackParamList } from "../../../types/navigation";
import { shipmentApiClient, ShipmentRecord } from "../../../services/api/shipmentApiClient";
import { handleError } from "../../../utils/errorHandler";

type NavigationProp = NativeStackNavigationProp<WHOutboundStackParamList>;
type RouteType = RouteProp<WHOutboundStackParamList, "WHPacking">;

interface PackingItem {
  id: string;
  name: string;
  batchNumber: string;
  quantity: number;
  location: string;
  packed: boolean;
}

interface OrderInfo {
  orderNumber: string;
  customer: string;
  dispatchTime: string;
  totalQuantity: number;
}

export function WHPackingScreen() {
  const theme = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteType>();
  const { orderId } = route.params;

  // 状态管理
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [orderInfo, setOrderInfo] = useState<OrderInfo | null>(null);
  const [shipmentId, setShipmentId] = useState<string | null>(null);

  // 加载出货单数据
  const loadShipmentData = useCallback(async () => {
    if (!orderId) {
      setLoading(false);
      return;
    }

    try {
      const shipment = await shipmentApiClient.getShipmentById(orderId);

      if (shipment) {
        setShipmentId(shipment.id);
        // 格式化发货时间
        const shipDate = new Date(shipment.shipmentDate);
        const dispatchTime = `${shipDate.getHours()}:${String(shipDate.getMinutes()).padStart(2, '0')} 前发出`;

        setOrderInfo({
          orderNumber: shipment.shipmentNumber || shipment.orderNumber || `SH-${shipment.id}`,
          customer: shipment.deliveryAddress || '未知客户',
          dispatchTime: dispatchTime,
          totalQuantity: shipment.quantity || 0,
        });
      }
    } catch (error) {
      handleError(error, { title: '加载出货单信息失败' });
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    loadShipmentData();
  }, [loadShipmentData]);

  // TODO: 打包项目需要从后端获取订单关联的批次列表
  // 当前使用模拟数据，后续需要接入订单明细 API
  const [packingItems, setPackingItems] = useState<PackingItem[]>([
    {
      id: "1",
      name: "鲈鱼片",
      batchNumber: "PB-20251225-003",
      quantity: 50,
      location: "A区-冷藏库-01",
      packed: false,
    },
    {
      id: "2",
      name: "鲈鱼片",
      batchNumber: "PB-20251225-004",
      quantity: 50,
      location: "A区-冷藏库-02",
      packed: false,
    },
    {
      id: "3",
      name: "鲈鱼片",
      batchNumber: "PB-20251225-005",
      quantity: 50,
      location: "A区-冷藏库-03",
      packed: false,
    },
  ]);

  const toggleItem = (id: string) => {
    setPackingItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, packed: !item.packed } : item
      )
    );
  };

  const packedCount = packingItems.filter((item) => item.packed).length;
  const totalCount = packingItems.length;
  const progress = packedCount / totalCount;
  const allPacked = packedCount === totalCount;

  // 完成打包操作
  const completePacking = async () => {
    if (!shipmentId) {
      Alert.alert('错误', '出货单ID无效，无法完成打包');
      return;
    }

    setSubmitting(true);
    try {
      // 更新出货状态为 shipped（已发货/待发货）
      await shipmentApiClient.updateStatus(shipmentId, 'shipped');
      Alert.alert('成功', '打包完成，等待发货确认');
      navigation.goBack();
    } catch (error) {
      handleError(error, { title: '完成打包失败' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleComplete = () => {
    if (!allPacked) {
      Alert.alert("提示", "请完成所有商品打包");
      return;
    }

    Alert.alert("确认完成", "所有商品都已打包完成吗？", [
      { text: "取消", style: "cancel" },
      {
        text: "确定",
        onPress: completePacking,
      },
    ]);
  };

  // 加载状态
  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>打包作业</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>加载中...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // 空状态
  if (!orderInfo) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>打包作业</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.loadingContainer}>
          <MaterialCommunityIcons name="package-variant" size={64} color="#ddd" />
          <Text style={styles.loadingText}>未找到出货单信息</Text>
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
        <Text style={styles.headerTitle}>打包作业</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* 订单信息 */}
        <Surface style={styles.orderCard} elevation={1}>
          <View style={styles.orderHeader}>
            <Text style={styles.orderNumber}>{orderInfo.orderNumber}</Text>
            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>打包中</Text>
            </View>
          </View>
          <View style={styles.orderInfo}>
            <Text style={styles.customerText}>{orderInfo.customer}</Text>
            <Text style={styles.dispatchText}>
              <MaterialCommunityIcons name="clock-outline" size={14} color="#666" />
              {" "}{orderInfo.dispatchTime}
            </Text>
          </View>
        </Surface>

        {/* 打包进度 */}
        <View style={styles.progressSection}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressTitle}>打包进度</Text>
            <Text style={styles.progressText}>
              {packedCount}/{totalCount} 件
            </Text>
          </View>
          <ProgressBar
            progress={progress}
            color="#4CAF50"
            style={styles.progressBar}
          />
        </View>

        {/* 打包列表 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>商品列表</Text>

          {packingItems.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.packingItem,
                item.packed && styles.packingItemPacked,
              ]}
              onPress={() => toggleItem(item.id)}
              activeOpacity={0.7}
            >
              <Checkbox
                status={item.packed ? "checked" : "unchecked"}
                onPress={() => toggleItem(item.id)}
                color="#4CAF50"
              />
              <View style={styles.itemContent}>
                <View style={styles.itemHeader}>
                  <Text
                    style={[
                      styles.itemName,
                      item.packed && styles.itemNamePacked,
                    ]}
                  >
                    {item.name}
                  </Text>
                  <Text style={styles.itemQty}>{item.quantity} kg</Text>
                </View>
                <View style={styles.itemMeta}>
                  <Text style={styles.metaText}>批次: {item.batchNumber}</Text>
                  <Text style={styles.metaText}>库位: {item.location}</Text>
                </View>
              </View>
              {item.packed && (
                <MaterialCommunityIcons
                  name="check-circle"
                  size={24}
                  color="#4CAF50"
                />
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* 打包说明 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>打包说明</Text>
          <View style={styles.instructions}>
            <View style={styles.instructionItem}>
              <MaterialCommunityIcons
                name="numeric-1-circle"
                size={20}
                color="#4CAF50"
              />
              <Text style={styles.instructionText}>
                按列表顺序从库位取货
              </Text>
            </View>
            <View style={styles.instructionItem}>
              <MaterialCommunityIcons
                name="numeric-2-circle"
                size={20}
                color="#4CAF50"
              />
              <Text style={styles.instructionText}>
                确认商品数量后勾选完成
              </Text>
            </View>
            <View style={styles.instructionItem}>
              <MaterialCommunityIcons
                name="numeric-3-circle"
                size={20}
                color="#4CAF50"
              />
              <Text style={styles.instructionText}>
                全部完成后点击确认按钮
              </Text>
            </View>
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* 底部操作 */}
      <View style={styles.bottomActions}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryText}>
            已打包: {packedCount}/{totalCount} 件
          </Text>
          <Text style={styles.summaryWeight}>
            {packingItems
              .filter((i) => i.packed)
              .reduce((sum, i) => sum + i.quantity, 0)}{" "}
            / {orderInfo.totalQuantity} kg
          </Text>
        </View>
        <Button
          mode="contained"
          onPress={handleComplete}
          style={[
            styles.completeButton,
            (!allPacked || submitting) && styles.completeButtonDisabled,
          ]}
          labelStyle={styles.completeButtonLabel}
          icon="check"
          disabled={!allPacked || submitting}
          loading={submitting}
        >
          {submitting ? '提交中...' : '打包完成'}
        </Button>
      </View>
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
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
    textAlign: "center",
    marginRight: 28,
  },
  headerRight: {
    width: 28,
  },
  content: {
    flex: 1,
  },
  orderCard: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
  },
  orderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  orderNumber: {
    fontSize: 15,
    fontWeight: "600",
    color: "#333",
  },
  statusBadge: {
    backgroundColor: "#e3f2fd",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    color: "#1976d2",
    fontWeight: "500",
  },
  orderInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  customerText: {
    fontSize: 14,
    color: "#333",
  },
  dispatchText: {
    fontSize: 13,
    color: "#666",
  },
  progressSection: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    padding: 16,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  progressTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  progressText: {
    fontSize: 14,
    color: "#4CAF50",
    fontWeight: "600",
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "#e0e0e0",
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
  packingItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  packingItemPacked: {
    backgroundColor: "#f1f8e9",
    borderColor: "#4CAF50",
  },
  itemContent: {
    flex: 1,
    marginLeft: 8,
  },
  itemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  itemName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#333",
  },
  itemNamePacked: {
    color: "#4CAF50",
  },
  itemQty: {
    fontSize: 15,
    fontWeight: "600",
    color: "#4CAF50",
  },
  itemMeta: {
    flexDirection: "row",
    gap: 16,
  },
  metaText: {
    fontSize: 12,
    color: "#999",
  },
  instructions: {
    gap: 12,
  },
  instructionItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  instructionText: {
    fontSize: 14,
    color: "#666",
  },
  bottomActions: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    padding: 16,
    paddingBottom: 34,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  summaryText: {
    fontSize: 14,
    color: "#666",
  },
  summaryWeight: {
    fontSize: 14,
    color: "#4CAF50",
    fontWeight: "600",
  },
  completeButton: {
    borderRadius: 8,
    backgroundColor: "#4CAF50",
  },
  completeButtonDisabled: {
    backgroundColor: "#bdbdbd",
  },
  completeButtonLabel: {
    color: "#fff",
    fontWeight: "600",
    paddingVertical: 4,
  },
});

export default WHPackingScreen;
