import React from 'react';
import { View } from 'react-native';
import Svg, { Line, Polygon } from 'react-native-svg';
import { useTheme } from 'react-native-paper';
import type { AppTheme } from '../../theme';

export interface WorkflowConnectorProps {
  orientation: 'horizontal' | 'vertical';
  length?: number;
}

export function WorkflowConnector({ orientation, length = 32 }: WorkflowConnectorProps) {
  const theme = useTheme<AppTheme>();
  const stroke = theme.custom.workflow.connector;

  if (orientation === 'horizontal') {
    return (
      <View style={{ width: length, height: 16, justifyContent: 'center' }}>
        <Svg width={length} height={16} viewBox={`0 0 ${length} 16`}>
          <Line x1={2} y1={8} x2={length - 8} y2={8} stroke={stroke} strokeWidth={1.5} />
          <Polygon
            points={`${length - 10},4 ${length - 2},8 ${length - 10},12`}
            fill={stroke}
          />
        </Svg>
      </View>
    );
  }

  return (
    <View style={{ width: 16, height: length, alignItems: 'center' }}>
      <Svg width={16} height={length} viewBox={`0 0 16 ${length}`}>
        <Line x1={8} y1={2} x2={8} y2={length - 8} stroke={stroke} strokeWidth={1.5} />
        <Polygon
          points={`4,${length - 10} 8,${length - 2} 12,${length - 10}`}
          fill={stroke}
        />
      </Svg>
    </View>
  );
}
