import { z } from 'zod';
import { stockBalanceSchema } from './inventory-posting.ts';

const reason = z.string().trim().min(1, '发现原因必填').max(500);
export const createDiscoverySchema = stockBalanceSchema
  .extend({ productCode: z.string().min(1).max(80), reason })
  .strict();
export const updateDiscoverySchema = stockBalanceSchema
  .extend({ reason, version: z.number().int().nonnegative() })
  .strict();
export const deleteDiscoverySchema = z.strictObject({ version: z.number().int().nonnegative() });
export const discoveryMetadataSchema = z.object({
  id: z.uuid(),
  version: z.number().int().nonnegative(),
  reason: z.string(),
  actor: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export const discoverySchema = discoveryMetadataSchema.extend({
  stocktakeId: z.uuid(),
  warehouseCode: z.string(),
  productCode: z.string(),
  productName: z.string(),
  packages: stockBalanceSchema.shape.packages,
  weightGrams: stockBalanceSchema.shape.weightGrams,
});
export const discoveryListSchema = z.object({ items: z.array(discoverySchema), total: z.number().int().nonnegative() });
export const discoveryDeletedSchema = z.object({ id: z.uuid(), deleted: z.literal(true) });
export type CreateDiscovery = z.infer<typeof createDiscoverySchema>;
export type UpdateDiscovery = z.infer<typeof updateDiscoverySchema>;
export type Discovery = z.infer<typeof discoverySchema>;
export const DISCOVERY_MAX_PACKAGES = 2_147_483_647;
export const DISCOVERY_MAX_TONNES = 99_999_999.9999;
export const DISCOVERY_REASON_LIMIT = 500;
export const discoveryCopy = {
  register: '登记发现商品',
  label: '盘盈（新发现）',
  edit: '编辑发现商品',
  remove: '删除发现行',
  product: '商品',
  packages: '实盘包数',
  tonnes: '实盘吨数',
  reason: '发现原因',
  save: '保存发现行',
  confirmDelete: '确认删除这条发现行？',
  deleteDescription: '删除后需重新核对差异，删除前的录入记录将保留在操作日志中。',
  confirm: '确认删除',
  cancel: '取消',
  readonly: '已终结',
  existingStock: '该商品已有库存，请用调整或重新盘点',
  inSnapshot: '该商品已在本单快照内，请录入原行',
  duplicate: '本单已登记该发现商品，请编辑已有行',
  invalidProduct: '商品不存在、已停用或无库存资格',
  missing: '发现行不存在或已删除',
  stale: '发现行已变化，请刷新核对后重试；输入保留',
  overlap: '同一商品同时存在于快照与发现行，禁止回写',
  invalidPosting: '发现商品已失效、已有库存或不属于本仓，禁止回写；请核对后作废重建',
  refresh: '刷新已保存值',
  retry: '输入已保留，请核对已保存值后重试',
  independentWeight: '包数和吨数独立填写，不按包重推算。',
} as const;
