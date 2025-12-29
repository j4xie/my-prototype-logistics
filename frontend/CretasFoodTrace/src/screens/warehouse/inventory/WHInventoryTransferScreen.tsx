/**
 * 库存调拨页面
 * 对应原型: warehouse/inventory-transfer.html
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
import { materialBatchApiClient, MaterialBatch } from "../../../services/api/materialBatchApiClient";
import { handleError } from "../../../utils/errorHandler";

type NavigationProp = NativeStackNavigationProp<WHInventoryStackParamList>;

interface BatchOption {
  id: string;
  batchNumber: string;
  materialName: string;
  quantity: number;
  expiryDate?: string;
  location: string;
}

export function WHInventoryTransferScreen() {
  const theme = useTheme();
  const navigation = useNavigation<NavigationProp>();

  // 状态管理
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [batches, setBatches] = useState<BatchOption[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [toLocation, setToLocation] = useState("");
  const [quantity, setQuantity] = useState("");
  const [transferType, setTransferType] = useState("space");
  const [remarks, setRemarks] = useState("");

  // 获取选中批次信息
  const selectedBatch = batches.find(b => b.id === selectedBatchId);
  const maxQuantity = selectedBatch?.quantity || 0;

  // 加载批次数据
  const loadBatches = useCallback(async () => {
    try {
      const response = await materialBatchApiClient.getMaterialBatches({
        status: 'available',
        size: 100
      }) as { data?: { content?: MaterialBatch[] } | MaterialBatch[] };

      const allBatches: MaterialBatch[] = (response.data as { content?: MaterialBatch[] })?.content || response.data as MaterialBatch[] || [];
      const batchOptions: BatchOption[] = allBatches
        .filter((batch: MaterialBatch) => (batch.remainingQuantity || 0) > 0)
        .map((batch: MaterialBatch) => ({
          id: batch.id,
          batchNumber: batch.batchNumber,
          materialName: batch.materialName || '未知物料',
          quantity: batch.remainingQuantity || 0,
          expiryDate: batch.expiryDate,
          location: batch.storageLocation || '未知库位',
        }));

      setBatches(batchOptions);
    } catch (error) {
      handleError(error, { title: '加载批次数据失败' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBatches();
  }, [loadBatches]);

  // 执行调拨
  const executeTransfer = useCallback(async () => {
    if (!selectedBatch) return;

    setSubmitting(true);
    try {
      await materialBatchApiClient.updateBatch(selectedBatch.id, {
        storageLocation: toLocation,
        notes: `库存调拨: ${selectedBatch.location} → ${toLocation}, 原因: ${transferType}, ${remarks}`,
      });

      Alert.alert("成功", "调拨成功", [
        { text: "确定", onPress: () => navigation.goBack() }
      ]);
    } catch (error) {
      handleError(error, { title: '调拨失败' });
    } finally {
      setSubmitting(false);
    }
  }, [selectedBatch, toLocation, transferType, remarks, navigation]);

  const handleTransfer = () => {
    if (!selectedBatchId) {
      Alert.alert("提示", "请选择要调拨的批次");
      return;
    }

    if (!toLocation) {
      Alert.alert("提示", "请选择目标库位");
      return;
    }

    const qty = parseInt(quantity) || 0;
    if (qty <= 0 || qty > maxQuantity) {
      Alert.alert("提示", `调拨数量应在 1 - ${maxQuantity} kg 之间`);
      return;
    }

    const fromLocation = selectedBatch?.location || '当前库位';
    Alert.alert("确认调拨", `确定将 ${qty}kg 从 ${fromLocation} 调拨到 ${toLocation} 吗？`, [
      { text: "取消", style: "cancel" },
      {
        text: "确定",
        onPress: executeTransfer,
      },
    ]);
  };

  const qty = parseInt(quantity) || 0;
  const fromRemaining = maxQuantity - qty;
  const toNew = qty;

  // 加载状态
  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
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
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>加载中...</Text>
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
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>库存调拨</Text>
          <Text style={styles.headerSubtitle}>库位间转移</Text>
        </View>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* 选择批次 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>选择批次</Text>

          <View style={styles.formItem}>
            <Text style={styles.formLabel}>
              批次 <Text style={styles.required}>*</Text>
            </Text>
            <View style={styles.pickerWrapper}>
              <Picker
                selectedValue={selectedBatchId}
                onValueChange={setSelectedBatchId}
                style={styles.picker}
              >
                <Picker.Item label="请选择批次" value="" />
                {batches.map((batch) => (
                  <Picker.Item
                    key={batch.id}
                    label={`${batch.batchNumber} - ${batch.materialName} (${batch.quantity}kg)`}
                    value={batch.id}
                  />
                ))}
              </Picker>
            </View>
          </View>

          {selectedBatch && (
            <View style={styles.batchInfo}>
              <Text style={styles.batchInfoLabel}>当前库位: {selectedBatch.location}</Text>
              <Text style={styles.batchInfoLabel}>可调拨数量: {selectedBatch.quantity}kg</Text>
              {selectedBatch.expiryDate && (
                <Text style={styles.batchInfoLabel}>保质期至: {selectedBatch.expiryDate}</Text>
              )}
            </View>
          )}
        </View>

        {/* 调拨信息 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>调拨信息</Text>

          <View style={styles.formItem}>
            <Text style={styles.formLabel}>
              调出库位 <Text style={styles.required}>*</Text>
            </Text>
            <View style={styles.locationDisplay}>
              <Text style={styles.locationText}>
                {selectedBatch?.location || '请先选择批次'}
              </Text>
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
              <Text style={styles.previewLocation}>
                {selectedBatch?.location || '未选择'}
              </Text>
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
                {toLocation || "未选择"}
              </Text>
              <Text style={styles.previewChange}>+{toNew}kg</Text>
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
          disabled={submitting}
          loading={submitting}
        >
          {submitting ? '调拨中...' : '确认调拨'}
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
  batchInfo: {
    backgroundColor: "#f9f9f9",
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  batchInfoLabel: {
    fontSize: 13,
    color: "#666",
    marginBottom: 4,
  },
  locationDisplay: {
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ddd",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  locationText: {
    fontSize: 14,
    color: "#333",
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
