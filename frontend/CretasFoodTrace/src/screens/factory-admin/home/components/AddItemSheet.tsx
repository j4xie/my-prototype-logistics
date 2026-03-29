/**
 * AddItemSheet - Bottom sheet overlay for adding modules, stat cards, or quick actions
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Icon } from 'react-native-paper';

interface AddItemSheetItem {
  id: string;
  label: string;
  icon?: string;
  color?: string;
}

interface AddItemSheetProps {
  title: string;
  items: AddItemSheetItem[];
  onSelect: (id: string) => void;
  onClose: () => void;
}

export function AddItemSheet({ title, items, onSelect, onClose }: AddItemSheetProps) {
  return (
    <View style={styles.overlay}>
      <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} />
      <View style={styles.sheet}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <TouchableOpacity onPress={onClose}>
            <Icon source="close" size={24} color="#666" />
          </TouchableOpacity>
        </View>
        <View style={styles.list}>
          {items.map(item => (
            <TouchableOpacity
              key={item.id}
              style={styles.item}
              onPress={() => onSelect(item.id)}
            >
              {item.icon && item.color ? (
                <View style={[styles.itemIcon, { backgroundColor: `${item.color}15` }]}>
                  <Icon source={item.icon} size={20} color={item.color} />
                </View>
              ) : (
                <Icon source="plus-circle" size={24} color="#48bb78" />
              )}
              <Text style={styles.itemText}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 16,
    paddingBottom: 32,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a202c',
  },
  list: {
    gap: 12,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f7fafc',
    borderRadius: 12,
    gap: 12,
  },
  itemText: {
    fontSize: 16,
    color: '#2d3748',
  },
  itemIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
