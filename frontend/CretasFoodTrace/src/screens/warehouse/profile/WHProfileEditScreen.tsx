/**
 * 个人信息编辑页面
 * 对应原型: warehouse/profile-edit.html
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
import { Text, TextInput, Button, Switch, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { WHProfileStackParamList } from "../../../types/navigation";
import { useAuthStore } from "../../../store/authStore";
import { userApiClient } from "../../../services/api/userApiClient";
import { handleError } from "../../../utils/errorHandler";

type NavigationProp = NativeStackNavigationProp<WHProfileStackParamList>;

interface ProfileData {
  name: string;
  employeeId: string;
  phone: string;
  email: string;
  factory: string;
  department: string;
  position: string;
  joinDate: string;
}

export function WHProfileEditScreen() {
  const theme = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuthStore();

  // 状态管理
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [profileData, setProfileData] = useState<ProfileData>({
    name: "",
    employeeId: "",
    phone: "",
    email: "",
    factory: "",
    department: "",
    position: "",
    joinDate: "",
  });
  const [fingerprintEnabled, setFingerprintEnabled] = useState(true);

  // 加载用户数据
  const loadUserProfile = useCallback(async () => {
    try {
      // 首先使用auth store中的数据
      if (user) {
        const userAny = user as unknown as Record<string, unknown>;
        const phone = user.phone || '';
        setProfileData({
          name: user.username || (userAny.realName as string) || "用户",
          employeeId: (userAny.employeeId as string) || `WH${String(user.id || 1).padStart(3, '0')}`,
          phone: phone ? `${phone.substring(0, 3)}****${phone.substring(7)}` : "",
          email: user.email || "",
          factory: user.factoryId || "白垩纪食品加工厂",
          department: (userAny.departmentName as string) || (userAny.department as string) || "仓储部",
          position: (userAny.roleName as string) || "仓储管理员",
          joinDate: user.createdAt ? (user.createdAt.split('T')[0] || "") : "",
        });
      }

      // 尝试从API获取更多详细信息
      if (user?.id) {
        try {
          const userDetail = await userApiClient.getUserById(user.id) as {
            realName?: string;
            username?: string;
            email?: string;
            departmentName?: string;
          } | null;
          if (userDetail) {
            setProfileData(prev => ({
              ...prev,
              name: userDetail.realName || userDetail.username || prev.name,
              email: userDetail.email || prev.email,
              department: userDetail.departmentName || prev.department,
            }));
          }
        } catch {
          // API调用失败，继续使用store中的数据
        }
      }
    } catch (error) {
      handleError(error, { title: '加载用户信息失败' });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadUserProfile();
  }, [loadUserProfile]);

  // 保存用户信息
  const handleSave = async () => {
    setSubmitting(true);
    try {
      if (user?.id) {
        await userApiClient.updateUser(user.id, {
          realName: profileData.name,
          email: profileData.email,
        });
      }
      Alert.alert("成功", "个人信息已保存", [
        { text: "确定", onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      handleError(error, { title: '保存失败' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleChangePhone = () => {
    Alert.alert("更换手机号", "请联系管理员更换绑定手机号");
  };

  const handleChangePassword = () => {
    Alert.alert("修改密码", "密码修改功能");
  };

  const handleDeviceBinding = () => {
    Alert.alert("设备绑定", "当前设备已绑定");
  };

  const handleChangeAvatar = () => {
    Alert.alert("更换头像", "选择新头像");
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
            <Text style={styles.headerTitle}>个人信息</Text>
            <Text style={styles.headerSubtitle}>编辑个人资料</Text>
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
          <Text style={styles.headerTitle}>个人信息</Text>
          <Text style={styles.headerSubtitle}>编辑个人资料</Text>
        </View>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* 头像区域 */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarLarge}>
            <Text style={styles.avatarIcon}>
              {profileData.name.charAt(0)}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.avatarChangeBtn}
            onPress={handleChangeAvatar}
          >
            <Text style={styles.avatarChangeBtnText}>更换头像</Text>
          </TouchableOpacity>
        </View>

        {/* 基本信息 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>基本信息</Text>

          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>姓名</Text>
            <TextInput
              mode="outlined"
              value={profileData.name}
              onChangeText={(text) =>
                setProfileData({ ...profileData, name: text })
              }
              style={styles.formInput}
              outlineStyle={styles.inputOutline}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>工号</Text>
            <TextInput
              mode="outlined"
              value={profileData.employeeId}
              disabled
              style={styles.formInput}
              outlineStyle={styles.inputOutline}
            />
            <Text style={styles.formHint}>工号不可修改</Text>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>手机号</Text>
            <View style={styles.inputWithAction}>
              <TextInput
                mode="outlined"
                value={profileData.phone}
                disabled
                style={[styles.formInput, styles.flexInput]}
                outlineStyle={styles.inputOutline}
              />
              <TouchableOpacity
                style={styles.inputActionBtn}
                onPress={handleChangePhone}
              >
                <Text style={styles.inputActionBtnText}>更换</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>邮箱</Text>
            <TextInput
              mode="outlined"
              value={profileData.email}
              onChangeText={(text) =>
                setProfileData({ ...profileData, email: text })
              }
              placeholder="请输入邮箱"
              keyboardType="email-address"
              style={styles.formInput}
              outlineStyle={styles.inputOutline}
            />
          </View>
        </View>

        {/* 工作信息 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>工作信息</Text>

          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>所属工厂</Text>
            <TextInput
              mode="outlined"
              value={profileData.factory}
              disabled
              style={styles.formInput}
              outlineStyle={styles.inputOutline}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>部门</Text>
            <TextInput
              mode="outlined"
              value={profileData.department}
              disabled
              style={styles.formInput}
              outlineStyle={styles.inputOutline}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>职位</Text>
            <TextInput
              mode="outlined"
              value={profileData.position}
              disabled
              style={styles.formInput}
              outlineStyle={styles.inputOutline}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>入职日期</Text>
            <TextInput
              mode="outlined"
              value={profileData.joinDate}
              disabled
              style={styles.formInput}
              outlineStyle={styles.inputOutline}
            />
          </View>
        </View>

        {/* 安全设置 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>安全设置</Text>

          <TouchableOpacity style={styles.menuItem} onPress={handleChangePassword}>
            <MaterialCommunityIcons name="lock-outline" size={20} color="#666" />
            <Text style={styles.menuText}>修改密码</Text>
            <MaterialCommunityIcons name="chevron-right" size={20} color="#999" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={handleDeviceBinding}>
            <MaterialCommunityIcons name="cellphone-link" size={20} color="#666" />
            <Text style={styles.menuText}>设备绑定</Text>
            <Text style={styles.menuDesc}>已绑定</Text>
            <MaterialCommunityIcons name="chevron-right" size={20} color="#999" />
          </TouchableOpacity>

          <View style={styles.menuItem}>
            <MaterialCommunityIcons name="fingerprint" size={20} color="#666" />
            <Text style={styles.menuText}>指纹登录</Text>
            <Switch
              value={fingerprintEnabled}
              onValueChange={setFingerprintEnabled}
              color="#4CAF50"
            />
          </View>
        </View>

        {/* 操作按钮 */}
        <View style={styles.actionButtons}>
          <Button
            mode="outlined"
            onPress={() => navigation.goBack()}
            style={styles.actionBtnSecondary}
            labelStyle={{ color: "#666" }}
            disabled={submitting}
          >
            取消
          </Button>
          <Button
            mode="contained"
            onPress={handleSave}
            style={styles.actionBtnPrimary}
            labelStyle={{ color: "#fff" }}
            disabled={submitting}
            loading={submitting}
          >
            {submitting ? '保存中...' : '保存'}
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
  avatarSection: {
    alignItems: "center",
    paddingVertical: 24,
    backgroundColor: "#fff",
    marginBottom: 12,
  },
  avatarLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#4CAF50",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  avatarIcon: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#fff",
  },
  avatarChangeBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#4CAF50",
  },
  avatarChangeBtnText: {
    fontSize: 14,
    color: "#4CAF50",
  },
  section: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#999",
    marginBottom: 16,
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
    height: 44,
  },
  inputOutline: {
    borderRadius: 8,
  },
  formHint: {
    fontSize: 12,
    color: "#999",
    marginTop: 4,
  },
  inputWithAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  flexInput: {
    flex: 1,
  },
  inputActionBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
  },
  inputActionBtnText: {
    fontSize: 14,
    color: "#4CAF50",
    fontWeight: "500",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
    gap: 12,
  },
  menuText: {
    flex: 1,
    fontSize: 14,
    color: "#333",
  },
  menuDesc: {
    fontSize: 13,
    color: "#999",
    marginRight: 8,
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
});

export default WHProfileEditScreen;
