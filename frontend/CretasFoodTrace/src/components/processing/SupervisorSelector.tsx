import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Modal, FlatList, TouchableOpacity } from 'react-native';
import { TextInput, List, Divider, Button, Text, Searchbar, ActivityIndicator } from 'react-native-paper';
import { employeeAPI, Employee } from '../../services/api/employeeApiClient';

interface SupervisorSelectorProps {
  value: string;
  onSelect: (supervisorName: string, supervisorId?: number) => void;
  label?: string;
  placeholder?: string;
  error?: string;
}

/**
 * 负责人选择器
 * 从员工列表选择生产负责人
 */
export const SupervisorSelector: React.FC<SupervisorSelectorProps> = ({
  value,
  onSelect,
  label = '生产负责人',
  placeholder = '选择负责人',
  error,
}) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (modalVisible) {
      fetchEmployees();
    }
  }, [modalVisible]);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const result = await employeeAPI.getEmployees({ department: 'processing' });
      console.log('✅ Employees loaded:', result.length);
      setEmployees(result);
    } catch (error) {
      console.error('❌ Failed to fetch employees:', error);
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredEmployees = employees.filter(emp =>
    emp.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    emp.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelect = (employee: Employee) => {
    onSelect(employee.fullName, employee.id);
    setModalVisible(false);
    setSearchQuery('');
  };

  return (
    <View>
      <TouchableOpacity
        onPress={() => {
          console.log('👤 Opening supervisor selector');
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
            right={<TextInput.Icon icon="account" />}
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
              <Text variant="titleLarge">选择生产负责人</Text>
              <Button onPress={() => setModalVisible(false)}>取消</Button>
            </View>

            <Searchbar
              placeholder="搜索员工姓名..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={styles.searchBar}
            />

            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" />
              </View>
            ) : (
              <FlatList
                data={filteredEmployees}
                keyExtractor={item => item.id.toString()}
                renderItem={({ item }) => (
                  <>
                    <List.Item
                      title={item.fullName}
                      description={`${item.username}${item.department ? ` · ${item.department}` : ''}`}
                      onPress={() => handleSelect(item)}
                      right={props => value === item.fullName ? <List.Icon {...props} icon="check" color="#2196F3" /> : null}
                      left={props => <List.Icon {...props} icon="account-circle" />}
                    />
                    <Divider />
                  </>
                )}
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <Text variant="bodyMedium" style={styles.emptyText}>
                      未找到员工
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
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    color: '#9E9E9E',
  },
});

export default SupervisorSelector;
