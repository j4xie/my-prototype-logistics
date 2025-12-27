/**
 * 开始新批次页面
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Icon } from 'react-native-paper';

export function BatchStartScreen() {
  const navigation = useNavigation();
  const [selectedProduct, setSelectedProduct] = useState('');
  const [targetQuantity, setTargetQuantity] = useState('');
  const [notes, setNotes] = useState('');

  // 模拟产品列表
  const products = [
    { id: '1', name: '带鱼片', unit: 'kg' },
    { id: '2', name: '鲈鱼片', unit: 'kg' },
    { id: '3', name: '黄鱼片', unit: 'kg' },
    { id: '4', name: '银鲳鱼片', unit: 'kg' },
  ];

  const handleSubmit = () => {
    if (!selectedProduct) {
      Alert.alert('提示', '请选择产品');
      return;
    }
    if (!targetQuantity) {
      Alert.alert('提示', '请输入目标产量');
      return;
    }

    Alert.alert(
      '确认创建',
      `确定创建新批次吗？\n产品：${products.find(p => p.id === selectedProduct)?.name}\n目标产量：${targetQuantity}kg`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确认',
          onPress: () => {
            Alert.alert('成功', '批次已创建', [
              { text: '确定', onPress: () => navigation.goBack() }
            ]);
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 头部 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon source="close" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>创建批次</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* 产品选择 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>选择产品 *</Text>
          <View style={styles.productGrid}>
            {products.map((product) => (
              <TouchableOpacity
                key={product.id}
                style={[
                  styles.productCard,
                  selectedProduct === product.id && styles.productCardSelected,
                ]}
                onPress={() => setSelectedProduct(product.id)}
              >
                <Text
                  style={[
                    styles.productName,
                    selectedProduct === product.id && styles.productNameSelected,
                  ]}
                >
                  {product.name}
                </Text>
                {selectedProduct === product.id && (
                  <Icon source="check-circle" size={20} color="#667eea" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 目标产量 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>目标产量 (kg) *</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              value={targetQuantity}
              onChangeText={setTargetQuantity}
              keyboardType="numeric"
              placeholder="请输入目标产量"
              placeholderTextColor="#999"
            />
            <Text style={styles.inputUnit}>kg</Text>
          </View>
        </View>

        {/* 备注 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>备注 (可选)</Text>
          <TextInput
            style={styles.textArea}
            value={notes}
            onChangeText={setNotes}
            placeholder="输入备注信息..."
            placeholderTextColor="#999"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* 提示信息 */}
        <View style={styles.infoCard}>
          <Icon source="information-outline" size={20} color="#1890ff" />
          <Text style={styles.infoText}>
            创建批次后，系统将自动分配工位、设备和人员。请在任务开始前完成任务引导流程。
          </Text>
        </View>
      </ScrollView>

      {/* 底部按钮 */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.cancelBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.cancelBtnText}>取消</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit}>
          <Text style={styles.submitBtnText}>创建批次</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#667eea',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  productGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  productCard: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 14,
    borderWidth: 2,
    borderColor: '#e0e0e0',
  },
  productCardSelected: {
    borderColor: '#667eea',
    backgroundColor: '#f0f5ff',
  },
  productName: {
    fontSize: 15,
    color: '#333',
  },
  productNameSelected: {
    color: '#667eea',
    fontWeight: '600',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  input: {
    flex: 1,
    padding: 14,
    fontSize: 16,
    color: '#333',
  },
  inputUnit: {
    paddingHorizontal: 16,
    fontSize: 14,
    color: '#999',
  },
  textArea: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 14,
    fontSize: 14,
    color: '#333',
    height: 100,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: '#e6f7ff',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#91d5ff',
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#1890ff',
    marginLeft: 8,
    lineHeight: 18,
  },
  footer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 14,
  },
  cancelBtnText: {
    fontSize: 16,
    color: '#666',
  },
  submitBtn: {
    flex: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#667eea',
    borderRadius: 8,
    padding: 14,
  },
  submitBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});

export default BatchStartScreen;
