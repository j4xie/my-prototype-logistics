import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Animated,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { Text, Surface, ActivityIndicator } from 'react-native-paper';
import { CHART_COLORS } from './chartSizes';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/**
 * Single insight item
 */
export interface InsightItem {
  /** Unique identifier */
  id: string;
  /** Insight text content */
  text: string;
  /** Severity level */
  level?: 'info' | 'warning' | 'critical';
  /** Category tag */
  category?: string;
  /** Detailed explanation */
  detail?: string;
}

/**
 * AI insight data structure
 */
export interface AIInsightData {
  /** Positive findings */
  positive: InsightItem[];
  /** Negative/concerning findings */
  negative: InsightItem[];
  /** Actionable suggestions */
  suggestions: InsightItem[];
  /** Generation timestamp */
  generatedAt?: string;
}

/**
 * MobileAIInsightPanel Props
 */
export interface MobileAIInsightPanelProps {
  /** AI-generated insights data */
  insights: AIInsightData;
  /** Loading state */
  loading?: boolean;
  /** Callback when an insight item is pressed */
  onInsightPress?: (insight: InsightItem) => void;
  /** Whether the panel can be collapsed */
  collapsible?: boolean;
  /** Initial expanded state */
  initialExpanded?: boolean;
}

/**
 * Insight category configuration
 */
type InsightCategory = 'positive' | 'negative' | 'suggestions';

interface CategoryConfig {
  icon: string;
  title: string;
  color: string;
  bgColor: string;
}

const CATEGORY_CONFIG: Record<InsightCategory, CategoryConfig> = {
  positive: {
    icon: '\u2705', // White check mark
    title: '\u6b63\u9762\u53d1\u73b0', // Positive findings
    color: CHART_COLORS.secondary,
    bgColor: 'rgba(16, 185, 129, 0.1)',
  },
  negative: {
    icon: '\u26a0\ufe0f', // Warning sign
    title: '\u5173\u6ce8\u70b9', // Areas of concern
    color: CHART_COLORS.warning,
    bgColor: 'rgba(245, 158, 11, 0.1)',
  },
  suggestions: {
    icon: '\ud83d\udca1', // Light bulb
    title: '\u4f18\u5316\u5efa\u8bae', // Optimization suggestions
    color: CHART_COLORS.primary,
    bgColor: 'rgba(59, 130, 246, 0.1)',
  },
};

/**
 * Level colors for insight items
 */
const LEVEL_COLORS = {
  info: CHART_COLORS.gray,
  warning: CHART_COLORS.warning,
  critical: CHART_COLORS.danger,
};

/**
 * Skeleton Loader Component
 */
function SkeletonLoader(): React.ReactElement {
  const pulseAnim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.4,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [pulseAnim]);

  return (
    <View style={styles.skeletonContainer}>
      {[1, 2, 3].map((section) => (
        <View key={section} style={styles.skeletonSection}>
          <Animated.View
            style={[
              styles.skeletonHeader,
              { opacity: pulseAnim },
            ]}
          />
          {[1, 2].map((item) => (
            <Animated.View
              key={item}
              style={[
                styles.skeletonItem,
                { opacity: pulseAnim },
              ]}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

/**
 * Section Header Component
 * P0 Fix: Wrapped with React.memo to prevent unnecessary re-renders
 */
interface SectionHeaderProps {
  category: InsightCategory;
  count: number;
  expanded: boolean;
  onToggle: () => void;
}

const SectionHeader = React.memo(function SectionHeader({
  category,
  count,
  expanded,
  onToggle,
}: SectionHeaderProps): React.ReactElement {
  const config = CATEGORY_CONFIG[category];
  const rotateAnim = useRef(new Animated.Value(expanded ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(rotateAnim, {
      toValue: expanded ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [expanded, rotateAnim]);

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '90deg'],
  });

  return (
    <TouchableOpacity
      style={[styles.sectionHeader, { backgroundColor: config.bgColor }]}
      onPress={onToggle}
      activeOpacity={0.7}
    >
      <View style={styles.sectionHeaderLeft}>
        <Text style={styles.sectionIcon}>{config.icon}</Text>
        <Text style={[styles.sectionTitle, { color: config.color }]}>
          {config.title}
        </Text>
        <View style={[styles.countBadge, { backgroundColor: config.color }]}>
          <Text style={styles.countText}>{count}</Text>
        </View>
      </View>
      <Animated.View style={{ transform: [{ rotate }] }}>
        <Text style={styles.chevron}>{'\u276f'}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
});

/**
 * Insight Item Component
 * P0 Fix: Wrapped with React.memo to prevent unnecessary re-renders
 */
interface InsightItemRowProps {
  item: InsightItem;
  category: InsightCategory;
  onPress?: () => void;
}

const InsightItemRow = React.memo(function InsightItemRow({
  item,
  category,
  onPress,
}: InsightItemRowProps): React.ReactElement {
  const levelColor = item.level ? LEVEL_COLORS[item.level] : CHART_COLORS.gray;
  const config = CATEGORY_CONFIG[category];

  return (
    <TouchableOpacity
      style={styles.insightItem}
      onPress={onPress}
      activeOpacity={0.6}
      disabled={!onPress}
    >
      <View style={[styles.itemIndicator, { backgroundColor: config.color }]} />
      <View style={styles.itemContent}>
        <Text style={styles.itemText} numberOfLines={3}>
          {item.text}
        </Text>
        {(item.category || item.level) && (
          <View style={styles.itemMeta}>
            {item.category && (
              <View style={styles.categoryTag}>
                <Text style={styles.categoryTagText}>{item.category}</Text>
              </View>
            )}
            {item.level && item.level !== 'info' && (
              <View style={[styles.levelTag, { backgroundColor: levelColor + '20' }]}>
                <Text style={[styles.levelTagText, { color: levelColor }]}>
                  {item.level === 'warning' ? '\u8b66\u544a' : '\u4e25\u91cd'}
                </Text>
              </View>
            )}
          </View>
        )}
        {item.detail && (
          <Text style={styles.itemHint}>{'\u70b9\u51fb\u67e5\u770b\u8be6\u60c5'}</Text>
        )}
      </View>
      {onPress && (
        <Text style={styles.itemChevron}>{'\u203a'}</Text>
      )}
    </TouchableOpacity>
  );
});

/**
 * Category Section Component
 * P0 Fix: Wrapped with React.memo and optimized callbacks
 */
interface CategorySectionProps {
  category: InsightCategory;
  items: InsightItem[];
  onInsightPress?: (insight: InsightItem) => void;
  defaultExpanded?: boolean;
}

const CategorySection = React.memo(function CategorySection({
  category,
  items,
  onInsightPress,
  defaultExpanded = false,
}: CategorySectionProps): React.ReactElement | null {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const handleToggle = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((prev) => !prev);
  }, []);

  // P0 Fix: Memoize the press handler creator to avoid new functions on each render
  const handleItemPress = useCallback((item: InsightItem) => {
    onInsightPress?.(item);
  }, [onInsightPress]);

  if (items.length === 0) {
    return null;
  }

  return (
    <View style={styles.categorySection}>
      <SectionHeader
        category={category}
        count={items.length}
        expanded={expanded}
        onToggle={handleToggle}
      />
      {expanded && (
        <View style={styles.itemsContainer}>
          {items.map((item) => (
            <InsightItemRow
              key={item.id}
              item={item}
              category={category}
              onPress={onInsightPress ? () => handleItemPress(item) : undefined}
            />
          ))}
        </View>
      )}
    </View>
  );
});

/**
 * MobileAIInsightPanel Component
 *
 * A mobile-optimized panel for displaying AI-generated insights.
 * Features collapsible sections, smooth animations, and touch feedback.
 *
 * @example
 * ```tsx
 * <MobileAIInsightPanel
 *   insights={{
 *     positive: [
 *       { id: '1', text: 'Revenue increased by 15%', category: 'Finance' },
 *     ],
 *     negative: [
 *       { id: '2', text: 'Inventory levels are low', level: 'warning' },
 *     ],
 *     suggestions: [
 *       { id: '3', text: 'Consider restocking popular items', detail: '...' },
 *     ],
 *   }}
 *   onInsightPress={(insight) => console.log('Pressed:', insight)}
 *   collapsible
 *   initialExpanded={false}
 * />
 * ```
 */
export default function MobileAIInsightPanel({
  insights,
  loading = false,
  onInsightPress,
  collapsible = true,
  initialExpanded = false,
}: MobileAIInsightPanelProps): React.ReactElement {
  const [panelExpanded, setPanelExpanded] = useState(initialExpanded);

  const handlePanelToggle = useCallback(() => {
    if (!collapsible) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setPanelExpanded((prev) => !prev);
  }, [collapsible]);

  const totalInsights =
    insights.positive.length +
    insights.negative.length +
    insights.suggestions.length;

  const showContent = !collapsible || panelExpanded;

  return (
    <Surface style={styles.container} elevation={1}>
      {/* Header */}
      <TouchableOpacity
        style={styles.header}
        onPress={handlePanelToggle}
        activeOpacity={collapsible ? 0.7 : 1}
        disabled={!collapsible}
      >
        <View style={styles.headerLeft}>
          <Text style={styles.headerIcon}>{'\ud83e\udd16'}</Text>
          <Text style={styles.headerTitle}>AI \u5206\u6790\u7ed3\u8bba</Text>
          {loading && (
            <ActivityIndicator size="small" color={CHART_COLORS.primary} style={styles.loadingIndicator} />
          )}
        </View>
        <View style={styles.headerRight}>
          {totalInsights > 0 && (
            <View style={styles.totalBadge}>
              <Text style={styles.totalBadgeText}>{totalInsights}</Text>
            </View>
          )}
          {collapsible && (
            <Text style={[styles.panelChevron, panelExpanded && styles.panelChevronExpanded]}>
              {'\u25bc'}
            </Text>
          )}
        </View>
      </TouchableOpacity>

      {/* Content */}
      {showContent && (
        <View style={styles.content}>
          {loading ? (
            <SkeletonLoader />
          ) : totalInsights === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>{'\ud83d\udcca'}</Text>
              <Text style={styles.emptyText}>{'\u6682\u65e0\u5206\u6790\u7ed3\u679c'}</Text>
              <Text style={styles.emptyHint}>{'\u8bf7\u4e0a\u4f20\u6570\u636e\u540e\u83b7\u53d6AI\u5206\u6790'}</Text>
            </View>
          ) : (
            <>
              <CategorySection
                category="positive"
                items={insights.positive}
                onInsightPress={onInsightPress}
                defaultExpanded
              />
              <CategorySection
                category="negative"
                items={insights.negative}
                onInsightPress={onInsightPress}
                defaultExpanded
              />
              <CategorySection
                category="suggestions"
                items={insights.suggestions}
                onInsightPress={onInsightPress}
                defaultExpanded={false}
              />
              {insights.generatedAt && (
                <Text style={styles.timestamp}>
                  {'\u751f\u6210\u65f6\u95f4: '}{insights.generatedAt}
                </Text>
              )}
            </>
          )}
        </View>
      )}
    </Surface>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  loadingIndicator: {
    marginLeft: 8,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  totalBadge: {
    backgroundColor: CHART_COLORS.primary,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    marginRight: 8,
  },
  totalBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  panelChevron: {
    fontSize: 12,
    color: '#6B7280',
    transform: [{ rotate: '-90deg' }],
  },
  panelChevronExpanded: {
    transform: [{ rotate: '0deg' }],
  },
  content: {
    padding: 12,
  },
  // Skeleton styles
  skeletonContainer: {
    paddingVertical: 8,
  },
  skeletonSection: {
    marginBottom: 16,
  },
  skeletonHeader: {
    height: 40,
    backgroundColor: '#E5E7EB',
    borderRadius: 8,
    marginBottom: 8,
  },
  skeletonItem: {
    height: 56,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    marginBottom: 8,
    marginLeft: 12,
  },
  // Category section styles
  categorySection: {
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  countBadge: {
    marginLeft: 8,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  countText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  chevron: {
    fontSize: 12,
    color: '#6B7280',
  },
  itemsContainer: {
    marginTop: 8,
  },
  // Insight item styles
  insightItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FAFAFA',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  itemIndicator: {
    width: 4,
    height: '100%',
    minHeight: 24,
    borderRadius: 2,
    marginRight: 12,
  },
  itemContent: {
    flex: 1,
  },
  itemText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  itemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    flexWrap: 'wrap',
  },
  categoryTag: {
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginRight: 6,
  },
  categoryTagText: {
    fontSize: 10,
    color: '#6B7280',
    fontWeight: '500',
  },
  levelTag: {
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  levelTagText: {
    fontSize: 10,
    fontWeight: '600',
  },
  itemHint: {
    fontSize: 11,
    color: CHART_COLORS.primary,
    marginTop: 4,
  },
  itemChevron: {
    fontSize: 20,
    color: '#9CA3AF',
    marginLeft: 8,
    alignSelf: 'center',
  },
  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  emptyHint: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
  },
  // Timestamp
  timestamp: {
    fontSize: 11,
    color: '#9CA3AF',
    textAlign: 'right',
    marginTop: 8,
  },
});
