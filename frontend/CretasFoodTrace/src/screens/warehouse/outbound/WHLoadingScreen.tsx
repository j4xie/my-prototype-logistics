/**
 * 装车管理页面
 * 对应原型: warehouse/loading.html
 */

import React, { useState } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
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
import { WHOutboundStackParamList } from "../../../types/navigation";

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
  const theme = useTheme();
  const navigation = useNavigation<NavigationProp>();

  // 模拟车辆数据
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

  // 待装车订单
  const waitingOrders: LoadingOrder[] = [
    {
      id: "4",
      orderNumber: "SH-20251226-007",
      customer: "海鲜酒楼",
      quantity: 100,
      status: "waiting",
    },
    {
      id: "5",
      orderNumber: "SH-20251226-008",
      customer: "品质超市",
      quantity: 150,
      status: "waiting",
    },
  ];

  const handleDispatch = (vehicleId: string) => {
    Alert.alert("确认发车", "确定此车辆出发吗？", [
      { text: "取消", style: "cancel" },
      {
        text: "确定",
        onPress: () => {
          Alert.alert("成功", "车辆已发车");
        },
      },
    ]);
  };

  const getStatusConfig = (status: LoadingOrder["status"]) => {
    switch (status) {
      case "waiting":
        return { label: "待装车", color: "#f57c00", bgColor: "#fff3e0" };
      case "loading":
        return { label: "装车中", color: "#1976d2", bgColor: "#e3f2fd" };
      case "loaded":
        return { label: "已装车", color: "#388e3c", bgColor: "#e8f5e9" };
    }
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
            >
              确认发车
            </Button>
          </Surface>
        ))}

        {/* 待装车订单 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>待装车订单</Text>
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
