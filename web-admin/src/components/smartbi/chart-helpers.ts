/**
 * SmartBI Chart Helpers — shared tooltip/style factories
 */

type TooltipFormatter = (params: unknown) => string;

export function defaultTooltip(trigger: 'axis' | 'item' = 'axis', formatter?: TooltipFormatter) {
  return {
    trigger,
    confine: true,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderColor: '#ebeef5',
    borderWidth: 1,
    textStyle: { color: '#303133' },
    extraCssText: 'box-shadow: 0 2px 12px rgba(0,0,0,0.1); backdrop-filter: blur(4px);',
    ...(formatter ? { formatter } : {}),
  };
}
