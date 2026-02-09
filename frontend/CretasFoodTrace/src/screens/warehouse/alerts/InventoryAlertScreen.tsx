/**
 * 库存预警列表页面
 * 功能：预警类型分类、预警级别显示、批量处理、预警统计Dashboard
 * 路径: screens/warehouse/alerts/InventoryAlertScreen.tsx
 */

import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from "react-native";
import { Text, Button, Checkbox, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { WHInventoryStackParamList } from "../../../types/navigation";
import { materialBatchApiClient, MaterialBatch } from "../../../services/api/materialBatchApiClient";
import { handleError } from "../../../utils/errorHandler";
import { useAuthStore } from "../../../store/authStore";

type NavigationProp = NativeStackNavigationProp<WHInventoryStackParamList>;

// 预警类型
type AlertType = "all" | "low_stock" | "expiring" | "expired" | "quality";

// 预警级别
type AlertLevel = "urgent" | "important" | "normal";

// 预警项接口
interface InventoryAlert {
  id: string;
  batchNumber: string;
  materialName: string;
  materialType: string;
  alertType: AlertType;
  level: AlertLevel;
  quantity: number;
  threshold?: number;
  expiryDate?: string;
  daysLeft?: number;
  location: string;
  message: string;
  createdAt: string;
  status: "pending" | "processing" | "resolved";
}

// 预警统计
interface AlertStats {
  total: number;
  urgent: number;
  important: number;
  normal: number;
  resolved: number;
  lowStock: number;
  expiring: number;
  expired: number;
}

export function InventoryAlertScreen() {
  const theme = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuthStore();

  // 状态管理
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<AlertType>("all");
  const [alerts, setAlerts] = useState<InventoryAlert[]>([]);
  const [selectedAlerts, setSelectedAlerts] = useState<Set<string>>(new Set());
  const [batchMode, setBatchMode] = useState(false);
  const [stats, setStats] = useState<AlertStats>({
    total: 0,
    urgent: 0,
    important: 0,
    normal: 0,
    resolved: 0,
    lowStock: 0,
    expiring: 0,
    expired: 0,
  });

  // 计算过期状态
  const calculateExpireStatus = (expiryDate?: string): { level: AlertLevel; daysLeft: number } => {
    if (!expiryDate) {
      return { level: "normal", daysLeft: 999 };
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = new Date(expiryDate);
    expiry.setHours(0, 0, 0, 0);
    const diffTime = expiry.getTime() - today.getTime();
    const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (daysLeft <= 0) {
      return { level: "urgent", daysLeft: 0 };
    } else if (daysLeft <= 3) {
      return { level: "urgent", daysLeft };
    } else if (daysLeft <= 7) {
      return { level: "important", daysLeft };
    }
    return { level: "normal", daysLeft };
  };

  // 转换批次为预警项
  const convertToAlert = (
    batch: MaterialBatch,
    alertType: AlertType,
    message: string
  ): InventoryAlert => {
    const expireInfo = calculateExpireStatus(batch.expiryDate);
    let level: AlertLevel = "normal";

    if (alertType === "expired") {
      level = "urgent";
    } else if (alertType === "expiring") {
      level = expireInfo.level;
    } else if (alertType === "low_stock") {
      level = batch.remainingQuantity <= 50 ? "urgent" : "important";
    }

    return {
      id: batch.id,
      batchNumber: batch.batchNumber,
      materialName: batch.materialName || "未知物料",
      materialType: batch.storageType?.toLowerCase() === "fresh" ? "鲜品" : batch.storageType?.toLowerCase() === "frozen" ? "冻品" : "干货",
      alertType,
      level,
      quantity: batch.remainingQuantity || 0,
      expiryDate: batch.expiryDate,
      daysLeft: expireInfo.daysLeft,
      location: batch.storageLocation || "未知库位",
      message,
      createdAt: batch.createdAt,
      status: "pending",
    };
  };

  // 加载预警数据
  const loadAlerts = useCallback(async () => {
    try {
      setLoading(true);

      // 并行获取低库存、即将过期、已过期数据
      const [lowStockRes, expiringRes, expiredRes] = await Promise.all([
        materialBatchApiClient.getLowStockBatches(),
        materialBatchApiClient.getExpiringBatches(7),
        materialBatchApiClient.getExpiredBatches(),
      ]);

      const allAlerts: InventoryAlert[] = [];

      // 处理低库存预警
      const lowStockBatches: MaterialBatch[] = lowStockRes?.data || [];
      lowStockBatches.forEach((batch) => {
        allAlerts.push(
          convertToAlert(batch, "low_stock", `库存量 ${batch.remainingQuantity}kg 低于安全库存`)
        );
      });

      // 处理即将过期预警
      const expiringBatches: MaterialBatch[] = expiringRes?.data || [];
      expiringBatches.forEach((batch) => {
        const { daysLeft } = calculateExpireStatus(batch.expiryDate);
        if (daysLeft > 0) {
          allAlerts.push(
            convertToAlert(batch, "expiring", `将在 ${daysLeft} 天后过期`)
          );
        }
      });

      // 处理已过期预警
      const expiredBatches: MaterialBatch[] = expiredRes?.data || [];
      expiredBatches.forEach((batch) => {
        allAlerts.push(convertToAlert(batch, "expired", "已过期，需立即处理"));
      });

      // 按级别排序：urgent > important > normal
      allAlerts.sort((a, b) => {
        const levelOrder = { urgent: 0, important: 1, normal: 2 };
        return levelOrder[a.level] - levelOrder[b.level];
      });

      setAlerts(allAlerts);

      // 计算统计数据
      setStats({
        total: allAlerts.length,
        urgent: allAlerts.filter((a) => a.level === "urgent").length,
        important: allAlerts.filter((a) => a.level === "important").length,
        normal: allAlerts.filter((a) => a.level === "normal").length,
        resolved: 0,
        lowStock: lowStockBatches.length,
        expiring: expiringBatches.filter((b) => {
          const { daysLeft } = calculateExpireStatus(b.expiryDate);
          return daysLeft > 0;
        }).length,
        expired: expiredBatches.length,
      });
    } catch (error) {
      handleError(error, { title: "加载预警数据失败" });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  // 下拉刷新
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadAlerts();
  }, [loadAlerts]);

  // 筛选后的预警列表
  const filteredAlerts = alerts.filter((alert) => {
    if (activeFilter === "all") return true;
    return alert.alertType === activeFilter;
  });

  // 切换选择预警
  const toggleSelectAlert = (alertId: string) => {
    const newSelected = new Set(selectedAlerts);
    if (newSelected.has(alertId)) {
      newSelected.delete(alertId);
    } else {
      newSelected.add(alertId);
    }
    setSelectedAlerts(newSelected);
  };

  // 全选/取消全选
  const toggleSelectAll = () => {
    if (selectedAlerts.size === filteredAlerts.length) {
      setSelectedAlerts(new Set());
    } else {
      setSelectedAlerts(new Set(filteredAlerts.map((a) => a.id)));
    }
  };

  // 批量处理预警
  const handleBatchProcess = () => {
    if (selectedAlerts.size === 0) {
      Alert.alert("提示", "请先选择需要处理的预警");
      return;
    }

    Alert.alert(
      "批量处理",
      `确定要处理选中的 ${selectedAlerts.size} 条预警吗？`,
      [
        { text: "取消", style: "cancel" },
        {
          text: "确定",
          onPress: async () => {
            try {
              // 这里调用批量处理API
              await materialBatchApiClient.handleExpiredBatches();
              Alert.alert("成功", "批量处理完成");
              setSelectedAlerts(new Set());
              setBatchMode(false);
              loadAlerts();
            } catch (error) {
              handleError(error, { title: "批量处理失败" });
            }
          },
        },
      ]
    );
  };

  // 获取预警类型图标
  const getAlertTypeIcon = (type: AlertType): string => {
    switch (type) {
      case "low_stock":
        return "package-variant-closed";
      case "expiring":
        return "clock-alert-outline";
      case "expired":
        return "alert-circle";
      case "quality":
        return "clipboard-alert";
      default:
        return "bell-alert";
    }
  };

  // 获取级别样式
  const getLevelStyle = (level: AlertLevel) => {
    switch (level) {
      case "urgent":
        return { bg: "#ffebee", color: "#f44336", text: "紧急" };
      case "important":
        return { bg: "#fff3e0", color: "#f57c00", text: "重要" };
      case "normal":
        return { bg: "#e8f5e9", color: "#4CAF50", text: "一般" };
    }
  };

  // 获取类型标签
  const getTypeLabel = (type: AlertType): string => {
    switch (type) {
      case "low_stock":
        return "低库存";
      case "expiring":
        return "即将过期";
      case "expired":
        return "已过期";
      case "quality":
        return "质量异常";
      default:
        return "其他";
    }
  };

  // 渲染预警卡片
  const renderAlertCard = (alert: InventoryAlert) => {
    const levelStyle = getLevelStyle(alert.level);
    const isSelected = selectedAlerts.has(alert.id);

    return (
      <TouchableOpacity
        key={alert.id}
        style={[
          styles.alertCard,
          alert.level === "urgent" && styles.alertCardUrgent,
          alert.level === "important" && styles.alertCardImportant,
          isSelected && styles.alertCardSelected,
        ]}
        onPress={() => {
          if (batchMode) {
            toggleSelectAlert(alert.id);
          } else {
            navigation.navigate("WHAlertDetail" as keyof WHInventoryStackParamList, {
              alertId: alert.id,
              alertType: alert.alertType,
              batchNumber: alert.batchNumber,
            } as never);
          }
        }}
      >
        {batchMode && (
          <View style={styles.checkboxContainer}>
            <Checkbox
              status={isSelected ? "checked" : "unchecked"}
              onPress={() => toggleSelectAlert(alert.id)}
              color="#4CAF50"
            />
          </View>
        )}

        <View style={styles.alertContent}>
          <View style={styles.alertHeader}>
            <View style={styles.alertInfo}>
              <MaterialCommunityIcons
                name={getAlertTypeIcon(alert.alertType) as keyof typeof MaterialCommunityIcons.glyphMap}
                size={20}
                color={levelStyle.color}
              />
              <Text style={styles.alertBatch}>{alert.batchNumber}</Text>
            </View>
            <View style={styles.alertTags}>
              <View style={[styles.levelTag, { backgroundColor: levelStyle.bg }]}>
                <Text style={[styles.levelTagText, { color: levelStyle.color }]}>
                  {levelStyle.text}
                </Text>
              </View>
              <View style={styles.typeTag}>
                <Text style={styles.typeTagText}>{getTypeLabel(alert.alertType)}</Text>
              </View>
            </View>
          </View>

          <View style={styles.alertBody}>
            <View style={styles.alertRow}>
              <Text style={styles.alertLabel}>物料</Text>
              <Text style={styles.alertValue}>
                {alert.materialName} ({alert.materialType})
              </Text>
            </View>
            <View style={styles.alertRow}>
              <Text style={styles.alertLabel}>库存</Text>
              <Text
                style={[
                  styles.alertValue,
                  alert.alertType === "low_stock" && styles.textDanger,
                ]}
              >
                {alert.quantity} kg
              </Text>
            </View>
            {alert.expiryDate && (
              <View style={styles.alertRow}>
                <Text style={styles.alertLabel}>过期时间</Text>
                <Text
                  style={[
                    styles.alertValue,
                    alert.alertType === "expired" && styles.textDanger,
                    alert.alertType === "expiring" && styles.textWarning,
                  ]}
                >
                  {alert.expiryDate}
                  {alert.daysLeft !== undefined && alert.daysLeft > 0 && ` (${alert.daysLeft}天后)`}
                  {alert.daysLeft === 0 && " (今天)"}
                </Text>
              </View>
            )}
            <View style={styles.alertRow}>
              <Text style={styles.alertLabel}>库位</Text>
              <Text style={styles.alertValue}>{alert.location}</Text>
            </View>
            <View style={styles.alertMessage}>
              <MaterialCommunityIcons name="alert-outline" size={14} color="#f57c00" />
              <Text style={styles.alertMessageText}>{alert.message}</Text>
            </View>
          </View>

          {!batchMode && (
            <View style={styles.alertActions}>
              <Button
                mode="contained"
                compact
                onPress={() => {
                  navigation.navigate("WHAlertDetail" as keyof WHInventoryStackParamList, {
                    alertId: alert.id,
                    alertType: alert.alertType,
                    batchNumber: alert.batchNumber,
                  } as never);
                }}
                style={[
                  styles.actionBtn,
                  alert.level === "urgent" ? styles.actionBtnPrimary : styles.actionBtnSecondary,
                ]}
                labelStyle={{
                  color: alert.level === "urgent" ? "#fff" : "#666",
                  fontSize: 12,
                }}
              >
                {alert.level === "urgent" ? "立即处理" : "查看详情"}
              </Button>
            </View>
          )}
        </View>
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
            <Text style={styles.headerTitle}>库存预警</Text>
            <Text style={styles.headerSubtitle}>加载中...</Text>
          </View>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>加载预警数据中...</Text>
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
          <Text style={styles.headerTitle}>库存预警</Text>
          <Text style={styles.headerSubtitle}>
            共 {stats.total} 条预警 | 紧急 {stats.urgent} 条
          </Text>
        </View>
        <TouchableOpacity
          style={styles.headerRight}
          onPress={() => setBatchMode(!batchMode)}
        >
          <MaterialCommunityIcons
            name={batchMode ? "close" : "checkbox-multiple-outline"}
            size={24}
            color="#fff"
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#4CAF50"]} />
        }
      >
        {/* 预警统计Dashboard */}
        <View style={styles.dashboardSection}>
          <Text style={styles.sectionTitle}>预警统计</Text>
          <View style={styles.statsGrid}>
            <View style={[styles.statCard, styles.statCardDanger]}>
              <MaterialCommunityIcons name="alert-circle" size={24} color="#f44336" />
              <Text style={[styles.statValue, { color: "#f44336" }]}>{stats.expired}</Text>
              <Text style={styles.statLabel}>已过期</Text>
            </View>
            <View style={[styles.statCard, styles.statCardWarning]}>
              <MaterialCommunityIcons name="clock-alert" size={24} color="#f57c00" />
              <Text style={[styles.statValue, { color: "#f57c00" }]}>{stats.expiring}</Text>
              <Text style={styles.statLabel}>即将过期</Text>
            </View>
            <View style={[styles.statCard, styles.statCardInfo]}>
              <MaterialCommunityIcons name="package-variant-closed" size={24} color="#2196F3" />
              <Text style={[styles.statValue, { color: "#2196F3" }]}>{stats.lowStock}</Text>
              <Text style={styles.statLabel}>低库存</Text>
            </View>
            <View style={[styles.statCard, styles.statCardSuccess]}>
              <MaterialCommunityIcons name="check-circle" size={24} color="#4CAF50" />
              <Text style={[styles.statValue, { color: "#4CAF50" }]}>{stats.resolved}</Text>
              <Text style={styles.statLabel}>已处理</Text>
            </View>
          </View>
        </View>

        {/* 类型筛选 */}
        <View style={styles.filterSection}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.filterTabs}>
              {[
                { key: "all" as AlertType, label: "全部", count: stats.total },
                { key: "expired" as AlertType, label: "已过期", count: stats.expired },
                { key: "expiring" as AlertType, label: "即将过期", count: stats.expiring },
                { key: "low_stock" as AlertType, label: "低库存", count: stats.lowStock },
              ].map((tab) => (
                <TouchableOpacity
                  key={tab.key}
                  style={[
                    styles.filterTab,
                    activeFilter === tab.key && styles.filterTabActive,
                  ]}
                  onPress={() => setActiveFilter(tab.key)}
                >
                  <Text
                    style={[
                      styles.filterTabText,
                      activeFilter === tab.key && styles.filterTabTextActive,
                    ]}
                  >
                    {tab.label}
                  </Text>
                  <View
                    style={[
                      styles.filterBadge,
                      activeFilter === tab.key && styles.filterBadgeActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.filterBadgeText,
                        activeFilter === tab.key && styles.filterBadgeTextActive,
                      ]}
                    >
                      {tab.count}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* 批量模式工具栏 */}
        {batchMode && (
          <View style={styles.batchToolbar}>
            <TouchableOpacity style={styles.selectAllBtn} onPress={toggleSelectAll}>
              <Checkbox
                status={
                  selectedAlerts.size === filteredAlerts.length && filteredAlerts.length > 0
                    ? "checked"
                    : selectedAlerts.size > 0
                    ? "indeterminate"
                    : "unchecked"
                }
                onPress={toggleSelectAll}
                color="#4CAF50"
              />
              <Text style={styles.selectAllText}>
                {selectedAlerts.size === filteredAlerts.length ? "取消全选" : "全选"}
              </Text>
            </TouchableOpacity>
            <Text style={styles.selectedCount}>已选 {selectedAlerts.size} 项</Text>
            <Button
              mode="contained"
              compact
              onPress={handleBatchProcess}
              disabled={selectedAlerts.size === 0}
              style={styles.batchProcessBtn}
              labelStyle={{ color: "#fff", fontSize: 12 }}
            >
              批量处理
            </Button>
          </View>
        )}

        {/* 预警列表 */}
        <View style={styles.alertListSection}>
          {filteredAlerts.length > 0 ? (
            <>
              {/* 紧急预警 */}
              {filteredAlerts.filter((a) => a.level === "urgent").length > 0 && (
                <View style={styles.alertGroup}>
                  <Text style={[styles.alertGroupTitle, styles.textDanger]}>
                    紧急预警 ({filteredAlerts.filter((a) => a.level === "urgent").length})
                  </Text>
                  {filteredAlerts
                    .filter((a) => a.level === "urgent")
                    .map(renderAlertCard)}
                </View>
              )}

              {/* 重要预警 */}
              {filteredAlerts.filter((a) => a.level === "important").length > 0 && (
                <View style={styles.alertGroup}>
                  <Text style={[styles.alertGroupTitle, styles.textWarning]}>
                    重要预警 ({filteredAlerts.filter((a) => a.level === "important").length})
                  </Text>
                  {filteredAlerts
                    .filter((a) => a.level === "important")
                    .map(renderAlertCard)}
                </View>
              )}

              {/* 一般预警 */}
              {filteredAlerts.filter((a) => a.level === "normal").length > 0 && (
                <View style={styles.alertGroup}>
                  <Text style={[styles.alertGroupTitle, styles.textSuccess]}>
                    一般预警 ({filteredAlerts.filter((a) => a.level === "normal").length})
                  </Text>
                  {filteredAlerts
                    .filter((a) => a.level === "normal")
                    .map(renderAlertCard)}
                </View>
              )}
            </>
          ) : (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="bell-check-outline" size={64} color="#ccc" />
              <Text style={styles.emptyStateText}>暂无预警信息</Text>
              <Text style={styles.emptyStateSubtext}>当前没有需要处理的库存预警</Text>
            </View>
          )}
        </View>

        {/* 处理记录入口 */}
        <TouchableOpacity
          style={styles.historyEntry}
          onPress={() => {
            // TODO: 导航到处理记录历史页面
            Alert.alert("提示", "处理记录功能开发中");
          }}
        >
          <View style={styles.historyEntryLeft}>
            <MaterialCommunityIcons name="history" size={24} color="#4CAF50" />
            <View style={styles.historyEntryInfo}>
              <Text style={styles.historyEntryTitle}>处理记录历史</Text>
              <Text style={styles.historyEntrySubtitle}>查看所有预警处理记录</Text>
            </View>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={24} color="#999" />
        </TouchableOpacity>

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
    padding: 4,
    width: 32,
  },
  content: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#999",
    marginBottom: 12,
  },
  dashboardSection: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: "45%",
    alignItems: "center",
    padding: 16,
    borderRadius: 8,
    backgroundColor: "#f9f9f9",
  },
  statCardDanger: {
    backgroundColor: "#ffebee",
  },
  statCardWarning: {
    backgroundColor: "#fff3e0",
  },
  statCardInfo: {
    backgroundColor: "#e3f2fd",
  },
  statCardSuccess: {
    backgroundColor: "#e8f5e9",
  },
  statValue: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#333",
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: "#666",
    marginTop: 4,
  },
  filterSection: {
    paddingVertical: 12,
  },
  filterTabs: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 8,
  },
  filterTab: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#fff",
    gap: 6,
  },
  filterTabActive: {
    backgroundColor: "#4CAF50",
  },
  filterTabText: {
    fontSize: 13,
    color: "#666",
  },
  filterTabTextActive: {
    color: "#fff",
    fontWeight: "500",
  },
  filterBadge: {
    backgroundColor: "#f0f0f0",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  filterBadgeActive: {
    backgroundColor: "rgba(255,255,255,0.3)",
  },
  filterBadgeText: {
    fontSize: 11,
    color: "#666",
    fontWeight: "500",
  },
  filterBadgeTextActive: {
    color: "#fff",
  },
  batchToolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 8,
    padding: 12,
  },
  selectAllBtn: {
    flexDirection: "row",
    alignItems: "center",
  },
  selectAllText: {
    fontSize: 14,
    color: "#333",
    marginLeft: 4,
  },
  selectedCount: {
    fontSize: 14,
    color: "#666",
  },
  batchProcessBtn: {
    backgroundColor: "#4CAF50",
    borderRadius: 6,
  },
  alertListSection: {
    paddingHorizontal: 16,
  },
  alertGroup: {
    marginBottom: 16,
  },
  alertGroupTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 10,
  },
  alertCard: {
    backgroundColor: "#fff",
    borderRadius: 10,
    marginBottom: 10,
    flexDirection: "row",
    overflow: "hidden",
    borderLeftWidth: 4,
    borderLeftColor: "#e0e0e0",
  },
  alertCardUrgent: {
    borderLeftColor: "#f44336",
  },
  alertCardImportant: {
    borderLeftColor: "#f57c00",
  },
  alertCardSelected: {
    backgroundColor: "#e8f5e9",
  },
  checkboxContainer: {
    justifyContent: "center",
    paddingLeft: 8,
  },
  alertContent: {
    flex: 1,
    padding: 12,
  },
  alertHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  alertInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  alertBatch: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  alertTags: {
    flexDirection: "row",
    gap: 6,
  },
  levelTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  levelTagText: {
    fontSize: 11,
    fontWeight: "500",
  },
  typeTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: "#f5f5f5",
  },
  typeTagText: {
    fontSize: 11,
    color: "#666",
  },
  alertBody: {
    gap: 6,
  },
  alertRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  alertLabel: {
    fontSize: 13,
    color: "#999",
  },
  alertValue: {
    fontSize: 13,
    color: "#333",
  },
  alertMessage: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    padding: 8,
    backgroundColor: "#fff8e1",
    borderRadius: 6,
    gap: 6,
  },
  alertMessageText: {
    fontSize: 12,
    color: "#f57c00",
    flex: 1,
  },
  alertActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 10,
  },
  actionBtn: {
    borderRadius: 6,
  },
  actionBtnPrimary: {
    backgroundColor: "#4CAF50",
  },
  actionBtnSecondary: {
    backgroundColor: "#f5f5f5",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#999",
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 13,
    color: "#bbb",
    marginTop: 4,
  },
  historyEntry: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    padding: 16,
  },
  historyEntryLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  historyEntryInfo: {
    gap: 2,
  },
  historyEntryTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  historyEntrySubtitle: {
    fontSize: 12,
    color: "#999",
  },
  textDanger: {
    color: "#f44336",
  },
  textWarning: {
    color: "#f57c00",
  },
  textSuccess: {
    color: "#4CAF50",
  },
});

export default InventoryAlertScreen;
