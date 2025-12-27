/**
 * 扫码作业页面
 * 对应原型: warehouse/scan-operation.html
 */

import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Vibration,
} from "react-native";
import { Text, Surface, Button, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { WHInboundStackParamList } from "../../../types/navigation";

type NavigationProp = NativeStackNavigationProp<WHInboundStackParamList>;

interface ScanOperationParams {
  mode: "inbound" | "outbound";
}

export function WHScanOperationScreen() {
  const theme = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute();
  const params = route.params as ScanOperationParams | undefined;
  const mode = params?.mode ?? "inbound";

  const [isScanning, setIsScanning] = useState(false);
  const [scannedCount, setScannedCount] = useState(0);
  const [lastScan, setLastScan] = useState<string | null>(null);

  const modeConfig = {
    inbound: {
      title: "扫码入库",
      icon: "package-down",
      color: "#4CAF50",
      action: "入库",
    },
    outbound: {
      title: "扫码出库",
      icon: "package-up",
      color: "#2196F3",
      action: "出库",
    },
  };

  const config = modeConfig[mode];

  // 模拟扫码
  const handleScan = () => {
    setIsScanning(true);
    Vibration.vibrate(100);

    // 模拟扫码延迟
    setTimeout(() => {
      const mockCode = `MB-${Date.now().toString().slice(-8)}`;
      setLastScan(mockCode);
      setScannedCount((prev) => prev + 1);
      setIsScanning(false);

      Alert.alert(
        "扫码成功",
        `批次号: ${mockCode}\n${config.action}成功！`,
        [{ text: "继续扫码" }]
      );
    }, 1000);
  };

  const handleManualInput = () => {
    Alert.prompt?.(
      "手动输入",
      "请输入批次号",
      [
        { text: "取消", style: "cancel" },
        {
          text: "确定",
          onPress: (text) => {
            if (text) {
              setLastScan(text);
              setScannedCount((prev) => prev + 1);
              Alert.alert("成功", `批次 ${text} ${config.action}成功！`);
            }
          },
        },
      ],
      "plain-text",
      "",
      "default"
    ) ??
      Alert.alert("提示", "当前系统不支持手动输入，请使用扫码功能");
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: config.color }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{config.title}</Text>
        <View style={styles.headerRight} />
      </View>

      <View style={styles.content}>
        {/* 扫码区域 */}
        <View style={styles.scanArea}>
          <View
            style={[styles.scanFrame, { borderColor: config.color }]}
          >
            <MaterialCommunityIcons
              name={isScanning ? "loading" : "qrcode-scan"}
              size={80}
              color={config.color}
            />
            <Text style={styles.scanHint}>
              {isScanning ? "扫码中..." : "将二维码/条码放入框内"}
            </Text>
          </View>
        </View>

        {/* 统计信息 */}
        <Surface style={styles.statsCard} elevation={1}>
          <View style={styles.statsRow}>
            <View style={styles.statsItem}>
              <Text style={[styles.statsValue, { color: config.color }]}>
                {scannedCount}
              </Text>
              <Text style={styles.statsLabel}>已扫描</Text>
            </View>
            <View style={styles.statsDivider} />
            <View style={styles.statsItem}>
              <Text style={styles.lastScanText}>
                {lastScan ?? "暂无扫描记录"}
              </Text>
              <Text style={styles.statsLabel}>最近扫描</Text>
            </View>
          </View>
        </Surface>

        {/* 操作按钮 */}
        <View style={styles.actions}>
          <Button
            mode="contained"
            onPress={handleScan}
            style={[styles.scanButton, { backgroundColor: config.color }]}
            labelStyle={styles.scanButtonLabel}
            icon="qrcode-scan"
            loading={isScanning}
            disabled={isScanning}
          >
            {isScanning ? "扫码中" : "点击扫码"}
          </Button>

          <Button
            mode="outlined"
            onPress={handleManualInput}
            style={styles.manualButton}
            labelStyle={styles.manualButtonLabel}
            icon="keyboard"
          >
            手动输入
          </Button>
        </View>

        {/* 提示 */}
        <View style={styles.tips}>
          <Text style={styles.tipTitle}>扫码说明</Text>
          <View style={styles.tipItem}>
            <MaterialCommunityIcons
              name="check-circle"
              size={16}
              color="#4CAF50"
            />
            <Text style={styles.tipText}>支持二维码、条形码扫描</Text>
          </View>
          <View style={styles.tipItem}>
            <MaterialCommunityIcons
              name="check-circle"
              size={16}
              color="#4CAF50"
            />
            <Text style={styles.tipText}>扫描后自动{config.action}确认</Text>
          </View>
          <View style={styles.tipItem}>
            <MaterialCommunityIcons
              name="check-circle"
              size={16}
              color="#4CAF50"
            />
            <Text style={styles.tipText}>
              如无法扫码，可点击"手动输入"
            </Text>
          </View>
        </View>
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
    padding: 16,
  },
  scanArea: {
    alignItems: "center",
    marginVertical: 24,
  },
  scanFrame: {
    width: 220,
    height: 220,
    borderWidth: 3,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  scanHint: {
    marginTop: 16,
    fontSize: 14,
    color: "#666",
  },
  statsCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  statsItem: {
    flex: 1,
    alignItems: "center",
  },
  statsDivider: {
    width: 1,
    height: 40,
    backgroundColor: "#e0e0e0",
  },
  statsValue: {
    fontSize: 32,
    fontWeight: "bold",
  },
  statsLabel: {
    fontSize: 12,
    color: "#999",
    marginTop: 4,
  },
  lastScanText: {
    fontSize: 14,
    color: "#333",
    fontFamily: "monospace",
  },
  actions: {
    gap: 12,
    marginBottom: 24,
  },
  scanButton: {
    borderRadius: 8,
    paddingVertical: 8,
  },
  scanButtonLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  manualButton: {
    borderRadius: 8,
    borderColor: "#ddd",
  },
  manualButtonLabel: {
    color: "#666",
  },
  tips: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
  },
  tipTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 12,
  },
  tipItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  tipText: {
    fontSize: 13,
    color: "#666",
  },
});

export default WHScanOperationScreen;
