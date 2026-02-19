/**
 * 订单详情页面
 * 对应原型: warehouse/order-detail.html
 */

import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Text, Surface, Divider, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { WHOutboundStackParamList } from "../../../types/navigation";
import { shipmentApiClient, ShipmentRecord } from "../../../services/api/shipmentApiClient";
import { handleError } from "../../../utils/errorHandler";
import { formatDateTime as fmtDateTime, formatNumberWithCommas } from "../../../utils/formatters";

type NavigationProp = NativeStackNavigationProp<WHOutboundStackParamList>;
type RouteType = RouteProp<WHOutboundStackParamList, "WHOrderDetail">;

interface OrderProduct {
  id: string;
  name: string;
  specification: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  amount: number;
}

interface OrderDetail {
  orderNumber: string;
  status: string;
  statusLabel: string;
  createdAt: string;
  deliveredAt?: string;
  customer: {
    name: string;
    contact: string;
    phone: string;
    address: string;
  };
  logistics: {
    company: string;
    trackingNumber: string;
    driver: string;
    driverPhone: string;
    vehicleNo: string;
  };
  products: OrderProduct[];
  summary: {
    totalQuantity: number;
    totalAmount: number;
    shippingFee: number;
    finalAmount: number;
  };
}

/**
 * 获取状态标签
 */
const getStatusLabel = (status: string): string => {
  switch (status) {
    case 'delivered': return '已送达';
    case 'shipped': return '配送中';
    case 'pending': return '待发货';
    case 'returned': return '已退回';
    default: return '待处理';
  }
};

/**
 * 格式化日期时间
 */
const formatDateTime = (dateStr?: string): string => {
  if (!dateStr) return '-';
  return fmtDateTime(dateStr);
};

export function WHOrderDetailScreen() {
  const theme = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteType>();
  const { orderId } = route.params;

  // 状态管理
  const [loading, setLoading] = useState(true);
  const [orderDetail, setOrderDetail] = useState<OrderDetail | null>(null);

  // 加载订单数据
  const loadOrderData = useCallback(async () => {
    if (!orderId) {
      setLoading(false);
      return;
    }

    try {
      const shipment = await shipmentApiClient.getShipmentById(orderId);

      if (shipment) {
        const quantity = shipment.quantity || 0;
        const unitPrice = shipment.unitPrice || 0;
        const totalAmount = shipment.totalAmount || (quantity * unitPrice);

        setOrderDetail({
          orderNumber: shipment.shipmentNumber || shipment.orderNumber || `SH-${shipment.id}`,
          status: shipment.status || 'pending',
          statusLabel: getStatusLabel(shipment.status),
          createdAt: formatDateTime(shipment.createdAt),
          deliveredAt: shipment.status === 'delivered' ? formatDateTime(shipment.updatedAt) : undefined,
          customer: {
            name: shipment.productName || '未知客户',
            contact: '-',
            phone: '-',
            address: shipment.deliveryAddress || '未知地址',
          },
          logistics: {
            company: shipment.logisticsCompany || '未指定',
            trackingNumber: shipment.trackingNumber || '-',
            driver: '-',
            driverPhone: '-',
            vehicleNo: '-',
          },
          products: [
            {
              id: shipment.id,
              name: shipment.productName || '商品',
              specification: '-',
              quantity: quantity,
              unit: shipment.unit || 'kg',
              unitPrice: unitPrice,
              amount: totalAmount,
            },
          ],
          summary: {
            totalQuantity: quantity,
            totalAmount: totalAmount,
            shippingFee: 0,
            finalAmount: totalAmount,
          },
        });
      }
    } catch (error) {
      handleError(error, { title: '加载订单详情失败' });
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    loadOrderData();
  }, [loadOrderData]);

  const getStatusStyle = (status: string) => {
    switch (status) {
      case "delivered":
        return { color: "#388e3c", bgColor: "#e8f5e9" };
      case "shipped":
        return { color: "#0097a7", bgColor: "#e0f7fa" };
      case "ready":
        return { color: "#7b1fa2", bgColor: "#f3e5f5" };
      default:
        return { color: "#f57c00", bgColor: "#fff3e0" };
    }
  };

  // 加载状态
  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>订单详情</Text>
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
  if (!orderDetail) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>订单详情</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.loadingContainer}>
          <MaterialCommunityIcons name="clipboard-text-outline" size={64} color="#ddd" />
          <Text style={styles.loadingText}>未找到订单信息</Text>
        </View>
      </SafeAreaView>
    );
  }

  const statusStyle = getStatusStyle(orderDetail.status);

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
        <Text style={styles.headerTitle}>订单详情</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* 订单状态 */}
        <Surface style={styles.statusCard} elevation={1}>
          <View style={styles.statusHeader}>
            <View style={styles.statusLeft}>
              <Text style={styles.orderNumber}>{orderDetail.orderNumber}</Text>
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: statusStyle.bgColor },
                ]}
              >
                <Text style={[styles.statusText, { color: statusStyle.color }]}>
                  {orderDetail.statusLabel}
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.timeInfo}>
            <View style={styles.timeRow}>
              <Text style={styles.timeLabel}>下单时间</Text>
              <Text style={styles.timeValue}>{orderDetail.createdAt}</Text>
            </View>
            {orderDetail.deliveredAt && (
              <View style={styles.timeRow}>
                <Text style={styles.timeLabel}>送达时间</Text>
                <Text style={styles.timeValue}>{orderDetail.deliveredAt}</Text>
              </View>
            )}
          </View>
        </Surface>

        {/* 客户信息 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>客户信息</Text>
          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>客户名称</Text>
              <Text style={styles.infoValue}>{orderDetail.customer.name}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>联系人</Text>
              <Text style={styles.infoValue}>{orderDetail.customer.contact}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>联系电话</Text>
              <Text style={styles.infoValue}>{orderDetail.customer.phone}</Text>
            </View>
            <View style={[styles.infoItem, { width: "100%" }]}>
              <Text style={styles.infoLabel}>收货地址</Text>
              <Text style={styles.infoValue}>{orderDetail.customer.address}</Text>
            </View>
          </View>
        </View>

        {/* 物流信息 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>物流信息</Text>
          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>物流公司</Text>
              <Text style={styles.infoValue}>{orderDetail.logistics.company}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>运单号</Text>
              <Text style={styles.infoValue}>{orderDetail.logistics.trackingNumber}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>司机</Text>
              <Text style={styles.infoValue}>{orderDetail.logistics.driver}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>车牌号</Text>
              <Text style={styles.infoValue}>{orderDetail.logistics.vehicleNo}</Text>
            </View>
          </View>
        </View>

        {/* 产品明细 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>产品明细</Text>
          {orderDetail.products.map((product, index) => (
            <View key={product.id}>
              {index > 0 && <Divider style={styles.productDivider} />}
              <View style={styles.productItem}>
                <View style={styles.productMain}>
                  <Text style={styles.productName}>{product.name}</Text>
                  <Text style={styles.productAmount}>
                    ¥{formatNumberWithCommas(product.amount)}
                  </Text>
                </View>
                <View style={styles.productMeta}>
                  <Text style={styles.productSpec}>{product.specification}</Text>
                  <Text style={styles.productQty}>
                    {product.quantity} {product.unit} × ¥{product.unitPrice}
                  </Text>
                </View>
              </View>
            </View>
          ))}

          {/* 费用汇总 */}
          <View style={styles.summarySection}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>商品总量</Text>
              <Text style={styles.summaryValue}>
                {orderDetail.summary.totalQuantity} kg
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>商品金额</Text>
              <Text style={styles.summaryValue}>
                ¥{formatNumberWithCommas(orderDetail.summary.totalAmount)}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>运费</Text>
              <Text style={styles.summaryValue}>
                {orderDetail.summary.shippingFee === 0
                  ? "免运费"
                  : `¥${orderDetail.summary.shippingFee}`}
              </Text>
            </View>
            <View style={[styles.summaryRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>订单金额</Text>
              <Text style={styles.totalValue}>
                ¥{formatNumberWithCommas(orderDetail.summary.finalAmount)}
              </Text>
            </View>
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
  statusCard: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
  },
  statusHeader: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  statusLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  orderNumber: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "500",
  },
  timeInfo: {
    gap: 8,
  },
  timeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  timeLabel: {
    fontSize: 13,
    color: "#999",
  },
  timeValue: {
    fontSize: 13,
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
  productItem: {
    paddingVertical: 12,
  },
  productMain: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  productName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#333",
  },
  productAmount: {
    fontSize: 15,
    fontWeight: "600",
    color: "#f44336",
  },
  productMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  productSpec: {
    fontSize: 13,
    color: "#999",
  },
  productQty: {
    fontSize: 13,
    color: "#666",
  },
  productDivider: {
    marginVertical: 4,
  },
  summarySection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: "#666",
  },
  summaryValue: {
    fontSize: 14,
    color: "#333",
  },
  totalRow: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#333",
  },
  totalValue: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#f44336",
  },
});

export default WHOrderDetailScreen;
