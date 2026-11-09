# 文档索引与权威顺序（docs/README.md）

> 2026-11-09 文档入库状态：本批保存外部规格与实现评审快照，不表示全部条款已可直接实施。开工前先处理 [DOC_REVIEW.md](DOC_REVIEW.md) 的必修订项；已有批次的“完成”须按原验收记录区分代码、自动化、设备与生产。011 开发库应用另见 [应用计划](MIGRATION_011_APPLICATION_PLAN.md)，本轮未执行。

## 1. 权威顺序（冲突时从上到下）

1. `AGENTS.md`（项目硬约束）
2. `DOMAIN_RULES.md`（业务规则总纲）
3. `UX_STANDARDS.md`（文案、格式、图标、无硬编码、操作舒适度）
4. `WEB_UX_SPEC.md`（全局交互：操作分层、选择、查询抽屉、商品反查）
5. 各页面规格（`*_PAGE_SPEC.md`、`*_SPEC.md`）
6. `REPORT_SPEC.md`（报表会计口径 D1–D7）
7. 批次记录（`B*_ACCEPTANCE.md`、`B*_VALIDATION.md`、`B*_IMPLEMENTATION_PLAN.md`）

页面规格与 UX_STANDARDS 冲突时，以 UX_STANDARDS 为准。

## 2. 文档分类

### 规则与标准

| 文档 | 作用 |
|---|---|
| `DOMAIN_RULES.md` | 更正、业务日期、入出库异常、取样、报表口径、分批 |
| `UX_STANDARDS.md` | 文案映射、数值格式、图标、配置默认值、评审清单 |
| `REPORT_SPEC.md` | 报表会计口径（D1–D7）与不可验证规则 |
| `WEB_UX_SPEC.md` | 全局交互与查询规范 |

### 页面规格

| 文档 | 页面 |
|---|---|
| `WORKBENCH_SPEC.md` | 工作台 + 数据看板 |
| `STOCK_PAGE_SPEC.md` | 库存概览 + 流水 |
| `STOCKTAKE_SPEC.md` | 库存盘点 |
| `REPORTS_PAGE_SPEC.md` | 报表四页 |
| `CATALOG_PAGE_SPEC.md` | 条码目录 |
| `MASTER_DATA_SPEC.md` | 基础资料（商品/分类/仓库/客户/供应商/车辆） |
| `AUDIT_PAGE_SPEC.md` | 操作记录 |
| `OPS_PAGES_SPEC.md` | 消息中心 + 系统维护 + 个人中心 |

### 计划与记录

| 文档 | 作用 |
|---|---|
| `IMPLEMENTATION_PLAN.md` | 实施进度与未决项（实时更新） |
| `DOC_REVIEW.md` | 实现方评审：代码证据、规格冲突、缺失迁移/接口、矩阵修订及待决策项 |
| `MIGRATION_011_APPLICATION_PLAN.md` | 011 开发库备份、指纹、应用、冒烟与回退计划（未执行） |
| `PARITY_MATRIX.md` | P/U/N 对齐矩阵 |
| `UPGRADE_PROPOSALS.md` | 升级提案 |
| `DESIGN_DECISIONS.md` | 设计决策 |
| `UI_DESIGN_PLAN.md` | **已被 UX_STANDARDS / WEB_UX_SPEC 取代**，仅作历史参考 |
| `UI_SPEC.md` | **已被页面规格取代**，仅作历史参考 |
| `ACCEPTANCE.md` | 总验收记录 |
| `B5A_ACCEPTANCE.md` | B5a 更正与业务日期的逐项验收证据 |
| `B4A_VALIDATION.md` | B4a 边界修补的验收证据 |
| `B1C1_IMPLEMENTATION_PLAN.md` | B1c-1 目录版本化的实施计划（历史） |
| `FOUNDATION_MIGRATION.md` | 基础迁移与回退说明（历史） |
| `B*_ACCEPTANCE.md` / `B*_VALIDATION.md` / `B*_IMPLEMENTATION_PLAN.md` | 单批次记录，作为历史证据 |

### 已废弃

- `docs/references/handoff/figma/`：废弃设计，禁止引用。

## 3. 术语表

| 术语 | 含义 |
|---|---|
| 本系统 | 本项目，替代老系统的仓储业务系统 |
| 老系统 | `https://erp.nbsmzwl.cn`，历史数据与旧版业务入口；文档中常写作“ERP”，两者同义 |
| 历史导入 | 从老系统一次性导入的商品、客户、供应商、历史单据与库存 |
| 条码目录 | 用户手动上传的 sku.txt 全量快照，条码 → 规格 + 实重，只用于扫码 |
| 事实 | PDA 扫码产生的不可变记录（UUID + 正文） |
| 冻结 | PDA 提交扫码事实后锁定，不等于出库 |
| 确认 | Web 端明确操作，写库存、流水、审计 |
| 更正 | 对已入账单据的数量修正，引用原单，不改原值 |
| 锁仓 | 盘点期间禁止该仓的库存变动操作 |

## 4. 当前实现状态（以 IMPLEMENTATION_PLAN 为准）

| 批次 | 状态 |
|---|---|
| B1a 取号/状态回退/用途隔离/确认与调整事务 | 已完成 |
| B1b-1 列表与分页查询 | 已完成 |
| B1b-2 XLSX 导出 | 已完成 |
| B1c-1 目录版本化与上传 | 已完成 |
| B1c-2 PDA 离线目录与队列交接 | 已完成 |
| B2a 撤销与作废 | 已完成 |
| B3a 盘点 | 已完成 |
| B3b 明细/月报 | 已完成 |
| B3c 周转/库龄 | 已完成 |
| B4a 边界修补（更正入口相关、商品维护） | 已完成 |
| B4b OpenAPI 生成器重构 | 已完成 |
| B5a 更正与业务日期 | 已完成（提交 61f4d82，168/168 测试，55+9 E2E） |
| UI-2 全局交互重构 | 未开始 |
| 工作台/看板/库存/报表/目录/审计/运维页面改造 | 未开始 |
| 打印集成（积木） | 未开始，依赖配置 |

## 5. 上线相关

| 文档 | 说明 |
|---|---|
| `CUTOVER_PLAN.md` | 切换方案：期初库存导入、未完成单据、主数据、单号切点、七项校验、回滚预案 |
| `PRINT_SPEC.md` | 积木报表打印：配置表、代理调用、模板映射、安全与验收 |

## 6. 维护规则

1. 规格变更先改文档、再改代码；代码超出规格视为缺陷。
2. 每批完成后更新 `IMPLEMENTATION_PLAN.md` 与 `ACCEPTANCE.md`。
3. 已废弃文档在标题下标注「已废弃」并说明替代文档。
4. 不新增第 5 份 UI 规范——UI 约束只放 `UX_STANDARDS.md` 与 `WEB_UX_SPEC.md`。

## 7. 页面改造批次索引

沿用 PARITY_MATRIX 末尾的编号；依赖与建议执行顺序见 [DOC_REVIEW](DOC_REVIEW.md) 第6节。以下是计划映射，不是本轮功能实施授权。

| 批次 | 规格 |
|---|---|
| UI-3 工作台与看板 | WORKBENCH_SPEC.md |
| UI-4 库存概览与流水 | STOCK_PAGE_SPEC.md |
| UI-5 报表四页 | REPORTS_PAGE_SPEC.md + REPORT_SPEC.md |
| UI-6 条码目录 | CATALOG_PAGE_SPEC.md |
| UI-7 操作记录 | AUDIT_PAGE_SPEC.md |
| UI-8 消息、维护、个人中心 | OPS_PAGES_SPEC.md（拆三个子批） |

MASTER_DATA_SPEC、STOCKTAKE_SPEC、PRINT_SPEC、CUTOVER_PLAN 单列批次；不得因不在 UI-3～8 表内而遗漏。
