import type { CorrectionInput } from '@wms/contracts';
import { shipmentFixture, type ShipmentFixture } from './multi-shipment-fixture.ts';

export async function shipmentCorrectionFixture() {
  const c = await shipmentFixture();
  try {
    await c.ship(40);
    await c.ship(60);
    return c;
  } catch (error) {
    await c.dispose();
    throw error;
  }
}
export async function correctionInput(c: ShipmentFixture, seq: number, packages: number): Promise<CorrectionInput> {
  const order = await c.current(),
    record = (await c.records()).items.find((item) => item.seq === seq)!;
  return {
    expectedCorrectionRevision: order.corrections!.revision,
    previousCorrectionId: order.corrections!.latest?.id ?? null,
    reason: '发货行更正验收',
    lines: [
      {
        originalLineId: record.lines[0]!.lineId,
        shipmentLineId: record.lines[0]!.shipmentLineId,
        packages,
        weightGrams: packages * 300000,
      },
    ],
  };
}
