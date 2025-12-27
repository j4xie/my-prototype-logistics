/**
 * 库存管理列表页面
 * 对应原型: warehouse/inventory.html
 */

import React, { useState, useCallback } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import {
  Text,
  Surface,
  Chip,
  Searchbar,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { WHInventoryStackParamList } from "../../../types/navigation";

type NavigationProp = NativeStackNavigationProp<WHInventoryStackParamList>;

// 物料类型
type MaterialType = "fresh" | "frozen" | "dry";

interface InventoryItem {
  id: string;
  name: string;
  type: MaterialType;
  quantity: number;
  unit: string;
  batchCount: number;
  location: string;
  warning?: string;
  warningType?: "expire" | "low" | "normal";
  updatedAt: string;
}

// 模拟数据
const mockInventoryList: InventoryItem[] = [
  {
    id: "1",
    name: "带鱼",
    type: "fresh",
    quantity: 856,
    unit: "kg",
    batchCount: 3,
    location: "A区",
    warning: "1批即将过期",
    warningType: "expire",
    updatedAt: "10分钟前",
  },
  {
    id: "2",
    name: "虾仁",
    type: "frozen",
    quantity: 520,
    unit: "kg",
    batchCount: 4,
    location: "B区",
    warningType: "normal",
    updatedAt: "30分钟前",
  },
  {
    id: "3",
    name: "鲈鱼",
    type: "fresh",
    quantity: 380,
    unit: "kg",
    batchCount: 2,
    location: "A区",
    warningType: "normal",
    updatedAt: "1小时前",
  },
  {
    id: "4",
    name: "鱿鱼",
    type: "frozen",
    quantity: 450,
    unit: "kg",
    batchCount: 3,
    location: "B区",
    warningType: "normal",
    updatedAt: "2小时前",
  },
  {
    id: "5",
    name: "蟹类",
    type: "fresh",
    quantity: 120,
    unit: "kg",
    batchCount: 1,
    location: "A区",
    warning: "偏低",
    warningType: "low",
    updatedAt: "3小时前",
  },
  {
    id: "6",
    name: "干贝",
    type: "dry",
    quantity: 80,
    unit: "kg",
    batchCount: 2,
    location: "C区",
    warningType: "normal",
    updatedAt: "5小时前",
  },
];

const typeConfig: Record<MaterialType, { label: string; color: string; bgColor: string }> = {
  fresh: { label: "鲜品", color: "#4CAF50", bgColor: "#e8f5e9" },
  frozen: { label: "冻品", color: "#2196F3", bgColor: "#e3f2fd" },
  dry: { label: "干货", color: "#FF9800", bgColor: "#fff3e0" },
};

interface QuickAction {
  key: string;
  label: string;
  icon: string;
  color: string;
  screen: keyof WHInventoryStackParamList;
}

const quickActions: QuickAction[] = [
  { key: "check", label: "盘点", icon: "clipboard-check-outline", color: "#4CAF50", screen: "WHInventoryCheck" },
  { key: "transfer", label: "调拨", icon: "swap-horizontal", color: "#2196F3", screen: "WHInventoryTransfer" },
  { key: "location", label: "库位", icon: "map-marker", color: "#9C27B0", screen: "WHLocationManage" },
  { key: "expire", label: "过期", icon: "clock-alert-outline", color: "#FF5722", screen: "WHExpireHandle" },
];

export function WHInventoryListScreen() {
  const theme = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<string>("all");

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1500);
  }, []);

  // 筛选数据
  const filteredList = mockInventoryList.filter((item) => {
    if (selectedType !== "all" && item.type !== selectedType) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return item.name.toLowerCase().includes(query);
    }
    return true;
  });

  // 统计数据
  const stats = {
    total: mockInventoryList.length,
    fresh: mockInventoryList.filter((i) => i.type === "fresh").length,
    frozen: mockInventoryList.filter((i) => i.type === "frozen").length,
    dry: mockInventoryList.filter((i) => i.type === "dry").length,
    totalWeight: mockInventoryList.reduce((sum, i) => sum + i.quantity, 0),
    warningCount: mockInventoryList.filter((i) => i.warningType !== "normal").length,
  };

  const handleItemPress = (item: InventoryItem) => {
    navigation.navigate("WHInventoryDetail", { inventoryId: item.id });
  };

  const handleQuickAction = (action: QuickAction) => {
    navigation.navigate(action.screen as any);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>库存管理</Text>
        <Text style={styles.headerSubtitle}>
          在库 {stats.total} 种 | 总量 {stats.totalWeight.toLocaleString()} kg
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
        <View style={styles.quickActions}>
          {quickActions.map((action) => (
            <TouchableOpacity
              key={action.key}
              style={styles.quickActionItem}
              onPress={() => handleQuickAction(action)}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.quickActionIcon,
                  { backgroundColor: `${action.color}15` },
                ]}
              >
                <MaterialCommunityIcons
                  name={action.icon as any}
                  size={24}
                  color={action.color}
                />
              </View>
              <Text style={styles.quickActionLabel}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* 搜索栏 */}
        <Searchbar
          placeholder="搜索物料名称/批次号"
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
            selected={selectedType === "all"}
            onPress={() => setSelectedType("all")}
            style={[
              styles.filterChip,
              selectedType === "all" && styles.filterChipActive,
            ]}
            textStyle={selectedType === "all" ? styles.filterChipTextActive : undefined}
          >
            全部({stats.total})
          </Chip>
          <Chip
            selected={selectedType === "fresh"}
            onPress={() => setSelectedType("fresh")}
            style={[
              styles.filterChip,
              selectedType === "fresh" && styles.filterChipActive,
            ]}
            textStyle={selectedType === "fresh" ? styles.filterChipTextActive : undefined}
          >
            鲜品({stats.fresh})
          </Chip>
          <Chip
            selected={selectedType === "frozen"}
            onPress={() => setSelectedType("frozen")}
            style={[
              styles.filterChip,
              selectedType === "frozen" && styles.filterChipActive,
            ]}
            textStyle={selectedType === "frozen" ? styles.filterChipTextActive : undefined}
          >
            冻品({stats.frozen})
          </Chip>
          <Chip
            selected={selectedType === "dry"}
            onPress={() => setSelectedType("dry")}
            style={[
              styles.filterChip,
              selectedType === "dry" && styles.filterChipActive,
            ]}
            textStyle={selectedType === "dry" ? styles.filterChipTextActive : undefined}
          >
            干货({stats.dry})
          </Chip>
        </ScrollView>

        {/* 库存列表 */}
        <View style={styles.listContainer}>
          {filteredList.map((item) => {
            const typeConf = typeConfig[item.type];
            return (
              <TouchableOpacity
                key={item.id}
                onPress={() => handleItemPress(item)}
                activeOpacity={0.7}
              >
                <Surface style={styles.inventoryCard} elevation={1}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.materialName}>{item.name}</Text>
                    <View
                      style={[
                        styles.typeBadge,
                        { backgroundColor: typeConf.bgColor },
                      ]}
                    >
                      <Text style={[styles.typeText, { color: typeConf.color }]}>
                        {typeConf.label}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.cardContent}>
                    <View style={styles.mainInfo}>
                      <Text style={styles.quantityValue}>{item.quantity}</Text>
                      <Text style={styles.unitText}>{item.unit}</Text>
                    </View>
                    <View style={styles.metaInfo}>
                      <View style={styles.metaItem}>
                        <Text style={styles.metaLabel}>批次</Text>
                        <Text style={styles.metaValue}>{item.batchCount}个</Text>
                      </View>
                      <View style={styles.metaItem}>
                        <Text style={styles.metaLabel}>库位</Text>
                        <Text style={styles.metaValue}>{item.location}</Text>
                      </View>
                      <View style={styles.metaItem}>
                        <Text style={styles.metaLabel}>
                          {item.warningType === "normal" ? "状态" : "预警"}
                        </Text>
                        <Text
                          style={[
                            styles.metaValue,
                            item.warningType === "expire" && styles.warningText,
                            item.warningType === "low" && styles.lowText,
                            item.warningType === "normal" && styles.normalText,
                          ]}
                        >
                          {item.warning || "正常"}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.cardFooter}>
                    <Text style={styles.updateText}>
                      更新: {item.updatedAt}
                    </Text>
                    <View style={styles.actionLink}>
                      <Text style={styles.actionText}>查看详情</Text>
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

        {/* 库存概览 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>库存概览</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statsItem}>
              <Text style={styles.statsValue}>{stats.total}</Text>
              <Text style={styles.statsLabel}>物料种类</Text>
            </View>
            <View style={styles.statsItem}>
              <Text style={styles.statsValue}>
                {stats.totalWeight.toLocaleString()}
              </Text>
              <Text style={styles.statsLabel}>总库存(kg)</Text>
            </View>
            <View style={styles.statsItem}>
              <Text style={styles.statsValue}>¥89K</Text>
              <Text style={styles.statsLabel}>库存价值</Text>
            </View>
            <View style={styles.statsItem}>
              <Text style={[styles.statsValue, { color: "#f44336" }]}>
                {stats.warningCount}
              </Text>
              <Text style={styles.statsLabel}>预警数</Text>
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
  quickActions: {
    flexDirection: "row",
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    paddingVertical: 16,
  },
  quickActionItem: {
    flex: 1,
    alignItems: "center",
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  quickActionLabel: {
    fontSize: 12,
    color: "#666",
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
  inventoryCard: {
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
  materialName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  typeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  typeText: {
    fontSize: 12,
    fontWeight: "500",
  },
  cardContent: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
    paddingTop: 12,
  },
  mainInfo: {
    flexDirection: "row",
    alignItems: "baseline",
    width: 100,
  },
  quantityValue: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#4CAF50",
  },
  unitText: {
    fontSize: 14,
    color: "#666",
    marginLeft: 4,
  },
  metaInfo: {
    flex: 1,
    marginLeft: 16,
  },
  metaItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  metaLabel: {
    fontSize: 12,
    color: "#999",
  },
  metaValue: {
    fontSize: 12,
    color: "#333",
  },
  warningText: {
    color: "#f44336",
    fontWeight: "600",
  },
  lowText: {
    color: "#ff9800",
    fontWeight: "600",
  },
  normalText: {
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
  updateText: {
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

export default WHInventoryListScreen;
