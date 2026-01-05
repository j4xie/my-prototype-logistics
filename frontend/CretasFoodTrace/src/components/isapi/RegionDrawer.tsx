/**
 * RegionDrawer - Detection region drawing component for ISAPI cameras
 *
 * Features:
 * - Display camera preview image
 * - Draw detection lines (LINE_DETECTION) and polygons (FIELD_DETECTION)
 * - Touch gestures: tap to add, drag to move, long press to delete
 * - Coordinates normalized to 0-10000 range (ISAPI standard)
 */

import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Image,
  StyleSheet,
  GestureResponderEvent,
  LayoutChangeEvent,
  Text,
  Pressable,
  Vibration,
  Platform,
} from 'react-native';
import Svg, {
  Line,
  Polygon,
  Circle,
  G,
  Text as SvgText,
  Defs,
  Marker,
  Path,
} from 'react-native-svg';
import {
  SmartCoordinate,
  normalizedToPixel,
  pixelToNormalized,
} from '../../services/api/isapiApiClient';

// ========== Types ==========

export type DrawMode = 'LINE' | 'POLYGON' | 'VIEW';

export interface RegionDrawerProps {
  /** Base64 or URL of camera snapshot */
  imageUri?: string;
  /** Display width */
  width: number;
  /** Display height */
  height: number;
  /** Drawing mode */
  mode: DrawMode;
  /** Current coordinates (normalized 0-10000) */
  coordinates: SmartCoordinate[];
  /** Callback when coordinates change */
  onChange?: (coordinates: SmartCoordinate[]) => void;
  /** Line/polygon color */
  color?: string;
  /** Show coordinate labels */
  showCoordinates?: boolean;
  /** Point radius */
  pointRadius?: number;
  /** Line stroke width */
  strokeWidth?: number;
  /** Fill opacity for polygons */
  fillOpacity?: number;
  /** Minimum points required */
  minPoints?: number;
  /** Maximum points allowed */
  maxPoints?: number;
  /** Show direction arrow for lines */
  showDirection?: boolean;
  /** Direction for line detection */
  direction?: 'LEFT_TO_RIGHT' | 'RIGHT_TO_LEFT' | 'BOTH';
  /** Placeholder when no image */
  placeholder?: React.ReactNode;
  /** Additional style */
  style?: object;
}

interface PointState {
  index: number;
  startX: number;
  startY: number;
  originalCoord: SmartCoordinate;
}

// ========== Constants ==========

const DEFAULT_COLOR = '#FF6B35';
const DEFAULT_POINT_RADIUS = 12;
const DEFAULT_STROKE_WIDTH = 3;
const DEFAULT_FILL_OPACITY = 0.2;
const LONG_PRESS_DURATION = 500;
const MIN_DRAG_DISTANCE = 5;

// ========== Component ==========

export const RegionDrawer: React.FC<RegionDrawerProps> = ({
  imageUri,
  width,
  height,
  mode,
  coordinates,
  onChange,
  color = DEFAULT_COLOR,
  showCoordinates = false,
  pointRadius = DEFAULT_POINT_RADIUS,
  strokeWidth = DEFAULT_STROKE_WIDTH,
  fillOpacity = DEFAULT_FILL_OPACITY,
  minPoints,
  maxPoints,
  showDirection = false,
  direction = 'BOTH',
  placeholder,
  style,
}) => {
  // ========== State ==========

  const [containerSize, setContainerSize] = useState({ width, height });
  const [draggingPoint, setDraggingPoint] = useState<PointState | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

  // ========== Computed Values ==========

  const isEditable = mode !== 'VIEW' && onChange !== undefined;

  // Calculate default min/max points based on mode
  const effectiveMinPoints = minPoints ?? (mode === 'LINE' ? 2 : 3);
  const effectiveMaxPoints = maxPoints ?? (mode === 'LINE' ? 2 : 10);

  // Convert normalized coordinates to pixel coordinates
  const pixelCoordinates = useMemo(() => {
    return coordinates.map((coord) =>
      normalizedToPixel(coord, containerSize.width, containerSize.height)
    );
  }, [coordinates, containerSize.width, containerSize.height]);

  // ========== Handlers ==========

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const { width: layoutWidth, height: layoutHeight } = event.nativeEvent.layout;
    setContainerSize({ width: layoutWidth, height: layoutHeight });
  }, []);

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  // Get touch position relative to container
  const getTouchPosition = useCallback(
    (event: GestureResponderEvent): { x: number; y: number } => {
      const { locationX, locationY } = event.nativeEvent;
      return {
        x: Math.max(0, Math.min(containerSize.width, locationX)),
        y: Math.max(0, Math.min(containerSize.height, locationY)),
      };
    },
    [containerSize]
  );

  // Find if touch is near a point
  const findNearestPoint = useCallback(
    (x: number, y: number): number => {
      const hitRadius = pointRadius * 2;
      for (let i = 0; i < pixelCoordinates.length; i++) {
        const point = pixelCoordinates[i];
        if (!point) continue;
        const distance = Math.sqrt(Math.pow(point.x - x, 2) + Math.pow(point.y - y, 2));
        if (distance <= hitRadius) {
          return i;
        }
      }
      return -1;
    },
    [pixelCoordinates, pointRadius]
  );

  // Add a new point
  const addPoint = useCallback(
    (x: number, y: number) => {
      if (!isEditable) return;
      if (coordinates.length >= effectiveMaxPoints) return;

      const normalized = pixelToNormalized(
        { x, y },
        containerSize.width,
        containerSize.height
      );

      // For LINE mode, limit to 2 points
      if (mode === 'LINE' && coordinates.length >= 2) {
        return;
      }

      const newCoordinates = [...coordinates, normalized];
      onChange?.(newCoordinates);
    },
    [isEditable, coordinates, effectiveMaxPoints, containerSize, mode, onChange]
  );

  // Delete a point
  const deletePoint = useCallback(
    (index: number) => {
      if (!isEditable) return;
      if (coordinates.length <= effectiveMinPoints) return;

      const newCoordinates = coordinates.filter((_, i) => i !== index);
      onChange?.(newCoordinates);

      // Haptic feedback
      if (Platform.OS !== 'web') {
        Vibration.vibrate(50);
      }
    },
    [isEditable, coordinates, effectiveMinPoints, onChange]
  );

  // Move a point
  const movePoint = useCallback(
    (index: number, x: number, y: number) => {
      if (!isEditable) return;

      const normalized = pixelToNormalized(
        { x, y },
        containerSize.width,
        containerSize.height
      );

      const newCoordinates = [...coordinates];
      newCoordinates[index] = normalized;
      onChange?.(newCoordinates);
    },
    [isEditable, coordinates, containerSize, onChange]
  );

  // Touch start handler
  const handleTouchStart = useCallback(
    (event: GestureResponderEvent) => {
      if (!isEditable) return;

      const { x, y } = getTouchPosition(event);
      const pointIndex = findNearestPoint(x, y);

      touchStartRef.current = { x, y, time: Date.now() };

      if (pointIndex >= 0 && coordinates[pointIndex]) {
        // Started on a point - prepare for drag or long press
        setDraggingPoint({
          index: pointIndex,
          startX: x,
          startY: y,
          originalCoord: coordinates[pointIndex],
        });

        // Set up long press timer for delete
        clearLongPressTimer();
        longPressTimerRef.current = setTimeout(() => {
          if (!isDragging) {
            deletePoint(pointIndex);
            setDraggingPoint(null);
          }
        }, LONG_PRESS_DURATION);
      }
    },
    [
      isEditable,
      getTouchPosition,
      findNearestPoint,
      coordinates,
      clearLongPressTimer,
      isDragging,
      deletePoint,
    ]
  );

  // Touch move handler
  const handleTouchMove = useCallback(
    (event: GestureResponderEvent) => {
      if (!isEditable || !draggingPoint) return;

      const { x, y } = getTouchPosition(event);

      // Check if we've moved enough to be considered dragging
      const distance = Math.sqrt(
        Math.pow(x - draggingPoint.startX, 2) + Math.pow(y - draggingPoint.startY, 2)
      );

      if (distance > MIN_DRAG_DISTANCE) {
        setIsDragging(true);
        clearLongPressTimer();
        movePoint(draggingPoint.index, x, y);
      }
    },
    [isEditable, draggingPoint, getTouchPosition, clearLongPressTimer, movePoint]
  );

  // Touch end handler
  const handleTouchEnd = useCallback(
    (event: GestureResponderEvent) => {
      clearLongPressTimer();

      if (!isEditable) return;

      const { x, y } = getTouchPosition(event);

      // If not dragging and no point was touched, add a new point
      if (!draggingPoint && touchStartRef.current) {
        const timeDiff = Date.now() - touchStartRef.current.time;
        const distance = Math.sqrt(
          Math.pow(x - touchStartRef.current.x, 2) + Math.pow(y - touchStartRef.current.y, 2)
        );

        // Quick tap (not a long press or drag)
        if (timeDiff < LONG_PRESS_DURATION && distance < MIN_DRAG_DISTANCE) {
          const pointIndex = findNearestPoint(x, y);
          if (pointIndex < 0) {
            addPoint(x, y);
          }
        }
      }

      setDraggingPoint(null);
      setIsDragging(false);
      touchStartRef.current = null;
    },
    [isEditable, draggingPoint, getTouchPosition, clearLongPressTimer, findNearestPoint, addPoint]
  );

  // ========== Render Helpers ==========

  // Render the line shape
  const renderLine = () => {
    if (pixelCoordinates.length < 2) return null;

    const start = pixelCoordinates[0];
    const end = pixelCoordinates[1];
    if (!start || !end) return null;

    return (
      <G>
        <Defs>
          {showDirection && (
            <Marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="7"
              refX="9"
              refY="3.5"
              orient="auto"
            >
              <Path d="M0,0 L0,7 L10,3.5 z" fill={color} />
            </Marker>
          )}
        </Defs>
        <Line
          x1={start.x}
          y1={start.y}
          x2={end.x}
          y2={end.y}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          markerEnd={showDirection && direction !== 'BOTH' ? 'url(#arrowhead)' : undefined}
        />
        {/* Direction indicators for BOTH */}
        {showDirection && direction === 'BOTH' && (
          <>
            {/* Arrows on both sides */}
            <SvgText
              x={(start.x + end.x) / 2}
              y={(start.y + end.y) / 2 - 10}
              fill={color}
              fontSize={12}
              textAnchor="middle"
            >
              {'<-->'}
            </SvgText>
          </>
        )}
      </G>
    );
  };

  // Render the polygon shape
  const renderPolygon = () => {
    if (pixelCoordinates.length < 3) {
      // Draw lines between points if less than 3
      if (pixelCoordinates.length === 2) {
        const p0 = pixelCoordinates[0];
        const p1 = pixelCoordinates[1];
        if (!p0 || !p1) return null;
        return (
          <Line
            x1={p0.x}
            y1={p0.y}
            x2={p1.x}
            y2={p1.y}
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray="5,5"
          />
        );
      }
      return null;
    }

    const points = pixelCoordinates.map((p) => `${p.x},${p.y}`).join(' ');

    return (
      <Polygon
        points={points}
        fill={color}
        fillOpacity={fillOpacity}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
    );
  };

  // Render draggable points
  const renderPoints = () => {
    return pixelCoordinates.map((point, index) => (
      <G key={`point-${index}`}>
        {/* Outer circle (touch area) */}
        <Circle
          cx={point.x}
          cy={point.y}
          r={pointRadius}
          fill={color}
          fillOpacity={0.3}
          stroke={color}
          strokeWidth={2}
        />
        {/* Inner circle */}
        <Circle
          cx={point.x}
          cy={point.y}
          r={pointRadius / 2}
          fill="#FFFFFF"
          stroke={color}
          strokeWidth={2}
        />
        {/* Point number */}
        {showCoordinates && (
          <SvgText
            x={point.x + pointRadius + 5}
            y={point.y - pointRadius - 5}
            fill={color}
            fontSize={10}
            fontWeight="bold"
          >
            {`P${index + 1}`}
          </SvgText>
        )}
      </G>
    ));
  };

  // Render coordinate labels
  const renderCoordinateLabels = () => {
    if (!showCoordinates) return null;

    return coordinates.map((coord, index) => (
      <View
        key={`label-${index}`}
        style={[
          styles.coordinateLabel,
          {
            left: pixelCoordinates[index]?.x ?? 0,
            top: (pixelCoordinates[index]?.y ?? 0) + pointRadius + 5,
          },
        ]}
      >
        <Text style={[styles.coordinateLabelText, { color }]}>
          ({coord.x}, {coord.y})
        </Text>
      </View>
    ));
  };

  // Render placeholder when no image
  const renderPlaceholder = () => {
    if (placeholder) return placeholder;

    return (
      <View style={styles.placeholderContainer}>
        <Text style={styles.placeholderText}>No preview available</Text>
        <Text style={styles.placeholderSubtext}>
          {mode === 'VIEW' ? 'No camera snapshot' : 'Tap to add detection points'}
        </Text>
      </View>
    );
  };

  // ========== Main Render ==========

  return (
    <View
      style={[styles.container, { width, height }, style]}
      onLayout={handleLayout}
    >
      {/* Background Image */}
      {imageUri ? (
        <Image
          source={{ uri: imageUri }}
          style={styles.image}
          resizeMode="contain"
        />
      ) : (
        renderPlaceholder()
      )}

      {/* SVG Overlay */}
      <View
        style={styles.svgContainer}
        onStartShouldSetResponder={() => isEditable}
        onMoveShouldSetResponder={() => isEditable && draggingPoint !== null}
        onResponderGrant={handleTouchStart}
        onResponderMove={handleTouchMove}
        onResponderRelease={handleTouchEnd}
        onResponderTerminate={handleTouchEnd}
      >
        <Svg width={containerSize.width} height={containerSize.height}>
          {/* Draw shape based on mode */}
          {mode === 'LINE' ? renderLine() : renderPolygon()}

          {/* Draw control points */}
          {(isEditable || mode === 'VIEW') && renderPoints()}
        </Svg>
      </View>

      {/* Coordinate labels (outside SVG for better text rendering) */}
      {showCoordinates && renderCoordinateLabels()}

      {/* Mode indicator */}
      {isEditable && (
        <View style={styles.modeIndicator}>
          <Text style={styles.modeText}>
            {mode === 'LINE' ? 'Line Mode' : 'Polygon Mode'}
          </Text>
          <Text style={styles.pointCountText}>
            {coordinates.length}/{effectiveMaxPoints} points
          </Text>
        </View>
      )}

      {/* Instructions */}
      {isEditable && coordinates.length === 0 && (
        <View style={styles.instructionsContainer}>
          <Text style={styles.instructionsText}>
            {mode === 'LINE'
              ? 'Tap to add start and end points'
              : 'Tap to add polygon vertices'}
          </Text>
        </View>
      )}
    </View>
  );
};

// ========== Styles ==========

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  svgContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  placeholderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
  },
  placeholderText: {
    color: '#888888',
    fontSize: 16,
    fontWeight: '600',
  },
  placeholderSubtext: {
    color: '#666666',
    fontSize: 12,
    marginTop: 4,
  },
  coordinateLabel: {
    position: 'absolute',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  coordinateLabelText: {
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  modeIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignItems: 'flex-end',
  },
  modeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  pointCountText: {
    color: '#AAAAAA',
    fontSize: 10,
    marginTop: 2,
  },
  instructionsContainer: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    alignItems: 'center',
  },
  instructionsText: {
    color: '#FFFFFF',
    fontSize: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    overflow: 'hidden',
  },
});

// ========== Export ==========

export default RegionDrawer;
