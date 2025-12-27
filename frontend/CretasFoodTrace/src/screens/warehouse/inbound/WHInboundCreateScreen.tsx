/**
 * 新建入库页面
 * 对应原型: warehouse/inbound-create.html
 */

import React, { useState, useCallback } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import {
  Text,
  TextInput,
  Button,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { WHInboundStackParamList } from "../../../types/navigation";
import { materialBatchApiClient } from "../../../services/api/materialBatchApiClient";
import { handleError } from "../../../utils/errorHandler";

type NavigationProp = NativeStackNavigationProp<WHInboundStackParamList>;

export function WHInboundCreateScreen() {
  const theme = useTheme();
  const navigation = useNavigation<NavigationProp>();

  // 表单状态
  const [formData, setFormData] = useState({
    material: "",
    materialType: "fresh",
    supplier: "",
    quantity: "",
    unitPrice: "",
    productionDate: "",
    expiryDate: "",
    storageTemp: "",
    remarks: "",
  });
  const [submitting, setSubmitting] = useState(false);

  // 提交入库API调用
  const submitInbound = useCallback(async () => {
    setSubmitting(true);
    try {
      // 生成批次号
      const today = new Date();
      const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
      const randomSuffix = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
      const batchNumber = `MB-${dateStr}-${randomSuffix}`;

      const batchData = {
        batchNumber,
        materialName: formData.material,
        materialTypeId: formData.materialType, // TODO: 后续需要从原料类型API获取真实ID
        supplierId: formData.supplier, // TODO: 后续需要从供应商API获取真实ID
        inboundQuantity: parseFloat(formData.quantity) || 0,
        remainingQuantity: parseFloat(formData.quantity) || 0,
        unitPrice: parseFloat(formData.unitPrice) || 0,
        totalCost: (parseFloat(formData.quantity) || 0) * (parseFloat(formData.unitPrice) || 0),
        inboundDate: today.toISOString().split('T')[0],
        productionDate: formData.productionDate || undefined,
        expiryDate: formData.expiryDate || undefined,
        storageLocation: formData.storageTemp || undefined,
        notes: formData.remarks || undefined,
        status: 'available',
      };

      await materialBatchApiClient.createBatch(batchData);
      Alert.alert('成功', '入库单创建成功', [
        { text: '确定', onPress: () => navigation.goBack() }
      ]);
    } catch (error) {
      handleError(error, { title: '创建入库单失败' });
    } finally {
      setSubmitting(false);
    }
  }, [formData, navigation]);

  const handleSubmit = () => {
    if (!formData.material || !formData.supplier || !formData.quantity) {
      Alert.alert("提示", "请填写必填项");
      return;
    }

    Alert.alert("确认提交", "确定要创建此入库单吗？", [
      { text: "取消", style: "cancel" },
      {
        text: "确定",
        onPress: submitInbound,
      },
    ]);
  };

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
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
        <Text style={styles.headerTitle}>新建入库</Text>
        <View style={styles.headerRight} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* 物料信息 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>物料信息</Text>

            <View style={styles.formItem}>
              <Text style={styles.label}>
                物料名称 <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                mode="outlined"
                value={formData.material}
                onChangeText={(v) => updateField("material", v)}
                placeholder="请输入物料名称"
                style={styles.input}
                outlineColor="#ddd"
                activeOutlineColor="#4CAF50"
              />
            </View>

            <View style={styles.formItem}>
              <Text style={styles.label}>物料类型</Text>
              <View style={styles.typeSelector}>
                {[
                  { key: "fresh", label: "鲜品" },
                  { key: "frozen", label: "冻品" },
                  { key: "dry", label: "干货" },
                ].map((type) => (
                  <TouchableOpacity
                    key={type.key}
                    style={[
                      styles.typeOption,
                      formData.materialType === type.key &&
                        styles.typeOptionActive,
                    ]}
                    onPress={() => updateField("materialType", type.key)}
                  >
                    <Text
                      style={[
                        styles.typeOptionText,
                        formData.materialType === type.key &&
                          styles.typeOptionTextActive,
                      ]}
                    >
                      {type.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.formItem}>
              <Text style={styles.label}>
                供应商 <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                mode="outlined"
                value={formData.supplier}
                onChangeText={(v) => updateField("supplier", v)}
                placeholder="请选择或输入供应商"
                style={styles.input}
                outlineColor="#ddd"
                activeOutlineColor="#4CAF50"
              />
            </View>
          </View>

          {/* 数量与价格 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>数量与价格</Text>

            <View style={styles.formRow}>
              <View style={[styles.formItem, { flex: 1 }]}>
                <Text style={styles.label}>
                  数量(kg) <Text style={styles.required}>*</Text>
                </Text>
                <TextInput
                  mode="outlined"
                  value={formData.quantity}
                  onChangeText={(v) => updateField("quantity", v)}
                  placeholder="0"
                  keyboardType="numeric"
                  style={styles.input}
                  outlineColor="#ddd"
                  activeOutlineColor="#4CAF50"
                />
              </View>
              <View style={{ width: 12 }} />
              <View style={[styles.formItem, { flex: 1 }]}>
                <Text style={styles.label}>单价(元/kg)</Text>
                <TextInput
                  mode="outlined"
                  value={formData.unitPrice}
                  onChangeText={(v) => updateField("unitPrice", v)}
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                  style={styles.input}
                  outlineColor="#ddd"
                  activeOutlineColor="#4CAF50"
                />
              </View>
            </View>
          </View>

          {/* 保质信息 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>保质信息</Text>

            <View style={styles.formRow}>
              <View style={[styles.formItem, { flex: 1 }]}>
                <Text style={styles.label}>生产日期</Text>
                <TextInput
                  mode="outlined"
                  value={formData.productionDate}
                  onChangeText={(v) => updateField("productionDate", v)}
                  placeholder="YYYY-MM-DD"
                  style={styles.input}
                  outlineColor="#ddd"
                  activeOutlineColor="#4CAF50"
                />
              </View>
              <View style={{ width: 12 }} />
              <View style={[styles.formItem, { flex: 1 }]}>
                <Text style={styles.label}>保质期至</Text>
                <TextInput
                  mode="outlined"
                  value={formData.expiryDate}
                  onChangeText={(v) => updateField("expiryDate", v)}
                  placeholder="YYYY-MM-DD"
                  style={styles.input}
                  outlineColor="#ddd"
                  activeOutlineColor="#4CAF50"
                />
              </View>
            </View>

            <View style={styles.formItem}>
              <Text style={styles.label}>存储温度</Text>
              <TextInput
                mode="outlined"
                value={formData.storageTemp}
                onChangeText={(v) => updateField("storageTemp", v)}
                placeholder="如: -2°C ~ 4°C"
                style={styles.input}
                outlineColor="#ddd"
                activeOutlineColor="#4CAF50"
              />
            </View>
          </View>

          {/* 备注 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>备注</Text>
            <TextInput
              mode="outlined"
              value={formData.remarks}
              onChangeText={(v) => updateField("remarks", v)}
              placeholder="请输入备注信息"
              multiline
              numberOfLines={3}
              style={[styles.input, styles.textArea]}
              outlineColor="#ddd"
              activeOutlineColor="#4CAF50"
            />
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* 底部操作 */}
      <View style={styles.bottomActions}>
        <Button
          mode="outlined"
          onPress={() => navigation.goBack()}
          style={styles.cancelButton}
          labelStyle={styles.cancelButtonLabel}
        >
          取消
        </Button>
        <Button
          mode="contained"
          onPress={handleSubmit}
          style={styles.submitButton}
          labelStyle={styles.submitButtonLabel}
          disabled={submitting}
          loading={submitting}
        >
          {submitting ? '提交中...' : '提交入库'}
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
  formItem: {
    marginBottom: 16,
  },
  formRow: {
    flexDirection: "row",
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
    minHeight: 80,
  },
  typeSelector: {
    flexDirection: "row",
    gap: 12,
  },
  typeOption: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ddd",
    alignItems: "center",
  },
  typeOptionActive: {
    borderColor: "#4CAF50",
    backgroundColor: "#e8f5e9",
  },
  typeOptionText: {
    fontSize: 14,
    color: "#666",
  },
  typeOptionTextActive: {
    color: "#4CAF50",
    fontWeight: "600",
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
  submitButton: {
    flex: 1,
    borderRadius: 8,
    backgroundColor: "#4CAF50",
  },
  submitButtonLabel: {
    color: "#fff",
    fontWeight: "600",
  },
});

export default WHInboundCreateScreen;
