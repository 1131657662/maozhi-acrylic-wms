export type FindingKind = 'color' | 'radius' | 'padding';

export interface Finding {
  file: string;
  line: number;
  column: number;
  kind: FindingKind;
  value: string;
}

export interface AllowlistEntry {
  file: string;
  kind: FindingKind;
  value: string;
  reason: string;
  batch: string;
}

export interface CheckResult {
  existing: { finding: Finding; entry: AllowlistEntry }[];
  violations: Finding[];
  stale: AllowlistEntry[];
}
