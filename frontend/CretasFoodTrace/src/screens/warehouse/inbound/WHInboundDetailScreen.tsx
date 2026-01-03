/**
 * 入库详情页面
 * 对应原型: warehouse/inbound-detail.html
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
import { Text, Surface, Button, Divider, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useTranslation } from 'react-i18next';
import { WHInboundStackParamList } from "../../../types/navigation";
import { materialBatchApiClient, MaterialBatch } from "../../../services/api/materialBatchApiClient";
import { handleError } from "../../../utils/errorHandler";

type NavigationProp = NativeStackNavigationProp<WHInboundStackParamList>;
type RouteType = RouteProp<WHInboundStackParamList, "WHInboundDetail">;

/**
 * 获取入库状态标签和样式
 */
const getInboundStatusInfo = (status?: string): { label: string; bgColor: string; textColor: string } => {
  switch (status?.toLowerCase()) {
    case 'available':
      return { label: '已入库', bgColor: '#e8f5e9', textColor: '#4CAF50' };
    case 'reserved':
      return { label: '已预留', bgColor: '#e3f2fd', textColor: '#2196F3' };
    case 'depleted':
      return { label: '已耗尽', bgColor: '#f5f5f5', textColor: '#999' };
    case 'expired':
      return { label: '已过期', bgColor: '#ffebee', textColor: '#f44336' };
    case 'pending':
    default:
      return { label: '待确认', bgColor: '#fff3e0', textColor: '#f57c00' };
  }
};

/**
 * 获取存储温度描述
 */
const getStorageTemp = (storageType?: string): string => {
  switch (storageType?.toLowerCase()) {
    case 'frozen': return '-18°C ~ -25°C';
    case 'fresh': return '-2°C ~ 4°C';
    case 'dry': return '常温';
    default: return '-2°C ~ 4°C';
  }
};

/**
 * 格式化日期
 */
const formatDate = (dateStr?: string): string => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
};

/**
 * 格式化日期时间
 */
const formatDateTime = (dateStr?: string): string => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit'
  });
};

interface InboundDetail {
  batchNumber: string;
  status: string;
  statusLabel: string;
  statusBgColor: string;
  statusTextColor: string;
  material: string;
  materialType: string;
  supplier: string;
  supplierContact: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalAmount: number;
  productionDate: string;
  expiryDate: string;
  storageTemp: string;
  arrivalTime: string;
  vehicleNo: string;
  driverName: string;
  driverPhone: string;
  remarks: string;
}

export function WHInboundDetailScreen() {
  const { t } = useTranslation('warehouse');
  const theme = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteType>();
  const { batchId } = route.params;

  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<InboundDetail | null>(null);

  // 加载数据
  const loadData = useCallback(async () => {
    if (!batchId) {
      setLoading(false);
      return;
    }

    try {
      const response = await materialBatchApiClient.getBatchById(batchId) as
        { data?: MaterialBatch } | MaterialBatch | undefined;

      const batch = (response as { data?: MaterialBatch })?.data ?? (response as MaterialBatch);

      if (batch) {
        const statusInfo = getInboundStatusInfo(batch.status);
        const qty = batch.inboundQuantity ?? batch.remainingQuantity ?? 0;
        const unitPrice = batch.unitPrice ?? 0;

        setDetail({
          batchNumber: batch.batchNumber ?? `MB-${batch.id}`,
          status: batch.status ?? 'pending',
          statusLabel: statusInfo.label,
          statusBgColor: statusInfo.bgColor,
          statusTextColor: statusInfo.textColor,
          material: batch.materialName ?? '未知原料',
          materialType: batch.storageType === 'frozen' ? '冻品' : batch.storageType === 'dry' ? '干货' : '鲜品',
          supplier: batch.supplierName ?? '未知供应商',
          supplierContact: '-',  // Backend doesn't provide supplier contact
          quantity: qty,
          unit: 'kg',
          unitPrice: unitPrice,
          totalAmount: qty * unitPrice,
          productionDate: formatDate(batch.productionDate),
          expiryDate: formatDate(batch.expiryDate),
          storageTemp: getStorageTemp(batch.storageType),
          arrivalTime: formatDateTime(batch.inboundDate),
          vehicleNo: '-',  // Not available from API
          driverName: '-',  // Not available from API
          driverPhone: '-',  // Not available from API
          remarks: batch.notes ?? '无备注',
        });
      }
    } catch (error) {
      handleError(error, { title: t('messages.loadDetailFailed') });
    } finally {
      setLoading(false);
    }
  }, [batchId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleConfirm = () => {
    Alert.alert(t('inbound.detail.confirmTitle'), t('inbound.detail.confirmMessage'), [
      { text: t('inbound.detail.cancel'), style: "cancel" },
      {
        text: t('inbound.detail.confirm'),
        onPress: () => {
          Alert.alert(t('inbound.detail.success'), t('inbound.detail.successMessage'));
          navigation.goBack();
        },
      },
    ]);
  };

  // 加载状态
  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('inbound.detail.title')}</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>{t('inbound.detail.loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  // 空状态
  if (!detail) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('inbound.detail.title')}</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.loadingContainer}>
          <MaterialCommunityIcons name="package-variant" size={64} color="#ddd" />
          <Text style={styles.loadingText}>{t('inbound.detail.notFound')}</Text>
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
        <Text style={styles.headerTitle}>{t('inbound.detail.title')}</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* 状态卡片 */}
        <Surface style={styles.statusCard} elevation={1}>
          <View style={styles.statusHeader}>
            <Text style={styles.batchNumber}>{detail.batchNumber}</Text>
            <View style={[styles.statusBadge, { backgroundColor: detail.statusBgColor }]}>
              <Text style={[styles.statusText, { color: detail.statusTextColor }]}>{detail.statusLabel}</Text>
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
          <Text style={styles.sectionTitle}>{t('inbound.detail.basicInfo')}</Text>
          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>{t('inbound.detail.supplier')}</Text>
              <Text style={styles.infoValue}>{detail.supplier}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>{t('inbound.detail.contact')}</Text>
              <Text style={styles.infoValue}>{detail.supplierContact}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>{t('inbound.detail.unitPrice')}</Text>
              <Text style={styles.infoValue}>¥{detail.unitPrice}/kg</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>{t('inbound.detail.amount')}</Text>
              <Text style={[styles.infoValue, styles.amountValue]}>
                ¥{detail.totalAmount.toLocaleString()}
              </Text>
            </View>
          </View>
        </View>

        {/* 保质信息 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('inbound.detail.qualityInfo')}</Text>
          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>{t('inbound.detail.productionDate')}</Text>
              <Text style={styles.infoValue}>{detail.productionDate}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>{t('inbound.detail.expiryDate')}</Text>
              <Text style={styles.infoValue}>{detail.expiryDate}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>{t('inbound.detail.storageTemp')}</Text>
              <Text style={styles.infoValue}>{detail.storageTemp}</Text>
            </View>
          </View>
        </View>

        {/* 物流信息 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('inbound.detail.logisticsInfo')}</Text>
          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>{t('inbound.detail.arrivalTime')}</Text>
              <Text style={styles.infoValue}>{detail.arrivalTime}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>{t('inbound.detail.vehicleNo')}</Text>
              <Text style={styles.infoValue}>{detail.vehicleNo}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>{t('inbound.detail.driver')}</Text>
              <Text style={styles.infoValue}>{detail.driverName}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>{t('inbound.detail.phone')}</Text>
              <Text style={styles.infoValue}>{detail.driverPhone}</Text>
            </View>
          </View>
        </View>

        {/* 备注 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('inbound.detail.remarks')}</Text>
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
            {t('inbound.detail.back')}
          </Button>
          <Button
            mode="contained"
            onPress={handleConfirm}
            style={styles.confirmButton}
            labelStyle={styles.confirmButtonLabel}
          >
            {t('inbound.detail.confirmInbound')}
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
