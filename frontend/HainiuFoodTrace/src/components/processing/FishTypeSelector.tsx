import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  SafeAreaView,
  FlatList,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FISH_TYPES, FishType } from '../../types/costAccounting';

interface FishTypeSelectorProps {
  value?: string;
  onValueChange: (fishType: FishType) => void;
  label?: string;
  placeholder?: string;
}

/**
 * 鱼类品种选择器组件
 * - 常用品种快捷选择
 * - 搜索过滤
 * - 大卡片显示
 */
export const FishTypeSelector: React.FC<FishTypeSelectorProps> = ({
  value,
  onValueChange,
  label = '鱼类品种',
  placeholder = '请选择鱼类品种',
}) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const selectedFish = FISH_TYPES.find(fish => fish.name === value);

  // 过滤鱼类列表
  const filteredFishTypes = FISH_TYPES.filter(fish =>
    fish.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    fish.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    fish.category.includes(searchQuery)
  );

  // 常用鱼类(前5个)
  const commonFishTypes = FISH_TYPES.slice(0, 5);

  const handleSelect = (fish: FishType) => {
    onValueChange(fish);
    setModalVisible(false);
    setSearchQuery('');
  };

  const renderFishItem = ({ item }: { item: FishType }) => (
    <TouchableOpacity
      style={[
        styles.fishItem,
        item.name === value && styles.fishItemSelected,
      ]}
      onPress={() => handleSelect(item)}
    >
      <View style={styles.fishInfo}>
        <Text style={[
          styles.fishName,
          item.name === value && styles.fishNameSelected,
        ]}>
          {item.name}
        </Text>
        <Text style={styles.fishCategory}>{item.category}</Text>
      </View>
      <View style={styles.fishMeta}>
        {item.averagePrice && (
          <Text style={styles.fishPrice}>
            ¥{item.averagePrice}/kg
          </Text>
        )}
        {item.name === value && (
          <Ionicons name="checkmark-circle" size={24} color="#10B981" />
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <>
      {/* 触发按钮 */}
      <TouchableOpacity
        style={styles.trigger}
        onPress={() => setModalVisible(true)}
      >
        <View style={styles.triggerContent}>
          <Text style={styles.label}>{label}</Text>
          <View style={styles.valueContainer}>
            {selectedFish ? (
              <>
                <Text style={styles.value}>{selectedFish.name}</Text>
                <Text style={styles.category}>({selectedFish.category})</Text>
              </>
            ) : (
              <Text style={styles.placeholder}>{placeholder}</Text>
            )}
          </View>
        </View>
        <Ionicons name="chevron-forward" size={24} color="#9CA3AF" />
      </TouchableOpacity>

      {/* 选择器模态框 */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setModalVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          {/* 头部 */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Ionicons name="close" size={28} color="#6B7280" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{label}</Text>
            <View style={{ width: 28 }} />
          </View>

          {/* 搜索框 */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#9CA3AF" />
            <TextInput
              style={styles.searchInput}
              placeholder="搜索鱼类品种..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor="#9CA3AF"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </View>

          {/* 常用品种 */}
          {!searchQuery && (
            <View style={styles.commonSection}>
              <Text style={styles.sectionTitle}>常用品种</Text>
              <View style={styles.commonGrid}>
                {commonFishTypes.map((fish) => (
                  <TouchableOpacity
                    key={fish.id}
                    style={[
                      styles.commonItem,
                      fish.name === value && styles.commonItemSelected,
                    ]}
                    onPress={() => handleSelect(fish)}
                  >
                    <Text style={[
                      styles.commonItemText,
                      fish.name === value && styles.commonItemTextSelected,
                    ]}>
                      {fish.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* 分类标题 */}
          {searchQuery && (
            <View style={styles.resultsHeader}>
              <Text style={styles.resultsCount}>
                找到 {filteredFishTypes.length} 个结果
              </Text>
            </View>
          )}

          {/* 鱼类列表 */}
          <FlatList
            data={filteredFishTypes}
            renderItem={renderFishItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        </SafeAreaView>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  // 触发按钮样式
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  triggerContent: {
    flex: 1,
  },
  label: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  value: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
  },
  category: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 8,
  },
  placeholder: {
    fontSize: 18,
    color: '#9CA3AF',
  },

  // 模态框样式
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },

  // 搜索框
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 12,
    margin: 16,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1F2937',
  },

  // 常用品种
  commonSection: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  commonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  commonItem: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  commonItemSelected: {
    backgroundColor: '#D1FAE5',
    borderColor: '#10B981',
  },
  commonItemText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  commonItemTextSelected: {
    color: '#10B981',
  },

  // 搜索结果头部
  resultsHeader: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  resultsCount: {
    fontSize: 14,
    color: '#6B7280',
  },

  // 鱼类列表
  listContent: {
    padding: 16,
  },
  fishItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  fishItemSelected: {
    backgroundColor: '#D1FAE5',
    borderColor: '#10B981',
  },
  fishInfo: {
    flex: 1,
  },
  fishName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  fishNameSelected: {
    color: '#10B981',
  },
  fishCategory: {
    fontSize: 14,
    color: '#6B7280',
  },
  fishMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  fishPrice: {
    fontSize: 14,
    fontWeight: '500',
    color: '#3B82F6',
  },
});
