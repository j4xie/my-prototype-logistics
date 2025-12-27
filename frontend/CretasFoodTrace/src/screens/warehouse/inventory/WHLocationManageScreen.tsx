/**
 * 库位管理页面
 * 对应原型: warehouse/location-manage.html
 */

import React, { useState } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { Text, Surface, Button, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { WHInventoryStackParamList } from "../../../types/navigation";

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

  const zones: Zone[] = [
    {
      id: "A",
      name: "A区 - 冷藏库",
      tempRange: "0°C ~ 4°C",
      totalLocations: 5,
      usedLocations: 3,
      capacity: 68,
    },
    {
      id: "B",
      name: "B区 - 冷冻库",
      tempRange: "-20°C ~ -15°C",
      totalLocations: 5,
      usedLocations: 4,
      capacity: 72,
    },
  ];

  const zoneALocations: Location[] = [
    {
      id: "A-01",
      name: "A区-冷藏库-01",
      zoneId: "A",
      status: "using",
      capacity: 500,
      used: 536,
      temperature: 2,
      tempNormal: true,
      items: "带鱼 x2批",
    },
    {
      id: "A-02",
      name: "A区-冷藏库-02",
      zoneId: "A",
      status: "using",
      capacity: 400,
      used: 320,
      temperature: 3,
      tempNormal: true,
      items: "带鱼、鲈鱼",
    },
    {
      id: "A-03",
      name: "A区-冷藏库-03",
      zoneId: "A",
      status: "using",
      capacity: 400,
      used: 120,
      temperature: 2.5,
      tempNormal: true,
      items: "蟹类",
    },
    {
      id: "A-04",
      name: "A区-冷藏库-04",
      zoneId: "A",
      status: "empty",
      capacity: 300,
      used: 0,
      temperature: 2,
      tempNormal: true,
    },
    {
      id: "A-05",
      name: "A区-冷藏库-05",
      zoneId: "A",
      status: "empty",
      capacity: 300,
      used: 0,
      temperature: 2,
      tempNormal: true,
    },
  ];

  const zoneBLocations: Location[] = [
    {
      id: "B-01",
      name: "B区-冷冻库-01",
      zoneId: "B",
      status: "using",
      capacity: 600,
      used: 520,
      temperature: -18,
      tempNormal: true,
      items: "虾仁 x4批",
    },
  ];

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
            总库位 10 个 | 使用中 7 个
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
