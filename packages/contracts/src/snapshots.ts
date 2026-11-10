export const SNAPSHOT_MISSING_TEXT = '历史未记录';
export function snapshotText(value: string | null | undefined): string {
  return value?.trim() ? value : SNAPSHOT_MISSING_TEXT;
}
