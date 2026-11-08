# 四端重建 / 第一里程碑

日期：2026-11-07。来源：用户本轮指令优先于只读交接包中的旧技术/审批建议。

## 范围与决策

单用户模块化单体，无租户、组织权限、角色矩阵、多级审批。Web 一次确认出库。
Web 使用官方 Ant Design Pro v6.0.3 工程结构、Umi Max、ProLayout、ProForm、ProTable 和 ProDescriptions；后端使用 Express 5 + TypeScript + Zod；原生微信小程序 + Vant；Kotlin + Room + WorkManager。
开发库使用本地隔离 MySQL 8；迁移脚本提供 up/down，业务 SQL 不使用 SQLite 专有语法。测试为每轮创建并销毁的临时 MySQL 库，必要时可使用内存级测试替身，但不连接生产。
重量使用 MySQL DECIMAL(12,4) 吨，接口继续使用整数克，转换不经过浮点舍入。
包数与总吨数独立；内部整数克、100g 精度，API 返回整数克；展示吨四位小数。
PDA 队列事实不可变且固定 UUID；离线保存、重试同一正文；服务端验证目录实重与来源。
冻结校验 revision + SHA-256 摘要，冻结不写库存。Web 确认在单事务中扣库存、记流水、审计及幂等结果。

## 阶段与验收

- [x] 阅读交接资料、截图、实重记录和旧字段；记录设计取舍。
- [x] 建工程与共享契约、隔离数据库。
- [x] 登录、分页出库列表/详情、扫码接收/冻结、Web 确认。
- [x] PDA 离线队列与补传；小程序只读查询实现。
- [x] 安全/幂等/重开/库存边界测试；Web 与 Android 构建/界面验证；备份恢复演练。
- [ ] 微信开发者工具与真机渲染验收、物理扫码枪/功能键和长时间弱网验收（不以模拟测试代替）。

### 第二阶段（代码完成，浏览器模拟验收通过）

- [x] 商品、仓库、客户、供应商主数据列表、新增、改名和启停。
- [x] 入库列表、详情和登记；包数与该商品本次总吨数分开录入，确认时原子增加库存并记流水、审计和幂等结果。
- [x] 待扫码出库计划新建、编辑；编辑携带 revision/digest，已有事实或冻结后拒绝修改，创建/编辑不预占库存。
- [x] Web 同源身份、PDA/小程序访问边界与业务 HTTP 契约测试。
- [x] TypeScript/生产构建、API 测试和 Playwright 浏览器 E2E；详细边界见 `docs/ACCEPTANCE.md`。

第二阶段规则仍待现场确认：入库单当前只支持一次确认，不支持撤销/更正；重复入库需要使用新单号。主数据提供启停，不物理删除；已建单据保留名称快照。若这些规则与现场操作冲突，应先完善反向流水/更正模型再上线使用。
后续阶段：手工实重/CSV、日志查询完善；再做旧数据只读对账、硬件和生产上线验收。

## 尚未确定的业务与保守处理

1. 真实条码目录、版本和实重已从 `sku.txt` 只读解析：9018 条包级条码、141 条规格；商品目录使用独立 `SPEC-001` 至 `SPEC-141`，重量从 kg 以十进制转换为 `DECIMAL(12,4)` 吨，不从条码推算。
2. 缺重现场称量、短装/超发及差异容差：本阶段不开放，数量或计划重量不一致禁止冻结。
3. 多设备占用与 claim TTL：单用户先按持久化事实唯一约束和乐观版本保护，不假定设备独占。
4. ERP 单据状态和库存流水类型原样保留在来源字段（例如 `audited`、`submit`、`inbound`、`outbound`、`check`、`import`）；当前 API 展示层对未知值采用原文回退，不把它们语义映射为 `open/frozen/confirmed`。
5. 旧 SCHEMA_WMS 字段表模板未展开；只能从残留 COLUMN_NAME 判断字段，正式适配前须重新只读导出。
6. ERP 商品 428 行全部保留原 code；141 条 `sku.txt` 规格是独立的条码目录商品，两套商品不建立关系，原因是没有可靠映射键。生产样本中的软删行全部导入并以 `source_del_flag=1` 标记，不参与当前业务查询；孤立历史明细保留原 product/order code 和来源 JSON，不修生产历史数据。
7. 样本 seed 只在空的隔离 MySQL 8 开发库执行，已有身份或数据时拒绝覆盖；生产快照只读导出不进入 Git。单据编号、未知状态/流水类型的业务含义、ERP 商品与条码目录关系仍待现场确认。

## 兼容与回滚

保留 order_no、warehouse_code、product_code、qty 与 decimal(12,4) 吨的含义，旧 bigint ID 在适配中以字符串传输。
保留历史 del_flag 与业务单据/流水，不把生产 12 用户/4 角色带成新权限体系。
新 API /api/v1；旧 /api/scan 与 /api/outbound/order 在后续显式适配，不声称已兼容。
先读旧快照并逐单对账，确认包数和吨数分别一致后才设计切换；不双写、不自动覆盖。
所有现阶段变更限新目录。停止新服务即可退出本地试用；生产切换与不可逆数据操作须另行批准。

## B1a 第 1 提交：RK/CK 取号与原文回退（2026-11-08）

本提交仅实现取号和现有 Web 状态/流水展示；第 2 提交双来源分组、第 3 提交确认/审核/调整事务均待用户验收后放行。B1b 查询壳、响应式重构、导出/打印 schema 未开始。

### 四个风险的决定与理由

1. **首次计数器**：按北京时间业务日、固定 RK/CK 前缀扫描两类单据中完整匹配的数字尾号，用 `BigInt` 找最大值，补零位数不同也参与；含软删号。无法完整解析的历史号不猜、不改、不忽略其占用：最终候选仍按原字符串查询两类单据，已存在立即报 `NUMBERING_COLLISION`。超出 8 位容量明确阻断，不溢出截断、不反复猜号。不会把旧号重新编号。
2. **调宽/调窄**：宽度只影响补零，计数器不重置。配置保存、旧请求建单、新自动建单均先获取已有 `app_meta.identity` 事务锁，再处理规则/计数器/单据，统一锁序。保存配置在锁内验证版本、下一号碰撞和宽度容量；冲突 409 并保留原规则，前端保留已填宽度。已有号码不改。当前单用户少量写入沿用已有全局写锁，避免引入另一套锁序；并发吞吐不是本提交优化目标。
3. **旧请求兼容**：`receiptNo`/`orderNo` 由必填改为可选。省略时自动取号；显式提供时保留原号（沿用既有 trim 校验），查重失败仍返回既有重复号错误，不偷偷替换。成功/冲突响应含 `Deprecation` 和 `X-Document-Number-Mode: legacy-preserved`；暂不设删除兼容入口日期。编辑可省略或原样回传旧号，试图修改则 `DOCUMENT_NUMBER_IMMUTABLE`。因此缓存旧前端、脚本和 PDA/小程序只读响应不会突然失效。
4. **审核/撤销归属**：入库审核/明确确认归 B1a 第 3 提交（正向库存、前后值、原因、流水与审计事务）；撤销审核、作废、更正归 B2（补偿流水及后续出库依赖检查）。B1b 仅共同能力，不处理状态流转。本提交不改变当前入库登记即确认行为，也不将历史状态强制变为本地枚举。

### API 变更

全部沿用 `/api/v1` 信封和身份校验。新增入口仅 Web Cookie 会话；PUT/POST 继续要求允许的 Origin 和 UUID `Idempotency-Key`。不向 PDA 或小程序开放配置写入。

| 端点 | 请求/响应变化 | 失败及兼容 |
| --- | --- | --- |
| `GET /document-numbering` | 两规则：kind、prefix、width、version、dateKey、timeZone、preview、previewError；默认宽度 4；不写表、不占号 | 预览冲突/超限返回 preview=null 及原因；最终号只认创建成功响应 |
| `PUT /document-numbering/:kind` | kind=inbound/outbound；正文 width=2..8、expectedVersion；响应更新后规则；幂等键重放返回原结果 | `NUMBERING_COLLISION`、`NUMBER_SEQUENCE_EXHAUSTED`、`NUMBERING_VERSION_CONFLICT` 为 409；非法字段/种类为 422；成功写配置审计 |
| `POST /inbound` | receiptNo 可选；响应保留 receiptNo，增加原始 nullable status；旧缓存幂等结果缺 status 时为 null | 旧指定重复号 `RECEIPT_NO_EXISTS`；自动号、库存、流水、审计、幂等结果同事务 |
| `POST /outbound` | orderNo 可选；响应 orderNo 不变 | 旧指定重复号 `DUPLICATE_ORDER_NO`；不预占库存；自动号与单据同事务 |
| `PATCH /outbound/:id` | plan.orderNo 可省略或原样回传；仍要求 revision/digest | 改号 409 `DOCUMENT_NUMBER_IMMUTABLE`；其他编辑规则不改 |
| `GET /inbound`、`GET /inbound/:id` | 返回库内原始 status；null 为未记录 | 不用“已入库”硬编码覆盖历史状态；不改历史库值 |
| `GET /stock/journal?limit=20` | limit 1..100；id、type、warehouseCode、productCode、packagesDelta、weightDeltaGrams、createdAt | 只读、排除软删；历史 type 含 null 原样返回，仅无 source_id 的本地流水按明确入/出库外键标记；不添加查询壳和合计 |

`StatusTag` 对未知字符串用中性灰原文（包括 `constructor` 等原型属性名）；null 显示“未记录”，空串显示“空值”。未确认含义的 submit/check/import 不强行翻译；未知状态不画本地三步流程、不开放确认按钮。`JournalTypeTag` 同样保留未知原文。

### 调用点核查（不是直接删字段）

| 调用点 | 本提交处理 |
| --- | --- |
| `apps/web/src/features/inbound/editor.tsx`、`use-create-receipt.ts` | 去手填输入；创建省略 receiptNo；同一未离开表单的同正文重试保留幂等键 |
| `apps/web/src/features/outbound/editor.tsx`、`use-create-plan.ts`、`use-update-plan.ts` | 新建省略 orderNo；编辑显示只读原号；不改变返回号字段；创建同正文重试保留键 |
| `packages/contracts/src/inbound.ts`、`outbound-plan.ts`，API create/plans/controllers | 可选旧字段、原号兼容/查重、弃用响应头、编辑保号；旧入库幂等结果可解析 |
| `apps/api/tests/inbound.test.ts`、`plans.test.ts`、`business-http.test.ts` | 保留手填调用作为旧协议回归；新增 numbering 测试覆盖现代自动号及旧协议 |
| `tests/e2e/outbound.spec.ts`、`numbering.spec.ts`、`retry-numbering.spec.ts` | 自动号/保号、配置碰撞/四态、丢响应后的同键重试；不再依赖手填号 |
| `scripts/e2e-api.ts`、`scripts/e2e-numbering-fixtures.ts` | 修正既有错误的 seedDemo 导入到 seed-test；仅白名单临时库注入未知状态/碰撞场景 |
| `scripts/setup-demo.ts`、`setup-sample.ts`、`apps/api/src/db/seed-history.ts` | 样本走历史导入 SQL，保留原号，不调用自动取号；本轮不改 |
| `apps/api/src/openapi.ts`、`scripts/openapi.ts`、`docs/api/*` | 生成契约更新可选字段和新增入口，响应仍有原单号 |
| `apps/pda/app/src/main/java/cn/maozhi/wms/pda/ui/PlanScreen.kt`、`ScanScreen.kt` | 仅读 orderNo，响应不改，未修改 PDA |
| `apps/miniapp/pages/outbound/index.wxml`、`pages/detail/index.wxml` 与请求服务 | 仅读 orderNo，无建单调用，不改小程序；既有真实请求契约测试继续跑 |
| 可能缓存的旧 Web / 外部本地脚本 | 保留旧字段路径、原响应字段、旧幂等正文；通过响应头提示升级，不静默拒绝所有旧请求 |

### 004 迁移与回滚

- 新增 `document_number_rules(kind,sequence_width,version)` 和 `document_number_counters(kind,date_key,last_sequence)`；主键、种类/宽度 CHECK、规则外键；不修改 001–003，不导入默认行，不碰历史单据/库存数据。
- 日期采用 `Asia/Shanghai`。预览只读；配置首次保存或自动建单才建立规则；当天首次自动取号才建立计数器。提交失败计数器也回滚，已提交号不复用。
- 开发升级命令为 `npx tsx scripts/mysql/migrate.ts up`，连接验证限定本机 3307 白名单库；不运行生产迁移，不运行种子覆盖。
- down 必须经 `migrateDown` 执行，停服务后才允许空表回退；规则或计数器任一非空即拒绝，不删数据。非空时只回退整套 Web/API 代码，保留 004 表及编号记录，不手工执行 DROP 脚本。
- 应用回退到上一提交时，新旧 Web/API 要成套切换；旧 API 不具备自动号，因此不能只退 API 而保留新表单。没有新增业务 feature flag，不宣称可一键关闭。
- 本提交未承诺跨刷新/关闭页面后的草稿恢复；页面内丢响应重试已保留同键同正文。持久草稿属于后续批次。

## B1a 第 2 提交：双来源不合计（2026-11-08）

> 历史记录：下述多入口设计已被本文件末尾“用途隔离修正”取代；不得再作为当前业务口径。原守卫和兼容机制保留。

- 分组依据是 `master_products.source_kind`：`erp-product` 为 ERP 历史商品，`sku-spec` 为 SPEC 条码目录商品；不按名称、编码前缀、库存记录是否有 source_id 推断来源。两套商品不建立映射。
- `app`、`test`、未知来源以及缺失主数据的库存归入 `unclassified`，保留明细及原始来源，**不提供小计**。有效库存不因商品停用而消失；来源关联保留停用/软删商品的来源信息，库存及流水本身的 `source_del_flag=1` 始终排除。
- 新 Web 只调用 `GET /api/v1/stock/by-source?source=...` 与 `/stock/by-source/journal?source=...&limit=20`；source 必填且只允许上述三个值，遗漏、all、多值、额外 total 参数均 422。新入口只允许 Web 会话。
- 响应 `source/items/subtotal` 仅属一个来源；逐行 source 必须与响应 source 一致，未归属 subtotal=null。契约严格拒绝额外 total 字段和混源行。库存小计由同一读取事务内的 SQL 生成，返回整数克；不累计 scan_catalog 重量。
- 页面没有“全部”选项、总计字段、跨来源选择或 reduce 合计路径。每次只挂载一个来源面板；缓存键包含来源，切换时不沿用上一个来源数据；错源响应停止展示。流水也随来源切换，无流水合计。
- `/stock` 原始数组契约与 `/stock/journal` 原接口保持不变。小程序仅调用出库查询，PDA 调用扫码计划/目录/事实，均未修改；测试仍验证三渠道读取旧 stock 的响应一致。新的查询代码不调整业务确认事务。
- 当前没有报表页面或报表端点；本轮验证可供后续报表使用的单来源契约，不声称四类报表已完成。后续报表必须使用来源必填的查询，不得接回旧无来源数组做汇总。
- 未知状态标签增加“状态待识别”文字，入/出库详情常驻说明原值、不能判断的含义和核对原单的下一步；出库确认继续禁用，不通过 tooltip 隐藏关键说明。
- 浏览器回归发现 Umi MFSU 缓存旧工作区契约导出；仅将 `@wms/contracts` 从第三方依赖预编译排除，随源码编译，防止新增契约在开发环境为 undefined；不更换框架或依赖。
- 不新增迁移、不改历史数据。回滚顺序为先回退独立 OpenAPI 生成物提交，再回退本批 Web/API/契约；旧查询可恢复，已有库存、商品、流水和 004 编号表不变。

### 可执行证据与数学边界

SQL：[`scripts/sql/verify-stock-sources.sql`](../scripts/sql/verify-stock-sources.sql)。命令 `npx tsx scripts/verify-stock-sources.ts` 仅以 READ ONLY 事务读取固定的本机 3307 样本库；`npx tsx --test apps/api/tests/stock-source.test.ts` 在独立临时库执行相同 SQL 并自动清理。

真实样本 SPEC 只有目录、没有库存，因此 ERP+0 必然等于 ERP；不能伪造“不等式”或把目录重量当库存。真实输出保存 `.local/evidence/b1a2-sample-sql-output.txt`。隔离夹具同时设置非零 ERP/SPEC，SQL 比较小计、明细和最近流水的所有包数/吨数候选值，E2E 再比对实际 DOM；同时验证界面请求均含来源。数值巧合相等不能替代来源链路证据。

源码、测试与说明为一个业务提交；`docs/api/openapi.json`、`docs/api/ENDPOINTS.md` 在独立生成物提交中。第 3 提交确认/审核/调整事务和 B1b 仍未执行。

## 用途隔离修正（2026-11-08）

- 已确认：`sku.txt` 是条码→规格+实重的扫码目录，不是库存。库存与单据只认 `source_kind='erp-product'` 的 ERP 商品；`sku-spec` 只属于 B1c 条码目录页面，本轮不开发该页、不建立猜测映射。
- 本次仅纠正库存展示：删除 SPEC/未归属页签、表格分支及占位，固定请求 ERP 库存/流水，保留未知状态说明和旧 `/stock` 契约；不扩大到建单、确认、调整事务重构。
- 保留现有 API 的来源参数守卫及严格响应校验：拒绝缺省/all/多来源/总计参数、混源或附加总计响应。兼容查询能力不是非 ERP 业务库存入口；后续报表也只能采用 ERP 口径。
- 未归属有效库存行只以 `stock.unclassified_detected` 结构化警告记录行数，不返回用户提示字段或业务数据；同一数据库对象的行数不变不重复刷日志，进程重启或行数变化后可重新记录。没有数据写入或自动归类。
- E2E 合成作业商品仅在独立临时测试库标记为 ERP，使出库确认后的库存回归继续覆盖唯一 ERP 视图；非 ERP 异常夹具仅验证排除与防混源，不代表第二套库存。
- 无迁移、依赖、API 契约或 OpenAPI 生成物变化；回滚本次提交即可恢复代码，原始库存/单据/目录数据不变。B1a 第 3 提交、B1b 和 B1c 未执行。
