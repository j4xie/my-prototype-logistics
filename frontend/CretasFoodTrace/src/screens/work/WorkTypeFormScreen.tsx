import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { Text, Appbar, TextInput, Button, IconButton, Divider } from 'react-native-paper';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { ScreenWrapper, NeoCard, NeoButton } from '../../components/ui';
import { theme } from '../../theme';
import { WorkStackParamList } from '../../types/navigation';

type WorkTypeFormRouteProp = RouteProp<WorkStackParamList, 'WorkTypeForm'>;

export default function WorkTypeFormScreen() {
  const navigation = useNavigation();
  const route = useRoute<WorkTypeFormRouteProp>();
  const { workTypeCode, workTypeName } = route.params;

  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Form Data
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [batchId, setBatchId] = useState(''); // Optional: if work is batch-specific

  const getIconForType = (code: string) => {
    if (code.includes('RECEIVE')) return 'truck-delivery';
    if (code.includes('INSPECT')) return 'magnify-scan';
    if (code.includes('PROCESS')) return 'cog-outline';
    if (code.includes('PACKAGE')) return 'package-variant';
    if (code.includes('STORAGE')) return 'fridge-outline';
    return 'briefcase-outline';
  };

  const handleNext = () => {
    if (currentStep === 2 && !quantity) {
      Alert.alert('提示', '请输入工作数量');
      return;
    }
    setCurrentStep(c => c + 1);
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      Alert.alert('提交成功', '工作记录已保存', [
        { text: '确定', onPress: () => navigation.goBack() }
      ]);
    } catch (error) {
      Alert.alert('失败', '请重试');
    } finally {
      setLoading(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1: // Task Info
        return (
          <View style={styles.stepContainer}>
            <Text variant="headlineSmall" style={styles.title}>第一步: 确认任务</Text>

            <NeoCard style={styles.taskCard} padding="l">
              <View style={styles.iconContainer}>
                <IconButton
                  icon={getIconForType(workTypeCode)}
                  size={64}
                  iconColor={theme.colors.primary}
                />
              </View>
              <Text variant="headlineMedium" style={styles.taskName}>{workTypeName}</Text>
              <Text variant="bodyLarge" style={styles.taskCode}>{workTypeCode}</Text>
            </NeoCard>

            <View style={styles.infoBox}>
              <Text style={styles.infoTitle}>💡 操作提示</Text>
              <Text style={styles.infoText}>
                请确认您当前正在进行的工作类型。点击"下一步"开始记录数据。
              </Text>
            </View>
          </View>
        );

      case 2: // Data Entry
        return (
          <View style={styles.stepContainer}>
            <Text variant="headlineSmall" style={styles.title}>第二步: 填写数据</Text>

            <Text style={styles.label}>工作数量</Text>
            <TextInput
              style={styles.bigInput}
              value={quantity}
              onChangeText={setQuantity}
              keyboardType="numeric"
              mode="outlined"
              placeholder="0"
              right={<TextInput.Affix text="件/kg" />}
            />

            <Text style={styles.label}>关联批次 (选填)</Text>
            <TextInput
              style={styles.input}
              value={batchId}
              onChangeText={setBatchId}
              mode="outlined"
              placeholder="扫描或输入批次号"
              right={<TextInput.Icon icon="barcode-scan" />}
            />

            <Text style={styles.label}>备注 (选填)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={notes}
              onChangeText={setNotes}
              mode="outlined"
              multiline
              numberOfLines={3}
              placeholder="如有特殊情况请说明"
            />
          </View>
        );

      case 3: // Confirm
        return (
          <View style={styles.stepContainer}>
            <Text variant="headlineSmall" style={styles.title}>第三步: 确认提交</Text>

            <NeoCard style={styles.summaryCard} padding="l">
              <View style={styles.row}>
                <Text style={styles.label}>任务:</Text>
                <Text style={styles.value}>{workTypeName}</Text>
              </View>
              <Divider style={styles.divider} />
              <View style={styles.row}>
                <Text style={styles.label}>数量:</Text>
                <Text style={styles.value}>{quantity}</Text>
              </View>
              {batchId ? (
                <>
                  <Divider style={styles.divider} />
                  <View style={styles.row}>
                    <Text style={styles.label}>批次:</Text>
                    <Text style={styles.value}>{batchId}</Text>
                  </View>
                </>
              ) : null}
              {notes ? (
                <>
                  <Divider style={styles.divider} />
                  <View style={styles.row}>
                    <Text style={styles.label}>备注:</Text>
                    <Text style={styles.value}>{notes}</Text>
                  </View>
                </>
              ) : null}
            </NeoCard>
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <ScreenWrapper edges={['top']} backgroundColor={theme.colors.background}>
      <Appbar.Header elevated>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title={`工作记录 (步骤 ${currentStep}/3)`} />
      </Appbar.Header>

      <ScrollView contentContainerStyle={styles.content}>
        {renderStep()}

        <View style={styles.actions}>
          {currentStep > 1 && (
            <Button mode="outlined" onPress={() => setCurrentStep(c => c - 1)} style={styles.btn}>
              上一步
            </Button>
          )}

          {currentStep < 3 ? (
            <Button mode="contained" onPress={handleNext} style={[styles.btn, { flex: 1 }]}>
              下一步
            </Button>
          ) : (
            <Button
              mode="contained"
              onPress={handleSubmit}
              loading={loading}
              style={[styles.btn, { flex: 1 }]}
              icon="check"
            >
              提交记录
            </Button>
          )}
        </View>
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 20,
    flexGrow: 1,
    justifyContent: 'space-between',
  },
  stepContainer: {
    gap: 20,
  },
  title: {
    fontWeight: 'bold',
    color: '#1976D2',
    marginBottom: 10,
    textAlign: 'center',
  },
  taskCard: {
    alignItems: 'center',
    paddingVertical: 30,
    backgroundColor: 'white',
  },
  iconContainer: {
    marginBottom: 16,
    backgroundColor: '#E3F2FD',
    borderRadius: 50,
    padding: 10,
  },
  taskName: {
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  taskCode: {
    color: '#666',
    fontSize: 16,
  },
  infoBox: {
    backgroundColor: '#FFF3E0',
    padding: 16,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  infoTitle: {
    fontWeight: 'bold',
    color: '#E65100',
    marginBottom: 4,
  },
  infoText: {
    color: '#F57C00',
  },
  label: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
    marginTop: 8,
  },
  bigInput: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    backgroundColor: 'white',
    marginBottom: 16,
  },
  input: {
    backgroundColor: 'white',
    marginBottom: 16,
  },
  textArea: {
    minHeight: 80,
  },
  summaryCard: {
    backgroundColor: 'white',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  value: {
    fontWeight: 'bold',
    fontSize: 18,
    flex: 1,
    textAlign: 'right',
  },
  divider: {
    backgroundColor: '#E0E0E0',
  },
  actions: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 40,
  },
  btn: {
    flex: 1,
    paddingVertical: 6,
  },
});
