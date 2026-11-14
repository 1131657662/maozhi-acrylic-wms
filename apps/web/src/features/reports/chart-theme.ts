import type { GlobalToken } from 'antd';
import type { ChartOption } from '../../components/ui/chart-runtime';
import { spacing } from '../../theme/design-tokens';

export function chartTheme(token: GlobalToken) {
  return {
    inbound: token.colorSuccess,
    outbound: token.colorPrimary,
    net: token.colorWarning,
    ages: [token.colorSuccess, token.colorPrimary, token.colorWarning, token.colorErrorBorderHover, token.colorError],
    unaged: token.colorTextQuaternary,
  };
}
export function chartBase(token: GlobalToken): ChartOption {
  return {
    animation: false,
    textStyle: { color: token.colorText, fontFamily: token.fontFamily, fontSize: token.fontSize },
    backgroundColor: token.colorBgContainer,
    grid: { left: spacing[16], right: spacing[24], top: spacing[24] * 2, bottom: spacing[16], containLabel: true },
    legend: {
      top: 0,
      bottom: 'auto',
      textStyle: { color: token.colorTextSecondary },
      inactiveColor: token.colorTextDisabled,
      selectedMode: false,
    },
    tooltip: {
      trigger: 'axis',
      renderMode: 'richText',
      confine: true,
      backgroundColor: token.colorBgElevated,
      borderColor: token.colorBorderSecondary,
      textStyle: { color: token.colorText },
      axisPointer: { type: 'line', lineStyle: { color: token.colorBorder } },
    },
  };
}
export function chartAxis(token: GlobalToken) {
  return {
    axisLabel: { color: token.colorTextSecondary },
    nameTextStyle: { color: token.colorTextSecondary },
    axisLine: { lineStyle: { color: token.colorBorder } },
    axisTick: { lineStyle: { color: token.colorBorder } },
    splitLine: { lineStyle: { color: token.colorBorderSecondary } },
  };
}
