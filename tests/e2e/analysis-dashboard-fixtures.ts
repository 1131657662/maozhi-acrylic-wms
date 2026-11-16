import type { Route } from '@playwright/test';
import { analysisSchema, type Analysis } from '@wms/contracts';

async function readAnalysisResponse(route: Route) {
  const response = await route.fetch(),
    envelope: unknown = await response.json();
  if (!envelope || typeof envelope !== 'object' || !('data' in envelope)) throw new Error('Invalid API envelope');
  const data = analysisSchema.parse(envelope.data);
  return { response, envelope, data };
}

// Browser boundary samples exercise chart states without changing the isolated API's unknown-source evidence.
function initializeChartSamples(data: Analysis) {
  const end = new Date(data.toDay + 'T00:00:00Z');
  data.monthly.data ??= {
    points: Array.from({ length: 12 }, (_, index) => ({
      month: new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 11 + index, 1)).toISOString().slice(0, 7),
      inboundGrams: 0,
      outboundGrams: 0,
      inboundPackages: 0,
      outboundPackages: 0,
    })),
  };
  data.comparison.data ??= {
    current: { fromDay: data.fromDay, toDay: data.toDay, inboundGrams: 0, outboundGrams: 0 },
    previous: {
      fromDay: data.comparison.period.fromDay,
      toDay: new Date(Date.parse(data.fromDay) - 86400000).toISOString().slice(0, 10),
      inboundGrams: 0,
      outboundGrams: 0,
    },
  };
  data.tops.data ??= { products: [], customers: [], suppliers: [] };
  data.heatmap.data ??= {
    days: Array.from({ length: 183 }, (_, index) => ({
      day: new Date(end.getTime() - (182 - index) * 86400000).toISOString().slice(0, 10),
      value: 0,
      inboundGrams: 0,
      outboundGrams: 0,
    })),
  };
  for (const key of ['monthly', 'comparison', 'tops', 'heatmap'] as const) {
    data[key].verification = 'verified';
    data[key].reason = null;
  }
  data.heatmap.data.days = data.heatmap.data.days.map((day) => ({
    ...day,
    value: 0,
    inboundGrams: 0,
    outboundGrams: 0,
  }));
}

function setDashboardChartSamples(data: Analysis) {
  initializeChartSamples(data);
  if (!data.monthly.data || !data.comparison.data || !data.tops.data || !data.heatmap.data)
    throw new Error('Analysis fixture is incomplete');
  const lastMonth = data.monthly.data.points.at(-1);
  if (!lastMonth) throw new Error('Monthly fixture has no chart points');
  data.monthly.data.points[data.monthly.data.points.length - 1] = {
    ...lastMonth,
    inboundGrams: 1_000_000,
    outboundGrams: 2_000_000,
    inboundPackages: 10,
    outboundPackages: 20,
  };
  data.comparison.data.current.inboundGrams = 1_000_000;
  data.comparison.data.current.outboundGrams = 2_000_000;
  data.tops.data = {
    products: [
      { code: 'RPT-P1', name: '合成商品', inboundGrams: 1_000_000, outboundGrams: 2_000_000, rankedGrams: 2_000_000 },
    ],
    customers: [
      { code: 'RPT-C1', name: '合成客户', inboundGrams: 0, outboundGrams: 2_000_000, rankedGrams: 2_000_000 },
    ],
    suppliers: [
      { code: 'RPT-S1', name: '合成供应商', inboundGrams: 1_000_000, outboundGrams: 0, rankedGrams: 1_000_000 },
    ],
  };
  data.tops.verification = 'verified';
  data.tops.reason = null;
  const firstDay = data.heatmap.data.days[0];
  if (!firstDay) throw new Error('Heatmap fixture has no days');
  data.heatmap.data.days[0] = { ...firstDay, inboundGrams: 1_000_000, outboundGrams: 2_000_000, value: 3_000_000 };
}

export async function fulfillAnalysisWithCharts(route: Route) {
  const { response, envelope, data } = await readAnalysisResponse(route);
  setDashboardChartSamples(data);
  return route.fulfill({ response, json: { ...envelope, data } });
}

export async function fulfillAnalysisWithZeros(route: Route) {
  const { response, envelope, data } = await readAnalysisResponse(route);
  setAnalysisToZero(data);
  return route.fulfill({ response, json: { ...envelope, data } });
}

function setAnalysisToZero(data: Analysis) {
  initializeChartSamples(data);
  if (!data.monthly.data || !data.comparison.data || !data.tops.data || !data.heatmap.data)
    throw new Error('Analysis fixture is incomplete');
  data.monthly.data.points = data.monthly.data.points.map((point) => ({ ...point, inboundGrams: 0, outboundGrams: 0 }));
  data.comparison.data.current.inboundGrams = 0;
  data.comparison.data.current.outboundGrams = 0;
  data.comparison.data.previous.inboundGrams = 0;
  data.comparison.data.previous.outboundGrams = 0;
  data.tops.data = { products: [], customers: [], suppliers: [] };
  data.tops.verification = 'verified';
  data.tops.reason = null;
  data.heatmap.data.days = data.heatmap.data.days.map((point) => ({
    ...point,
    value: 0,
    inboundGrams: 0,
    outboundGrams: 0,
  }));
}
