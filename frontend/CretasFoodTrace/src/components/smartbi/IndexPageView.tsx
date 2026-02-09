/**
 * IndexPageView
 *
 * Displays the contents of an Excel index/TOC sheet.
 * Shows report directory with navigation and expandable descriptions.
 *
 * @version 1.0.0
 * @since 2026-02-04
 */

import React, { useState } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { Text, Surface } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import type { IndexSheetMapping } from '../../types/smartbi';

// Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/**
 * Props for IndexPageView
 */
export interface IndexPageViewProps {
  /** Index sheet mappings containing report names and descriptions */
  mappings?: IndexSheetMapping[];
  /** Callback when a sheet is selected for navigation */
  onNavigate: (sheetIndex: number) => void;
  /** Currently active sheet index (for highlighting) */
  activeIndex?: number;
}

/**
 * Individual Report Item
 */
interface ReportItemProps {
  mapping: IndexSheetMapping;
  index: number;
  isActive: boolean;
  onPress: () => void;
}

function ReportItem({ mapping, index, isActive, onPress }: ReportItemProps): React.ReactElement {
  const [expanded, setExpanded] = useState(false);

  const toggleExpanded = () => {
    if (mapping.description) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setExpanded(!expanded);
    }
  };

  const hasDescription = mapping.description && mapping.description.trim().length > 0;

  return (
    <Surface style={[styles.reportItem, isActive && styles.reportItemActive]} elevation={1}>
      <TouchableOpacity
        style={styles.reportHeader}
        onPress={onPress}
        activeOpacity={0.7}
      >
        {/* Index number */}
        <View style={[styles.indexBadge, isActive && styles.indexBadgeActive]}>
          <Text style={[styles.indexText, isActive && styles.indexTextActive]}>
            {index + 1}
          </Text>
        </View>

        {/* Report name and sheet info */}
        <View style={styles.reportInfo}>
          <Text style={[styles.reportName, isActive && styles.reportNameActive]} numberOfLines={1}>
            {mapping.reportName}
          </Text>
          {mapping.sheetName !== mapping.reportName && (
            <Text style={styles.sheetName} numberOfLines={1}>
              Sheet: {mapping.sheetName}
            </Text>
          )}
        </View>

        {/* Navigate button */}
        <TouchableOpacity
          style={styles.navigateButton}
          onPress={onPress}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <MaterialCommunityIcons
            name="chevron-right"
            size={24}
            color={isActive ? '#3B82F6' : '#6B7280'}
          />
        </TouchableOpacity>
      </TouchableOpacity>

      {/* Description toggle */}
      {hasDescription && (
        <TouchableOpacity
          style={styles.descriptionToggle}
          onPress={toggleExpanded}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons
            name={expanded ? 'chevron-up' : 'information-outline'}
            size={16}
            color="#8B5CF6"
          />
          <Text style={styles.descriptionToggleText}>
            {expanded ? '收起编制说明' : '查看编制说明'}
          </Text>
        </TouchableOpacity>
      )}

      {/* Expanded description */}
      {expanded && hasDescription && (
        <View style={styles.descriptionContainer}>
          <Text style={styles.descriptionText}>{mapping.description}</Text>
        </View>
      )}
    </Surface>
  );
}

/**
 * IndexPageView Component
 *
 * Displays the index/TOC page content with:
 * - List of reports with names and descriptions
 * - Navigation to individual sheets
 * - Expandable compilation notes (编制说明)
 */
export default function IndexPageView({
  mappings = [],
  onNavigate,
  activeIndex,
}: IndexPageViewProps): React.ReactElement {
  if (mappings.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <MaterialCommunityIcons
          name="format-list-bulleted"
          size={48}
          color="#9CA3AF"
        />
        <Text style={styles.emptyTitle}>报表目录</Text>
        <Text style={styles.emptyText}>暂无报表目录信息</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Header */}
      <View style={styles.header}>
        <MaterialCommunityIcons name="format-list-bulleted" size={24} color="#8B5CF6" />
        <Text style={styles.headerTitle}>报表目录</Text>
        <Text style={styles.headerSubtitle}>{mappings.length} 个报表</Text>
      </View>

      {/* Report list */}
      {mappings.map((mapping, idx) => (
        <ReportItem
          key={`report-${mapping.index}-${idx}`}
          mapping={mapping}
          index={idx}
          isActive={mapping.index === activeIndex}
          onPress={() => onNavigate(mapping.index)}
        />
      ))}

      {/* Footer hint */}
      <View style={styles.footer}>
        <MaterialCommunityIcons name="gesture-tap" size={16} color="#9CA3AF" />
        <Text style={styles.footerText}>点击报表名称跳转到对应 Sheet</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginLeft: 8,
    flex: 1,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#6B7280',
  },
  reportItem: {
    marginBottom: 12,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  reportItemActive: {
    borderWidth: 2,
    borderColor: '#3B82F6',
  },
  reportHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  indexBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  indexBadgeActive: {
    backgroundColor: '#DBEAFE',
  },
  indexText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4B5563',
  },
  indexTextActive: {
    color: '#3B82F6',
  },
  reportInfo: {
    flex: 1,
    marginRight: 8,
  },
  reportName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  reportNameActive: {
    color: '#3B82F6',
  },
  sheetName: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  navigateButton: {
    padding: 4,
  },
  descriptionToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingBottom: 10,
  },
  descriptionToggleText: {
    fontSize: 12,
    color: '#8B5CF6',
    marginLeft: 4,
    fontWeight: '500',
  },
  descriptionContainer: {
    backgroundColor: '#F5F3FF',
    padding: 12,
    marginHorizontal: 14,
    marginBottom: 14,
    borderRadius: 8,
  },
  descriptionText: {
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 8,
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  footerText: {
    fontSize: 12,
    color: '#9CA3AF',
    marginLeft: 6,
  },
});
