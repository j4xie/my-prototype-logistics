import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Modal,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

export interface DropdownOption {
  label: string;
  value: string;
  description?: string;
}

interface SearchableDropdownProps {
  label: string;
  required?: boolean;
  placeholder?: string;
  options: DropdownOption[];
  value: string;
  onSelect: (value: string) => void;
  loading?: boolean;
  allowCustom?: boolean;
  testID?: string;
}

export default function SearchableDropdown({
  label,
  required,
  placeholder = '请选择',
  options,
  value,
  onSelect,
  loading,
  allowCustom = true,
  testID,
}: SearchableDropdownProps) {
  const [visible, setVisible] = useState(false);
  const [search, setSearch] = useState('');
  const [customMode, setCustomMode] = useState(false);

  const filtered = useMemo(() => {
    if (!search.trim()) return options;
    const q = search.trim().toLowerCase();
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q)
    );
  }, [options, search]);

  const displayText = useMemo(() => {
    if (!value) return '';
    const found = options.find((o) => o.value === value);
    return found ? found.label : value;
  }, [value, options]);

  const handleSelect = (opt: DropdownOption) => {
    onSelect(opt.value);
    setVisible(false);
    setSearch('');
    setCustomMode(false);
  };

  const handleCustomSubmit = () => {
    if (search.trim()) {
      onSelect(search.trim());
      setVisible(false);
      setSearch('');
      setCustomMode(false);
    }
  };

  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>
        {label} {required && <Text style={styles.required}>*</Text>}
      </Text>
      <TouchableOpacity
        testID={testID}
        style={styles.selector}
        onPress={() => setVisible(true)}
      >
        <Text style={[styles.selectorText, !value && styles.placeholder]}>
          {displayText || placeholder}
        </Text>
        <MaterialCommunityIcons name="chevron-down" size={20} color="#9CA3AF" />
      </TouchableOpacity>

      <Modal visible={visible} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{label}</Text>
              <TouchableOpacity onPress={() => { setVisible(false); setSearch(''); setCustomMode(false); }}>
                <MaterialCommunityIcons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {/* Search */}
            <View style={styles.searchBox}>
              <MaterialCommunityIcons name="magnify" size={20} color="#9CA3AF" />
              <TextInput
                style={styles.searchInput}
                placeholder="搜索..."
                value={search}
                onChangeText={setSearch}
                autoFocus
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch('')}>
                  <MaterialCommunityIcons name="close-circle" size={18} color="#9CA3AF" />
                </TouchableOpacity>
              )}
            </View>

            {/* Options list */}
            {loading ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>加载中...</Text>
              </View>
            ) : (
              <FlatList
                data={filtered}
                keyExtractor={(item) => item.value}
                style={styles.list}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.option, item.value === value && styles.optionSelected]}
                    onPress={() => handleSelect(item)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.optionText, item.value === value && styles.optionTextSelected]}>
                        {item.label}
                      </Text>
                      {item.description ? (
                        <Text style={styles.optionDesc}>{item.description}</Text>
                      ) : null}
                    </View>
                    {item.value === value && (
                      <MaterialCommunityIcons name="check" size={20} color="#4F46E5" />
                    )}
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyText}>无匹配选项</Text>
                  </View>
                }
              />
            )}

            {/* Custom input option */}
            {allowCustom && (
              <TouchableOpacity
                style={styles.customOption}
                onPress={() => {
                  if (search.trim()) {
                    handleCustomSubmit();
                  } else {
                    setCustomMode(true);
                  }
                }}
              >
                <MaterialCommunityIcons name="pencil-plus-outline" size={18} color="#4F46E5" />
                <Text style={styles.customOptionText}>
                  {search.trim() ? `使用 "${search.trim()}"` : '其他（手动输入）'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  fieldGroup: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 6 },
  required: { color: '#EF4444' },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  selectorText: { flex: 1, fontSize: 15, color: '#1F2937' },
  placeholder: { color: '#9CA3AF' },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '70%',
    paddingBottom: 30,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: { fontSize: 16, fontWeight: '600', color: '#1F2937' },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginVertical: 10,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 6,
  },
  searchInput: { flex: 1, fontSize: 15, color: '#1F2937', padding: 0 },
  list: { maxHeight: 300 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F3F4F6',
  },
  optionSelected: { backgroundColor: '#EEF2FF' },
  optionText: { fontSize: 15, color: '#1F2937' },
  optionTextSelected: { color: '#4F46E5', fontWeight: '600' },
  optionDesc: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  emptyState: { padding: 30, alignItems: 'center' },
  emptyText: { fontSize: 14, color: '#9CA3AF' },
  customOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 8,
  },
  customOptionText: { fontSize: 14, color: '#4F46E5', fontWeight: '500' },
});
