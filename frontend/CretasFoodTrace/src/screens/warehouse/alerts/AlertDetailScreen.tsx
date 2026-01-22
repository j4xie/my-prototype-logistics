/**
 * 预警详情处理页面
 * 功能：查看预警详情、选择处理方案、提交处理结果
 * 路径: screens/warehouse/alerts/AlertDetailScreen.tsx
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
import { Text, TextInput, Button, RadioButton, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Picker } from "@react-native-picker/picker";
import { WHInventoryStackParamList } from "../../../types/navigation";
import { materialBatchApiClient, MaterialBatch, ConvertToFrozenRequest } from "../../../services/api/materialBatchApiClient";
import { handleError } from "../../../utils/errorHandler";
import { useAuthStore } from "../../../store/authStore";

type NavigationProp = NativeStackNavigationProp<WHInventoryStackParamList>;

// 预警类型
type AlertType = "low_stock" | "expiring" | "expired" | "quality";

// 路由参数
interface RouteParams {
  alertId: string;
  alertType: AlertType;
  batchNumber: string;
}

// 处理方案
interface Solution {
  id: string;
  icon: string;
  title: string;
  recommended?: boolean;
  description: string[];
  applicableTypes: AlertType[];
}

// 处理记录
interface ProcessingRecord {
  id: string;
  action: string;
  operator: string;
  time: string;
  notes: string;
  status: "success" | "failed";
}

export function AlertDetailScreen() {
  const theme = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProp<{ params: RouteParams }, "params">>();
  const { user } = useAuthStore();

  const { alertId, alertType, batchNumber } = route.params || {};

  // 状态管理
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [batch, setBatch] = useState<MaterialBatch | null>(null);
  const [selectedSolution, setSelectedSolution] = useState<string>("");
  const [remarks, setRemarks] = useState("");

  // 低库存处理表单
  const [purchaseQty, setPurchaseQty] = useState("100");
  const [supplier, setSupplier] = useState("supplier1");
  const [unitPrice, setUnitPrice] = useState("30");

  // 转冻品处理表单
  const [freezeQty, setFreezeQty] = useState("");
  const [targetLocation, setTargetLocation] = useState("B1-01");

  // 处理记录
  const [processingRecords, setProcessingRecords] = useState<ProcessingRecord[]>([]);

  // 所有处理方案
  const allSolutions: Solution[] = [
    {
      id: "purchase",
      icon: "cart-plus",
      title: "紧急采购",
      recommended: true,
      description: [
        "快速补充库存",
        "推荐供应商发货",
        "预计1-3天到货",
      ],
      applicableTypes: ["low_stock"],
    },
    {
      id: "transfer",
      icon: "swap-horizontal",
      title: "库存调拨",
      description: [
        "从其他仓库调入",
        "内部资源协调",
        "当天可完成",
      ],
      applicableTypes: ["low_stock"],
    },
    {
      id: "freeze",
      icon: "snowflake",
      title: "转为冻品",
      recommended: true,
      description: [
        "延长保质期30天",
        "转移至冷冻库",
        "适用于即将过期物料",
      ],
      applicableTypes: ["expiring", "expired"],
    },
    {
      id: "fifo",
      icon: "sort-numeric-ascending",
      title: "优先出库 (FIFO)",
      description: [
        "标记为优先消耗批次",
        "关联生产计划",
        "系统自动推荐",
      ],
      applicableTypes: ["expiring"],
    },
    {
      id: "dispose",
      icon: "delete-outline",
      title: "报损处理",
      description: [
        "登记报损信息",
        "需主管审批",
        "适用于已变质/过期物料",
      ],
      applicableTypes: ["expired", "quality"],
    },
    {
      id: "return",
      icon: "truck-delivery",
      title: "退供应商",
      description: [
        "质量问题退货",
        "协商换货处理",
        "保留凭证",
      ],
      applicableTypes: ["quality"],
    },
    {
      id: "recheck",
      icon: "clipboard-check",
      title: "重新质检",
      description: [
        "安排二次检验",
        "确认质量状态",
        "更新检测报告",
      ],
      applicableTypes: ["quality"],
    },
  ];

  // 根据预警类型筛选可用方案
  const availableSolutions = allSolutions.filter(
    (s) => s.applicableTypes.includes(alertType)
  );

  // 供应商选项
  const suppliers = [
    { label: "舟山渔业合作社 (推荐)", value: "supplier1" },
    { label: "东海水产", value: "supplier2" },
    { label: "宁波海鲜批发", value: "supplier3" },
  ];

  // 目标库位选项
  const targetLocations = [
    { label: "B区-冷冻库-01 (剩余200kg)", value: "B1-01" },
    { label: "B区-冷冻库-02 (剩余150kg)", value: "B1-02" },
    { label: "C区-冷冻库-01 (剩余300kg)", value: "C1-01" },
  ];

  // 加载批次数据
  const loadBatchData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await materialBatchApiClient.getBatchById(alertId);
      if (response?.data) {
        setBatch(response.data);
        setFreezeQty(String(response.data.remainingQuantity || 0));
      }

      // 模拟获取处理记录
      setProcessingRecords([
        {
          id: "1",
          action: "创建预警",
          operator: "系统",
          time: "2026-01-22 08:00",
          notes: "系统自动检测到库存异常",
          status: "success",
        },
      ]);
    } catch (error) {
      handleError(error, { title: "加载批次数据失败" });
    } finally {
      setLoading(false);
    }
  }, [alertId]);

  useEffect(() => {
    loadBatchData();
    // 设置默认选中的处理方案（推荐的）
    const recommended = availableSolutions.find((s) => s.recommended);
    if (recommended) {
      setSelectedSolution(recommended.id);
    } else if (availableSolutions.length > 0) {
      setSelectedSolution(availableSolutions[0].id);
    }
  }, [loadBatchData, alertType]);

  // 计算采购总金额
  const calculateTotal = () => {
    const qty = parseFloat(purchaseQty) || 0;
    const price = parseFloat(unitPrice) || 0;
    return (qty * price).toLocaleString();
  };

  // 获取预警类型标签
  const getAlertTypeInfo = (type: AlertType) => {
    switch (type) {
      case "low_stock":
        return { label: "低库存预警", color: "#2196F3", icon: "package-variant-closed" };
      case "expiring":
        return { label: "即将过期预警", color: "#f57c00", icon: "clock-alert-outline" };
      case "expired":
        return { label: "已过期预警", color: "#f44336", icon: "alert-circle" };
      case "quality":
        return { label: "质量异常预警", color: "#9C27B0", icon: "clipboard-alert" };
    }
  };

  const alertTypeInfo = getAlertTypeInfo(alertType);

  // 处理提交
  const handleSubmit = async () => {
    if (!selectedSolution) {
      Alert.alert("提示", "请选择处理方案");
      return;
    }

    Alert.alert("确认提交", `确定采用"${allSolutions.find((s) => s.id === selectedSolution)?.title}"方案处理此预警吗？`, [
      { text: "取消", style: "cancel" },
      {
        text: "确定",
        onPress: async () => {
          setProcessing(true);
          try {
            switch (selectedSolution) {
              case "freeze": {
                // 转冻品处理
                const request: ConvertToFrozenRequest = {
                  convertedBy: user?.id || 1,
                  convertedDate: new Date().toISOString().split("T")[0] || "",
                  storageLocation: targetLocation,
                  notes: remarks || "预警处理：转冻品延长保质期",
                };
                await materialBatchApiClient.convertToFrozen(alertId, request);
                Alert.alert("成功", "已转为冻品，保质期延长30天", [
                  { text: "确定", onPress: () => navigation.goBack() },
                ]);
                break;
              }
              case "dispose": {
                // 报损处理
                await materialBatchApiClient.updateBatch(alertId, {
                  status: "depleted",
                  notes: `报损处理: ${remarks || "过期处理"} ${new Date().toISOString().split("T")[0]}`,
                });
                Alert.alert("成功", "报损处理已提交", [
                  { text: "确定", onPress: () => navigation.goBack() },
                ]);
                break;
              }
              case "fifo": {
                // 优先出库标记
                await materialBatchApiClient.updateBatch(alertId, {
                  notes: `FIFO优先出库标记 ${new Date().toISOString().split("T")[0]} ${remarks}`,
                });
                Alert.alert("成功", "已标记为优先出库批次", [
                  { text: "确定", onPress: () => navigation.goBack() },
                ]);
                break;
              }
              case "purchase":
              case "transfer":
              case "return":
              case "recheck":
              default: {
                // 其他处理方案 - 创建处理记录
                Alert.alert("成功", "处理方案已提交，等待后续跟进", [
                  { text: "确定", onPress: () => navigation.goBack() },
                ]);
                break;
              }
            }
          } catch (error) {
            handleError(error, { title: "处理失败" });
          } finally {
            setProcessing(false);
          }
        },
      },
    ]);
  };

  // 渲染处理方案选项
  const renderSolutionCard = (solution: Solution) => {
    const isSelected = selectedSolution === solution.id;

    return (
      <TouchableOpacity
        key={solution.id}
        style={[
          styles.solutionItem,
          isSelected && styles.solutionItemSelected,
          solution.recommended && styles.solutionItemRecommended,
        ]}
        onPress={() => setSelectedSolution(solution.id)}
      >
        <View style={styles.solutionContent}>
          <View style={styles.solutionHeader}>
            <View style={[styles.solutionIcon, isSelected && styles.solutionIconSelected]}>
              <MaterialCommunityIcons
                name={solution.icon as keyof typeof MaterialCommunityIcons.glyphMap}
                size={20}
                color={isSelected ? "#fff" : "#666"}
              />
            </View>
            <Text style={[styles.solutionTitle, isSelected && styles.solutionTitleSelected]}>
              {solution.title}
            </Text>
            {solution.recommended && (
              <View style={styles.recommendedTag}>
                <Text style={styles.recommendedTagText}>推荐</Text>
              </View>
            )}
          </View>
          <View style={styles.solutionDesc}>
            {solution.description.map((desc, index) => (
              <Text key={index} style={styles.solutionDescText}>
                {desc}
              </Text>
            ))}
          </View>
        </View>
        <RadioButton
          value={solution.id}
          status={isSelected ? "checked" : "unchecked"}
          onPress={() => setSelectedSolution(solution.id)}
          color="#4CAF50"
        />
      </TouchableOpacity>
    );
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
            <Text style={styles.headerTitle}>预警处理</Text>
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
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>预警处理</Text>
          <Text style={styles.headerSubtitle}>{batchNumber}</Text>
        </View>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* 预警信息卡片 */}
        <View style={styles.alertDetailCard}>
          <View style={styles.alertDetailHeader}>
            <View style={styles.alertTypeBox}>
              <MaterialCommunityIcons
                name={alertTypeInfo.icon as keyof typeof MaterialCommunityIcons.glyphMap}
                size={24}
                color={alertTypeInfo.color}
              />
              <Text style={[styles.alertTypeLabel, { color: alertTypeInfo.color }]}>
                {alertTypeInfo.label}
              </Text>
            </View>
            <View style={[styles.levelBadge, { backgroundColor: alertTypeInfo.color }]}>
              <Text style={styles.levelBadgeText}>
                {alertType === "expired" ? "紧急" : alertType === "expiring" ? "重要" : "一般"}
              </Text>
            </View>
          </View>

          <View style={styles.batchInfoSection}>
            <View style={styles.batchInfoHeader}>
              <MaterialCommunityIcons name="package-variant" size={20} color="#666" />
              <Text style={styles.batchInfoTitle}>{batch?.materialName || "未知物料"}</Text>
            </View>
            <Text style={styles.batchInfoSubtitle}>{batchNumber}</Text>
          </View>

          <View style={styles.alertDetailContent}>
            <View style={styles.alertDetailRow}>
              <Text style={styles.alertDetailLabel}>当前库存</Text>
              <Text
                style={[
                  styles.alertDetailValue,
                  alertType === "low_stock" && styles.textDanger,
                ]}
              >
                {batch?.remainingQuantity || 0} kg
              </Text>
            </View>
            {batch?.expiryDate && (
              <View style={styles.alertDetailRow}>
                <Text style={styles.alertDetailLabel}>过期时间</Text>
                <Text
                  style={[
                    styles.alertDetailValue,
                    (alertType === "expired" || alertType === "expiring") && styles.textWarning,
                  ]}
                >
                  {batch.expiryDate}
                </Text>
              </View>
            )}
            <View style={styles.alertDetailRow}>
              <Text style={styles.alertDetailLabel}>存储类型</Text>
              <Text style={styles.alertDetailValue}>
                {batch?.storageType === "fresh"
                  ? "鲜品"
                  : batch?.storageType === "frozen"
                  ? "冻品"
                  : "干货"}
              </Text>
            </View>
            <View style={styles.alertDetailRow}>
              <Text style={styles.alertDetailLabel}>库位</Text>
              <Text style={styles.alertDetailValue}>{batch?.storageLocation || "-"}</Text>
            </View>
            <View style={styles.alertDetailRow}>
              <Text style={styles.alertDetailLabel}>供应商</Text>
              <Text style={styles.alertDetailValue}>{batch?.supplierName || "-"}</Text>
            </View>
          </View>
        </View>

        {/* 处理方案选择 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>选择处理方案</Text>
          <View style={styles.solutionList}>
            {availableSolutions.map(renderSolutionCard)}
          </View>
        </View>

        {/* 采购信息表单 (低库存处理) */}
        {selectedSolution === "purchase" && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>采购信息</Text>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>采购数量</Text>
              <View style={styles.inputWithUnit}>
                <TextInput
                  mode="outlined"
                  value={purchaseQty}
                  onChangeText={setPurchaseQty}
                  keyboardType="numeric"
                  style={styles.formInput}
                  outlineStyle={styles.inputOutline}
                />
                <Text style={styles.inputUnit}>kg</Text>
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>供应商</Text>
              <View style={styles.pickerContainer}>
                <Picker selectedValue={supplier} onValueChange={setSupplier} style={styles.picker}>
                  {suppliers.map((s) => (
                    <Picker.Item key={s.value} label={s.label} value={s.value} />
                  ))}
                </Picker>
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>预计单价</Text>
              <View style={styles.inputWithUnit}>
                <TextInput
                  mode="outlined"
                  value={unitPrice}
                  onChangeText={setUnitPrice}
                  keyboardType="numeric"
                  style={styles.formInput}
                  outlineStyle={styles.inputOutline}
                />
                <Text style={styles.inputUnit}>元/kg</Text>
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>预计总金额</Text>
              <View style={styles.calculatedValue}>
                <Text style={styles.calculatedValueText}>${calculateTotal()}</Text>
              </View>
            </View>
          </View>
        )}

        {/* 转冻品信息表单 */}
        {selectedSolution === "freeze" && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>转冻品信息</Text>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>转换数量</Text>
              <View style={styles.inputWithUnit}>
                <TextInput
                  mode="outlined"
                  value={freezeQty}
                  onChangeText={setFreezeQty}
                  keyboardType="numeric"
                  style={styles.formInput}
                  outlineStyle={styles.inputOutline}
                />
                <Text style={styles.inputUnit}>kg</Text>
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>目标库位</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={targetLocation}
                  onValueChange={setTargetLocation}
                  style={styles.picker}
                >
                  {targetLocations.map((loc) => (
                    <Picker.Item key={loc.value} label={loc.label} value={loc.value} />
                  ))}
                </Picker>
              </View>
            </View>

            <View style={styles.infoBox}>
              <Text style={styles.infoBoxTitle}>转冻品说明</Text>
              <View style={styles.infoBoxList}>
                <Text style={styles.infoBoxItem}>* 转冻后保质期延长30天</Text>
                <Text style={styles.infoBoxItem}>
                  * 新到期日期: {new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]}
                </Text>
                <Text style={styles.infoBoxItem}>* 需要2小时冷冻处理</Text>
              </View>
            </View>
          </View>
        )}

        {/* 备注 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>备注信息</Text>
          <TextInput
            mode="outlined"
            value={remarks}
            onChangeText={setRemarks}
            placeholder="请输入处理备注（可选）"
            multiline
            numberOfLines={3}
            style={styles.formTextarea}
            outlineStyle={styles.inputOutline}
          />
        </View>

        {/* 处理记录 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>处理记录</Text>
          {processingRecords.map((record) => (
            <View key={record.id} style={styles.recordItem}>
              <View style={styles.recordDot} />
              <View style={styles.recordContent}>
                <View style={styles.recordHeader}>
                  <Text style={styles.recordAction}>{record.action}</Text>
                  <Text style={styles.recordTime}>{record.time}</Text>
                </View>
                <Text style={styles.recordOperator}>操作人: {record.operator}</Text>
                <Text style={styles.recordNotes}>{record.notes}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* 操作按钮 */}
        <View style={styles.actionButtons}>
          <Button
            mode="outlined"
            onPress={() => navigation.goBack()}
            style={styles.actionBtnSecondary}
            labelStyle={{ color: "#666" }}
          >
            取消
          </Button>
          <Button
            mode="contained"
            onPress={handleSubmit}
            loading={processing}
            disabled={processing || !selectedSolution}
            style={styles.actionBtnPrimary}
            labelStyle={{ color: "#fff" }}
          >
            确认处理
          </Button>
        </View>

        <View style={{ height: 30 }} />
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
  alertDetailCard: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
  },
  alertDetailHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  alertTypeBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  alertTypeLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  levelBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  levelBadgeText: {
    fontSize: 12,
    color: "#fff",
    fontWeight: "500",
  },
  batchInfoSection: {
    backgroundColor: "#f9f9f9",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  batchInfoHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  batchInfoTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  batchInfoSubtitle: {
    fontSize: 12,
    color: "#999",
    marginTop: 4,
    marginLeft: 28,
  },
  alertDetailContent: {
    gap: 10,
  },
  alertDetailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  alertDetailLabel: {
    fontSize: 13,
    color: "#666",
  },
  alertDetailValue: {
    fontSize: 13,
    fontWeight: "500",
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
  solutionList: {
    gap: 10,
  },
  solutionItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f9f9f9",
    borderRadius: 8,
    padding: 12,
    borderWidth: 2,
    borderColor: "transparent",
  },
  solutionItemSelected: {
    borderColor: "#4CAF50",
    backgroundColor: "#e8f5e9",
  },
  solutionItemRecommended: {
    borderColor: "#4CAF50",
  },
  solutionContent: {
    flex: 1,
  },
  solutionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 10,
  },
  solutionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#e0e0e0",
    alignItems: "center",
    justifyContent: "center",
  },
  solutionIconSelected: {
    backgroundColor: "#4CAF50",
  },
  solutionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  solutionTitleSelected: {
    color: "#4CAF50",
  },
  recommendedTag: {
    backgroundColor: "#4CAF50",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  recommendedTagText: {
    fontSize: 10,
    color: "#fff",
    fontWeight: "500",
  },
  solutionDesc: {
    marginLeft: 42,
    gap: 4,
  },
  solutionDescText: {
    fontSize: 12,
    color: "#666",
  },
  formGroup: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 13,
    color: "#666",
    marginBottom: 8,
  },
  formInput: {
    backgroundColor: "#fff",
    flex: 1,
    height: 44,
  },
  inputOutline: {
    borderRadius: 8,
  },
  formTextarea: {
    backgroundColor: "#fff",
    minHeight: 80,
  },
  inputWithUnit: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  inputUnit: {
    fontSize: 14,
    color: "#666",
    width: 50,
  },
  pickerContainer: {
    backgroundColor: "#f9f9f9",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ddd",
    overflow: "hidden",
  },
  picker: {
    height: 50,
  },
  calculatedValue: {
    backgroundColor: "#e8f5e9",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  calculatedValueText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#4CAF50",
  },
  infoBox: {
    backgroundColor: "#e3f2fd",
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  infoBoxTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1976d2",
    marginBottom: 8,
  },
  infoBoxList: {
    gap: 4,
  },
  infoBoxItem: {
    fontSize: 12,
    color: "#666",
    lineHeight: 18,
  },
  recordItem: {
    flexDirection: "row",
    marginBottom: 12,
  },
  recordDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#4CAF50",
    marginTop: 4,
    marginRight: 12,
  },
  recordContent: {
    flex: 1,
  },
  recordHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  recordAction: {
    fontSize: 14,
    fontWeight: "500",
    color: "#333",
  },
  recordTime: {
    fontSize: 12,
    color: "#999",
  },
  recordOperator: {
    fontSize: 12,
    color: "#666",
    marginBottom: 2,
  },
  recordNotes: {
    fontSize: 12,
    color: "#999",
  },
  actionButtons: {
    flexDirection: "row",
    paddingHorizontal: 16,
    marginTop: 16,
    gap: 12,
  },
  actionBtnSecondary: {
    flex: 1,
    borderRadius: 8,
    borderColor: "#ddd",
  },
  actionBtnPrimary: {
    flex: 1,
    borderRadius: 8,
    backgroundColor: "#4CAF50",
  },
  textDanger: {
    color: "#f44336",
  },
  textWarning: {
    color: "#f57c00",
  },
});

export default AlertDetailScreen;
