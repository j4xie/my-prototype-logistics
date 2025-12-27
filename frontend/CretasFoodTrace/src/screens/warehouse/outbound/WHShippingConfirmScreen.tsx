/**
 * 发货确认页面
 * 对应原型: warehouse/shipping-confirm.html
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
  TextInput,
  RadioButton,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { WHOutboundStackParamList } from "../../../types/navigation";

type NavigationProp = NativeStackNavigationProp<WHOutboundStackParamList>;
type RouteType = RouteProp<WHOutboundStackParamList, "WHShippingConfirm">;

interface LogisticsOption {
  id: string;
  name: string;
  description: string;
  estimatedTime: string;
}

export function WHShippingConfirmScreen() {
  const theme = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteType>();
  const { orderId } = route.params;

  // 模拟订单数据
  const orderInfo = {
    orderNumber: "SH-20251226-004",
    customer: "美食广场",
    address: "浙江省宁波市海曙区中山西路123号",
    totalQuantity: 200,
    packageCount: 4,
  };

  // 物流选项
  const logisticsOptions: LogisticsOption[] = [
    {
      id: "sf",
      name: "顺丰冷链",
      description: "冷链配送，全程温控",
      estimatedTime: "预计 2 小时送达",
    },
    {
      id: "jd",
      name: "京东冷链",
      description: "冷链配送，温控保障",
      estimatedTime: "预计 3 小时送达",
    },
    {
      id: "self",
      name: "自有车辆",
      description: "工厂车辆配送",
      estimatedTime: "预计 1.5 小时送达",
    },
  ];

  const [selectedLogistics, setSelectedLogistics] = useState("sf");
  const [vehicleNo, setVehicleNo] = useState("");
  const [driverName, setDriverName] = useState("");
  const [driverPhone, setDriverPhone] = useState("");
  const [remarks, setRemarks] = useState("");

  const handleConfirm = () => {
    if (selectedLogistics === "self" && (!vehicleNo || !driverName)) {
      Alert.alert("提示", "请填写车辆和司机信息");
      return;
    }

    Alert.alert("确认发货", "确定发货吗？发货后将通知客户。", [
      { text: "取消", style: "cancel" },
      {
        text: "确定",
        onPress: () => {
          Alert.alert("成功", "发货成功！");
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
        <Text style={styles.headerTitle}>发货确认</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* 订单信息 */}
        <Surface style={styles.orderCard} elevation={1}>
          <View style={styles.orderHeader}>
            <Text style={styles.orderNumber}>{orderInfo.orderNumber}</Text>
            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>待发货</Text>
            </View>
          </View>
          <View style={styles.orderInfo}>
            <View style={styles.infoRow}>
              <MaterialCommunityIcons name="store" size={16} color="#666" />
              <Text style={styles.infoText}>{orderInfo.customer}</Text>
            </View>
            <View style={styles.infoRow}>
              <MaterialCommunityIcons
                name="map-marker"
                size={16}
                color="#666"
              />
              <Text style={styles.infoText}>{orderInfo.address}</Text>
            </View>
            <View style={styles.infoRow}>
              <MaterialCommunityIcons
                name="package-variant"
                size={16}
                color="#666"
              />
              <Text style={styles.infoText}>
                {orderInfo.totalQuantity} kg / {orderInfo.packageCount} 件
              </Text>
            </View>
          </View>
        </Surface>

        {/* 物流选择 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>物流方式</Text>
          <RadioButton.Group
            value={selectedLogistics}
            onValueChange={setSelectedLogistics}
          >
            {logisticsOptions.map((option) => (
              <TouchableOpacity
                key={option.id}
                style={[
                  styles.logisticsOption,
                  selectedLogistics === option.id &&
                    styles.logisticsOptionSelected,
                ]}
                onPress={() => setSelectedLogistics(option.id)}
                activeOpacity={0.7}
              >
                <RadioButton value={option.id} color="#4CAF50" />
                <View style={styles.logisticsInfo}>
                  <Text style={styles.logisticsName}>{option.name}</Text>
                  <Text style={styles.logisticsDesc}>{option.description}</Text>
                  <Text style={styles.logisticsTime}>{option.estimatedTime}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </RadioButton.Group>
        </View>

        {/* 自有车辆信息 */}
        {selectedLogistics === "self" && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>车辆信息</Text>
            <View style={styles.formItem}>
              <Text style={styles.label}>
                车牌号 <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                mode="outlined"
                value={vehicleNo}
                onChangeText={setVehicleNo}
                placeholder="请输入车牌号"
                style={styles.input}
                outlineColor="#ddd"
                activeOutlineColor="#4CAF50"
              />
            </View>
            <View style={styles.formItem}>
              <Text style={styles.label}>
                司机姓名 <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                mode="outlined"
                value={driverName}
                onChangeText={setDriverName}
                placeholder="请输入司机姓名"
                style={styles.input}
                outlineColor="#ddd"
                activeOutlineColor="#4CAF50"
              />
            </View>
            <View style={styles.formItem}>
              <Text style={styles.label}>联系电话</Text>
              <TextInput
                mode="outlined"
                value={driverPhone}
                onChangeText={setDriverPhone}
                placeholder="请输入联系电话"
                keyboardType="phone-pad"
                style={styles.input}
                outlineColor="#ddd"
                activeOutlineColor="#4CAF50"
              />
            </View>
          </View>
        )}

        {/* 备注 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>发货备注</Text>
          <TextInput
            mode="outlined"
            value={remarks}
            onChangeText={setRemarks}
            placeholder="请输入发货备注..."
            multiline
            numberOfLines={3}
            style={styles.textArea}
            outlineColor="#ddd"
            activeOutlineColor="#4CAF50"
          />
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* 底部操作 */}
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
          icon="truck-check"
        >
          确认发货
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
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  orderNumber: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  statusBadge: {
    backgroundColor: "#f3e5f5",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    color: "#7b1fa2",
    fontWeight: "500",
  },
  orderInfo: {
    gap: 8,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: "#666",
    lineHeight: 20,
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
  logisticsOption: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    marginBottom: 10,
  },
  logisticsOptionSelected: {
    borderColor: "#4CAF50",
    backgroundColor: "#f1f8e9",
  },
  logisticsInfo: {
    flex: 1,
    marginLeft: 8,
  },
  logisticsName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#333",
  },
  logisticsDesc: {
    fontSize: 13,
    color: "#666",
    marginTop: 2,
  },
  logisticsTime: {
    fontSize: 12,
    color: "#4CAF50",
    marginTop: 4,
  },
  formItem: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    color: "#333",
    marginBottom: 8,
  },
  required: {
    color: "#f44336",
  },
  input: {
    backgroundColor: "#fff",
    fontSize: 14,
  },
  textArea: {
    backgroundColor: "#fff",
    fontSize: 14,
    minHeight: 80,
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

export default WHShippingConfirmScreen;
