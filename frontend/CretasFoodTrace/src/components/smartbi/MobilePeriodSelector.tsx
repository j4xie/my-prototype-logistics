import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Platform,
  Dimensions,
} from 'react-native';
import { Text, Surface, Switch, IconButton } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { CHART_COLORS } from './chartSizes';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * Period type enumeration
 */
export type PeriodType = 'month' | 'quarter' | 'year' | 'month_range' | 'quarter_range' | 'custom';

/**
 * Quick option configuration
 */
export interface QuickOption {
  /** Option key */
  key: string;
  /** Display label */
  label: string;
  /** Function to compute the period selection */
  getValue: () => Omit<PeriodSelection, 'compareEnabled'>;
}

/**
 * Period selection state
 */
export interface PeriodSelection {
  /** Period type */
  type: PeriodType;
  /** Selected year */
  year: number;
  /** Selected value - single value for month/quarter/year, tuple for ranges */
  value: string | [string, string];
  /** Whether YoY comparison is enabled */
  compareEnabled: boolean;
}

/**
 * MobilePeriodSelector Props
 */
export interface MobilePeriodSelectorProps {
  /** Current selection value */
  value: PeriodSelection;
  /** Callback when selection changes */
  onChange: (selection: PeriodSelection) => void;
  /** Show YoY comparison toggle (default: true) */
  showYoYToggle?: boolean;
  /** Custom quick options (uses defaults if not provided) */
  quickOptions?: QuickOption[];
  /** Disabled state */
  disabled?: boolean;
}

/**
 * Month labels in Chinese
 */
const MONTHS = [
  '1月', '2月', '3月', '4月', '5月', '6月',
  '7月', '8月', '9月', '10月', '11月', '12月',
];

/**
 * Month values
 */
const MONTH_VALUES = [
  '01', '02', '03', '04', '05', '06',
  '07', '08', '09', '10', '11', '12',
];

/**
 * Quarter labels
 */
const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'];

/**
 * Quarter values
 */
const QUARTER_VALUES = ['Q1', 'Q2', 'Q3', 'Q4'];

/**
 * Period type tabs configuration
 */
const PERIOD_TYPES: { type: PeriodType; label: string }[] = [
  { type: 'month', label: '单月' },
  { type: 'quarter', label: '季度' },
  { type: 'year', label: '全年' },
  { type: 'month_range', label: '月范围' },
  { type: 'quarter_range', label: '季范围' },
];

/**
 * Get current date info for default quick options
 */
function getCurrentDateInfo() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-12
  const quarter = Math.ceil(month / 3);
  return { year, month, quarter };
}

/**
 * Default quick options
 */
function getDefaultQuickOptions(): QuickOption[] {
  const { year, month, quarter } = getCurrentDateInfo();
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevMonthYear = month === 1 ? year - 1 : year;
  const prevQuarter = quarter === 1 ? 4 : quarter - 1;
  const prevQuarterYear = quarter === 1 ? year - 1 : year;

  return [
    {
      key: 'current_month',
      label: '本月',
      getValue: () => ({
        type: 'month',
        year,
        value: month.toString().padStart(2, '0'),
      }),
    },
    {
      key: 'prev_month',
      label: '上月',
      getValue: () => ({
        type: 'month',
        year: prevMonthYear,
        value: prevMonth.toString().padStart(2, '0'),
      }),
    },
    {
      key: 'current_quarter',
      label: '本季',
      getValue: () => ({
        type: 'quarter',
        year,
        value: `Q${quarter}`,
      }),
    },
    {
      key: 'prev_quarter',
      label: '上季',
      getValue: () => ({
        type: 'quarter',
        year: prevQuarterYear,
        value: `Q${prevQuarter}`,
      }),
    },
    {
      key: 'current_year',
      label: '本年',
      getValue: () => ({
        type: 'year',
        year,
        value: year.toString(),
      }),
    },
  ];
}

/**
 * Format period selection for display
 */
export function formatPeriodDisplay(selection: PeriodSelection): string {
  const { type, year, value } = selection;

  switch (type) {
    case 'month':
      return `${year}年${parseInt(value as string, 10)}月`;
    case 'quarter':
      return `${year}年${value}`;
    case 'year':
      return `${year}年`;
    case 'month_range': {
      const [start, end] = value as [string, string];
      return `${year}年${parseInt(start, 10)}月-${parseInt(end, 10)}月`;
    }
    case 'quarter_range': {
      const [startQ, endQ] = value as [string, string];
      return `${year}年${startQ}-${endQ}`;
    }
    case 'custom':
      return Array.isArray(value) ? `${value[0]} - ${value[1]}` : value;
    default:
      return '';
  }
}

/**
 * MobilePeriodSelector Component
 *
 * A mobile-optimized period selector using bottom sheet modal style.
 * Provides quick options, year picker, period type tabs, and selection grids.
 *
 * @example
 * ```tsx
 * const [period, setPeriod] = useState<PeriodSelection>({
 *   type: 'month',
 *   year: 2026,
 *   value: '01',
 *   compareEnabled: false,
 * });
 *
 * <MobilePeriodSelector
 *   value={period}
 *   onChange={setPeriod}
 *   showYoYToggle
 * />
 * ```
 */
export default function MobilePeriodSelector({
  value,
  onChange,
  showYoYToggle = true,
  quickOptions,
  disabled = false,
}: MobilePeriodSelectorProps): React.ReactElement {
  const [modalVisible, setModalVisible] = useState(false);
  const [tempSelection, setTempSelection] = useState<PeriodSelection>(value);
  const [rangeStart, setRangeStart] = useState<string | null>(null);

  // Use provided quick options or defaults
  const options = useMemo(
    () => quickOptions || getDefaultQuickOptions(),
    [quickOptions]
  );

  // Generate year options (current year and 5 years back)
  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const years: number[] = [];
    for (let i = 0; i <= 5; i++) {
      years.push(currentYear - i);
    }
    return years;
  }, []);

  // Display text for the trigger button
  const displayText = useMemo(() => formatPeriodDisplay(value), [value]);

  // Open modal and sync temp selection
  const handleOpenModal = useCallback(() => {
    if (disabled) return;
    setTempSelection(value);
    setRangeStart(null);
    setModalVisible(true);
  }, [disabled, value]);

  // Close modal without saving
  const handleCancel = useCallback(() => {
    setModalVisible(false);
    setTempSelection(value);
    setRangeStart(null);
  }, [value]);

  // Confirm selection
  const handleConfirm = useCallback(() => {
    onChange(tempSelection);
    setModalVisible(false);
    setRangeStart(null);
  }, [onChange, tempSelection]);

  // Handle quick option selection
  const handleQuickOption = useCallback((option: QuickOption) => {
    const newValue = option.getValue();
    setTempSelection(prev => ({
      ...newValue,
      compareEnabled: prev.compareEnabled,
    }));
    setRangeStart(null);
  }, []);

  // Handle year change
  const handleYearChange = useCallback((year: number) => {
    setTempSelection(prev => ({
      ...prev,
      year,
    }));
    setRangeStart(null);
  }, []);

  // Handle period type change
  const handleTypeChange = useCallback((type: PeriodType) => {
    setTempSelection(prev => {
      // Reset value based on new type
      let newValue: string | [string, string] = prev.value;
      if (type === 'month' && typeof prev.value !== 'string') {
        newValue = '01';
      } else if (type === 'quarter' && !prev.value.toString().startsWith('Q')) {
        newValue = 'Q1';
      } else if (type === 'year') {
        newValue = prev.year.toString();
      } else if (type === 'month_range') {
        newValue = ['01', '03'];
      } else if (type === 'quarter_range') {
        newValue = ['Q1', 'Q2'];
      }
      return { ...prev, type, value: newValue };
    });
    setRangeStart(null);
  }, []);

  // Handle month selection
  const handleMonthSelect = useCallback((monthValue: string) => {
    if (tempSelection.type === 'month') {
      setTempSelection(prev => ({ ...prev, value: monthValue }));
    } else if (tempSelection.type === 'month_range') {
      if (rangeStart === null) {
        setRangeStart(monthValue);
      } else {
        const startNum = parseInt(rangeStart, 10);
        const endNum = parseInt(monthValue, 10);
        const [start, end] = startNum <= endNum
          ? [rangeStart, monthValue]
          : [monthValue, rangeStart];
        setTempSelection(prev => ({ ...prev, value: [start, end] }));
        setRangeStart(null);
      }
    }
  }, [tempSelection.type, rangeStart]);

  // Handle quarter selection
  const handleQuarterSelect = useCallback((quarterValue: string) => {
    if (tempSelection.type === 'quarter') {
      setTempSelection(prev => ({ ...prev, value: quarterValue }));
    } else if (tempSelection.type === 'quarter_range') {
      if (rangeStart === null) {
        setRangeStart(quarterValue);
      } else {
        const startIdx = QUARTER_VALUES.indexOf(rangeStart);
        const endIdx = QUARTER_VALUES.indexOf(quarterValue);
        const [start, end] = startIdx <= endIdx
          ? [rangeStart, quarterValue]
          : [quarterValue, rangeStart];
        setTempSelection(prev => ({ ...prev, value: [start, end] }));
        setRangeStart(null);
      }
    }
  }, [tempSelection.type, rangeStart]);

  // Handle YoY toggle
  const handleYoYToggle = useCallback((enabled: boolean) => {
    setTempSelection(prev => ({ ...prev, compareEnabled: enabled }));
  }, []);

  // Check if a month is selected (for highlighting)
  const isMonthSelected = useCallback((monthValue: string) => {
    if (tempSelection.type === 'month') {
      return tempSelection.value === monthValue;
    }
    if (tempSelection.type === 'month_range') {
      const [start, end] = tempSelection.value as [string, string];
      const monthNum = parseInt(monthValue, 10);
      const startNum = parseInt(start, 10);
      const endNum = parseInt(end, 10);
      return monthNum >= startNum && monthNum <= endNum;
    }
    return false;
  }, [tempSelection]);

  // Check if a month is the range start (for border highlighting)
  const isMonthRangeStart = useCallback((monthValue: string) => {
    return rangeStart === monthValue;
  }, [rangeStart]);

  // Check if a quarter is selected
  const isQuarterSelected = useCallback((quarterValue: string) => {
    if (tempSelection.type === 'quarter') {
      return tempSelection.value === quarterValue;
    }
    if (tempSelection.type === 'quarter_range') {
      const [start, end] = tempSelection.value as [string, string];
      const quarterIdx = QUARTER_VALUES.indexOf(quarterValue);
      const startIdx = QUARTER_VALUES.indexOf(start);
      const endIdx = QUARTER_VALUES.indexOf(end);
      return quarterIdx >= startIdx && quarterIdx <= endIdx;
    }
    return false;
  }, [tempSelection]);

  // Check if a quarter is the range start
  const isQuarterRangeStart = useCallback((quarterValue: string) => {
    return rangeStart === quarterValue;
  }, [rangeStart]);

  return (
    <>
      {/* Trigger Button */}
      <TouchableOpacity
        style={[styles.triggerButton, disabled && styles.triggerButtonDisabled]}
        onPress={handleOpenModal}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`Period selector: ${displayText}`}
        accessibilityHint="Double tap to open period selection"
      >
        <MaterialCommunityIcons
          name="calendar-range"
          size={20}
          color={disabled ? '#9CA3AF' : CHART_COLORS.primary}
        />
        <Text style={[styles.triggerText, disabled && styles.triggerTextDisabled]}>
          {displayText}
        </Text>
        {value.compareEnabled && (
          <View style={styles.yoyBadge}>
            <Text style={styles.yoyBadgeText}>YoY</Text>
          </View>
        )}
        <MaterialCommunityIcons
          name="chevron-down"
          size={20}
          color={disabled ? '#9CA3AF' : '#6B7280'}
        />
      </TouchableOpacity>

      {/* Bottom Sheet Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={handleCancel}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={handleCancel}
          />
          <View style={styles.modalContent}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalDragHandle} />
              <View style={styles.modalTitleRow}>
                <Text style={styles.modalTitle}>选择时间段</Text>
                <TouchableOpacity
                  onPress={handleCancel}
                  style={styles.closeButton}
                  accessibilityLabel="Close"
                >
                  <IconButton icon="close" size={24} iconColor="#666" />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView
              style={styles.modalBody}
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              {/* Quick Options Row */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>快捷选项</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.quickOptionsContainer}
                >
                  {options.map(option => {
                    const optionValue = option.getValue();
                    const isActive =
                      tempSelection.type === optionValue.type &&
                      tempSelection.year === optionValue.year &&
                      JSON.stringify(tempSelection.value) === JSON.stringify(optionValue.value);
                    return (
                      <TouchableOpacity
                        key={option.key}
                        style={[
                          styles.quickOptionButton,
                          isActive && styles.quickOptionButtonActive,
                        ]}
                        onPress={() => handleQuickOption(option)}
                        accessibilityRole="button"
                        accessibilityLabel={option.label}
                        accessibilityState={{ selected: isActive }}
                      >
                        <Text
                          style={[
                            styles.quickOptionText,
                            isActive && styles.quickOptionTextActive,
                          ]}
                        >
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Year Picker */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>选择年份</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.yearPickerContainer}
                >
                  {yearOptions.map(year => (
                    <TouchableOpacity
                      key={year}
                      style={[
                        styles.yearButton,
                        tempSelection.year === year && styles.yearButtonActive,
                      ]}
                      onPress={() => handleYearChange(year)}
                      accessibilityRole="button"
                      accessibilityLabel={`${year}年`}
                      accessibilityState={{ selected: tempSelection.year === year }}
                    >
                      <Text
                        style={[
                          styles.yearButtonText,
                          tempSelection.year === year && styles.yearButtonTextActive,
                        ]}
                      >
                        {year}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Period Type Tabs */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>时间类型</Text>
                <View style={styles.periodTypeTabs}>
                  {PERIOD_TYPES.map(({ type, label }) => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.periodTypeTab,
                        tempSelection.type === type && styles.periodTypeTabActive,
                      ]}
                      onPress={() => handleTypeChange(type)}
                      accessibilityRole="tab"
                      accessibilityLabel={label}
                      accessibilityState={{ selected: tempSelection.type === type }}
                    >
                      <Text
                        style={[
                          styles.periodTypeTabText,
                          tempSelection.type === type && styles.periodTypeTabTextActive,
                        ]}
                      >
                        {label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Month Selection Grid */}
              {(tempSelection.type === 'month' || tempSelection.type === 'month_range') && (
                <View style={styles.section}>
                  <View style={styles.sectionTitleRow}>
                    <Text style={styles.sectionTitle}>选择月份</Text>
                    {tempSelection.type === 'month_range' && (
                      <Text style={styles.sectionHint}>
                        {rangeStart ? `已选起始: ${parseInt(rangeStart, 10)}月` : '点击选择范围'}
                      </Text>
                    )}
                  </View>
                  <View style={styles.monthGrid}>
                    {MONTHS.map((month, index) => {
                      const monthValue = MONTH_VALUES[index];
                      const selected = isMonthSelected(monthValue ?? '');
                      const isStart = isMonthRangeStart(monthValue ?? '');
                      return (
                        <TouchableOpacity
                          key={monthValue}
                          style={[
                            styles.monthButton,
                            selected && styles.monthButtonSelected,
                            isStart && styles.monthButtonRangeStart,
                          ]}
                          onPress={() => handleMonthSelect(monthValue ?? '')}
                          accessibilityRole="button"
                          accessibilityLabel={`${tempSelection.year}年${month}`}
                          accessibilityState={{ selected }}
                        >
                          <Text
                            style={[
                              styles.monthButtonText,
                              selected && styles.monthButtonTextSelected,
                            ]}
                          >
                            {month}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Quarter Selection Grid */}
              {(tempSelection.type === 'quarter' || tempSelection.type === 'quarter_range') && (
                <View style={styles.section}>
                  <View style={styles.sectionTitleRow}>
                    <Text style={styles.sectionTitle}>选择季度</Text>
                    {tempSelection.type === 'quarter_range' && (
                      <Text style={styles.sectionHint}>
                        {rangeStart ? `已选起始: ${rangeStart}` : '点击选择范围'}
                      </Text>
                    )}
                  </View>
                  <View style={styles.quarterGrid}>
                    {QUARTERS.map((quarter, index) => {
                      const quarterValue = QUARTER_VALUES[index];
                      const selected = isQuarterSelected(quarterValue ?? '');
                      const isStart = isQuarterRangeStart(quarterValue ?? '');
                      return (
                        <TouchableOpacity
                          key={quarterValue}
                          style={[
                            styles.quarterButton,
                            selected && styles.quarterButtonSelected,
                            isStart && styles.quarterButtonRangeStart,
                          ]}
                          onPress={() => handleQuarterSelect(quarterValue ?? '')}
                          accessibilityRole="button"
                          accessibilityLabel={`${tempSelection.year}年${quarter}`}
                          accessibilityState={{ selected }}
                        >
                          <Text
                            style={[
                              styles.quarterButtonText,
                              selected && styles.quarterButtonTextSelected,
                            ]}
                          >
                            {quarter}
                          </Text>
                          <Text style={styles.quarterSubtext}>
                            {index === 0 && '1-3月'}
                            {index === 1 && '4-6月'}
                            {index === 2 && '7-9月'}
                            {index === 3 && '10-12月'}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Year type - just show confirmation */}
              {tempSelection.type === 'year' && (
                <View style={styles.section}>
                  <Surface style={styles.yearConfirmCard} elevation={1}>
                    <MaterialCommunityIcons
                      name="calendar-check"
                      size={32}
                      color={CHART_COLORS.primary}
                    />
                    <Text style={styles.yearConfirmText}>
                      已选择 {tempSelection.year} 年全年数据
                    </Text>
                  </Surface>
                </View>
              )}

              {/* YoY Comparison Toggle */}
              {showYoYToggle && (
                <View style={styles.section}>
                  <Surface style={styles.yoyToggleCard} elevation={1}>
                    <View style={styles.yoyToggleContent}>
                      <View style={styles.yoyToggleInfo}>
                        <MaterialCommunityIcons
                          name="swap-vertical"
                          size={24}
                          color={CHART_COLORS.primary}
                        />
                        <View style={styles.yoyToggleTextContainer}>
                          <Text style={styles.yoyToggleTitle}>同比对比</Text>
                          <Text style={styles.yoyToggleDescription}>
                            显示与去年同期的对比数据
                          </Text>
                        </View>
                      </View>
                      <Switch
                        value={tempSelection.compareEnabled}
                        onValueChange={handleYoYToggle}
                        color={CHART_COLORS.primary}
                        accessibilityLabel="Enable year-over-year comparison"
                      />
                    </View>
                  </Surface>
                </View>
              )}

              {/* Current Selection Preview */}
              <View style={styles.section}>
                <Surface style={styles.previewCard} elevation={1}>
                  <Text style={styles.previewLabel}>当前选择</Text>
                  <Text style={styles.previewValue}>
                    {formatPeriodDisplay(tempSelection)}
                    {tempSelection.compareEnabled && ' (含同比)'}
                  </Text>
                </Surface>
              </View>
            </ScrollView>

            {/* Footer Buttons */}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={handleCancel}
                accessibilityRole="button"
                accessibilityLabel="取消"
              >
                <Text style={styles.cancelButtonText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmButton}
                onPress={handleConfirm}
                accessibilityRole="button"
                accessibilityLabel="确认选择"
              >
                <Text style={styles.confirmButtonText}>确认</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  // Trigger Button
  triggerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  triggerButtonDisabled: {
    backgroundColor: '#F3F4F6',
  },
  triggerText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937',
    marginLeft: 8,
  },
  triggerTextDisabled: {
    color: '#9CA3AF',
  },
  yoyBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 4,
  },
  yoyBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: CHART_COLORS.primary,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
  },
  modalHeader: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  modalDragHandle: {
    width: 36,
    height: 4,
    backgroundColor: '#D1D5DB',
    borderRadius: 2,
    marginBottom: 12,
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  closeButton: {
    marginRight: -12,
  },
  modalBody: {
    paddingHorizontal: 16,
  },
  modalFooter: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#6B7280',
  },
  confirmButton: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: CHART_COLORS.primary,
    alignItems: 'center',
  },
  confirmButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Sections
  section: {
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionHint: {
    fontSize: 12,
    color: CHART_COLORS.primary,
  },

  // Quick Options
  quickOptionsContainer: {
    paddingRight: 16,
    gap: 8,
  },
  quickOptionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  quickOptionButtonActive: {
    backgroundColor: CHART_COLORS.primary,
  },
  quickOptionText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#4B5563',
  },
  quickOptionTextActive: {
    color: '#FFFFFF',
  },

  // Year Picker
  yearPickerContainer: {
    paddingRight: 16,
    gap: 8,
  },
  yearButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    minWidth: 72,
    alignItems: 'center',
  },
  yearButtonActive: {
    backgroundColor: '#EEF2FF',
    borderWidth: 2,
    borderColor: CHART_COLORS.primary,
  },
  yearButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#4B5563',
  },
  yearButtonTextActive: {
    color: CHART_COLORS.primary,
    fontWeight: '600',
  },

  // Period Type Tabs
  periodTypeTabs: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    padding: 4,
  },
  periodTypeTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  periodTypeTabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  periodTypeTabText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
  },
  periodTypeTabTextActive: {
    color: CHART_COLORS.primary,
    fontWeight: '600',
  },

  // Month Grid
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  monthButton: {
    width: (SCREEN_WIDTH - 32 - 24) / 4 - 6, // 4 columns with gaps
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  monthButtonSelected: {
    backgroundColor: '#EEF2FF',
    borderColor: CHART_COLORS.primary,
  },
  monthButtonRangeStart: {
    backgroundColor: CHART_COLORS.primary,
    borderColor: CHART_COLORS.primary,
  },
  monthButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  monthButtonTextSelected: {
    color: CHART_COLORS.primary,
    fontWeight: '600',
  },

  // Quarter Grid
  quarterGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  quarterButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  quarterButtonSelected: {
    backgroundColor: '#EEF2FF',
    borderColor: CHART_COLORS.primary,
  },
  quarterButtonRangeStart: {
    backgroundColor: CHART_COLORS.primary,
    borderColor: CHART_COLORS.primary,
  },
  quarterButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  quarterButtonTextSelected: {
    color: CHART_COLORS.primary,
  },
  quarterSubtext: {
    fontSize: 11,
    color: '#9CA3AF',
  },

  // Year Confirm
  yearConfirmCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    gap: 12,
  },
  yearConfirmText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#374151',
  },

  // YoY Toggle
  yoyToggleCard: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  yoyToggleContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  yoyToggleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  yoyToggleTextContainer: {
    flex: 1,
  },
  yoyToggleTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  yoyToggleDescription: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },

  // Preview Card
  previewCard: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#EEF2FF',
    marginBottom: 8,
  },
  previewLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  previewValue: {
    fontSize: 16,
    fontWeight: '600',
    color: CHART_COLORS.primary,
  },
});
