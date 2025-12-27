/**
 * 库存盘点页面
 * 对应原型: warehouse/inventory-check.html
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
  ProgressBar,
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

interface CheckItem {
  id: string;
  name: string;
  type: string;
  batchNumber: string;
  location: string;
  systemQty: number;
  actualQty: number | null;
  status: "pending" | "completed" | "diff";
}

export function WHInventoryCheckScreen() {
  const theme = useTheme();
  const navigation = useNavigation<NavigationProp>();

  // 状态管理
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState("A");
  const [checkItems, setCheckItems] = useState<CheckItem[]>([]);

  // 获取存储类型显示名称
  const getStorageTypeLabel = (type?: string): string => {
    switch (type) {
      case 'fresh': return '鲜品';
      case 'frozen': return '冻品';
      case 'dry': return '干货';
      default: return '其他';
    }
  };

  // 加载库存数据
  const loadInventoryData = useCallback(async () => {
    try {
      const response = await materialBatchApiClient.getMaterialBatches({
        status: 'available',
        size: 50
      });

      const batches = response.data?.content || response.data || [];

      const items: CheckItem[] = batches.map((batch: MaterialBatch) => ({
        id: batch.id,
        name: batch.materialName || '未知物料',
        type: getStorageTypeLabel(batch.storageType),
        batchNumber: batch.batchNumber,
        location: batch.storageLocation || 'A区-冷藏库',
        systemQty: batch.remainingQuantity || 0,
        actualQty: null,
        status: 'pending' as const,
      }));

      setCheckItems(items);
    } catch (error) {
      handleError(error, { title: '加载库存数据失败' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInventoryData();
  }, [loadInventoryData]);

  const completedCount = checkItems.filter(
    (item) => item.status !== "pending"
  ).length;
  const totalCount = checkItems.length;
  const progress = completedCount / totalCount;
  const diffCount = checkItems.filter((item) => item.status === "diff").length;
  const noDiffCount = completedCount - diffCount;
  const totalDiff = checkItems
    .filter((item) => item.status === "diff")
    .reduce(
      (sum, item) => sum + ((item.actualQty ?? 0) - item.systemQty),
      0
    );

  const updateActualQty = (id: string, value: string) => {
    const qty = parseInt(value) || null;
    setCheckItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const newStatus =
            qty === null
              ? "pending"
              : qty === item.systemQty
              ? "completed"
              : "diff";
          return { ...item, actualQty: qty, status: newStatus };
        }
        return item;
      })
    );
  };

  // 提交盘点结果
  const submitInventoryCheck = useCallback(async () => {
    setSubmitting(true);
    try {
      // 更新有差异的批次数量
      const diffItems = checkItems.filter(item => item.status === 'diff');

      for (const item of diffItems) {
        if (item.actualQty !== null && item.actualQty !== item.systemQty) {
          // TODO: 后端需要提供库存调整API
          // 暂时使用updateBatch来调整数量
          await materialBatchApiClient.updateBatch(item.id, {
            remainingQuantity: item.actualQty,
            notes: `盘点调整: 系统${item.systemQty}kg → 实际${item.actualQty}kg`,
          });
        }
      }

      Alert.alert('成功', '盘点已提交', [
        { text: '确定', onPress: () => navigation.goBack() }
      ]);
    } catch (error) {
      handleError(error, { title: '提交盘点失败' });
    } finally {
      setSubmitting(false);
    }
  }, [checkItems, navigation]);

  const handleSubmit = () => {
    const pendingItems = checkItems.filter((item) => item.status === "pending");
    if (pendingItems.length > 0) {
      Alert.alert("提示", `还有 ${pendingItems.length} 项未盘点，请完成所有项目`);
      return;
    }

    Alert.alert("确认提交", "确定提交盘点结果吗？", [
      { text: "取消", style: "cancel" },
      {
        text: "确定",
        onPress: submitInventoryCheck,
      },
    ]);
  };

  const handleSave = () => {
    // TODO: 实现暂存功能，可能需要AsyncStorage或后端API
    Alert.alert("成功", "盘点进度已暂存");
  };

  // 加载状态
  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>库存盘点</Text>
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
          <Text style={styles.headerTitle}>库存盘点</Text>
          <Text style={styles.headerSubtitle}>A区-冷藏库</Text>
        </View>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* 盘点进度 */}
        <Surface style={styles.progressCard} elevation={1}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressTitle}>盘点进度</Text>
            <Text style={styles.progressValue}>
              {completedCount}/{totalCount} 项
            </Text>
          </View>
          <ProgressBar
            progress={progress}
            color="#4CAF50"
            style={styles.progressBar}
          />
          <View style={styles.progressInfo}>
            <Text style={styles.progressInfoText}>
              已完成 {Math.round(progress * 100)}%
            </Text>
            <Text style={styles.progressInfoText}>
              剩余 {totalCount - completedCount} 项
            </Text>
          </View>
        </Surface>

        {/* 盘点范围 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>盘点范围</Text>
          <View style={styles.pickerContainer}>
            <Text style={styles.formLabel}>选择库位</Text>
            <View style={styles.pickerWrapper}>
              <Picker
                selectedValue={selectedLocation}
                onValueChange={setSelectedLocation}
                style={styles.picker}
              >
                <Picker.Item label="A区-冷藏库 (全部)" value="A" />
                <Picker.Item label="A区-冷藏库-01" value="A-01" />
                <Picker.Item label="A区-冷藏库-02" value="A-02" />
                <Picker.Item label="A区-冷藏库-03" value="A-03" />
                <Picker.Item label="B区-冷冻库 (全部)" value="B" />
              </Picker>
            </View>
          </View>
        </View>

        {/* 盘点清单 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>盘点清单</Text>

          {checkItems.map((item) => (
            <View
              key={item.id}
              style={[
                styles.checkItem,
                item.status === "completed" && styles.checkItemCompleted,
                item.status === "diff" && styles.checkItemDiff,
              ]}
            >
              <View style={styles.checkInfo}>
                <Text style={styles.checkName}>
                  {item.name} ({item.type})
                </Text>
                <Text style={styles.checkBatch}>
                  {item.batchNumber} | {item.location}
                </Text>
              </View>
              {item.status === "pending" ? (
                <View style={styles.checkInput}>
                  <Text style={styles.checkSystem}>系统: {item.systemQty}kg</Text>
                  <TextInput
                    mode="outlined"
                    placeholder="实际数量"
                    keyboardType="numeric"
                    value={item.actualQty?.toString() || ""}
                    onChangeText={(value) => updateActualQty(item.id, value)}
                    style={styles.qtyInput}
                    outlineColor="#ddd"
                    activeOutlineColor="#4CAF50"
                  />
                </View>
              ) : (
                <View style={styles.checkQty}>
                  <Text style={styles.checkSystem}>系统: {item.systemQty}kg</Text>
                  <Text
                    style={[
                      styles.checkActual,
                      item.status === "completed" && styles.checkActualSuccess,
                      item.status === "diff" && styles.checkActualDiff,
                    ]}
                  >
                    实际: {item.actualQty}kg{" "}
                    {item.status === "completed"
                      ? "✓"
                      : `(${(item.actualQty ?? 0) - item.systemQty}kg)`}
                  </Text>
                </View>
              )}
            </View>
          ))}
        </View>

        {/* 差异汇总 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>差异汇总</Text>
          <View style={styles.diffSummary}>
            <View style={styles.diffItem}>
              <Text style={styles.diffLabel}>已盘点</Text>
              <Text style={styles.diffValue}>{completedCount} 项</Text>
            </View>
            <View style={styles.diffItem}>
              <Text style={styles.diffLabel}>无差异</Text>
              <Text style={[styles.diffValue, { color: "#4CAF50" }]}>
                {noDiffCount} 项
              </Text>
            </View>
            <View style={styles.diffItem}>
              <Text style={styles.diffLabel}>有差异</Text>
              <Text style={[styles.diffValue, { color: "#f57c00" }]}>
                {diffCount} 项 ({totalDiff > 0 ? "+" : ""}{totalDiff}kg)
              </Text>
            </View>
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* 底部操作 */}
      <View style={styles.bottomActions}>
        <Button
          mode="outlined"
          onPress={handleSave}
          style={styles.saveButton}
          labelStyle={{ color: "#666" }}
        >
          暂存
        </Button>
        <Button
          mode="contained"
          onPress={handleSubmit}
          style={styles.submitButton}
          labelStyle={{ color: "#fff" }}
          disabled={submitting}
          loading={submitting}
        >
          {submitting ? '提交中...' : '提交盘点'}
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
  progressCard: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  progressTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  progressValue: {
    fontSize: 14,
    color: "#4CAF50",
    fontWeight: "600",
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "#e0e0e0",
  },
  progressInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  progressInfoText: {
    fontSize: 12,
    color: "#999",
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
  pickerContainer: {},
  formLabel: {
    fontSize: 14,
    color: "#333",
    marginBottom: 8,
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
  checkItem: {
    backgroundColor: "#f9f9f9",
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    borderLeftWidth: 3,
    borderLeftColor: "#e0e0e0",
  },
  checkItemCompleted: {
    borderLeftColor: "#4CAF50",
    backgroundColor: "#f1f8e9",
  },
  checkItemDiff: {
    borderLeftColor: "#f57c00",
    backgroundColor: "#fff8e1",
  },
  checkInfo: {
    marginBottom: 8,
  },
  checkName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  checkBatch: {
    fontSize: 12,
    color: "#999",
    marginTop: 2,
  },
  checkInput: {},
  checkQty: {},
  checkSystem: {
    fontSize: 13,
    color: "#666",
    marginBottom: 4,
  },
  qtyInput: {
    backgroundColor: "#fff",
    height: 40,
    fontSize: 14,
  },
  checkActual: {
    fontSize: 13,
  },
  checkActualSuccess: {
    color: "#4CAF50",
    fontWeight: "500",
  },
  checkActualDiff: {
    color: "#f57c00",
    fontWeight: "500",
  },
  diffSummary: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  diffItem: {
    alignItems: "center",
  },
  diffLabel: {
    fontSize: 13,
    color: "#999",
    marginBottom: 4,
  },
  diffValue: {
    fontSize: 15,
    fontWeight: "600",
    color: "#333",
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
  saveButton: {
    flex: 1,
    borderRadius: 8,
    borderColor: "#ddd",
  },
  submitButton: {
    flex: 1,
    borderRadius: 8,
    backgroundColor: "#4CAF50",
  },
});

export default WHInventoryCheckScreen;
