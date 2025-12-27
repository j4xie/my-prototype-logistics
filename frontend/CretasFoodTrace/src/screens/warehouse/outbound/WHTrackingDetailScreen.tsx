/**
 * 物流跟踪详情页面
 * 对应原型: warehouse/tracking-detail.html
 */

import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Linking,
  ActivityIndicator,
} from "react-native";
import { Text, Surface, Button, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { WHOutboundStackParamList } from "../../../types/navigation";
import { shipmentApiClient, ShipmentRecord } from "../../../services/api/shipmentApiClient";
import { handleError } from "../../../utils/errorHandler";

type NavigationProp = NativeStackNavigationProp<WHOutboundStackParamList>;
type RouteType = RouteProp<WHOutboundStackParamList, "WHTrackingDetail">;

interface TrackingInfo {
  orderNumber: string;
  customer: string;
  logistics: string;
  trackingNumber: string;
  status: string;
  temperature: string;
  driver: string;
  driverPhone: string;
}

interface TrackingEvent {
  id: string;
  time: string;
  status: string;
  location: string;
  isCurrent?: boolean;
}

export function WHTrackingDetailScreen() {
  const theme = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteType>();
  const { shipmentId } = route.params;

  // 状态管理
  const [loading, setLoading] = useState(true);
  const [trackingInfo, setTrackingInfo] = useState<TrackingInfo | null>(null);

  // 获取状态显示文本
  const getStatusLabel = (status: string): string => {
    switch (status) {
      case 'delivered': return '已送达';
      case 'shipped': return '运输中';
      case 'pending': return '待发货';
      case 'returned': return '已退回';
      default: return '处理中';
    }
  };

  // 加载物流数据
  const loadTrackingData = useCallback(async () => {
    if (!shipmentId) {
      setLoading(false);
      return;
    }

    try {
      const shipment = await shipmentApiClient.getShipmentById(shipmentId);

      if (shipment) {
        setTrackingInfo({
          orderNumber: shipment.shipmentNumber || shipment.orderNumber || `SH-${shipment.id}`,
          customer: shipment.productName || '未知客户',
          logistics: shipment.logisticsCompany || '未指定物流',
          trackingNumber: shipment.trackingNumber || '-',
          status: getStatusLabel(shipment.status),
          temperature: '-18°C', // TODO: 从设备监控获取实时温度
          driver: '司机信息', // TODO: 从物流接口获取
          driverPhone: '-', // TODO: 从物流接口获取
        });
      }
    } catch (error) {
      handleError(error, { title: '加载物流信息失败' });
    } finally {
      setLoading(false);
    }
  }, [shipmentId]);

  useEffect(() => {
    loadTrackingData();
  }, [loadTrackingData]);

  // 物流轨迹
  const trackingEvents: TrackingEvent[] = [
    {
      id: "1",
      time: "2025-12-26 11:30",
      status: "运输中",
      location: "杭州市余杭区分拨中心，正在派送",
      isCurrent: true,
    },
    {
      id: "2",
      time: "2025-12-26 09:15",
      status: "运输中",
      location: "已离开宁波市转运中心",
    },
    {
      id: "3",
      time: "2025-12-26 08:30",
      status: "已揽收",
      location: "已从白垩纪食品加工厂发出",
    },
    {
      id: "4",
      time: "2025-12-26 08:00",
      status: "待揽收",
      location: "商家已下单，等待快递员揽收",
    },
  ];

  const handleCallDriver = () => {
    if (trackingInfo?.driverPhone && trackingInfo.driverPhone !== '-') {
      Linking.openURL(`tel:${trackingInfo.driverPhone.replace(/\*/g, "")}`);
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
          <Text style={styles.headerTitle}>物流跟踪</Text>
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
  if (!trackingInfo) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>物流跟踪</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.loadingContainer}>
          <MaterialCommunityIcons name="truck-outline" size={64} color="#ddd" />
          <Text style={styles.loadingText}>未找到物流信息</Text>
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
        <Text style={styles.headerTitle}>物流跟踪</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* 物流状态卡片 */}
        <Surface style={styles.statusCard} elevation={1}>
          <View style={styles.statusHeader}>
            <View style={styles.statusIcon}>
              <MaterialCommunityIcons
                name="truck-delivery"
                size={32}
                color="#4CAF50"
              />
            </View>
            <View style={styles.statusInfo}>
              <Text style={styles.statusTitle}>{trackingInfo.status}</Text>
              <Text style={styles.statusDesc}>
                预计今日 14:00 前送达
              </Text>
            </View>
          </View>

          <View style={styles.trackingNumber}>
            <Text style={styles.trackingLabel}>
              {trackingInfo.logistics} {trackingInfo.trackingNumber}
            </Text>
            <TouchableOpacity>
              <MaterialCommunityIcons
                name="content-copy"
                size={18}
                color="#666"
              />
            </TouchableOpacity>
          </View>

          <View style={styles.tempInfo}>
            <MaterialCommunityIcons
              name="thermometer"
              size={18}
              color="#2196F3"
            />
            <Text style={styles.tempText}>
              当前温度: {trackingInfo.temperature}
            </Text>
            <Text style={styles.tempNormal}>温度正常</Text>
          </View>
        </Surface>

        {/* 司机信息 */}
        <Surface style={styles.driverCard} elevation={1}>
          <View style={styles.driverInfo}>
            <View style={styles.driverAvatar}>
              <MaterialCommunityIcons
                name="account"
                size={24}
                color="#666"
              />
            </View>
            <View style={styles.driverMain}>
              <Text style={styles.driverName}>{trackingInfo.driver}</Text>
              <Text style={styles.driverPhone}>{trackingInfo.driverPhone}</Text>
            </View>
          </View>
          <Button
            mode="contained"
            onPress={handleCallDriver}
            style={styles.callButton}
            labelStyle={styles.callButtonLabel}
            icon="phone"
          >
            联系司机
          </Button>
        </Surface>

        {/* 物流轨迹 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>物流轨迹</Text>

          <View style={styles.timeline}>
            {trackingEvents.map((event, index) => (
              <View key={event.id} style={styles.timelineItem}>
                <View style={styles.timelineLeft}>
                  <View
                    style={[
                      styles.timelineDot,
                      event.isCurrent && styles.timelineDotCurrent,
                    ]}
                  />
                  {index < trackingEvents.length - 1 && (
                    <View style={styles.timelineLine} />
                  )}
                </View>
                <View style={styles.timelineContent}>
                  <Text
                    style={[
                      styles.eventStatus,
                      event.isCurrent && styles.eventStatusCurrent,
                    ]}
                  >
                    {event.status}
                  </Text>
                  <Text style={styles.eventLocation}>{event.location}</Text>
                  <Text style={styles.eventTime}>{event.time}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* 订单信息 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>订单信息</Text>
          <View style={styles.orderInfo}>
            <View style={styles.orderRow}>
              <Text style={styles.orderLabel}>订单号</Text>
              <Text style={styles.orderValue}>{trackingInfo.orderNumber}</Text>
            </View>
            <View style={styles.orderRow}>
              <Text style={styles.orderLabel}>收货方</Text>
              <Text style={styles.orderValue}>{trackingInfo.customer}</Text>
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
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  statusIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#e8f5e9",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  statusInfo: {},
  statusTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
  statusDesc: {
    fontSize: 13,
    color: "#666",
    marginTop: 4,
  },
  trackingNumber: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  trackingLabel: {
    fontSize: 14,
    color: "#333",
  },
  tempInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    gap: 8,
  },
  tempText: {
    fontSize: 14,
    color: "#2196F3",
  },
  tempNormal: {
    fontSize: 12,
    color: "#4CAF50",
    backgroundColor: "#e8f5e9",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  driverCard: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  driverInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  driverAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#f5f5f5",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  driverMain: {},
  driverName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#333",
  },
  driverPhone: {
    fontSize: 13,
    color: "#666",
    marginTop: 2,
  },
  callButton: {
    borderRadius: 8,
    backgroundColor: "#4CAF50",
  },
  callButtonLabel: {
    color: "#fff",
    fontSize: 13,
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
  timeline: {},
  timelineItem: {
    flexDirection: "row",
    minHeight: 80,
  },
  timelineLeft: {
    alignItems: "center",
    width: 20,
    marginRight: 12,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#e0e0e0",
    marginTop: 4,
  },
  timelineDotCurrent: {
    backgroundColor: "#4CAF50",
    width: 14,
    height: 14,
    borderRadius: 7,
    marginTop: 3,
  },
  timelineLine: {
    flex: 1,
    width: 2,
    backgroundColor: "#e0e0e0",
    marginTop: 4,
  },
  timelineContent: {
    flex: 1,
    paddingBottom: 16,
  },
  eventStatus: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
    marginBottom: 4,
  },
  eventStatusCurrent: {
    color: "#4CAF50",
  },
  eventLocation: {
    fontSize: 14,
    color: "#333",
    lineHeight: 20,
    marginBottom: 4,
  },
  eventTime: {
    fontSize: 12,
    color: "#999",
  },
  orderInfo: {},
  orderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f5f5f5",
  },
  orderLabel: {
    fontSize: 14,
    color: "#999",
  },
  orderValue: {
    fontSize: 14,
    color: "#333",
  },
});

export default WHTrackingDetailScreen;
