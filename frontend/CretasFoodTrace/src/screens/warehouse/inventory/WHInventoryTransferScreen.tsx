/**
 * 库存调拨页面
 * 对应原型: warehouse/inventory-transfer.html
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
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { WHInventoryStackParamList } from "../../../types/navigation";
import { Picker } from "@react-native-picker/picker";

type NavigationProp = NativeStackNavigationProp<WHInventoryStackParamList>;

export function WHInventoryTransferScreen() {
  const theme = useTheme();
  const navigation = useNavigation<NavigationProp>();

  const [selectedMaterial, setSelectedMaterial] = useState("fish");
  const [selectedBatch, setSelectedBatch] = useState("MB-20251223-001");
  const [fromLocation, setFromLocation] = useState("A-01");
  const [toLocation, setToLocation] = useState("");
  const [quantity, setQuantity] = useState("100");
  const [transferType, setTransferType] = useState("space");
  const [remarks, setRemarks] = useState("");

  const maxQuantity = 256; // 可调拨数量

  const handleTransfer = () => {
    if (!toLocation) {
      Alert.alert("提示", "请选择目标库位");
      return;
    }

    const qty = parseInt(quantity) || 0;
    if (qty <= 0 || qty > maxQuantity) {
      Alert.alert("提示", `调拨数量应在 1 - ${maxQuantity} kg 之间`);
      return;
    }

    Alert.alert("确认调拨", `确定将 ${qty}kg 从 ${fromLocation} 调拨到 ${toLocation} 吗？`, [
      { text: "取消", style: "cancel" },
      {
        text: "确定",
        onPress: () => {
          Alert.alert("成功", "调拨成功");
          navigation.goBack();
        },
      },
    ]);
  };

  const qty = parseInt(quantity) || 0;
  const fromRemaining = maxQuantity - qty;
  const toNew = qty;

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
          <Text style={styles.headerTitle}>库存调拨</Text>
          <Text style={styles.headerSubtitle}>库位间转移</Text>
        </View>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* 选择物料 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>选择物料</Text>

          <View style={styles.formItem}>
            <Text style={styles.formLabel}>
              物料名称 <Text style={styles.required}>*</Text>
            </Text>
            <View style={styles.pickerWrapper}>
              <Picker
                selectedValue={selectedMaterial}
                onValueChange={setSelectedMaterial}
                style={styles.picker}
              >
                <Picker.Item label="请选择物料" value="" />
                <Picker.Item label="带鱼 (鲜品)" value="fish" />
                <Picker.Item label="虾仁 (冻品)" value="shrimp" />
                <Picker.Item label="鲈鱼 (鲜品)" value="bass" />
                <Picker.Item label="鱿鱼 (冻品)" value="squid" />
              </Picker>
            </View>
          </View>

          <View style={styles.formItem}>
            <Text style={styles.formLabel}>
              选择批次 <Text style={styles.required}>*</Text>
            </Text>
            <View style={styles.pickerWrapper}>
              <Picker
                selectedValue={selectedBatch}
                onValueChange={setSelectedBatch}
                style={styles.picker}
              >
                <Picker.Item label="请选择批次" value="" />
                <Picker.Item
                  label="MB-20251223-001 (256kg, 3天后过期)"
                  value="MB-20251223-001"
                />
                <Picker.Item
                  label="MB-20251224-002 (320kg, 4天后过期)"
                  value="MB-20251224-002"
                />
                <Picker.Item
                  label="MB-20251226-001 (280kg, 新入库)"
                  value="MB-20251226-001"
                />
              </Picker>
            </View>
          </View>
        </View>

        {/* 调拨信息 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>调拨信息</Text>

          <View style={styles.formItem}>
            <Text style={styles.formLabel}>
              调出库位 <Text style={styles.required}>*</Text>
            </Text>
            <View style={styles.pickerWrapper}>
              <Picker
                selectedValue={fromLocation}
                onValueChange={setFromLocation}
                style={styles.picker}
              >
                <Picker.Item label="A区-冷藏库-01 (当前库位)" value="A-01" />
              </Picker>
            </View>
          </View>

          <View style={styles.transferArrow}>
            <MaterialCommunityIcons
              name="arrow-down"
              size={24}
              color="#4CAF50"
            />
          </View>

          <View style={styles.formItem}>
            <Text style={styles.formLabel}>
              调入库位 <Text style={styles.required}>*</Text>
            </Text>
            <View style={styles.pickerWrapper}>
              <Picker
                selectedValue={toLocation}
                onValueChange={setToLocation}
                style={styles.picker}
              >
                <Picker.Item label="请选择目标库位" value="" />
                <Picker.Item label="A区-冷藏库-02 (剩余: 150kg)" value="A-02" />
                <Picker.Item label="A区-冷藏库-03 (剩余: 300kg)" value="A-03" />
                <Picker.Item label="B区-冷冻库-01 (剩余: 500kg)" value="B-01" />
              </Picker>
            </View>
          </View>

          <View style={styles.formItem}>
            <Text style={styles.formLabel}>
              调拨数量 (kg) <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              mode="outlined"
              value={quantity}
              onChangeText={setQuantity}
              keyboardType="numeric"
              placeholder="请输入调拨数量"
              style={styles.input}
              outlineColor="#ddd"
              activeOutlineColor="#4CAF50"
            />
            <Text style={styles.formHint}>可调拨: {maxQuantity} kg</Text>
          </View>
        </View>

        {/* 调拨原因 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>调拨原因</Text>

          <View style={styles.formItem}>
            <Text style={styles.formLabel}>
              调拨类型 <Text style={styles.required}>*</Text>
            </Text>
            <RadioButton.Group
              value={transferType}
              onValueChange={setTransferType}
            >
              <View style={styles.radioGroup}>
                <TouchableOpacity
                  style={styles.radioItem}
                  onPress={() => setTransferType("space")}
                >
                  <RadioButton value="space" color="#4CAF50" />
                  <Text style={styles.radioLabel}>库位整理</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.radioItem}
                  onPress={() => setTransferType("temp")}
                >
                  <RadioButton value="temp" color="#4CAF50" />
                  <Text style={styles.radioLabel}>温控调整</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.radioItem}
                  onPress={() => setTransferType("fifo")}
                >
                  <RadioButton value="fifo" color="#4CAF50" />
                  <Text style={styles.radioLabel}>先进先出</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.radioItem}
                  onPress={() => setTransferType("other")}
                >
                  <RadioButton value="other" color="#4CAF50" />
                  <Text style={styles.radioLabel}>其他</Text>
                </TouchableOpacity>
              </View>
            </RadioButton.Group>
          </View>

          <View style={styles.formItem}>
            <Text style={styles.formLabel}>备注说明</Text>
            <TextInput
              mode="outlined"
              value={remarks}
              onChangeText={setRemarks}
              placeholder="请输入调拨说明（选填）"
              multiline
              numberOfLines={2}
              style={styles.textArea}
              outlineColor="#ddd"
              activeOutlineColor="#4CAF50"
            />
          </View>
        </View>

        {/* 调拨预览 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>调拨预览</Text>
          <View style={styles.transferPreview}>
            <View style={styles.previewFrom}>
              <Text style={styles.previewLabel}>调出</Text>
              <Text style={styles.previewLocation}>A区-冷藏库-01</Text>
              <Text style={styles.previewChange}>
                {maxQuantity}kg → {fromRemaining}kg
              </Text>
            </View>
            <View style={styles.previewArrow}>
              <MaterialCommunityIcons
                name="arrow-right"
                size={24}
                color="#4CAF50"
              />
            </View>
            <View style={styles.previewTo}>
              <Text style={styles.previewLabel}>调入</Text>
              <Text style={styles.previewLocation}>
                {toLocation ? `A区-冷藏库-0${toLocation.split("-")[1]}` : "未选择"}
              </Text>
              <Text style={styles.previewChange}>0kg → {toNew}kg</Text>
            </View>
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* 底部操作 */}
      <View style={styles.bottomActions}>
        <Button
          mode="outlined"
          onPress={() => navigation.goBack()}
          style={styles.cancelButton}
          labelStyle={{ color: "#666" }}
        >
          取消
        </Button>
        <Button
          mode="contained"
          onPress={handleTransfer}
          style={styles.confirmButton}
          labelStyle={{ color: "#fff" }}
        >
          确认调拨
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
  formItem: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 14,
    color: "#333",
    marginBottom: 8,
  },
  required: {
    color: "#f44336",
  },
  pickerWrapper: {
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  picker: {
    height: 50,
  },
  transferArrow: {
    alignItems: "center",
    marginVertical: 8,
  },
  input: {
    backgroundColor: "#fff",
    fontSize: 14,
  },
  formHint: {
    fontSize: 12,
    color: "#999",
    marginTop: 4,
  },
  radioGroup: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  radioItem: {
    flexDirection: "row",
    alignItems: "center",
    width: "50%",
    marginBottom: 8,
  },
  radioLabel: {
    fontSize: 14,
    color: "#333",
  },
  textArea: {
    backgroundColor: "#fff",
    fontSize: 14,
    minHeight: 60,
  },
  transferPreview: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f9f9f9",
    borderRadius: 12,
    padding: 16,
  },
  previewFrom: {
    flex: 1,
    alignItems: "center",
  },
  previewTo: {
    flex: 1,
    alignItems: "center",
  },
  previewArrow: {
    paddingHorizontal: 12,
  },
  previewLabel: {
    fontSize: 12,
    color: "#999",
    marginBottom: 4,
  },
  previewLocation: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  previewChange: {
    fontSize: 12,
    color: "#4CAF50",
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
  confirmButton: {
    flex: 1,
    borderRadius: 8,
    backgroundColor: "#4CAF50",
  },
});

export default WHInventoryTransferScreen;
