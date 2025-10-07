import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Modal, FlatList, TouchableOpacity } from 'react-native';
import { TextInput, List, Divider, Button, Text, Searchbar, ActivityIndicator } from 'react-native-paper';
import { productTypeApiClient } from '../../services/api/productTypeApiClient';

interface ProductType {
  id: string;
  name: string;
  code: string;
  category?: string;
  description?: string;
}

interface ProductTypeSelectorProps {
  value: string;  // 显示的产品名称
  onSelect: (productTypeId: string, productTypeName: string, productTypeCode: string) => void;
  label?: string;
  placeholder?: string;
  error?: string;
}

/**
 * 产品类型(SKU)选择器
 * 注意: 不支持快捷添加，SKU由管理员预先配置
 */
export const ProductTypeSelector: React.FC<ProductTypeSelectorProps> = ({
  value,
  onSelect,
  label = '产品类型',
  placeholder = '选择产品类型',
  error,
}) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [productTypes, setProductTypes] = useState<ProductType[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (modalVisible) {
      fetchProductTypes();
    }
  }, [modalVisible]);

  const fetchProductTypes = async () => {
    try {
      setLoading(true);
      const result = await productTypeApiClient.getProductTypes({ isActive: true, limit: 100 });
      console.log('✅ Product types loaded:', result.data.productTypes.length);
      setProductTypes(result.data.productTypes);
    } catch (error) {
      console.error('❌ Failed to fetch product types:', error);
      setProductTypes([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredProductTypes = productTypes.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.category?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelect = (product: ProductType) => {
    onSelect(product.id, product.name, product.code);
    setModalVisible(false);
    setSearchQuery('');
  };

  return (
    <View>
      <TouchableOpacity
        onPress={() => {
          console.log('🔍 Opening product type selector');
          setModalVisible(true);
        }}
        activeOpacity={1}
      >
        <View pointerEvents="none">
          <TextInput
            label={label + ' *'}
            placeholder={placeholder}
            mode="outlined"
            value={value}
            editable={false}
            error={!!error}
            right={<TextInput.Icon icon="chevron-down" />}
            style={styles.input}
          />
        </View>
      </TouchableOpacity>
      {error && <Text variant="bodySmall" style={styles.errorText}>{error}</Text>}

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text variant="titleLarge">选择{label}</Text>
              <Button onPress={() => setModalVisible(false)}>取消</Button>
            </View>

            <Searchbar
              placeholder="搜索产品/SKU..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={styles.searchBar}
            />

            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" />
                <Text style={styles.loadingText}>加载中...</Text>
              </View>
            ) : (
              <FlatList
                data={filteredProductTypes}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <>
                    <List.Item
                      title={item.name}
                      description={`SKU: ${item.code}${item.category ? ' • ' + item.category : ''}`}
                      onPress={() => handleSelect(item)}
                      right={props => value === item.name ? <List.Icon {...props} icon="check" color="#2196F3" /> : null}
                    />
                    <Divider />
                  </>
                )}
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <Text variant="bodyMedium" style={styles.emptyText}>
                      {searchQuery ? '未找到匹配的产品类型' : '暂无产品类型'}
                    </Text>
                    <Text variant="bodySmall" style={styles.emptyHint}>
                      请联系管理员添加产品SKU
                    </Text>
                  </View>
                }
                ListFooterComponent={
                  <View style={styles.footerNote}>
                    <Text variant="bodySmall" style={styles.noteText}>
                      💡 提示: 产品SKU由管理员统一配置
                    </Text>
                  </View>
                }
              />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  input: {
    marginBottom: 4,
  },
  errorText: {
    color: '#F44336',
    marginTop: 4,
    marginLeft: 12,
    marginBottom: 8,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  searchBar: {
    margin: 16,
  },
  loadingContainer: {
    padding: 48,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#757575',
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    color: '#9E9E9E',
    marginBottom: 8,
  },
  emptyHint: {
    color: '#BDBDBD',
    fontSize: 12,
  },
  footerNote: {
    padding: 16,
    marginTop: 8,
    marginHorizontal: 16,
    backgroundColor: '#FFF9C4',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#FBC02D',
  },
  noteText: {
    color: '#F57F17',
    fontSize: 12,
  },
});

export default ProductTypeSelector;
