/**
 * 装车管理页面
 * 对应原型: warehouse/loading.html
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
  Chip,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useTranslation } from 'react-i18next';
import { WHOutboundStackParamList } from "../../../types/navigation";
import { shipmentApiClient, ShipmentRecord } from "../../../services/api/shipmentApiClient";
import { handleError } from "../../../utils/errorHandler";

type NavigationProp = NativeStackNavigationProp<WHOutboundStackParamList>;

interface LoadingOrder {
  id: string;
  orderNumber: string;
  customer: string;
  quantity: number;
  status: "waiting" | "loading" | "loaded";
}

interface Vehicle {
  id: string;
  plateNumber: string;
  driver: string;
  phone: string;
  capacity: number;
  currentLoad: number;
  orders: LoadingOrder[];
}

export function WHLoadingScreen() {
  const { t } = useTranslation('warehouse');
  const theme = useTheme();
  const navigation = useNavigation<NavigationProp>();

  // 状态管理
  const [loading, setLoading] = useState(true);
  const [dispatching, setDispatching] = useState<string | null>(null); // 正在发车的车辆ID
  const [waitingOrders, setWaitingOrders] = useState<LoadingOrder[]>([]);

  // TODO: 车辆管理需要后端 API，当前使用模拟数据
  // 后续需要接入车辆管理和装车分配 API
  const [vehicles, setVehicles] = useState<Vehicle[]>([
    {
      id: "1",
      plateNumber: "浙B12345",
      driver: "李师傅",
      phone: "139****5678",
      capacity: 500,
      currentLoad: 280,
      orders: [
        {
          id: "1",
          orderNumber: "SH-20251226-004",
          customer: "美食广场",
          quantity: 200,
          status: "loaded",
        },
        {
          id: "2",
          orderNumber: "SH-20251226-005",
          customer: "鲜味餐厅",
          quantity: 80,
          status: "loaded",
        },
      ],
    },
    {
      id: "2",
      plateNumber: "浙B67890",
      driver: "王师傅",
      phone: "138****1234",
      capacity: 400,
      currentLoad: 120,
      orders: [
        {
          id: "3",
          orderNumber: "SH-20251226-006",
          customer: "城市生鲜店",
          quantity: 120,
          status: "loading",
        },
      ],
    },
  ]);

  // 加载待装车订单（从出货记录中获取 pending 状态的订单）
  const loadWaitingOrders = useCallback(async () => {
    try {
      const response = await shipmentApiClient.getShipments({ status: 'pending', size: 20 });

      const orders: LoadingOrder[] = (response.data || []).map((shipment: ShipmentRecord) => ({
        id: shipment.id,
        orderNumber: shipment.shipmentNumber || shipment.orderNumber || `SH-${shipment.id}`,
        customer: shipment.deliveryAddress || '未知客户',
        quantity: shipment.quantity || 0,
        status: 'waiting' as const,
      }));

      setWaitingOrders(orders);
    } catch (error) {
      handleError(error, { title: t('messages.loadListFailed') });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWaitingOrders();
  }, [loadWaitingOrders]);

  // 发车操作
  const dispatchVehicle = async (vehicleId: string) => {
    const vehicle = vehicles.find(v => v.id === vehicleId);
    if (!vehicle) return;

    setDispatching(vehicleId);
    try {
      // 批量更新车辆上所有订单的状态为 'shipped'
      const updatePromises = vehicle.orders
        .filter(order => order.status === 'loaded')
        .map(order => shipmentApiClient.updateStatus(order.id, 'shipped'));

      await Promise.all(updatePromises);

      // 从车辆列表中移除已发车的车辆
      setVehicles(prev => prev.filter(v => v.id !== vehicleId));
      Alert.alert(t('inbound.create.success'), t('outbound.loading.success'));
    } catch (error) {
      handleError(error, { title: t('messages.loadListFailed') });
    } finally {
      setDispatching(null);
    }
  };

  const handleDispatch = (vehicleId: string) => {
    Alert.alert(t('outbound.loading.confirmLoading'), t('outbound.loading.confirmLoading'), [
      { text: t('inbound.create.cancel'), style: "cancel" },
      {
        text: t('inbound.create.confirm'),
        onPress: () => dispatchVehicle(vehicleId),
      },
    ]);
  };

  const getStatusConfig = (status: LoadingOrder["status"]) => {
    switch (status) {
      case "waiting":
        return { label: t('outbound.status.waiting'), color: "#f57c00", bgColor: "#fff3e0" };
      case "loading":
        return { label: t('outbound.status.packing'), color: "#1976d2", bgColor: "#e3f2fd" };
      case "loaded":
        return { label: t('outbound.status.ready'), color: "#388e3c", bgColor: "#e8f5e9" };
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
          <Text style={styles.headerTitle}>{t('outbound.loading.title')}</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>{t('outbound.loading.loading')}</Text>
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
        <Text style={styles.headerTitle}>装车管理</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* 车辆列表 */}
        {vehicles.map((vehicle) => (
          <Surface key={vehicle.id} style={styles.vehicleCard} elevation={1}>
            <View style={styles.vehicleHeader}>
              <View style={styles.vehicleInfo}>
                <MaterialCommunityIcons
                  name="truck"
                  size={24}
                  color="#4CAF50"
                />
                <View style={styles.vehicleMain}>
                  <Text style={styles.plateNumber}>{vehicle.plateNumber}</Text>
                  <Text style={styles.driverInfo}>
                    {vehicle.driver} | {vehicle.phone}
                  </Text>
                </View>
              </View>
              <View style={styles.loadInfo}>
                <Text style={styles.loadText}>
                  {vehicle.currentLoad}/{vehicle.capacity} kg
                </Text>
                <View style={styles.loadBar}>
                  <View
                    style={[
                      styles.loadFill,
                      {
                        width: `${(vehicle.currentLoad / vehicle.capacity) * 100}%`,
                      },
                    ]}
                  />
                </View>
              </View>
            </View>

            {/* 订单列表 */}
            <View style={styles.ordersContainer}>
              {vehicle.orders.map((order) => {
                const statusConfig = getStatusConfig(order.status);
                return (
                  <View key={order.id} style={styles.orderItem}>
                    <View style={styles.orderMain}>
                      <Text style={styles.orderNumber}>{order.orderNumber}</Text>
                      <Chip
                        style={[
                          styles.orderStatus,
                          { backgroundColor: statusConfig.bgColor },
                        ]}
                        textStyle={{ color: statusConfig.color, fontSize: 11 }}
                      >
                        {statusConfig.label}
                      </Chip>
                    </View>
                    <View style={styles.orderMeta}>
                      <Text style={styles.orderCustomer}>{order.customer}</Text>
                      <Text style={styles.orderQty}>{order.quantity} kg</Text>
                    </View>
                  </View>
                );
              })}
            </View>

            {/* 发车按钮 */}
            <Button
              mode="contained"
              onPress={() => handleDispatch(vehicle.id)}
              style={styles.dispatchButton}
              labelStyle={styles.dispatchButtonLabel}
              icon="truck-fast"
              disabled={dispatching !== null}
              loading={dispatching === vehicle.id}
            >
              {dispatching === vehicle.id ? t('outbound.loading.loading') : t('outbound.loading.confirmLoading')}
            </Button>
          </Surface>
        ))}

        {/* 待装车订单 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('outbound.loading.loadedItems')}</Text>
          {waitingOrders.map((order) => {
            const statusConfig = getStatusConfig(order.status);
            return (
              <TouchableOpacity
                key={order.id}
                style={styles.waitingOrder}
                activeOpacity={0.7}
              >
                <View style={styles.orderMain}>
                  <Text style={styles.orderNumber}>{order.orderNumber}</Text>
                  <Chip
                    style={[
                      styles.orderStatus,
                      { backgroundColor: statusConfig.bgColor },
                    ]}
                    textStyle={{ color: statusConfig.color, fontSize: 11 }}
                  >
                    {statusConfig.label}
                  </Chip>
                </View>
                <View style={styles.orderMeta}>
                  <Text style={styles.orderCustomer}>{order.customer}</Text>
                  <Text style={styles.orderQty}>{order.quantity} kg</Text>
                </View>
              </TouchableOpacity>
            );
          })}
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
    padding: 16,
  },
  vehicleCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  vehicleHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  vehicleInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  vehicleMain: {},
  plateNumber: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
  },
  driverInfo: {
    fontSize: 13,
    color: "#666",
    marginTop: 2,
  },
  loadInfo: {
    alignItems: "flex-end",
  },
  loadText: {
    fontSize: 13,
    color: "#666",
    marginBottom: 4,
  },
  loadBar: {
    width: 80,
    height: 6,
    backgroundColor: "#e0e0e0",
    borderRadius: 3,
  },
  loadFill: {
    height: "100%",
    backgroundColor: "#4CAF50",
    borderRadius: 3,
  },
  ordersContainer: {
    gap: 8,
    marginBottom: 16,
  },
  orderItem: {
    backgroundColor: "#f9f9f9",
    borderRadius: 8,
    padding: 12,
  },
  orderMain: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  orderNumber: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  orderStatus: {
    height: 24,
  },
  orderMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  orderCustomer: {
    fontSize: 13,
    color: "#666",
  },
  orderQty: {
    fontSize: 13,
    color: "#4CAF50",
    fontWeight: "600",
  },
  dispatchButton: {
    borderRadius: 8,
    backgroundColor: "#4CAF50",
  },
  dispatchButtonLabel: {
    color: "#fff",
    fontWeight: "600",
  },
  section: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#999",
    marginBottom: 12,
  },
  waitingOrder: {
    backgroundColor: "#f9f9f9",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
});

export default WHLoadingScreen;
