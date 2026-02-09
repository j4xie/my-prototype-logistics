/**
 * SheetTabBar
 *
 * Tab bar component for switching between Excel sheets in multi-sheet analysis.
 * Shows sheet names with optional cache hit indicator.
 *
 * @version 1.0.0
 * @since 2026-01-30
 */

import React, { useRef, useEffect } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

/**
 * Sheet info for tab display
 */
export interface SheetTabInfo {
  name: string;
  fromCache?: boolean;
  hasError?: boolean;
  isIndex?: boolean;
}

/**
 * SheetTabBar Props
 */
export interface SheetTabBarProps {
  /** List of sheet info */
  sheets: SheetTabInfo[];
  /** Currently active sheet index */
  activeIndex: number;
  /** Callback when tab is pressed */
  onTabPress: (index: number) => void;
  /** Whether data is loading */
  loading?: boolean;
}

/**
 * Individual Tab Component
 */
interface TabItemProps {
  sheet: SheetTabInfo;
  index: number;
  isActive: boolean;
  onPress: () => void;
}

function TabItem({ sheet, index, isActive, onPress }: TabItemProps): React.ReactElement {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Animate on active change
  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: isActive ? 1.02 : 1,
      useNativeDriver: true,
      tension: 100,
      friction: 10,
    }).start();
  }, [isActive, scaleAnim]);

  // Determine icon and color based on state
  const getIconName = (): string => {
    if (sheet.hasError) return 'alert-circle';
    if (sheet.isIndex) return 'format-list-bulleted';
    return 'file-document-outline';
  };

  const getIconColor = (): string => {
    if (isActive) return '#3B82F6';
    if (sheet.hasError) return '#EF4444';
    if (sheet.isIndex) return '#8B5CF6'; // Purple for index
    return '#6B7280';
  };

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <Animated.View
        style={[
          styles.tab,
          isActive && styles.tabActive,
          sheet.hasError && styles.tabError,
          sheet.isIndex && styles.tabIndex,
          { transform: [{ scale: scaleAnim }] },
        ]}
      >
        {/* Tab content */}
        <View style={styles.tabContent}>
          {/* Sheet icon */}
          <MaterialCommunityIcons
            name={getIconName()}
            size={16}
            color={getIconColor()}
            style={styles.tabIcon}
          />

          {/* Sheet name */}
          <Text
            style={[
              styles.tabText,
              isActive && styles.tabTextActive,
              sheet.hasError && styles.tabTextError,
            ]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {sheet.name}
          </Text>

          {/* Cache indicator */}
          {sheet.fromCache && !sheet.hasError && (
            <View style={styles.cacheBadge}>
              <MaterialCommunityIcons
                name="lightning-bolt"
                size={10}
                color="#10B981"
              />
            </View>
          )}
        </View>

        {/* Active indicator line */}
        {isActive && <View style={styles.activeIndicator} />}
      </Animated.View>
    </TouchableOpacity>
  );
}

/**
 * SheetTabBar Component
 */
export default function SheetTabBar({
  sheets,
  activeIndex,
  onTabPress,
  loading = false,
}: SheetTabBarProps): React.ReactElement {
  const scrollViewRef = useRef<ScrollView>(null);

  // Auto-scroll to active tab
  useEffect(() => {
    if (scrollViewRef.current && sheets.length > 0) {
      // Approximate scroll position based on tab width
      const tabWidth = 120;
      const scrollX = Math.max(0, activeIndex * tabWidth - 100);
      scrollViewRef.current.scrollTo({ x: scrollX, animated: true });
    }
  }, [activeIndex, sheets.length]);

  if (sheets.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>暂无 Sheet 数据</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollViewRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {sheets.map((sheet, index) => (
          <TabItem
            key={`sheet-${index}-${sheet.name}`}
            sheet={sheet}
            index={index}
            isActive={index === activeIndex}
            onPress={() => !loading && onTabPress(index)}
          />
        ))}
      </ScrollView>

      {/* Sheet count indicator */}
      <View style={styles.countBadge}>
        <Text style={styles.countText}>
          {Math.min(activeIndex + 1, sheets.length)}/{sheets.length}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingVertical: 4,
  },
  scrollContent: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexGrow: 1,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 4,
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
    minWidth: 80,
    maxWidth: 150,
    position: 'relative',
  },
  tabActive: {
    backgroundColor: '#EBF5FF',
    borderColor: '#3B82F6',
    borderWidth: 1,
  },
  tabError: {
    backgroundColor: '#FEF2F2',
    borderColor: '#EF4444',
    borderWidth: 1,
  },
  tabIndex: {
    backgroundColor: '#F5F3FF',
    borderColor: '#8B5CF6',
    borderWidth: 1,
  },
  tabContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tabIcon: {
    marginRight: 6,
  },
  tabText: {
    fontSize: 13,
    color: '#4B5563',
    fontWeight: '500',
    flex: 1,
  },
  tabTextActive: {
    color: '#3B82F6',
    fontWeight: '600',
  },
  tabTextError: {
    color: '#EF4444',
  },
  cacheBadge: {
    marginLeft: 4,
    backgroundColor: '#D1FAE5',
    borderRadius: 4,
    padding: 2,
  },
  activeIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 16,
    right: 16,
    height: 3,
    backgroundColor: '#3B82F6',
    borderRadius: 1.5,
  },
  countBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    marginRight: 8,
  },
  countText: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '600',
  },
  emptyContainer: {
    padding: 16,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
});
