/**
 * 出货详情页面
 * 对应原型: warehouse/outbound-detail.html
 */

import React from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from "react-native";
import { Text, Surface, Button, Divider, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { WHOutboundStackParamList } from "../../../types/navigation";

type NavigationProp = NativeStackNavigationProp<WHOutboundStackParamList>;
type RouteType = RouteProp<WHOutboundStackParamList, "WHOutboundDetail">;

interface OrderProduct {
  id: string;
  name: string;
  batchNumber: string;
  quantity: number;
  location: string;
}

export function WHOutboundDetailScreen() {
  const theme = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteType>();
  const { shipmentId } = route.params;

  // 模拟数据
  const detail = {
    orderNumber: "SH-20251226-001",
    status: "waiting",
    statusLabel: "待打包",
    isUrgent: true,
    dispatchTime: "14:00 前发出",
    customer: "鲜食超市",
    customerContact: "王经理 139****1234",
    address: "浙江省宁波市海曙区中山西路123号",
    totalQuantity: 80,
    totalAmount: 4800,
    createdAt: "2025-12-26 08:00",
    remarks: "请确保冷链运输，货物需要单独包装",
    products: [
      {
        id: "1",
        name: "带鱼片",
        batchNumber: "PB-20251225-001",
        quantity: 50,
        location: "A区-冷藏库-01",
      },
      {
        id: "2",
        name: "带鱼片",
        batchNumber: "PB-20251225-002",
        quantity: 30,
        location: "A区-冷藏库-02",
      },
    ] as OrderProduct[],
  };

  const handleStartPacking = () => {
    navigation.navigate("WHPacking", { orderId: shipmentId });
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
        <Text style={styles.headerTitle}>出货详情</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* 状态卡片 */}
        <Surface style={styles.statusCard} elevation={1}>
          <View style={styles.statusHeader}>
            <View style={styles.orderIdRow}>
              <Text style={styles.orderNumber}>{detail.orderNumber}</Text>
              {detail.isUrgent && (
                <View style={styles.urgentBadge}>
                  <Text style={styles.urgentText}>紧急</Text>
                </View>
              )}
            </View>
            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>{detail.statusLabel}</Text>
            </View>
          </View>
          <View style={styles.dispatchInfo}>
            <MaterialCommunityIcons
              name="clock-outline"
              size={16}
              color="#f44336"
            />
            <Text style={styles.dispatchText}>{detail.dispatchTime}</Text>
          </View>
        </Surface>

        {/* 客户信息 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>客户信息</Text>
          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>客户名称</Text>
              <Text style={styles.infoValue}>{detail.customer}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>联系人</Text>
              <Text style={styles.infoValue}>{detail.customerContact}</Text>
            </View>
            <View style={[styles.infoItem, { width: "100%" }]}>
              <Text style={styles.infoLabel}>收货地址</Text>
              <Text style={styles.infoValue}>{detail.address}</Text>
            </View>
          </View>
        </View>

        {/* 产品明细 */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>产品明细</Text>
            <Text style={styles.totalText}>
              共 {detail.totalQuantity} kg
            </Text>
          </View>

          {detail.products.map((product, index) => (
            <View key={product.id}>
              {index > 0 && <Divider style={styles.productDivider} />}
              <View style={styles.productItem}>
                <View style={styles.productMain}>
                  <Text style={styles.productName}>{product.name}</Text>
                  <Text style={styles.productQty}>{product.quantity} kg</Text>
                </View>
                <View style={styles.productMeta}>
                  <Text style={styles.productBatch}>
                    批次: {product.batchNumber}
                  </Text>
                  <Text style={styles.productLocation}>
                    库位: {product.location}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* 订单信息 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>订单信息</Text>
          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>订单金额</Text>
              <Text style={[styles.infoValue, styles.amountValue]}>
                ¥{detail.totalAmount.toLocaleString()}
              </Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>下单时间</Text>
              <Text style={styles.infoValue}>{detail.createdAt}</Text>
            </View>
          </View>
        </View>

        {/* 备注 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>备注</Text>
          <Text style={styles.remarksText}>{detail.remarks}</Text>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* 底部操作 */}
      {detail.status === "waiting" && (
        <View style={styles.bottomActions}>
          <Button
            mode="outlined"
            onPress={() => navigation.goBack()}
            style={styles.cancelButton}
            labelStyle={styles.cancelButtonLabel}
          >
            返回
          </Button>
          <Button
            mode="contained"
            onPress={handleStartPacking}
            style={styles.actionButton}
            labelStyle={styles.actionButtonLabel}
            icon="package-variant"
          >
            开始打包
          </Button>
        </View>
      )}
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
  statusCard: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
  },
  statusHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  orderIdRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  orderNumber: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  urgentBadge: {
    backgroundColor: "#ffebee",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  urgentText: {
    fontSize: 11,
    color: "#f44336",
    fontWeight: "600",
  },
  statusBadge: {
    backgroundColor: "#fff3e0",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    color: "#f57c00",
    fontWeight: "500",
  },
  dispatchInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },
  dispatchText: {
    fontSize: 14,
    color: "#f44336",
    fontWeight: "600",
  },
  section: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    padding: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#999",
    marginBottom: 12,
  },
  totalText: {
    fontSize: 14,
    color: "#4CAF50",
    fontWeight: "600",
  },
  infoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  infoItem: {
    width: "50%",
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 12,
    color: "#999",
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 14,
    color: "#333",
  },
  amountValue: {
    color: "#f44336",
    fontWeight: "600",
    fontSize: 16,
  },
  productItem: {
    paddingVertical: 12,
  },
  productMain: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  productName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#333",
  },
  productQty: {
    fontSize: 15,
    fontWeight: "600",
    color: "#4CAF50",
  },
  productMeta: {
    flexDirection: "row",
    gap: 16,
  },
  productBatch: {
    fontSize: 12,
    color: "#999",
  },
  productLocation: {
    fontSize: 12,
    color: "#999",
  },
  productDivider: {
    marginVertical: 4,
  },
  remarksText: {
    fontSize: 14,
    color: "#666",
    lineHeight: 20,
  },
  bottomActions: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    flexDirection: "row",
    padding: 16,
    paddingBottom: 34,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },
  cancelButton: {
    flex: 1,
    borderRadius: 8,
    borderColor: "#ddd",
  },
  cancelButtonLabel: {
    color: "#666",
  },
  actionButton: {
    flex: 1,
    borderRadius: 8,
    backgroundColor: "#4CAF50",
  },
  actionButtonLabel: {
    color: "#fff",
    fontWeight: "600",
  },
});

export default WHOutboundDetailScreen;
