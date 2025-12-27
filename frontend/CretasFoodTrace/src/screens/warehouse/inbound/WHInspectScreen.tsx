/**
 * 质检页面
 * 对应原型: warehouse/inbound-inspect.html
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
  Checkbox,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { WHInboundStackParamList } from "../../../types/navigation";

type NavigationProp = NativeStackNavigationProp<WHInboundStackParamList>;
type RouteType = RouteProp<WHInboundStackParamList, "WHInspect">;

interface InspectItem {
  key: string;
  label: string;
  checked: boolean;
}

export function WHInspectScreen() {
  const theme = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteType>();
  const { batchId } = route.params;

  // 模拟批次数据
  const batchInfo = {
    batchNumber: "MB-20251226-002",
    material: "虾仁",
    materialType: "冻品",
    supplier: "东海冷冻食品有限公司",
    quantity: 80,
  };

  // 质检项
  const [inspectItems, setInspectItems] = useState<InspectItem[]>([
    { key: "appearance", label: "外观检查 - 颜色正常，无异物", checked: false },
    { key: "smell", label: "气味检查 - 无异味", checked: false },
    { key: "temp", label: "温度检测 - 符合冷链要求", checked: false },
    { key: "package", label: "包装检查 - 完整无破损", checked: false },
    { key: "certificate", label: "证书检查 - 资质齐全有效", checked: false },
  ]);

  const [sampleWeight, setSampleWeight] = useState("");
  const [actualTemp, setActualTemp] = useState("");
  const [remarks, setRemarks] = useState("");

  const toggleItem = (key: string) => {
    setInspectItems((prev) =>
      prev.map((item) =>
        item.key === key ? { ...item, checked: !item.checked } : item
      )
    );
  };

  const allChecked = inspectItems.every((item) => item.checked);
  const checkedCount = inspectItems.filter((item) => item.checked).length;

  const handlePass = () => {
    if (!allChecked) {
      Alert.alert("提示", "请完成所有质检项目");
      return;
    }

    Alert.alert("质检通过", "确定此批次质检通过吗？", [
      { text: "取消", style: "cancel" },
      {
        text: "确定",
        onPress: () => {
          Alert.alert("成功", "质检通过，请进行上架操作");
          navigation.goBack();
        },
      },
    ]);
  };

  const handleReject = () => {
    Alert.alert("质检不通过", "确定此批次质检不通过吗？", [
      { text: "取消", style: "cancel" },
      {
        text: "确定",
        style: "destructive",
        onPress: () => {
          Alert.alert("已标记", "批次已标记为质检不通过");
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
        <Text style={styles.headerTitle}>质检作业</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* 批次信息 */}
        <Surface style={styles.batchCard} elevation={1}>
          <View style={styles.batchHeader}>
            <Text style={styles.batchNumber}>{batchInfo.batchNumber}</Text>
            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>质检中</Text>
            </View>
          </View>
          <View style={styles.batchInfo}>
            <Text style={styles.materialName}>
              {batchInfo.material} ({batchInfo.materialType})
            </Text>
            <Text style={styles.supplierText}>{batchInfo.supplier}</Text>
            <Text style={styles.quantityText}>{batchInfo.quantity} kg</Text>
          </View>
        </Surface>

        {/* 质检项目 */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>质检项目</Text>
            <Text style={styles.progressText}>
              {checkedCount}/{inspectItems.length}
            </Text>
          </View>

          {inspectItems.map((item) => (
            <TouchableOpacity
              key={item.key}
              style={styles.checkItem}
              onPress={() => toggleItem(item.key)}
              activeOpacity={0.7}
            >
              <Checkbox
                status={item.checked ? "checked" : "unchecked"}
                onPress={() => toggleItem(item.key)}
                color="#4CAF50"
              />
              <Text
                style={[
                  styles.checkLabel,
                  item.checked && styles.checkLabelChecked,
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* 质检数据 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>质检数据</Text>

          <View style={styles.dataRow}>
            <View style={styles.dataItem}>
              <Text style={styles.dataLabel}>抽样重量(kg)</Text>
              <TextInput
                mode="outlined"
                value={sampleWeight}
                onChangeText={setSampleWeight}
                placeholder="0"
                keyboardType="numeric"
                style={styles.dataInput}
                outlineColor="#ddd"
                activeOutlineColor="#4CAF50"
              />
            </View>
            <View style={styles.dataItem}>
              <Text style={styles.dataLabel}>实测温度(°C)</Text>
              <TextInput
                mode="outlined"
                value={actualTemp}
                onChangeText={setActualTemp}
                placeholder="-18"
                keyboardType="numbers-and-punctuation"
                style={styles.dataInput}
                outlineColor="#ddd"
                activeOutlineColor="#4CAF50"
              />
            </View>
          </View>
        </View>

        {/* 备注 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>质检备注</Text>
          <TextInput
            mode="outlined"
            value={remarks}
            onChangeText={setRemarks}
            placeholder="请输入质检备注..."
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
          onPress={handleReject}
          style={styles.rejectButton}
          labelStyle={styles.rejectButtonLabel}
          icon="close"
        >
          不通过
        </Button>
        <Button
          mode="contained"
          onPress={handlePass}
          style={styles.passButton}
          labelStyle={styles.passButtonLabel}
          icon="check"
          disabled={!allChecked}
        >
          质检通过
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
  batchCard: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
  },
  batchHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  batchNumber: {
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
  batchInfo: {
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
    paddingTop: 12,
  },
  materialName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  supplierText: {
    fontSize: 13,
    color: "#666",
    marginTop: 4,
  },
  quantityText: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#4CAF50",
    marginTop: 8,
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
  },
  progressText: {
    fontSize: 14,
    color: "#4CAF50",
    fontWeight: "600",
  },
  checkItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f5f5f5",
  },
  checkLabel: {
    flex: 1,
    fontSize: 14,
    color: "#333",
    marginLeft: 8,
  },
  checkLabelChecked: {
    color: "#4CAF50",
  },
  dataRow: {
    flexDirection: "row",
    gap: 12,
  },
  dataItem: {
    flex: 1,
  },
  dataLabel: {
    fontSize: 13,
    color: "#666",
    marginBottom: 8,
  },
  dataInput: {
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
  rejectButton: {
    flex: 1,
    borderRadius: 8,
    borderColor: "#f44336",
  },
  rejectButtonLabel: {
    color: "#f44336",
  },
  passButton: {
    flex: 1,
    borderRadius: 8,
    backgroundColor: "#4CAF50",
  },
  passButtonLabel: {
    color: "#fff",
    fontWeight: "600",
  },
});

export default WHInspectScreen;
