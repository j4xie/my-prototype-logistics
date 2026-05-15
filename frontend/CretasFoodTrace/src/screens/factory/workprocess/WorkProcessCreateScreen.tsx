/**
 * 工序新增 / 编辑表单
 *
 * 入口: WorkProcessListScreen → FAB / 长按
 * Track D2 — M-WP-1
 *
 * 客户原话 (六扇门第四次 line 76-86):
 *   "新增工序: 第一个工序叫拆包, 工序我选前处理, 产出单位是工金, 预估工时..."
 *   "主要是工序名称, 工序列表跟产出单位嘛, 预估工时选填 (有些不好控制)"
 */

import React, { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import {
  ActivityIndicator,
  Appbar,
  Button,
  Card,
  HelperText,
  Menu,
  Text,
  TextInput,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';

import { workProcessApiClient } from '../../../services/api/workProcessApiClient';
import { useAuthStore } from '../../../store/authStore';
import { getFactoryId } from '../../../types/auth';
import { logger } from '../../../utils/logger';
import type { ManagementStackParamList } from '../../../types/navigation';
import {
  WORK_PROCESS_CATEGORIES,
  WORK_PROCESS_UNIT_OPTIONS,
  type CreateWorkProcessRequest,
  type UpdateWorkProcessRequest,
} from '../../../types/workProcess';

const workProcessLogger = logger.createContextLogger('WorkProcessCreate');

type RoutePropType = RouteProp<ManagementStackParamList, 'WorkProcessCreate'>;

interface FormState {
  processName: string;
  processCategory: string;
  unit: string;
  estimatedMinutes: string; // string in form, parsed to number on submit
  description: string;
}

const INITIAL_FORM: FormState = {
  processName: '',
  processCategory: 'PRE_PROCESS',
  unit: '工金',
  estimatedMinutes: '',
  description: '',
};

export default function WorkProcessCreateScreen() {
  const navigation = useNavigation();
  const route = useRoute<RoutePropType>();
  const user = useAuthStore((state) => state.user);
  const factoryId = getFactoryId(user);

  const mode = route.params?.mode ?? 'create';
  const editingId = route.params?.id;
  const isEdit = mode === 'edit' && !!editingId;

  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  const [categoryMenuVisible, setCategoryMenuVisible] = useState(false);
  const [unitMenuVisible, setUnitMenuVisible] = useState(false);

  // Edit mode: 加载现有数据
  useEffect(() => {
    if (!isEdit || !factoryId || !editingId) return;
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        const wp = await workProcessApiClient.getWorkProcess(editingId, factoryId);
        if (cancelled) return;
        setForm({
          processName: wp.processName,
          processCategory: wp.processCategory ?? 'PRE_PROCESS',
          unit: wp.unit || '工金',
          estimatedMinutes:
            wp.estimatedMinutes !== undefined && wp.estimatedMinutes !== null
              ? String(wp.estimatedMinutes)
              : '',
          description: wp.description ?? '',
        });
      } catch (error) {
        const msg = error instanceof Error ? error.message : '加载工序失败';
        workProcessLogger.error('加载工序失败', error as Error, { id: editingId });
        Alert.alert('错误', msg, [{ text: '确定', onPress: () => navigation.goBack() }]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isEdit, factoryId, editingId, navigation]);

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => ({ ...prev, [key]: undefined }));
    }
  };

  const validate = (): boolean => {
    const next: Partial<Record<keyof FormState, string>> = {};
    if (!form.processName.trim()) {
      next.processName = '工序名称不能为空';
    } else if (form.processName.trim().length > 100) {
      next.processName = '工序名称不能超过 100 个字符';
    }
    if (!form.unit.trim()) {
      next.unit = '产出单位不能为空';
    }
    if (form.estimatedMinutes.trim()) {
      const parsed = Number(form.estimatedMinutes);
      if (!Number.isFinite(parsed) || parsed < 0 || !Number.isInteger(parsed)) {
        next.estimatedMinutes = '预估工时须为非负整数 (分钟)';
      }
    }
    if (form.description && form.description.length > 500) {
      next.description = '描述不能超过 500 个字符';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    if (!factoryId) {
      Alert.alert('错误', '无法获取工厂信息, 请重新登录');
      return;
    }

    const payload: CreateWorkProcessRequest = {
      processName: form.processName.trim(),
      processCategory: form.processCategory || undefined,
      unit: form.unit.trim(),
      estimatedMinutes: form.estimatedMinutes.trim()
        ? Number(form.estimatedMinutes)
        : undefined,
      description: form.description.trim() || undefined,
    };

    try {
      setSaving(true);
      if (isEdit && editingId) {
        const updatePayload: UpdateWorkProcessRequest = { ...payload };
        await workProcessApiClient.updateWorkProcess(editingId, updatePayload, factoryId);
        workProcessLogger.info('更新工序成功', { id: editingId });
      } else {
        const created = await workProcessApiClient.createWorkProcess(payload, factoryId);
        workProcessLogger.info('创建工序成功', { id: created.id, name: created.processName });
      }
      navigation.goBack();
    } catch (error) {
      const msg = error instanceof Error ? error.message : '保存失败';
      workProcessLogger.error('保存工序失败', error as Error);
      Alert.alert('错误', msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Appbar.Header>
          <Appbar.BackAction onPress={() => navigation.goBack()} />
          <Appbar.Content title={isEdit ? '编辑工序' : '新增工序'} />
        </Appbar.Header>
        <View style={styles.centerArea}>
          <ActivityIndicator size="large" />
        </View>
      </SafeAreaView>
    );
  }

  const categoryLabel =
    WORK_PROCESS_CATEGORIES.find((c) => c.value === form.processCategory)?.label ?? '选择类别';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content
          title={isEdit ? '编辑工序' : '新增工序'}
          subtitle={isEdit ? `ID: ${editingId}` : undefined}
        />
      </Appbar.Header>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll}>
          <Card style={styles.card}>
            <Card.Content>
              <Text variant="titleSmall" style={styles.sectionTitle}>
                基础信息
              </Text>

              <TextInput
                label="工序名称 *"
                value={form.processName}
                onChangeText={(v) => updateField('processName', v)}
                placeholder="如: 拆包"
                mode="outlined"
                style={styles.input}
                error={!!errors.processName}
              />
              {errors.processName ? (
                <HelperText type="error">{errors.processName}</HelperText>
              ) : null}

              <Menu
                visible={categoryMenuVisible}
                onDismiss={() => setCategoryMenuVisible(false)}
                anchorPosition="bottom"
                anchor={
                  <TextInput
                    label="工序类别"
                    value={categoryLabel}
                    mode="outlined"
                    editable={false}
                    style={styles.input}
                    right={
                      <TextInput.Icon icon="menu-down" onPress={() => setCategoryMenuVisible(true)} />
                    }
                    onPressIn={() => setCategoryMenuVisible(true)}
                  />
                }
              >
                {WORK_PROCESS_CATEGORIES.map((opt) => (
                  <Menu.Item
                    key={opt.value}
                    title={opt.label}
                    onPress={() => {
                      updateField('processCategory', opt.value);
                      setCategoryMenuVisible(false);
                    }}
                  />
                ))}
              </Menu>

              <Menu
                visible={unitMenuVisible}
                onDismiss={() => setUnitMenuVisible(false)}
                anchorPosition="bottom"
                anchor={
                  <TextInput
                    label="产出单位 *"
                    value={form.unit}
                    onChangeText={(v) => updateField('unit', v)}
                    placeholder="如: 工金"
                    mode="outlined"
                    style={styles.input}
                    error={!!errors.unit}
                    right={
                      <TextInput.Icon icon="menu-down" onPress={() => setUnitMenuVisible(true)} />
                    }
                  />
                }
              >
                {WORK_PROCESS_UNIT_OPTIONS.map((opt) => (
                  <Menu.Item
                    key={opt}
                    title={opt}
                    onPress={() => {
                      updateField('unit', opt);
                      setUnitMenuVisible(false);
                    }}
                  />
                ))}
              </Menu>
              {errors.unit ? <HelperText type="error">{errors.unit}</HelperText> : null}

              <TextInput
                label="预估工时 (分钟, 选填)"
                value={form.estimatedMinutes}
                onChangeText={(v) => updateField('estimatedMinutes', v.replace(/[^0-9]/g, ''))}
                placeholder="如: 30"
                mode="outlined"
                keyboardType="number-pad"
                style={styles.input}
                error={!!errors.estimatedMinutes}
              />
              {errors.estimatedMinutes ? (
                <HelperText type="error">{errors.estimatedMinutes}</HelperText>
              ) : (
                <HelperText type="info">
                  客户原话: "有些飞镖不好控制, 这个是选填的"
                </HelperText>
              )}

              <TextInput
                label="描述 (选填)"
                value={form.description}
                onChangeText={(v) => updateField('description', v)}
                placeholder="工序说明 / SOP 备注"
                mode="outlined"
                multiline
                numberOfLines={3}
                style={styles.input}
                error={!!errors.description}
              />
              {errors.description ? (
                <HelperText type="error">{errors.description}</HelperText>
              ) : null}
            </Card.Content>
          </Card>

          <Button
            mode="contained"
            onPress={handleSubmit}
            loading={saving}
            disabled={saving}
            style={styles.submitBtn}
          >
            {isEdit ? '保存修改' : '创建工序'}
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  flex: {
    flex: 1,
  },
  centerArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scroll: {
    padding: 12,
    paddingBottom: 40,
  },
  card: {
    marginBottom: 12,
  },
  sectionTitle: {
    marginBottom: 12,
    fontWeight: '600',
    color: '#444',
  },
  input: {
    marginBottom: 8,
  },
  submitBtn: {
    marginTop: 12,
    paddingVertical: 6,
  },
});
