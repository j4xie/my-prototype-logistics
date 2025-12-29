/**
 * 库位管理页面
 * 对应原型: warehouse/location-manage.html
 */

import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Text, Surface, Button, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { WHInventoryStackParamList } from "../../../types/navigation";
import { materialBatchApiClient, MaterialBatch } from "../../../services/api/materialBatchApiClient";
import { handleError } from "../../../utils/errorHandler";

type NavigationProp = NativeStackNavigationProp<WHInventoryStackParamList>;

interface Zone {
  id: string;
  name: string;
  tempRange: string;
  totalLocations: number;
  usedLocations: number;
  capacity: number;
}

interface Location {
  id: string;
  name: string;
  zoneId: string;
  status: "using" | "empty";
  capacity: number;
  used: number;
  temperature: number;
  tempNormal: boolean;
  items?: string;
}

export function WHLocationManageScreen() {
  const theme = useTheme();
  const navigation = useNavigation<NavigationProp>();

  // 状态管理
  const [loading, setLoading] = useState(true);
  const [zones, setZones] = useState<Zone[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [totalLocations, setTotalLocations] = useState(0);
  const [usedLocations, setUsedLocations] = useState(0);

  // 从批次数据计算库位信息
  const loadLocationData = useCallback(async () => {
    try {
      const response = await materialBatchApiClient.getMaterialBatches({
        status: 'available',
        size: 200
      }) as { data?: { content?: MaterialBatch[] } | MaterialBatch[] };

      const allBatches: MaterialBatch[] = (response.data as { content?: MaterialBatch[] })?.content || response.data as MaterialBatch[] || [];

      // 按库位分组批次
      const locationMap = new Map<string, {
        batches: MaterialBatch[];
        totalQuantity: number;
        materials: Set<string>;
      }>();

      allBatches.forEach((batch: MaterialBatch) => {
        const loc = batch.storageLocation || '未分配';
        if (!locationMap.has(loc)) {
          locationMap.set(loc, {
            batches: [],
            totalQuantity: 0,
            materials: new Set(),
          });
        }
        const data = locationMap.get(loc)!;
        data.batches.push(batch);
        data.totalQuantity += batch.remainingQuantity || 0;
        if (batch.materialName) {
          data.materials.add(batch.materialName);
        }
      });

      // 生成库位列表
      const locationList: Location[] = Array.from(locationMap.entries())
        .filter(([loc]) => loc !== '未分配')
        .map(([loc, data]) => {
          // 根据库位名称判断区域
          const zoneId = loc.startsWith('B') ? 'B' : 'A';
          const isUsing = data.totalQuantity > 0;
          const capacity = 500; // 默认容量
          const temperature = zoneId === 'B' ? -18 : 2; // 冷冻-18°C, 冷藏2°C

          return {
            id: loc,
            name: loc,
            zoneId,
            status: isUsing ? 'using' as const : 'empty' as const,
            capacity,
            used: data.totalQuantity,
            temperature,
            tempNormal: true,
            items: data.materials.size > 0
              ? `${Array.from(data.materials).slice(0, 2).join('、')}${data.materials.size > 2 ? '等' : ''} x${data.batches.length}批`
              : undefined,
          };
        });

      // 计算区域统计
      const zoneALocs = locationList.filter(l => l.zoneId === 'A');
      const zoneBLocs = locationList.filter(l => l.zoneId === 'B');

      const zoneStats: Zone[] = [
        {
          id: 'A',
          name: 'A区 - 冷藏库',
          tempRange: '0°C ~ 4°C',
          totalLocations: Math.max(zoneALocs.length, 5),
          usedLocations: zoneALocs.filter(l => l.status === 'using').length,
          capacity: Math.round(
            zoneALocs.reduce((sum, l) => sum + (l.used / l.capacity) * 100, 0) /
            Math.max(zoneALocs.length, 1)
          ),
        },
        {
          id: 'B',
          name: 'B区 - 冷冻库',
          tempRange: '-20°C ~ -15°C',
          totalLocations: Math.max(zoneBLocs.length, 5),
          usedLocations: zoneBLocs.filter(l => l.status === 'using').length,
          capacity: Math.round(
            zoneBLocs.reduce((sum, l) => sum + (l.used / l.capacity) * 100, 0) /
            Math.max(zoneBLocs.length, 1)
          ),
        },
      ];

      setZones(zoneStats);
      setLocations(locationList);
      setTotalLocations(locationList.length || 10);
      setUsedLocations(locationList.filter(l => l.status === 'using').length);

    } catch (error) {
      handleError(error, { title: '加载库位数据失败' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLocationData();
  }, [loadLocationData]);

  // 按区域过滤库位
  const zoneALocations = locations.filter(l => l.zoneId === 'A');
  const zoneBLocations = locations.filter(l => l.zoneId === 'B');

  const getUsagePercent = (used: number, capacity: number) => {
    return Math.round((used / capacity) * 100);
  };

  const getCapacityColor = (percent: number) => {
    if (percent > 100) return "#f44336";
    if (percent > 80) return "#f57c00";
    return "#4CAF50";
  };

  const renderZoneCard = (zone: Zone) => (
    <Surface key={zone.id} style={styles.zoneCard} elevation={1}>
      <View style={styles.zoneHeader}>
        <Text style={styles.zoneName}>{zone.name}</Text>
        <Text style={styles.zoneTemp}>{zone.tempRange}</Text>
      </View>
      <View style={styles.zoneStats}>
        <View style={styles.zoneStat}>
          <Text style={styles.zoneStatValue}>{zone.totalLocations}</Text>
          <Text style={styles.zoneStatLabel}>库位</Text>
        </View>
        <View style={styles.zoneStat}>
          <Text style={styles.zoneStatValue}>{zone.usedLocations}</Text>
          <Text style={styles.zoneStatLabel}>使用中</Text>
        </View>
        <View style={styles.zoneStat}>
          <Text style={styles.zoneStatValue}>{zone.capacity}%</Text>
          <Text style={styles.zoneStatLabel}>容量</Text>
        </View>
      </View>
    </Surface>
  );

  const renderLocationCard = (location: Location) => {
    const usagePercent = getUsagePercent(location.used, location.capacity);
    const capacityColor = getCapacityColor(usagePercent);
    const isOverCapacity = usagePercent > 100;

    return (
      <View
        key={location.id}
        style={[
          styles.locationCard,
          location.status === "empty" && styles.locationCardEmpty,
        ]}
      >
        <View style={styles.locationHeader}>
          <Text style={styles.locationName}>{location.name}</Text>
          <View
            style={[
              styles.locationStatus,
              location.status === "using"
                ? styles.locationStatusUsing
                : styles.locationStatusEmpty,
            ]}
          >
            <Text
              style={[
                styles.locationStatusText,
                location.status === "using"
                  ? styles.locationStatusTextUsing
                  : styles.locationStatusTextEmpty,
              ]}
            >
              {location.status === "using" ? "使用中" : "空闲"}
            </Text>
          </View>
        </View>

        <View style={styles.locationContent}>
          <View style={styles.locationRow}>
            <Text style={styles.locationLabel}>容量</Text>
            <Text style={styles.locationValue}>{location.capacity} kg</Text>
          </View>

          {location.status === "using" && (
            <View style={styles.locationRow}>
              <Text style={styles.locationLabel}>已用</Text>
              <Text
                style={[
                  styles.locationValue,
                  isOverCapacity && { color: "#f44336" },
                ]}
              >
                {location.used} kg ({usagePercent}%)
              </Text>
            </View>
          )}

          <View style={styles.locationRow}>
            <Text style={styles.locationLabel}>温度</Text>
            <Text
              style={[
                styles.locationValue,
                { color: location.tempNormal ? "#4CAF50" : "#f44336" },
              ]}
            >
              {location.temperature}°C {location.tempNormal ? "✓" : "!"}
            </Text>
          </View>

          {location.items && (
            <View style={styles.locationRow}>
              <Text style={styles.locationLabel}>存放</Text>
              <Text style={styles.locationValue}>{location.items}</Text>
            </View>
          )}
        </View>

        {location.status === "using" && (
          <View style={styles.capacityBarContainer}>
            <View
              style={[
                styles.capacityBar,
                {
                  width: `${Math.min(usagePercent, 100)}%`,
                  backgroundColor: capacityColor,
                },
              ]}
            />
          </View>
        )}
      </View>
    );
  };

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
            <Text style={styles.headerTitle}>库位管理</Text>
            <Text style={styles.headerSubtitle}>加载中...</Text>
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
          <Text style={styles.headerTitle}>库位管理</Text>
          <Text style={styles.headerSubtitle}>
            总库位 {totalLocations} 个 | 使用中 {usedLocations} 个
          </Text>
        </View>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* 库区概览 */}
        <View style={styles.zoneOverview}>
          {zones.map(renderZoneCard)}
        </View>

        {/* A区库位列表 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>A区 - 冷藏库</Text>
          {zoneALocations.map(renderLocationCard)}
        </View>

        {/* B区库位列表 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>B区 - 冷冻库</Text>
          {zoneBLocations.map(renderLocationCard)}
        </View>

        {/* 操作按钮 */}
        <View style={styles.actionButtons}>
          <Button
            mode="outlined"
            onPress={() => navigation.navigate("WHTempMonitor")}
            style={styles.actionButton}
            labelStyle={{ color: "#4CAF50" }}
          >
            温控监控
          </Button>
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
  zoneOverview: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 12,
  },
  zoneCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
  },
  zoneHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  zoneName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#333",
  },
  zoneTemp: {
    fontSize: 11,
    color: "#0097a7",
  },
  zoneStats: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  zoneStat: {
    alignItems: "center",
  },
  zoneStatValue: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
  },
  zoneStatLabel: {
    fontSize: 10,
    color: "#999",
    marginTop: 2,
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
  locationCard: {
    backgroundColor: "#f9f9f9",
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  locationCardEmpty: {
    opacity: 0.7,
  },
  locationHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  locationName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  locationStatus: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  locationStatusUsing: {
    backgroundColor: "#e8f5e9",
  },
  locationStatusEmpty: {
    backgroundColor: "#f5f5f5",
  },
  locationStatusText: {
    fontSize: 11,
    fontWeight: "500",
  },
  locationStatusTextUsing: {
    color: "#4CAF50",
  },
  locationStatusTextEmpty: {
    color: "#999",
  },
  locationContent: {
    gap: 6,
  },
  locationRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  locationLabel: {
    fontSize: 13,
    color: "#999",
  },
  locationValue: {
    fontSize: 13,
    color: "#333",
  },
  capacityBarContainer: {
    height: 4,
    backgroundColor: "#e0e0e0",
    borderRadius: 2,
    marginTop: 10,
    overflow: "hidden",
  },
  capacityBar: {
    height: "100%",
    borderRadius: 2,
  },
  actionButtons: {
    paddingHorizontal: 16,
    marginTop: 16,
  },
  actionButton: {
    borderRadius: 8,
    borderColor: "#4CAF50",
  },
});

export default WHLocationManageScreen;
