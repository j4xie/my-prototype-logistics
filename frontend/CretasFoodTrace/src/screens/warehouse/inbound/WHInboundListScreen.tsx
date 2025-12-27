/**
 * 入库管理列表页面
 * 对应原型: warehouse/inbound.html
 *
 * API集成:
 * - materialBatchApiClient - 获取原材料批次列表
 */

import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import {
  Text,
  Surface,
  Chip,
  Button,
  Searchbar,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { WHInboundStackParamList } from "../../../types/navigation";
import { materialBatchApiClient, MaterialBatch } from "../../../services/api/materialBatchApiClient";
import { handleError } from "../../../utils/errorHandler";
import { logger } from "../../../utils/logger";

type NavigationProp = NativeStackNavigationProp<WHInboundStackParamList>;

// 入库状态类型
type InboundStatus = "pending" | "inspecting" | "putaway" | "completed";

interface InboundItem {
  id: string;
  batchNumber: string;
  material: string;
  materialType: string;
  supplier: string;
  quantity: number;
  status: InboundStatus;
  createdAt: string;
  location?: string;
  inspectResult?: string;
}

const statusConfig: Record<
  InboundStatus,
  { label: string; color: string; bgColor: string }
> = {
  pending: { label: "待确认", color: "#f57c00", bgColor: "#fff3e0" },
  inspecting: { label: "质检中", color: "#1976d2", bgColor: "#e3f2fd" },
  putaway: { label: "待上架", color: "#7b1fa2", bgColor: "#f3e5f5" },
  completed: { label: "已完成", color: "#388e3c", bgColor: "#e8f5e9" },
};

// 将后端状态映射到前端状态
const mapBatchStatusToInbound = (backendStatus: string | undefined): InboundStatus => {
  switch (backendStatus?.toLowerCase()) {
    case 'available': return 'completed';
    case 'reserved': return 'inspecting';
    case 'depleted': return 'completed';
    case 'expired': return 'completed';
    case 'fresh': return 'pending';
    case 'frozen': return 'pending';
    default: return 'pending';
  }
};

export function WHInboundListScreen() {
  const theme = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [inboundList, setInboundList] = useState<InboundItem[]>([]);

  // 加载数据
  const loadData = useCallback(async () => {
    try {
      logger.info('[WHInboundListScreen] 开始加载入库列表');

      const response = await materialBatchApiClient.getMaterialBatches({ page: 0, size: 50 }) as
        { data?: { content?: MaterialBatch[] }; content?: MaterialBatch[] } | undefined;

      // 处理响应数据
      const batchData = response?.data?.content ?? response?.content ?? [];
      const batches = Array.isArray(batchData) ? batchData : [];

      const mappedList: InboundItem[] = batches.map((b: MaterialBatch) => ({
        id: b.id,
        batchNumber: b.batchNumber || b.id,
        material: b.materialName || '原材料',
        materialType: b.storageType === 'frozen' ? '冻品' : b.storageType === 'fresh' ? '鲜品' : '干货',
        supplier: b.supplierName || b.supplierId || '未知供应商',
        quantity: b.inboundQuantity || 0,
        status: mapBatchStatusToInbound(b.status),
        createdAt: b.inboundDate
          ? new Date(b.inboundDate).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
          : '未知时间',
        location: b.storageLocation,
        inspectResult: b.qualityGrade ? `质量等级: ${b.qualityGrade}` : undefined,
      }));

      setInboundList(mappedList);
      logger.info(`[WHInboundListScreen] 加载入库列表成功: ${mappedList.length}条`);

    } catch (error) {
      logger.error('[WHInboundListScreen] 加载入库列表失败:', error);
      handleError(error, { title: '加载入库列表失败' });
      setInboundList([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  // 筛选数据
  const filteredList = inboundList.filter((item) => {
    if (selectedStatus !== "all" && item.status !== selectedStatus) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        item.batchNumber.toLowerCase().includes(query) ||
        item.material.toLowerCase().includes(query) ||
        item.supplier.toLowerCase().includes(query)
      );
    }
    return true;
  });

  // 统计数据
  const stats = {
    total: inboundList.length,
    pending: inboundList.filter((i) => i.status === "pending").length,
    inspecting: inboundList.filter((i) => i.status === "inspecting").length,
    completed: inboundList.filter((i) => i.status === "completed").length,
    todayWeight: inboundList.reduce((sum, i) => sum + i.quantity, 0),
  };

  const getActionText = (status: InboundStatus): string => {
    switch (status) {
      case "pending":
        return "确认入库";
      case "inspecting":
        return "继续质检";
      case "putaway":
        return "确认上架";
      case "completed":
        return "查看详情";
      default:
        return "查看";
    }
  };

  const handleItemPress = (item: InboundItem) => {
    switch (item.status) {
      case "pending":
        navigation.navigate("WHInboundDetail", { batchId: item.id });
        break;
      case "inspecting":
        navigation.navigate("WHInspect", { batchId: item.id });
        break;
      case "putaway":
        navigation.navigate("WHPutaway", { batchId: item.id });
        break;
      case "completed":
        navigation.navigate("WHInboundDetail", { batchId: item.id });
        break;
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>入库管理</Text>
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
        <Text style={styles.headerTitle}>入库管理</Text>
        <Text style={styles.headerSubtitle}>
          待确认 {stats.pending} 单 | 今日入库 {stats.todayWeight} kg
        </Text>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* 快捷操作 */}
        <View style={styles.actionBar}>
          <Button
            mode="contained"
            icon="plus"
            onPress={() => navigation.navigate("WHInboundCreate")}
            style={[styles.actionButton, { backgroundColor: "#4CAF50" }]}
            labelStyle={styles.actionButtonLabel}
          >
            新建入库
          </Button>
          <Button
            mode="outlined"
            icon="qrcode-scan"
            onPress={() => navigation.navigate("WHScanOperation", { type: "inbound" })}
            style={styles.actionButton}
            labelStyle={styles.actionButtonLabelOutlined}
          >
            扫码入库
          </Button>
        </View>

        {/* 搜索栏 */}
        <Searchbar
          placeholder="搜索批次号/物料/供应商"
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={styles.searchBar}
          inputStyle={styles.searchInput}
        />

        {/* 筛选标签 */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterContainer}
        >
          <Chip
            selected={selectedStatus === "all"}
            onPress={() => setSelectedStatus("all")}
            style={[
              styles.filterChip,
              selectedStatus === "all" && styles.filterChipActive,
            ]}
            textStyle={selectedStatus === "all" ? styles.filterChipTextActive : undefined}
          >
            全部({stats.total})
          </Chip>
          <Chip
            selected={selectedStatus === "pending"}
            onPress={() => setSelectedStatus("pending")}
            style={[
              styles.filterChip,
              selectedStatus === "pending" && styles.filterChipActive,
            ]}
            textStyle={selectedStatus === "pending" ? styles.filterChipTextActive : undefined}
          >
            待确认({stats.pending})
          </Chip>
          <Chip
            selected={selectedStatus === "inspecting"}
            onPress={() => setSelectedStatus("inspecting")}
            style={[
              styles.filterChip,
              selectedStatus === "inspecting" && styles.filterChipActive,
            ]}
            textStyle={selectedStatus === "inspecting" ? styles.filterChipTextActive : undefined}
          >
            质检中({stats.inspecting})
          </Chip>
          <Chip
            selected={selectedStatus === "completed"}
            onPress={() => setSelectedStatus("completed")}
            style={[
              styles.filterChip,
              selectedStatus === "completed" && styles.filterChipActive,
            ]}
            textStyle={selectedStatus === "completed" ? styles.filterChipTextActive : undefined}
          >
            已完成({stats.completed})
          </Chip>
        </ScrollView>

        {/* 入库列表 */}
        <View style={styles.listContainer}>
          {filteredList.map((item) => {
            const config = statusConfig[item.status];
            return (
              <TouchableOpacity
                key={item.id}
                onPress={() => handleItemPress(item)}
                activeOpacity={0.7}
              >
                <Surface style={styles.inboundCard} elevation={1}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.batchNumber}>{item.batchNumber}</Text>
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: config.bgColor },
                      ]}
                    >
                      <Text style={[styles.statusText, { color: config.color }]}>
                        {config.label}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.cardContent}>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>物料</Text>
                      <Text style={styles.infoValue}>
                        {item.material} ({item.materialType})
                      </Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>供应商</Text>
                      <Text style={styles.infoValue}>{item.supplier}</Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>数量</Text>
                      <Text style={[styles.infoValue, styles.quantityValue]}>
                        {item.quantity} kg
                      </Text>
                    </View>
                  </View>

                  <View style={styles.cardFooter}>
                    <Text style={styles.timeText}>
                      {item.createdAt}
                      {item.location && ` | ${item.location}`}
                      {item.inspectResult && ` | ${item.inspectResult}`}
                    </Text>
                    <View style={styles.actionLink}>
                      <Text style={styles.actionText}>
                        {getActionText(item.status)}
                      </Text>
                      <MaterialCommunityIcons
                        name="chevron-right"
                        size={16}
                        color="#4CAF50"
                      />
                    </View>
                  </View>
                </Surface>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* 今日统计 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>今日入库统计</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statsItem}>
              <Text style={styles.statsValue}>{stats.total}</Text>
              <Text style={styles.statsLabel}>入库单数</Text>
            </View>
            <View style={styles.statsItem}>
              <Text style={styles.statsValue}>{stats.todayWeight}</Text>
              <Text style={styles.statsLabel}>入库重量(kg)</Text>
            </View>
            <View style={styles.statsItem}>
              <Text style={styles.statsValue}>5</Text>
              <Text style={styles.statsLabel}>供应商数</Text>
            </View>
            <View style={styles.statsItem}>
              <Text style={styles.statsValue}>100%</Text>
              <Text style={styles.statsLabel}>质检合格率</Text>
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
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
  },
  headerSubtitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.9)",
    marginTop: 4,
  },
  content: {
    flex: 1,
  },
  actionBar: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    borderRadius: 8,
  },
  actionButtonLabel: {
    color: "#fff",
    fontWeight: "600",
  },
  actionButtonLabelOutlined: {
    color: "#4CAF50",
    fontWeight: "600",
  },
  searchBar: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 8,
    backgroundColor: "#fff",
  },
  searchInput: {
    fontSize: 14,
  },
  filterContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  filterChip: {
    marginRight: 8,
    backgroundColor: "#fff",
  },
  filterChipActive: {
    backgroundColor: "#4CAF50",
  },
  filterChipTextActive: {
    color: "#fff",
  },
  listContainer: {
    paddingHorizontal: 16,
  },
  inboundCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
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
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "500",
  },
  cardContent: {
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
    paddingTop: 12,
  },
  infoRow: {
    flexDirection: "row",
    marginBottom: 8,
  },
  infoLabel: {
    width: 60,
    fontSize: 13,
    color: "#999",
  },
  infoValue: {
    flex: 1,
    fontSize: 13,
    color: "#333",
  },
  quantityValue: {
    fontWeight: "600",
    color: "#4CAF50",
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },
  timeText: {
    fontSize: 12,
    color: "#999",
  },
  actionLink: {
    flexDirection: "row",
    alignItems: "center",
  },
  actionText: {
    fontSize: 13,
    color: "#4CAF50",
    fontWeight: "500",
  },
  section: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#333",
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  statsItem: {
    width: "25%",
    alignItems: "center",
    paddingVertical: 8,
  },
  statsValue: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#4CAF50",
  },
  statsLabel: {
    fontSize: 11,
    color: "#666",
    marginTop: 4,
  },
});

export default WHInboundListScreen;
