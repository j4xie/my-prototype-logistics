/**
 * ChartLinkageService - SmartBI Phase 4
 * Manages chart-to-chart data linkage and interactions
 *
 * Features:
 * - Filter linkage: clicking chart A filters chart B
 * - Highlight linkage: hovering chart A highlights related data in chart B
 * - Drill-down linkage: clicking triggers drill-down across charts
 */

import { ref, reactive, computed, type Ref, type ComputedRef } from 'vue';

// ==================== Type Definitions ====================

/**
 * Linkage types for chart interactions
 */
export type LinkageType = 'filter' | 'highlight' | 'drill-down';

/**
 * Chart event types
 */
export type ChartEventType = 'click' | 'hover' | 'select' | 'brush';

/**
 * Chart event data structure
 */
export interface ChartEventData {
  /** Dimension name (e.g., 'category', 'region', 'date') */
  dimension?: string;
  /** Value of the dimension */
  value?: string | number | Date;
  /** Series name for multi-series charts */
  seriesName?: string;
  /** Data index in the series */
  dataIndex?: number;
  /** Additional custom data */
  extra?: Record<string, unknown>;
}

/**
 * Chart event interface
 */
export interface ChartEvent {
  /** Event type */
  type: ChartEventType;
  /** Event data */
  data: ChartEventData;
  /** Timestamp of the event */
  timestamp?: number;
  /** Source chart ID */
  sourceId?: string;
}

/**
 * Linkage configuration
 */
export interface LinkageConfig {
  /** Field to filter on (for filter linkage) */
  filterField?: string;
  /** Field to highlight (for highlight linkage) */
  highlightField?: string;
  /** Whether the linkage is bidirectional */
  bidirectional?: boolean;
  /** Event types to listen for */
  eventTypes?: ChartEventType[];
  /** Custom transform function for the event data */
  transform?: (event: ChartEvent) => ChartEvent;
  /** Debounce time in ms for high-frequency events (e.g., hover) */
  debounce?: number;
  /** Whether the linkage is enabled */
  enabled?: boolean;
}

/**
 * Chart instance wrapper
 */
export interface ChartInstance {
  /** Chart ID */
  id: string;
  /** ECharts instance or custom chart object */
  instance: unknown;
  /** Chart type for reference */
  type?: string;
  /** Current filter state */
  filterState?: Record<string, unknown>;
  /** Current highlight state */
  highlightState?: Record<string, unknown>;
}

/**
 * Linkage definition
 */
export interface Linkage {
  /** Source chart ID */
  sourceId: string;
  /** Target chart ID */
  targetId: string;
  /** Linkage type */
  type: LinkageType;
  /** Linkage configuration */
  config: LinkageConfig;
  /** Creation timestamp */
  createdAt: number;
}

/**
 * Event listener callback type
 */
export type LinkageEventListener = (event: ChartEvent, linkage: Linkage) => void;

/**
 * Linkage state for a specific chart
 */
export interface ChartLinkageState {
  /** Whether the chart is registered */
  isRegistered: boolean;
  /** Current filter applied to this chart */
  activeFilters: Record<string, unknown>;
  /** Current highlights on this chart */
  activeHighlights: string[];
  /** Charts that this chart links to (as source) */
  linkedTo: string[];
  /** Charts that link to this chart (as target) */
  linkedFrom: string[];
}

// ==================== Event Emitter Implementation ====================

type EventCallback = (...args: unknown[]) => void;

class EventEmitter {
  private events: Map<string, Set<EventCallback>> = new Map();

  on(event: string, callback: EventCallback): () => void {
    if (!this.events.has(event)) {
      this.events.set(event, new Set());
    }
    this.events.get(event)!.add(callback);

    // Return unsubscribe function
    return () => this.off(event, callback);
  }

  off(event: string, callback: EventCallback): void {
    const callbacks = this.events.get(event);
    if (callbacks) {
      callbacks.delete(callback);
    }
  }

  emit(event: string, ...args: unknown[]): void {
    const callbacks = this.events.get(event);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(...args);
        } catch (error) {
          console.error(`[ChartLinkage] Error in event handler for ${event}:`, error);
        }
      });
    }
  }

  removeAllListeners(event?: string): void {
    if (event) {
      this.events.delete(event);
    } else {
      this.events.clear();
    }
  }
}

// ==================== ChartLinkageService Class ====================

/**
 * ChartLinkageService - Singleton service for managing chart linkages
 */
class ChartLinkageService {
  private static instance: ChartLinkageService | null = null;

  /** Registered chart instances */
  private charts: Map<string, ChartInstance> = new Map();

  /** Defined linkages */
  private linkages: Map<string, Linkage> = new Map();

  /** Event emitter for internal events */
  private emitter: EventEmitter = new EventEmitter();

  /** Debounce timers */
  private debounceTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  /** Vue reactive state for UI binding */
  private _registeredCharts = ref<string[]>([]);
  private _activeLinkages = ref<Linkage[]>([]);
  private _lastEvent = ref<ChartEvent | null>(null);

  private constructor() {
    // Private constructor for singleton
  }

  /**
   * Get singleton instance
   */
  static getInstance(): ChartLinkageService {
    if (!ChartLinkageService.instance) {
      ChartLinkageService.instance = new ChartLinkageService();
    }
    return ChartLinkageService.instance;
  }

  /**
   * Reset instance (mainly for testing)
   */
  static resetInstance(): void {
    if (ChartLinkageService.instance) {
      ChartLinkageService.instance.destroy();
      ChartLinkageService.instance = null;
    }
  }

  // ==================== Chart Registration ====================

  /**
   * Register a chart for linkage
   * @param chartId Unique identifier for the chart
   * @param chartInstance The chart instance (ECharts instance or custom object)
   * @param chartType Optional chart type for reference
   */
  registerChart(chartId: string, chartInstance: unknown, chartType?: string): void {
    if (this.charts.has(chartId)) {
      console.warn(`[ChartLinkage] Chart "${chartId}" is already registered. Updating instance.`);
    }

    const chart: ChartInstance = {
      id: chartId,
      instance: chartInstance,
      type: chartType,
      filterState: {},
      highlightState: {}
    };

    this.charts.set(chartId, chart);
    this.updateReactiveState();
    this.emitter.emit('chart:registered', chartId, chart);
  }

  /**
   * Unregister a chart and remove all its linkages
   * @param chartId The chart ID to unregister
   */
  unregisterChart(chartId: string): void {
    if (!this.charts.has(chartId)) {
      console.warn(`[ChartLinkage] Chart "${chartId}" is not registered.`);
      return;
    }

    // Remove all linkages involving this chart
    const linkagesToRemove: string[] = [];
    this.linkages.forEach((linkage, key) => {
      if (linkage.sourceId === chartId || linkage.targetId === chartId) {
        linkagesToRemove.push(key);
      }
    });
    linkagesToRemove.forEach(key => this.linkages.delete(key));

    // Remove the chart
    this.charts.delete(chartId);
    this.updateReactiveState();
    this.emitter.emit('chart:unregistered', chartId);
  }

  /**
   * Check if a chart is registered
   */
  isChartRegistered(chartId: string): boolean {
    return this.charts.has(chartId);
  }

  /**
   * Get a registered chart instance
   */
  getChart(chartId: string): ChartInstance | undefined {
    return this.charts.get(chartId);
  }

  /**
   * Get all registered chart IDs
   */
  getRegisteredCharts(): string[] {
    return Array.from(this.charts.keys());
  }

  // ==================== Linkage Management ====================

  /**
   * Generate linkage key from source and target IDs
   */
  private getLinkageKey(sourceId: string, targetId: string): string {
    return `${sourceId}::${targetId}`;
  }

  /**
   * Create a linkage between two charts
   * @param sourceId Source chart ID (event originator)
   * @param targetId Target chart ID (event receiver)
   * @param type Linkage type
   * @param config Optional linkage configuration
   */
  createLinkage(
    sourceId: string,
    targetId: string,
    type: LinkageType,
    config: LinkageConfig = {}
  ): void {
    // Validate charts exist
    if (!this.charts.has(sourceId)) {
      console.warn(`[ChartLinkage] Source chart "${sourceId}" is not registered.`);
      return;
    }
    if (!this.charts.has(targetId)) {
      console.warn(`[ChartLinkage] Target chart "${targetId}" is not registered.`);
      return;
    }

    // Create linkage
    const linkageKey = this.getLinkageKey(sourceId, targetId);
    const linkage: Linkage = {
      sourceId,
      targetId,
      type,
      config: {
        bidirectional: false,
        eventTypes: this.getDefaultEventTypes(type),
        enabled: true,
        ...config
      },
      createdAt: Date.now()
    };

    this.linkages.set(linkageKey, linkage);

    // If bidirectional, create reverse linkage
    if (config.bidirectional) {
      const reverseKey = this.getLinkageKey(targetId, sourceId);
      if (!this.linkages.has(reverseKey)) {
        const reverseLinkage: Linkage = {
          ...linkage,
          sourceId: targetId,
          targetId: sourceId,
          config: { ...linkage.config, bidirectional: false } // Prevent infinite recursion
        };
        this.linkages.set(reverseKey, reverseLinkage);
      }
    }

    this.updateReactiveState();
    this.emitter.emit('linkage:created', linkage);
  }

  /**
   * Get default event types for a linkage type
   */
  private getDefaultEventTypes(type: LinkageType): ChartEventType[] {
    switch (type) {
      case 'filter':
        return ['click', 'select'];
      case 'highlight':
        return ['hover'];
      case 'drill-down':
        return ['click'];
      default:
        return ['click'];
    }
  }

  /**
   * Remove a linkage between two charts
   * @param sourceId Source chart ID
   * @param targetId Target chart ID
   */
  removeLinkage(sourceId: string, targetId: string): void {
    const linkageKey = this.getLinkageKey(sourceId, targetId);
    const linkage = this.linkages.get(linkageKey);

    if (!linkage) {
      console.warn(`[ChartLinkage] Linkage from "${sourceId}" to "${targetId}" does not exist.`);
      return;
    }

    // Remove the linkage
    this.linkages.delete(linkageKey);

    // If bidirectional, also remove reverse linkage
    if (linkage.config.bidirectional) {
      const reverseKey = this.getLinkageKey(targetId, sourceId);
      this.linkages.delete(reverseKey);
    }

    this.updateReactiveState();
    this.emitter.emit('linkage:removed', { sourceId, targetId });
  }

  /**
   * Enable or disable a linkage
   */
  setLinkageEnabled(sourceId: string, targetId: string, enabled: boolean): void {
    const linkageKey = this.getLinkageKey(sourceId, targetId);
    const linkage = this.linkages.get(linkageKey);

    if (linkage) {
      linkage.config.enabled = enabled;
      this.emitter.emit('linkage:updated', linkage);
    }
  }

  /**
   * Get linkage between two charts
   */
  getLinkage(sourceId: string, targetId: string): Linkage | undefined {
    return this.linkages.get(this.getLinkageKey(sourceId, targetId));
  }

  /**
   * Get all charts linked from a source chart
   * @param sourceId Source chart ID
   * @returns Array of target chart IDs
   */
  getLinkedCharts(sourceId: string): string[] {
    const linked: string[] = [];
    this.linkages.forEach(linkage => {
      if (linkage.sourceId === sourceId) {
        linked.push(linkage.targetId);
      }
    });
    return linked;
  }

  /**
   * Get all charts that link to a target chart
   * @param targetId Target chart ID
   * @returns Array of source chart IDs
   */
  getSourceCharts(targetId: string): string[] {
    const sources: string[] = [];
    this.linkages.forEach(linkage => {
      if (linkage.targetId === targetId) {
        sources.push(linkage.sourceId);
      }
    });
    return sources;
  }

  /**
   * Get all linkages for a chart (both as source and target)
   */
  getChartLinkages(chartId: string): Linkage[] {
    const result: Linkage[] = [];
    this.linkages.forEach(linkage => {
      if (linkage.sourceId === chartId || linkage.targetId === chartId) {
        result.push(linkage);
      }
    });
    return result;
  }

  // ==================== Event Dispatching ====================

  /**
   * Dispatch an event from a source chart to all linked charts
   * @param sourceId Source chart ID
   * @param event Chart event to dispatch
   */
  dispatch(sourceId: string, event: ChartEvent): void {
    if (!this.charts.has(sourceId)) {
      console.warn(`[ChartLinkage] Source chart "${sourceId}" is not registered.`);
      return;
    }

    // Enrich event with metadata
    const enrichedEvent: ChartEvent = {
      ...event,
      sourceId,
      timestamp: event.timestamp || Date.now()
    };

    // Update last event
    this._lastEvent.value = enrichedEvent;

    // Find all linkages from this source
    this.linkages.forEach(linkage => {
      if (linkage.sourceId !== sourceId) return;
      if (!linkage.config.enabled) return;

      // Check if event type matches linkage config
      const eventTypes = linkage.config.eventTypes || [];
      if (!eventTypes.includes(event.type)) return;

      // Apply debounce if configured
      if (linkage.config.debounce && linkage.config.debounce > 0) {
        this.dispatchWithDebounce(linkage, enrichedEvent);
      } else {
        this.processLinkageEvent(linkage, enrichedEvent);
      }
    });
  }

  /**
   * Dispatch event with debounce
   */
  private dispatchWithDebounce(linkage: Linkage, event: ChartEvent): void {
    const timerKey = `${linkage.sourceId}::${linkage.targetId}`;

    // Clear existing timer
    const existingTimer = this.debounceTimers.get(timerKey);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new timer
    const timer = setTimeout(() => {
      this.processLinkageEvent(linkage, event);
      this.debounceTimers.delete(timerKey);
    }, linkage.config.debounce);

    this.debounceTimers.set(timerKey, timer);
  }

  /**
   * Process a linkage event
   */
  private processLinkageEvent(linkage: Linkage, event: ChartEvent): void {
    // Apply transform if configured
    let processedEvent = event;
    if (linkage.config.transform) {
      try {
        processedEvent = linkage.config.transform(event);
      } catch (error) {
        console.error(`[ChartLinkage] Error in transform function:`, error);
        return;
      }
    }

    // Emit event based on linkage type
    const eventName = `${linkage.type}:${linkage.targetId}`;
    this.emitter.emit(eventName, processedEvent, linkage);

    // Also emit generic event for listeners
    this.emitter.emit('linkage:event', processedEvent, linkage);
  }

  /**
   * Clear all active filters on a chart
   */
  clearFilters(chartId: string): void {
    const chart = this.charts.get(chartId);
    if (chart) {
      chart.filterState = {};
      this.emitter.emit('filter:cleared', chartId);
    }
  }

  /**
   * Clear all active highlights on a chart
   */
  clearHighlights(chartId: string): void {
    const chart = this.charts.get(chartId);
    if (chart) {
      chart.highlightState = {};
      this.emitter.emit('highlight:cleared', chartId);
    }
  }

  // ==================== Event Subscription ====================

  /**
   * Subscribe to linkage events for a specific chart
   * @param chartId The chart to listen for events on
   * @param type The linkage type to listen for
   * @param callback The callback function
   * @returns Unsubscribe function
   */
  onLinkageEvent(
    chartId: string,
    type: LinkageType,
    callback: LinkageEventListener
  ): () => void {
    const eventName = `${type}:${chartId}`;
    return this.emitter.on(eventName, callback as EventCallback);
  }

  /**
   * Subscribe to all linkage events
   */
  onAnyLinkageEvent(callback: LinkageEventListener): () => void {
    return this.emitter.on('linkage:event', callback as EventCallback);
  }

  /**
   * Subscribe to chart registration events
   */
  onChartRegistered(callback: (chartId: string, chart: ChartInstance) => void): () => void {
    return this.emitter.on('chart:registered', callback as EventCallback);
  }

  /**
   * Subscribe to chart unregistration events
   */
  onChartUnregistered(callback: (chartId: string) => void): () => void {
    return this.emitter.on('chart:unregistered', callback as EventCallback);
  }

  // ==================== Reactive State ====================

  /**
   * Update Vue reactive state
   */
  private updateReactiveState(): void {
    this._registeredCharts.value = Array.from(this.charts.keys());
    this._activeLinkages.value = Array.from(this.linkages.values());
  }

  /**
   * Get reactive list of registered chart IDs
   */
  get registeredCharts(): ComputedRef<string[]> {
    return computed(() => this._registeredCharts.value);
  }

  /**
   * Get reactive list of active linkages
   */
  get activeLinkages(): ComputedRef<Linkage[]> {
    return computed(() => this._activeLinkages.value);
  }

  /**
   * Get last dispatched event
   */
  get lastEvent(): ComputedRef<ChartEvent | null> {
    return computed(() => this._lastEvent.value);
  }

  // ==================== Utility Methods ====================

  /**
   * Get the linkage state for a specific chart
   */
  getChartLinkageState(chartId: string): ChartLinkageState {
    const chart = this.charts.get(chartId);
    const linkedTo = this.getLinkedCharts(chartId);
    const linkedFrom = this.getSourceCharts(chartId);

    return {
      isRegistered: !!chart,
      activeFilters: chart?.filterState || {},
      activeHighlights: Object.keys(chart?.highlightState || {}),
      linkedTo,
      linkedFrom
    };
  }

  /**
   * Create a batch of linkages
   */
  createLinkages(linkages: Array<{
    sourceId: string;
    targetId: string;
    type: LinkageType;
    config?: LinkageConfig;
  }>): void {
    linkages.forEach(({ sourceId, targetId, type, config }) => {
      this.createLinkage(sourceId, targetId, type, config);
    });
  }

  /**
   * Remove all linkages
   */
  clearAllLinkages(): void {
    this.linkages.clear();
    this.updateReactiveState();
    this.emitter.emit('linkages:cleared');
  }

  /**
   * Destroy the service and clean up
   */
  destroy(): void {
    // Clear all debounce timers
    this.debounceTimers.forEach(timer => clearTimeout(timer));
    this.debounceTimers.clear();

    // Clear all data
    this.charts.clear();
    this.linkages.clear();
    this.emitter.removeAllListeners();

    // Reset reactive state
    this._registeredCharts.value = [];
    this._activeLinkages.value = [];
    this._lastEvent.value = null;
  }
}

// ==================== Vue Composable ====================

/**
 * Vue composable for chart linkage functionality
 * @param chartId The chart ID to manage linkage for
 * @returns Reactive methods and state for chart linkage
 */
export function useChartLinkage(chartId: string) {
  const service = ChartLinkageService.getInstance();

  // Reactive state for this chart
  const isRegistered = computed(() => service.isChartRegistered(chartId));
  const linkedCharts = computed(() => service.getLinkedCharts(chartId));
  const sourceCharts = computed(() => service.getSourceCharts(chartId));
  const linkageState = computed(() => service.getChartLinkageState(chartId));

  // Event listeners to clean up
  const listeners: Array<() => void> = [];

  /**
   * Register the chart instance
   */
  function register(chartInstance: unknown, chartType?: string): void {
    service.registerChart(chartId, chartInstance, chartType);
  }

  /**
   * Unregister the chart
   */
  function unregister(): void {
    service.unregisterChart(chartId);
  }

  /**
   * Create a linkage to another chart
   */
  function linkTo(
    targetId: string,
    type: LinkageType,
    config?: LinkageConfig
  ): void {
    service.createLinkage(chartId, targetId, type, config);
  }

  /**
   * Remove a linkage to another chart
   */
  function unlinkFrom(targetId: string): void {
    service.removeLinkage(chartId, targetId);
  }

  /**
   * Dispatch an event from this chart
   */
  function dispatch(event: ChartEvent): void {
    service.dispatch(chartId, event);
  }

  /**
   * Listen for filter events on this chart
   */
  function onFilter(callback: LinkageEventListener): () => void {
    const unsubscribe = service.onLinkageEvent(chartId, 'filter', callback);
    listeners.push(unsubscribe);
    return unsubscribe;
  }

  /**
   * Listen for highlight events on this chart
   */
  function onHighlight(callback: LinkageEventListener): () => void {
    const unsubscribe = service.onLinkageEvent(chartId, 'highlight', callback);
    listeners.push(unsubscribe);
    return unsubscribe;
  }

  /**
   * Listen for drill-down events on this chart
   */
  function onDrillDown(callback: LinkageEventListener): () => void {
    const unsubscribe = service.onLinkageEvent(chartId, 'drill-down', callback);
    listeners.push(unsubscribe);
    return unsubscribe;
  }

  /**
   * Clear filters applied to this chart
   */
  function clearFilters(): void {
    service.clearFilters(chartId);
  }

  /**
   * Clear highlights on this chart
   */
  function clearHighlights(): void {
    service.clearHighlights(chartId);
  }

  /**
   * Cleanup function to remove all listeners
   */
  function cleanup(): void {
    listeners.forEach(unsubscribe => unsubscribe());
    listeners.length = 0;
  }

  return {
    // State
    isRegistered,
    linkedCharts,
    sourceCharts,
    linkageState,

    // Methods
    register,
    unregister,
    linkTo,
    unlinkFrom,
    dispatch,
    onFilter,
    onHighlight,
    onDrillDown,
    clearFilters,
    clearHighlights,
    cleanup
  };
}

/**
 * Vue composable for global chart linkage management
 * @returns Global reactive state and methods
 */
export function useChartLinkageGlobal() {
  const service = ChartLinkageService.getInstance();

  return {
    // Reactive state
    registeredCharts: service.registeredCharts,
    activeLinkages: service.activeLinkages,
    lastEvent: service.lastEvent,

    // Methods
    registerChart: service.registerChart.bind(service),
    unregisterChart: service.unregisterChart.bind(service),
    createLinkage: service.createLinkage.bind(service),
    removeLinkage: service.removeLinkage.bind(service),
    createLinkages: service.createLinkages.bind(service),
    clearAllLinkages: service.clearAllLinkages.bind(service),
    getLinkedCharts: service.getLinkedCharts.bind(service),
    getSourceCharts: service.getSourceCharts.bind(service),
    getLinkage: service.getLinkage.bind(service),
    dispatch: service.dispatch.bind(service),
    onAnyLinkageEvent: service.onAnyLinkageEvent.bind(service),
    onChartRegistered: service.onChartRegistered.bind(service),
    onChartUnregistered: service.onChartUnregistered.bind(service)
  };
}

// ==================== Exports ====================

// Export singleton instance getter
export const getChartLinkageService = ChartLinkageService.getInstance;

// Export class for advanced usage
export { ChartLinkageService };

// Default export for convenience
export default ChartLinkageService;
