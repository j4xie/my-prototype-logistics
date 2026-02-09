/**
 * ChartDimensionSwitcher
 *
 * A component for switching chart dimensions (X-axis, series, measures).
 * Displays available options as chips and highlights the selected one.
 *
 * @version 1.0.0
 * @since 2026-01-30
 */

import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Text, Chip } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import type { AlternativeDimension } from '../../types/smartbi';

/**
 * ChartDimensionSwitcher Props
 */
export interface ChartDimensionSwitcherProps {
  /** Available dimension options */
  options: AlternativeDimension[];
  /** Currently selected field name */
  selected?: string;
  /** Callback when selection changes */
  onChange: (fieldName: string) => void;
  /** Label text */
  label?: string;
  /** Show icon in chips */
  showIcon?: boolean;
  /** Disabled state */
  disabled?: boolean;
  /** Compact mode (smaller chips) */
  compact?: boolean;
}

/**
 * Get icon for semantic type
 */
function getSemanticIcon(type: AlternativeDimension['semanticType']): string {
  switch (type) {
    case 'dimension':
      return 'shape-outline';
    case 'measure':
      return 'chart-bar';
    case 'time':
      return 'clock-outline';
    default:
      return 'circle-outline';
  }
}

/**
 * ChartDimensionSwitcher Component
 */
export default function ChartDimensionSwitcher({
  options,
  selected,
  onChange,
  label,
  showIcon = true,
  disabled = false,
  compact = false,
}: ChartDimensionSwitcherProps): React.ReactElement | null {
  // Don't render if there's only one option or no options
  if (options.length <= 1) {
    return null;
  }

  // Find selected option (by selected prop or by option.selected flag)
  const selectedField = selected || options.find(opt => opt.selected)?.fieldName;

  return (
    <View style={styles.container}>
      {/* Label */}
      {label && (
        <View style={styles.labelContainer}>
          <MaterialCommunityIcons
            name="tune-variant"
            size={14}
            color="#6B7280"
          />
          <Text style={styles.label}>{label}</Text>
        </View>
      )}

      {/* Options */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {options.map((option) => {
          const isSelected = option.fieldName === selectedField;

          return (
            <Chip
              key={option.fieldName}
              mode={isSelected ? 'flat' : 'outlined'}
              selected={isSelected}
              onPress={() => !disabled && onChange(option.fieldName)}
              disabled={disabled}
              icon={
                showIcon
                  ? () => (
                      <MaterialCommunityIcons
                        name={getSemanticIcon(option.semanticType) as any}
                        size={compact ? 14 : 16}
                        color={isSelected ? '#FFFFFF' : '#6B7280'}
                      />
                    )
                  : undefined
              }
              style={[
                styles.chip,
                isSelected && styles.chipSelected,
                compact && styles.chipCompact,
                disabled && styles.chipDisabled,
              ]}
              textStyle={[
                styles.chipText,
                isSelected && styles.chipTextSelected,
                compact && styles.chipTextCompact,
              ]}
              compact={compact}
            >
              {option.displayName}
            </Chip>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  labelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    marginLeft: 4,
    gap: 4,
  },
  label: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  scrollContent: {
    paddingHorizontal: 4,
    gap: 8,
  },
  chip: {
    backgroundColor: '#F9FAFB',
    borderColor: '#E5E7EB',
    marginRight: 0,
  },
  chipSelected: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  chipCompact: {
    height: 28,
  },
  chipDisabled: {
    opacity: 0.5,
  },
  chipText: {
    color: '#4B5563',
    fontSize: 13,
  },
  chipTextSelected: {
    color: '#FFFFFF',
  },
  chipTextCompact: {
    fontSize: 12,
  },
});
