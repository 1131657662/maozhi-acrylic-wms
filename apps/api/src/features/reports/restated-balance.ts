import type { RestatedBalance } from '@wms/contracts';
import type { DatedEvent } from './restated-events.ts';
import { reportCopy } from './copy.ts';

export function restatedBalance(events: DatedEvent[]): RestatedBalance {
  // No certified T0 / covered-event registration exists yet. An observed posted
  // boundary is not proof of an opening anchor for reallocated business events.
  const reasons: string[] = [reportCopy.missingRestatedAnchor];
  if (events.some((event) => !event.reportingDate)) reasons.push(reportCopy.missingBusinessDate);
  if (events.some((event) => !event.postedAt)) reasons.push(reportCopy.missingTime);
  return {
    openingPackages: null,
    openingGrams: null,
    closingPackages: null,
    closingGrams: null,
    differencePackages: null,
    differenceGrams: null,
    checkState: '不可验证',
    reasons,
  };
}
