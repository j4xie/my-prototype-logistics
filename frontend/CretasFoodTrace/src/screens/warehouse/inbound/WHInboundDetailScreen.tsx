/**
 * 入库详情页面
 * 对应原型: warehouse/inbound-detail.html
 */

import React, { useState } from "react";
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
import { WHInboundStackParamList } from "../../../types/navigation";

type NavigationProp = NativeStackNavigationProp<WHInboundStackParamList>;
type RouteType = RouteProp<WHInboundStackParamList, "WHInboundDetail">;

export function WHInboundDetailScreen() {
  const theme = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteType>();
  const { batchId } = route.params;

  // 模拟数据
  const detail = {
    batchNumber: "MB-20251226-001",
    status: "pending",
    statusLabel: "待确认",
    material: "带鱼",
    materialType: "鲜品",
    supplier: "舟山渔业合作社",
    supplierContact: "张经理 138****1234",
    quantity: 150,
    unit: "kg",
    unitPrice: 28.5,
    totalAmount: 4275,
    productionDate: "2025-12-25",
    expiryDate: "2025-12-28",
    storageTemp: "-2°C ~ 4°C",
    arrivalTime: "2025-12-26 09:00",
    vehicleNo: "浙B12345",
    driverName: "李师傅",
    driverPhone: "139****5678",
    remarks: "请注意冷链保鲜，到货后立即质检",
  };

  const handleConfirm = () => {
    Alert.alert("确认入库", "确定要确认此入库单吗？", [
      { text: "取消", style: "cancel" },
      {
        text: "确定",
        onPress: () => {
          Alert.alert("成功", "入库确认成功，进入质检流程");
          navigation.goBack();
        },
      },
    ]);
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
        <Text style={styles.headerTitle}>入库详情</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* 状态卡片 */}
        <Surface style={styles.statusCard} elevation={1}>
          <View style={styles.statusHeader}>
            <Text style={styles.batchNumber}>{detail.batchNumber}</Text>
            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>{detail.statusLabel}</Text>
            </View>
          </View>
          <Divider style={styles.cardDivider} />
          <View style={styles.materialInfo}>
            <Text style={styles.materialName}>
              {detail.material} ({detail.materialType})
            </Text>
            <Text style={styles.quantityText}>
              {detail.quantity} {detail.unit}
            </Text>
          </View>
        </Surface>

        {/* 基本信息 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>基本信息</Text>
          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>供应商</Text>
              <Text style={styles.infoValue}>{detail.supplier}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>联系人</Text>
              <Text style={styles.infoValue}>{detail.supplierContact}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>单价</Text>
              <Text style={styles.infoValue}>¥{detail.unitPrice}/kg</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>金额</Text>
              <Text style={[styles.infoValue, styles.amountValue]}>
                ¥{detail.totalAmount.toLocaleString()}
              </Text>
            </View>
          </View>
        </View>

        {/* 保质信息 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>保质信息</Text>
          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>生产日期</Text>
              <Text style={styles.infoValue}>{detail.productionDate}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>保质期至</Text>
              <Text style={styles.infoValue}>{detail.expiryDate}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>存储温度</Text>
              <Text style={styles.infoValue}>{detail.storageTemp}</Text>
            </View>
          </View>
        </View>

        {/* 物流信息 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>物流信息</Text>
          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>到货时间</Text>
              <Text style={styles.infoValue}>{detail.arrivalTime}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>车牌号</Text>
              <Text style={styles.infoValue}>{detail.vehicleNo}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>司机</Text>
              <Text style={styles.infoValue}>{detail.driverName}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>联系电话</Text>
              <Text style={styles.infoValue}>{detail.driverPhone}</Text>
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
      {detail.status === "pending" && (
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
            onPress={handleConfirm}
            style={styles.confirmButton}
            labelStyle={styles.confirmButtonLabel}
          >
            确认入库
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
  batchNumber: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
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
  cardDivider: {
    marginVertical: 12,
  },
  materialInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  materialName: {
    fontSize: 15,
    color: "#333",
  },
  quantityText: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#4CAF50",
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
  amountValue: {
    color: "#f44336",
    fontWeight: "600",
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
  confirmButton: {
    flex: 1,
    borderRadius: 8,
    backgroundColor: "#4CAF50",
  },
  confirmButtonLabel: {
    color: "#fff",
    fontWeight: "600",
  },
});

export default WHInboundDetailScreen;
