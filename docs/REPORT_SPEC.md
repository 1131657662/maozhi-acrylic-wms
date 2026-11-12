# B3b / B3c 报表口径建议

> 本文档中的状态、类型、结果等库值仅作实现标识；界面显示必须按 docs/UX_STANDARDS.md 映射为中文。

状态：**D1–D7 主口径及入库撤销已耗用层的处理均已由用户确认；B3b 已实现并完成本地验证，待用户验收；B3c 代码已完成，周转率冷首屏未达性能目标；B5c-2 实现有效收发量及更正明细，验证见 B5C_SPEC 本批记录；B5d 重述尚未实现。** 文档日期：2026-11-12；旧实现核对代码基线：`3f4c29efea1f010194f62bcbc0c8df2f587da4ca`；B3b 开工基线：`e37083c79dd81465aa84367f5a0bb2d00502d879`。

B3b 范围为月度汇总、出入库明细及既有 XLSX 通道；未新增迁移、依赖或库存写逻辑，没有连接生产。第 1–7 节的主口径已确认，其中第 6–7 节由 B3c 实施。下述实施边界和 [ACCEPTANCE](ACCEPTANCE.md) 区分代码、自动化/浏览器验证及未进行的生产验收。

用户追加的三条硬规则已实现：每张报表常驻 `期初 + 入库 − 出库 ± 调整 = 期末` 的包/吨对账行；历史无时区时间按上海本地原文解释并标“时间未核实”，不整体加八小时；断链区间标“不可验证”，未知边界为 null，不填 0、不生成补平调整。

## 适用范围与证据

- 库存、单据、报表只认 `erp-product`；`sku.txt`、`sku-spec`、目录版本和未确认扫码记录不构成库存发生额。出库确认采用已入账的实际包数、实际重量，不能再次从当前目录查重。
- 统计基本单元为“仓库编码 × ERP 商品编码”；按名称、型号合并可能串商品。历史有效流水不因商品现在停用而消失；缺主数据须列诊断，不能静默丢行或猜测来源。
- 包数与吨数独立累计；库内 `DECIMAL(12,4)`、接口整数克，先精确求和后显示。不得用平均包重反推包数/重量，不得逐行四舍五入后再求合计。
- “旧系统怎么算”指本地旧 ERP 源码可核实行为，不代表已核对线上部署版本。旧页面分别请求 `/report/monthly-summary`、`/report/turnover`、`/report/stock-aging`：见 [MonthlySummary.vue:69](D:/wms-new/wms-frontend-pure/src/views/wms/report/MonthlySummary.vue#L69)、[Turnover.vue:132](D:/wms-new/wms-frontend-pure/src/views/wms/report/Turnover.vue#L132)、[StockAging.vue:90](D:/wms-new/wms-frontend-pure/src/views/wms/report/StockAging.vue#L90)。本文不把旧 `slice` 的另一套实现当成这些页面的口径。
- 只读核查已存在的 `.local/prod-sample/*.csv`；原始数据不进入 Git 或本文。沿用已确认总行 828 / 有效 804 / 软删 24 的流水基线。新增聚合结果、文件 SHA-256、日期差异与完整性诊断留在 [本地数据诊断](../.local/evidence/b3b-report-data-profile.json)，不把样本明细写进文档或测试断言。
- 本轮 CSV 精确累计发现：有效流水净变化与样本库存期末一致，逐行前后值等式成立；但中间链仍有断点，且存在业务日与流水日跨月。**期末总量相等不等于各历史日/月完整**。诊断路径为 `journal.*`、`dates.*`；附录只读 SQL 可复核相同问题。

## 1. 业务日期与跨月归属

### 旧系统

- 月度汇总使用头表 `inbound_date` / `outbound_date` 的年、月，且只取 `audited`、`completed`；不用制单时间或审核时间：[reportMonthlySummaryService.js:16](D:/wms-new/wms-backend/services/reportMonthlySummaryService.js#L16)（16–39 行），状态值见 [constants.js:2](D:/wms-new/wms-backend/config/constants.js#L2)。因此业务日在上月、审核在本月的单，按当前状态查询时会被算回上月。
- 出入库明细也按业务日期筛选、排序；进销存台账却按流水 `create_time` 筛选：[reportInboundDetailService.js:28](D:/wms-new/wms-backend/services/reportInboundDetailService.js#L28)、[reportOutboundDetailService.js:28](D:/wms-new/wms-backend/services/reportOutboundDetailService.js#L28)、[reportStockJournalService.js:13](D:/wms-new/wms-backend/services/reportStockJournalService.js#L13)。两者并非天然同月。
- B3b评审时建单尚无独立业务日期，B5a已通过011补齐；以下链接保留历史对照：[inbound.ts:16](../packages/contracts/src/inbound.ts#L16)、[outbound-plan.ts:5](../packages/contracts/src/outbound-plan.ts#L5)。历史业务日仍在 `source_row_json` 中，seed 的 `created_at` 来自旧制单时间，并不是业务日：[seed-history.ts:22](../apps/api/src/db/seed-history.ts#L22)（22–46 行）。

### 推荐与理由

**不用制单时间作为收发存归属。默认月度汇总、入账明细和库存余额统一按“入账日”；保留业务日期作说明与单据核对。** 这样不会在确认后把库存变化挪到一个尚未发生该变化的月份。

| 字段 / 场景 | 建议规则 |
| --- | --- |
| 制单时间 | 仅说明录单先后；不决定库存发生额所属月。 |
| 业务日期 | 旧单读取原 `inbound_date` / `outbound_date`；本地新单B5a默认上海当天，超过3个日历月须确认、不得未来；出库冻结/入账后锁定。011之前NULL仍显示“未记录”，不拿制单日或导入日冒充；入账后日期更正另留历史。 |
| 新操作入账时间 | 已提交操作的 `inventory_operations.created_at`，同一操作的所有流水同一归属时间；失败/未提交操作不出现。现有写入见 [operation.ts:20](../apps/api/src/features/inventory/operation.ts#L20)（20–32 行）。它是事务内记账时间，不宣称是数据库物理 COMMIT 时间。 |
| 历史入账时间 | 原流水 `source_row_json.create_time`；保留原文与来源，缺失则“历史入账时间待核实”，不回退成导入时间。审核时间另列辅助核对，不能替换流水日。 |
| 跨月确认 / 撤销 | 业务日可以早于入账日；确认进入确认入账月，补偿进入撤销入账月，不回写上月，不删除原月发生额。 |
| 时区 / 截止 | 统一按 `Asia/Shanghai` 自然日；筛选采用 `[起日 00:00, 末日次日 00:00)`，避免漏掉末秒毫秒。新操作 UTC 转上海日；同次屏幕与导出固定截止时间和已提交流水水位。 |

历史时区须专门核实：旧连接配置为 `+08:00`，见 [database.js:13](D:/wms-new/wms-backend/config/database.js#L13)；新池为 `Z`，见 [mysql.ts:54](../apps/api/src/db/mysql.ts#L54)，seed 又直接保存无偏移的旧时间文本。建议历史时间在**报表读取投影**中按上海本地时间解释，并保留原文；这仍需核对导出/旧服务实际时区，不能仅据驱动配置就宣布已验证，更不能对历史 `created_at` 无区别加一次八小时。本轮不改存量时间。

### 差异、备选与风险

- 与旧月报相比，跨月迟确认会归到不同月份；必须有“业务日期 / 入账日期”两列和跨月说明，不能把差异当计算误差。样本差异已在本地诊断 `dates` 中量化。
- 备选：继续按业务日期做经营月报。但必须明确它可以追溯改变过去月份，且不能直接和按入账日的期初、期末拼成收发存等式；需要独立的口径标识及迟录调整规则。B3b只实现默认入账口径；已确认的B5d重述视图按§10显式标注并给归期桥接，不取消DOMAIN规定的开关。
- 合成验收例：2030-01-31 业务发生、02-02 确认，主报表计 2 月；03-01 误确认撤销计 3 月负向业务量；原业务日仍为 1 月，三个日期均可查。此例不来自生产记录。

## 2. 期初起点与历史完整性

### 旧系统

- 收发存用**查询时当前库存**作为期末，倒算 `期初 = 当前库存 − 区间入库 + 区间出库`；只遍历当前正余额商品：[reportPeriodSummaryService.js:16](D:/wms-new/wms-backend/services/reportPeriodSummaryService.js#L16)、[reportPeriodSummaryService.js:72](D:/wms-new/wms-backend/services/reportPeriodSummaryService.js#L72)（72–99 行）。没有扣除查询截止日之后的变动，也没有把调整/盘点纳入倒算，已清零商品可能漏行。
- 旧月度结算有另一算法：月初之前取最大流水 ID 的 `after`，当月有 `import` 时优先用当月最后一次导入后的余额作期初；当月发生额却仅取入/出库并按单据业务日筛选：[reportInventorySettlementService.js:293](D:/wms-new/wms-backend/services/reportInventorySettlementService.js#L293)（293–374 行）。导入并不必然发生在月初，且期间盘点/调整未进入该收发列表。

### 推荐与理由

**以可验证、不可变的切账库存快照 T0 为锚点，后续只累计已提交的有效库存 delta；不默认“最早一条流水之前全是零”。**

1. 开发样本锚点取已导入批次的原 `stock` 快照和 manifest/hash、被该快照覆盖的历史流水集合；不能把 seed 重跑日、导出结束时间或今天的当前库存当成上线日库存。正式上线另需同一一致性快照中的切账时点、库存与流水水位，本轮不执行。
2. 所有锚点已经包含的历史流水（含历史 `import`）只用于解释来源，不再叠加一遍。现有本地新操作属于锚点后事件；固化锚点时必须核对导入批次与事件水位，不能重复开账。
3. 对 `T0 ≤ S < E`，逐仓库商品计算：`期初(S) = 锚点余额 + Σ[T0,S)有效delta`；`期末(E) = 期初(S) + Σ[S,E)有效delta`。边界以固定水位消除同时间戳歧义；所有已提交库存类型都进入余额等式，不仅是入/出库。
4. 历史期初只有在起点、逐行 `before+delta=after`、相邻衔接、类型/时间、末值与锚点均核对后，才能标“已验证”。仅全量 SUM 与当前库存相等不够；当前样本存在中间链断点，不默认给所有历史月份盖章。
5. 未验证区间仍展示可识别的历史发生额和原流水；期初/期末显示 `—（历史期初未核实）`。标出覆盖起日、完整性状态和异常单元数。已验证无业务才是 0；未知不是 0。总计包含未知部分时也标不完整，不能只加已知部分却叫“总库存”。

**B3b 实施边界：**当前库没有正式上线 T0/流水水位登记，故本批不伪造切账时间，也不把导出时间当 T0。历史末值先与不可变 `stock.source_row_json` 原快照交叉验证，再核对末流水与当前库存；按固定只读快照逐仓品检查前后值、相邻衔接与时间顺序。期初/期末只能采用日期边界之前实际观察到的余额（恰在边界的首笔可用 before），不通过“本期发生额倒减当前库存”制造余额。已有观察值可展示，但断点覆盖区间始终标“不可验证”；无观察证据显示 `—`。任一仓品边界未知，则总对账的对应边界/差额也为 null。正式上线 T0 登记与时区核实仍为上线前未决项，不在本批宣称已验。

### 差异、备选与风险

- 备选：从最早有效流水及其 `before` 重放，只有每个仓库商品完整链通过校验才可采用。优点是可扩展历史月数；风险是旧软删/撤销中间缺记录，期末偶然相等仍会掩盖错误。建议作为历史核实路径，不是全库默认起点。
- 不因当前余额为 0 而删除历史行；维度集合取锚点、期间流水的并集。中间缺口不自动造“期初调整”抹平，不修改旧库存或补偿原记录。
- B3a 盘点快照是其仓库/商品范围、快照时点的证据；盘点回写才改变账面余额。它可用于该范围局部对账，但不能替代其他仓库或更早月份的全库期初。

## 3. 历史流水类型与 24 条软删

### 旧系统

旧列名是 `stock_journal.business_type`，新导入列是 `source_business_type`，原字符串及整行都保留：[seed-history.ts:66](../apps/api/src/db/seed-history.ts#L66)。含义按实际写入路径判断，不能按 delta 正负或类型英文猜测。

| 原值 | 旧代码实际含义与证据 | 推荐是否计收发 / 是否计余额 |
| --- | --- | --- |
| `inbound` | 入库记正变化：[inbound_order.js:514](D:/wms-new/wms-backend/controllers/inbound_order.js#L514)。旧撤销直接反向改库存、软删该单入库流水：[inbound_order.js:696](D:/wms-new/wms-backend/controllers/inbound_order.js#L696)（696–709 行）。 | 有效且证据正常时计入库，按原 signed delta；计余额。不把负值自动命名为退货。异常符号保留并标诊断。 |
| `outbound` | 出库写负变化：[outbound_order.js:508](D:/wms-new/wms-backend/controllers/outbound_order.js#L508)（508–517 行）；旧撤销加回库存并软删流水：[outbound_order.js:696](D:/wms-new/wms-backend/controllers/outbound_order.js#L696)（696–724 行）。 | 有效时出库业务量为 `−delta`；余额仍用原 signed delta。不用绝对值掩盖补偿。 |
| `check` | 盘点实盘值减当时库存，写 `before/after`：[stock_check_order.js:229](D:/wms-new/wms-backend/controllers/stock_check_order.js#L229)（229–258 行）。 | **不计入库/出库**；单列盘点差异，signed delta 计余额。零差异行可追溯，但不虚增收发量。 |
| `import` | 既有余额被替换时写“导入值−原余额”，新建或恢复软删行时从 0 起记：[stock.js:507](D:/wms-new/wms-backend/controllers/stock.js#L507)（507–599 行）。 | **不计入库/出库**；单列初始化/导入调整，不能全当采购入库。锚点已覆盖的导入不再计一次；锚点后的真实导入 delta 才作为该期其他库存变化。 |

**软删推荐：24 条全部保留供历史审计，经营统计、余额累计、周转率和库龄重放排除；同时显示排除数量，不转成 24 条新补偿。** 总行 828 / 有效 804 / 软删 24 必须可核对。旧代码证明撤销可能导致软删，但不能据此断言每条软删的具体业务原因。

旧 `/report/stock-journal` 的 WHERE 从 `1=1` 起，没有 `del_flag=0`，见 [reportStockJournalService.js:8](D:/wms-new/wms-backend/services/reportStockJournalService.js#L8)（8–34 行）；月报与结算却排软删。因此旧台账可能展示 828 行而其他报表按有效数据计算，这是需要纠正并解释的差异。

### 新操作与风险

| 新操作原值 | 报表归类 | 对余额的贡献 |
| --- | --- | --- |
| `inbound.confirm` / `inbound.reverse` | 入库确认 / 入库撤销 | 完整 signed delta 计有效入库；算法见 §10。 |
| `outbound.confirm` / `outbound.reverse` | 出库确认 / 出库撤销 | 完整 signed delta 取负计有效出库；算法见 §10。 |
| `stock.correct` / 撤销中的correctionOffset | 更正 / 更正抵消 | 明细独立可查，收发分类与抵消算法唯一见 §10。 |
| `stock.adjust` | 人工调整 | 单列 signed delta，不计收发。 |
| `stocktake.post` | 盘点回写 | 单列 signed delta，不计收发。 |
| 未知历史类型 / 未知操作 | “未识别类型” | 不挤进入/出库。若确为有效库存流水，其 signed delta 保留在“未分类变动”平衡项；分类质量标待核实。包数/重量不能被静默抛弃。 |

新操作集合见 [operation.ts:6](../apps/api/src/features/inventory/operation.ts#L6)；盘点写流水见 [stocktake-posting.ts:42](../apps/api/src/features/inventory/stocktake-posting.ts#L42)。优先识别明确 `operation_id` 及操作类型；历史按来源原值分类，二者不得双计。无法证明具备库存资格/来源证据、符号异常或链不完整的记录必须进入可见诊断，不能靠类型标签让它自动通过完整性校验。

备选“所有正数都算入库、负数都算出库”会把盘点、导入和撤销当实物流转，**不建议做**。备选“把软删加入余额再对冲”缺少历史反向操作证据，同样不建议。

## 4. 月度汇总、净入库与补偿

### 旧系统

按已审核/完成单据明细 SUM 入库、出库包数与重量，`COUNT(DISTINCT 单据ID)` 计单数：[reportMonthlySummaryService.js:16](D:/wms-new/wms-backend/services/reportMonthlySummaryService.js#L16)（16–39 行）。前端净入库重量为入库重量减出库重量：[MonthlySummary.vue:339](D:/wms-new/wms-frontend-pure/src/views/wms/report/MonthlySummary.vue#L339)。旧撤销会改回提交状态并软删流水，原月报可能随之减少；没有独立、可追溯的负补偿列。

### 推荐与理由

按第 1 节入账月、第 2 节完整性、第 3 节分类计算。以下 `d` 对包数、吨数分别独立应用，**不得 ABS**：

| 指标 | 推荐公式 / 呈现 |
| --- | --- |
| 入库确认量 `I+` | 含更正的有效量，见 §10；历史异常符号另标。 |
| 入库撤销量 `I−` | 完整撤销 signed delta，见 §10；可展开原操作。 |
| 入库量 `I` | `I+ + I−`；标题注明“含撤销冲回”。 |
| 出库确认量 `O+` | 含更正的有效量，见 §10。 |
| 出库撤销量 `O−` | 完整撤销 signed delta 取负，见 §10。 |
| 出库量 `O` | `O+ + O−`；撤销不是新入库，不代表实物退货。 |
| 净入库 `N` | `I − O`；仅收发净额，**不等于总库存变化**。 |
| 调整 `A` | 盘点与期初调整；其他历史库存动作单列，见 §10。 |
| 收发存核对 | `期末 − 期初 = N + A + 其他库存变动 = Σ本期所有有效库存delta`；分类与兼容项统一见 §10。 |

### 分批发货后的出库量与更正（B5c）

- 报表出库量一律取**库存流水 delta**，不直接累加发货记录；
- 有效已发量 = 各发货记录原量 + 未抵消更正净额；
- 页面按单展示「已发」时用发货记录汇总，若与流水口径不一致，必须给差异说明，不能两个数都当权威；
- 更正与撤销归期及分类统一见 §10，不重复加总；
- 短关部分不计出库量，也不写流水。

- 原确认与补偿都保留；即使原单现在是 `cancelled`，也不能把其原确认流水过滤掉。B2a 已按反向 delta 写补偿并关联原操作：[execute.ts:23](../apps/api/src/features/document-lifecycle/execute.ts#L23)（23–67 行），不是删除原流水。
- 作废仅未入账：无库存流水、无收发量，不制造一条 0 量“出入库”；仍在单据列表和操作日志可查。代码在 `void` 时不执行补偿：[execute.ts:24](../apps/api/src/features/document-lifecycle/execute.ts#L24)。未确认、冻结、扫码也不算库存发生额。
- 跨月撤销可能使某月 `I` 或 `O` 为负，允许并解释“本期冲回以前期间”；不把补偿倒填到原月。原确认单数、撤销操作数分开计数，不把单据数做成负数；多商品流水不能重复计一张单。
- 报表行采用“月份 × 仓库 × 有库存资格商品”（资格迁移前为erp-product）；用户折叠到月份时，只按同口径累计。无发生且覆盖已验证的月份显示 0，覆盖不足显示状态，不一律填 0。

### 差异、备选与风险

旧单据汇总与新流水汇总不承诺数字完全相同：日期、软删、撤销呈现、历史字段异常都要能拆出差额原因。历史单据明细和原流水须分别先聚合到“方向 × 单号 × 仓库 × 商品”再比对；不能把头、明细、流水直接多对多 JOIN 后 SUM，造成成倍放大。

备选仅显示确认总量、把撤销放“调整”虽易实现，却会夸大出入库和周转分子；不推荐。当前每笔新流水前后值来自 [posting.ts:62](../apps/api/src/features/inventory/posting.ts#L62)，历史前后值仍需从 `source_row_json` 读取，不能用 NULL 当 0。

## 5. 出入库明细：粒度、字段、排序

### 旧系统

- 一行是单据商品明细。入库字段见 [reportInboundDetailService.js:103](D:/wms-new/wms-backend/services/reportInboundDetailService.js#L103)，出库字段见 [reportOutboundDetailService.js:107](D:/wms-new/wms-backend/services/reportOutboundDetailService.js#L107)。均默认只排头/明细软删，状态是可选过滤，不像月报默认只含审核/完成：[reportInboundDetailService.js:25](D:/wms-new/wms-backend/services/reportInboundDetailService.js#L25)、[reportOutboundDetailService.js:25](D:/wms-new/wms-backend/services/reportOutboundDetailService.js#L25)。
- 排序为业务日期 DESC、单号 DESC，缺少唯一明细 ID 作为同值兜底；导出各有 `LIMIT 10000`：[reportInboundDetailService.js:149](D:/wms-new/wms-backend/services/reportInboundDetailService.js#L149)、[reportOutboundDetailService.js:159](D:/wms-new/wms-backend/services/reportOutboundDetailService.js#L159)。出库列表客户名取头表快照，导出改查客户主数据，历史名称也可能不同：见 [列表名称:129](D:/wms-new/wms-backend/services/reportOutboundDetailService.js#L129)、[导出名称:193](D:/wms-new/wms-backend/services/reportOutboundDetailService.js#L193)。

### 推荐与理由

**主明细一行 = 一笔库存流水中的一个仓库商品变化；确认与撤销补偿均独立成行。** 入库/出库方向可筛选，默认包含对应补偿，与月报一条链。未入账计划查询仍走已有单据列表，不混入“入账明细”的合计；原单据行可下钻查看，不将计划吨数替代出库实重。

| 字段组 | 字段清单与规则 |
| --- | --- |
| 时间 | 入账日期/时间、业务日期、制单时间、审核/确认时间、报表截止时间；缺失单独标记，不互相冒充。 |
| 定位 | 业务方向、类型中文、原单号/关联更正号及下钻链接；内部单据/流水/操作ID只作契约关联，不在报表界面/普通导出裸露。原值/追踪号仅登录审计详情原始数据区；历史缺关联标“历史未记录”。 |
| 维度 | 仓库/库存资格商品的业务编码、名称/型号、供应商/客户；来源标签显示历史导入/本地新建。迁移前继续erp-product白名单；有历史快照用快照，只有当前主数据则标“当前名称”。 |
| 数量 | 业务包数、业务吨数（取 §10 的有效收发分项；更正明细保留，补偿为负）；库存delta包数/吨数仍为完整原符号；变化前/后包数/吨数。包数整数、吨数固定四位，缺值不是 0。 |
| 业务附属 | 车辆、箱号、单据类型、入库交货单号 / 出库合同号、备注；已存在则保留可选列，未采集不编造。联系人/电话留详情可选，不强占默认报表。 |
| 追溯与质量 | 当前单据状态中文、操作人、原因、流水类型中文（原值仅审计原始数据区）、历史/新操作标识、完整性/时间核实状态；软删记录只在诊断视图，不进入合计。 |

- 默认时间逆序：规范化入账时间 DESC、稳定流水序号 DESC；新操作同组可展示操作 ID，计算余额仍按账本顺序。历史先用原时间+原 ID 校验；若不能证明其实际顺序，该区间标未核实，不靠重新排序“修好”库存。导出使用同一排序、过滤、可见列及范围。
- 默认显示定位、时间、仓库商品、往来单位、业务量、类型；前后值/原关联可展开，附属列可选。打印继续延后，不因报表增加 HTML 模板。
- “仅确认、不含补偿”可作为明细筛选，但范围标题与合计必须同时明确，不能仍称净发生额。主报表默认不隐藏补偿；`cancelled` 原单仍有原行与补偿行。

### 差异、备选与风险

旧明细是单据行，新明细是入账事件行；同一单撤销后会多一组行，行数不等于单据数。备选继续以单据行计数并折叠成最终净值，会丢失“何时撤销、撤销前后是多少”的证据，故不作为默认。历史单据与流水行不是必然一对一，匹配不到就显示关联缺失，不强 INNER JOIN 丢行。

## 6. 周转率：单位、平均库存与零分母

### 旧系统

分子取区间已审核/完成出库单吨数，分母却是查询时**当前库存吨数**，公式 `outWeight / currentWeight`，分母不大于 0 则返回 0；仅遍历当前有库存的商品：[reportTurnoverService.js:19](D:/wms-new/wms-backend/services/reportTurnoverService.js#L19)（19–75 行）。未计算期初期末平均、日均库存、天数或年化。页面标签只有“周转率”：[Turnover.vue:92](D:/wms-new/wms-frontend-pure/src/views/wms/report/Turnover.vue#L92)，不能将旧值解释成次/年。

### 推荐与理由

**采用吨数口径的“期间周转次数”，分母用逐日日终库存的时间平均；另给周转天数，不默认年化。** 每包重量不同，吨数比单纯包数更适合作主指标；这是实物量周转，不是有成本/金额分母的财务周转率。

令 D 为所选区间完整的上海自然日数，Q(d) 为第 d 日日终有效库存吨数，O 为同区间第 4 节净出库吨数：

- `平均库存 M = Σ Q(d) / D`；不是移动加权成本，也不是把每日周转率求平均。
- `期间周转次数 R = O / M`，单位“次 / 所选 D 天”；`周转天数 T = D × M / O`。次数显示四位、天数一位，计算时不先舍入日均量。
- 默认上海自然日“本月 1 日至昨日”；提供“上月”（完整自然月）、“近 30 天”（截至昨日的 30 个完整日）和自定义含首末日。选到今天时标“未完结”，今天不计入 D 或确定指标；若仅选今天或本月 1 日的默认区间，D=0 并显示空期间，不暗换上月。若以后需要年化，另显式标 `R × 365 / D` 为“折合年化（365 天约定）”，不得替换主指标。
- 无流水日沿用前一日日终余额 `Q(d-1)`，该日仍计入 D；前一日余额无证据时继续标未知，不以 0 起算，也不跳过该日。每日余额只采用同一水位已入账的有效库存变化。
- 人工/导入调整与盘点回写默认进入 Q(d)，但不进入净出库 O。页面与导出同一字段、位置及文本格式显示“本期含调整 N 笔、含盘点回写 M 次”：调整按人工/导入流水行计，盘点按操作 ID 去重，历史无操作 ID 时按流水 ID 计；未知类型单列诊断。报告说明必须写明这些变化不计入 O，调减或盘亏可降低平均库存，使周转率偏高；调增也可能拉低周转率。
- 仓库/商品汇总时重新用“总净出库 ÷ 总平均库存”计算，不能平均各商品的次数。已售空但区间有业务的商品也要保留；维度取区间余额与发生额并集。

| 情况 | 推荐显示 |
| --- | --- |
| M > 0 且 O > 0 | 正常计算次数、天数。 |
| M > 0 且 O = 0 | 次数 0；天数“无出库，无法估计”，不显示 0 天。 |
| M = 0 且 O = 0 | “无库存/无出库，不适用”，数值为 NULL。 |
| M = 0 且 O > 0 | “日终均库存为零，无法计算”；可能有同日入出，不自动认定数据错误，也不输出 Infinity。 |
| O < 0 | “本期撤销冲回大于出库，不适合计算周转”；月报负数照常保留，不输出负周转天数。 |
| 任一日余额未知/为负，或收发分类未核实 | “数据不足/异常，不可计算”，给出完整日覆盖率与原因；不丢掉坏日后悄悄减少 D。 |

### 差异、备选与风险

备选 `(期初+期末)/2` 成本低但无法反映中间大量入出；推荐日均可反映停留天数且容易复核。日终均值也会漏掉日内占用：同日到货又发走可使分母为 0，因此保留上表解释；按每笔变动间隔做连续时间加权更精细，但依赖可信时区和时间链，历史不足时不值得先做。

不能为让指标“有数字”改用当前库存。任一纳入范围的商品不完整时，总体指标标不完整；若另示“可计算子集”，分子、分母、覆盖范围必须是同一子集。合成验收例：完整 4 日日终吨数为 10、0、10、0，净出库 10，则 M=5、R=2 次/4天、T=2 天。

## 7. 库龄：起算、耗用假设与无法归龄

### 旧系统

按仓库商品取**最近**已审核/完成入库日 `MAX(inbound_date)`，将当前全部库存视作同龄；`floor(今天−最近入库日)`，缺日期写 999 天；旧系统分段为 0–30、31–60、61–90、91+，仅供历史对照，新报表只采用下文五档：[reportStockAgingService.js:9](D:/wms-new/wms-backend/services/reportStockAgingService.js#L9)（9–43 行）、[reportStockAgingService.js:49](D:/wms-new/wms-backend/services/reportStockAgingService.js#L49)（49–72 行）。新补一笔货就可能把全部老库存“变年轻”，没有 FIFO 或加权批次计算。

### 推荐与理由

**区分“可证明的入账余额”与“假设 FIFO 的账面库龄”；在证据足够的仓库商品上做吨数 FIFO 估算，无法证明的单独列“无法归龄”。不是现场逐包实际库龄。** 此耗用假设已确认，不反向修改库存、扫码记录或撤销依赖规则。

1. 截止日为明确选择的上海日期，余额也必须取同一截止水位；不能“历史日期分桶 + 今天余额”。入库层在确认入账后才出现；起龄优先用可信的原业务入库日期，新系统未记录则用入账日并标“按入账日起算（估算）”。未来日期/非法日期标异常，不截成 0 天。
2. 按已提交的入账顺序重放；每次出库只对当时已入账的可用层，按起龄日、原入库事件顺序耗用最早层，同值用稳定 ID。晚确认的层不能参与更早的出库。净耗用以实际入账吨数为准，层可分拆吨数，不以统一件重拆包。库龄天数是截止日期与起龄日期的自然日差，分段为 0–30 / 31–90 / 91–180 / 181–365 / >365 天。
3. **按吨分层，不伪造包级归龄。** 汇总可显示账面总包数；年龄桶默认只给吨数和吨数占比，包数显示“缺少逐包对应关系，未分桶”。若要每档包数，需要单独确认独立包数 FIFO 估算是否可接受，不能按吨数比例取整来冒充实包。
4. T0 期初没有入库年龄凭证时，不把 T0 当到货日。若一个仓库商品的剩余层含无法排序的历史池，默认该单元剩余余额整体列“无法归龄”，不擅自假定未知池最老/最新；完整历史补证或该单元可证归零后，后续可靠新层才可恢复估算。不得混入未知库存后仍宣称其余已知层一定剩余多少。
5. 导入、人工调增、盘盈不会自动成为当天“新到货”；无原始到货层证据时列未知。调减/盘亏也不证明消耗了最老层，无法定位层时将该单元剩余层标未知。可验证为 0 的余额可以结束此前未知池。
6. B2a 入库撤销在补偿入账时冲减原层；若原层已有出库耗用，相关仓品剩余余额整体列“无法归龄”，不回填原层或改写此前出库的 FIFO 分配，因为无法证明被撤销入库对应哪部分现存库存。新单据仍由 B2a 下游依赖检查阻断该撤销；此保守分支只处理历史或异常证据。出库撤销恢复该原出库在 FIFO 投影中耗用的层及原年龄，不生成当天新层。原流水不删除，截止日在补偿之前的报告不受后来补偿影响。由原操作/补偿关系重放到截止水位；缺关联或层分配证据时列未知，不猜测恢复。
7. 每个仓库商品及总计：`五档已归龄吨数 + 无法归龄吨数 = 同截止库存吨数`；已归龄覆盖率用吨数计算，0 库存显示不适用。未知不塞进 >365，不填 999 天。可另给吨数加权平均库龄，但仅在可归龄子集计算并同时标覆盖率。

### 差异、备选与风险

- FIFO 只是账面耗用假设，无法证明装车时真的先发旧包；`SPEC` 目录与 ERP 商品没有可靠全局映射，目录上传日/扫码时间不能补这个证据。
- 备选 A：吨数加权平均年龄，信息量小、不能直接给五档库存分布，且未知期初仍然未知；不推荐替代分桶。备选 B：仅保留“距最近入库天数”，可作为商品补货间隔提示，但不能继续叫库存库龄。
- 推荐的未知处理保守，早期可能大量显示“无法归龄”；这是可见的数据缺口，不是计算失败。要提高覆盖率，应补可靠历史来源，不能用改公式制造确定性。库龄推算仅在 B3c 实施，B3b 不暗中加批次扣减或包级库存。

## 8. 核对方式与实施证据

- Web `/reports/details`、`/reports/monthly`；Web-only API `GET /api/v1/web/reports/details`、`GET /api/v1/web/reports/monthly`。日期、仓库、ERP 商品筛选与稳定排序；明细另有movement=all/inbound/outbound（含撤销）。方向仅限制明细，屏幕/附页对账仍含完整收发；月报非all方向422拒绝，互跳恢复all。分页20/50/100/200，每次查询只读快照。月报单数按单号去重，撤销按操作计数，不跨商品求和；关联缺失显示 `—`。
- API/屏幕/XLSX 共用 `report-fields` 与 `report-reconciliation`。主 sheet 只合计本次导出的发生额；“收发存对账”附页固定为全部筛选区间，不能把选中记录伪装成完整收发存。跨月期初/期末、逐行 before/after 不相加。历史/当前名称依据另列，原单号可进入原详情。
- 可复现 SQL：[report-reconciliation.sql](../scripts/report-reconciliation.sql)；三个样本月份：[verify-report-samples.ts](../scripts/verify-report-samples.ts)，原始明细只在 `.local/evidence/b3b-sample-reconciliation.json`。脚本只恢复既有 CSV 到 3307 随机临时库，完成后释放该临时库，不读取生产。
- 自动化：[reports.test.ts](../apps/api/tests/reports.test.ts)、[report-integrity.test.ts](../apps/api/tests/report-integrity.test.ts)、[report-export.test.ts](../apps/api/tests/report-export.test.ts)、[report-pagination.test.ts](../apps/api/tests/report-pagination.test.ts)、[reports.spec.ts](../tests/e2e/reports.spec.ts)。实测数字、三张截图与性能限制见 [ACCEPTANCE](ACCEPTANCE.md)。
- 万级/十万级流水按 2000 条投影、1000 条流式导出，不把全部事实放进 Node 内存；保留仓品月份级聚合。仅在全范围时间与 ID 单调性已验证时用 keyset，其他情况仍按规范化时间/ID 排序；后者大规模性能待测，超时不给截断文件。查询尚未达到此前 U 的首屏/翻页目标，不能以导出完整性替代延迟验收。

| 项目 | 验证要求（周转/库龄待 B3c） |
| --- | --- |
| 日期 | 月末跨日、迟确认、跨月撤销、UTC/上海边界、历史缺日期用合成夹具逐行核对；同一操作不跨月拆行。 |
| 期初 | 已验证单元的包数/克：期初+全类型有效delta−期末均为0；链断点和缺失起点明确显示，不能被总量相等掩盖。 |
| 分类 | check/import/调整不进入收发量；24软删只进排除统计；未知类型中文提示，原文仅登录审计详情原始数据区可见，不默默删行。 |
| 月报/明细 | 明细按分类累计与月报逐格一致；同月、跨月原确认+补偿跨全周期净0；作废库存发生额0。历史单据与流水差额按原因列示。 |
| 导出 | 固定筛选、列顺序、快照水位；屏幕与XLSX逐字段及合计差异0；复用既有大数据导出验收，不恢复旧1万行截断。 |
| 周转 | 可手算逐日库存夹具包含无流水日余额结转、调整和盘点；净出库/日均/计数与独立只读 SQL 一致。零分母、无出库、负净出库、当天未完结、未知余额不出现 NaN/Infinity 或伪 0。 |
| 库龄 | 可手算部分 FIFO 耗用和入/出库补偿夹具覆盖原层已耗用、未知期初/盘盈盘亏及五档日期边界；五档+未知与同水位截止余额差异 0；包数不通过吨数反算。 |
| B3c 性能与一致性 | 10k 有效流水在隔离测试库实际记录冷/热首屏、翻页、全量 XLSX 耗时及环境；首屏按现有 <1.5s 目标判断，超标先定位优化。屏幕/API/XLSX 的字段、顺序、合计与说明逐项一致；本地通过不冒充生产验收。 |

### 附录：本地只读复核 SQL

以下只允许在 **3307 的本地样本副本**执行，均为 SELECT；不是生产操作要求，也不是迁移。以下 Q1–Q3 保留为口径评审的诊断 SQL；本批已实际执行的独立月份 SQL 位于 `scripts/report-reconciliation.sql`，结果在本地证据 JSON。历史快照字段从 `source_row_json` 取，避免后续本地操作改变当前库存后影响“导入样本”的复核。

Q1：原始类型、有效/软删双口径；输出的数量/吨位只保存在本地证据，不复制进文档。

```sql
SELECT source_business_type, source_del_flag, COUNT(*) AS rows_count,
       SUM(packages_delta) AS packages_delta,
       SUM(tonnes_delta) AS tonnes_delta
FROM stock_journal
WHERE source_id IS NOT NULL
GROUP BY source_business_type, source_del_flag
ORDER BY source_business_type, source_del_flag;
```

Q2：逐仓库商品核对历史有效流水净变化与导入库存快照；先分别聚合再 JOIN，集合包含“只有流水 / 只有库存”。这是“零起点假设能否对上期末”的诊断，**不是证明真实期初为零**。

```sql
WITH j AS (
  SELECT warehouse_code, product_code,
         SUM(packages_delta) AS qty, SUM(tonnes_delta) AS tonnes
  FROM stock_journal
  WHERE source_id IS NOT NULL AND source_del_flag=0
  GROUP BY warehouse_code, product_code
), s AS (
  SELECT warehouse_code, product_code,
         CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(source_row_json,'$.stock_qty')),'null') AS SIGNED) AS qty,
         CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(source_row_json,'$.stock_weight')),'null') AS DECIMAL(20,4)) AS tonnes
  FROM stock
  WHERE source_id IS NOT NULL
    AND JSON_UNQUOTE(JSON_EXTRACT(source_row_json,'$.del_flag'))='0'
), k AS (
  SELECT warehouse_code,product_code FROM j
  UNION
  SELECT warehouse_code,product_code FROM s
)
SELECT COUNT(*) AS warehouse_product_cells,
       SUM(j.product_code IS NULL) AS cells_without_journal,
       SUM(s.product_code IS NULL) AS cells_without_stock,
       SUM(s.product_code IS NOT NULL AND (s.qty IS NULL OR s.tonnes IS NULL)) AS missing_stock_values,
       SUM(COALESCE(j.qty,0)<>COALESCE(s.qty,0)
         OR COALESCE(j.tonnes,0)<>COALESCE(s.tonnes,0)) AS unequal_cells,
       SUM(COALESCE(s.qty,0)-COALESCE(j.qty,0)) AS packages_difference,
       SUM(COALESCE(s.tonnes,0)-COALESCE(j.tonnes,0)) AS tonnes_difference
FROM k LEFT JOIN j USING(warehouse_code,product_code)
LEFT JOIN s USING(warehouse_code,product_code);
```

Q3：检查历史每行等式与相邻有效流水链；NULL 单列而非当 0。排序按旧时间、原 ID，只作缺口诊断，不以排序重建业务事实。时间无法解析时须先停止对应链的认证。

```sql
WITH raw AS (
  SELECT warehouse_code,product_code,packages_delta,tonnes_delta,
    CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(source_row_json,'$.id')),'null') AS UNSIGNED) AS old_id,
    CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(source_row_json,'$.create_time')),'null') AS DATETIME(3)) AS old_time,
    CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(source_row_json,'$.before_qty')),'null') AS SIGNED) AS bq,
    CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(source_row_json,'$.after_qty')),'null') AS SIGNED) AS aq,
    CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(source_row_json,'$.before_weight')),'null') AS DECIMAL(20,4)) AS bw,
    CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(source_row_json,'$.after_weight')),'null') AS DECIMAL(20,4)) AS aw
  FROM stock_journal WHERE source_id IS NOT NULL AND source_del_flag=0
), chain AS (
  SELECT raw.*,
    ROW_NUMBER() OVER w AS seq,
    LAG(aq) OVER w AS previous_aq, LAG(aw) OVER w AS previous_aw
  FROM raw
  WINDOW w AS (PARTITION BY warehouse_code,product_code ORDER BY old_time,old_id)
)
SELECT COUNT(*) AS effective_rows,
  SUM(old_id IS NULL OR old_time IS NULL OR bq IS NULL OR aq IS NULL OR bw IS NULL OR aw IS NULL) AS missing_values,
  SUM(bq+packages_delta<>aq OR bw+tonnes_delta<>aw) AS row_equation_mismatches,
  SUM(seq>1 AND (bq<>previous_aq OR bw<>previous_aw)) AS chain_break_edges
FROM chain;
```

Q2 的 COALESCE 仅用于这条“把缺行视作零再比较”的诊断假设，缺行计数同时输出；业务期初、周转率、库龄仍按本规格保留未知，不能复用它来填平缺口。三条 SQL 不对当前有效 ERP 报表直接充当实现，后者还须落实来源守卫、锚点、水位及类型认证。

## 9. 决定记录（D1–D7 主口径与 B3c 补偿边界已确认）

| 项 | 本文推荐 | 不采用时的备选与代价 |
| --- | --- | --- |
| D1 日期（已确认） | 入账日为主日期；业务日/制单日分别保留；历史时区核实前按上海原文并标“时间未核实”，不统一加8小时。 | 业务日主报表需接受追溯变更旧月及额外重述规则；不能与入账余额混算。 |
| D2 期初 | 固定切账快照+流水水位；历史完整链逐范围认证，未知不填0。 | 最早流水重建只能对完整性已证明的范围启用。 |
| D3 历史分类 | inbound/outbound计收发，check/import独立；24软删不计经营统计但保留审计，未知单列。 | 正负数直接当收发会混淆盘点/导入，不建议。 |
| D4 补偿 | 撤销计撤销当月负向业务量、原行保留；作废无发生额；净入库不含调整。 | 重写原月/隐藏原行会丢历史，且不符B2a不可变账本。 |
| D5 明细 | 已入账事件粒度，默认含补偿，单据原行下钻；字段/顺序/合计同导出。 | 单据粒度最终净值看不到动作时间，不能替代对账明细。 |
| D6 周转 | 吨数净出库÷日终平均库存，次/期间并列天数；未知/零分母按表处理。 | 期初期末平均更省计算但失真；连续时间加权需更完整时间证据。 |
| D7 库龄 | 可验证范围按吨数FIFO估算；不能归龄单列，不推算包数分桶。 | 加权年龄无法给出分段分布；旧最近入库日仅能改名为补货间隔。 |

用户已确认 D1–D7 的主口径及 B3c 入库撤销边界：原层已被出库耗用时，该仓品剩余余额列“无法归龄”，不回填、不改写历史、不猜层龄。B5a数量更正已有独立验收；本次仅修订口径，不启动B5d、实物退货、PDA盘点或打印实施。

## 10. 更正分类与重述（B5c-2 裁定）

本轮实现第 1–2 条的入账视图；第 3–7 条中的重述、日期更正与切账锚点继续作为后续批次目标，不属于 B5c-2 完成范围。

1. **有效收发量（本轮唯一计算定义）**：入库量 = 原入库实收 + 入库更正净额 + 入库撤销；出库量 = 各发货记录原实发 + 出库更正净额 + 出库撤销。按每笔库存流水的实际入账日归月，跨月更正计更正发生月，不追溯改原月；单据状态不影响已入账数量。入库取完整库存 signed delta，出库取其负值，撤销按完整有效量反向。`correctionOffset` 与更正明细仅作已计入收发的说明，不再另加减；同期间出库量必须等于出库原流水、更正流水和撤销流水完整 signed delta 的负合计。
   `调整` 仅包含盘点与期初/初始化调整，不含任何数量更正。正常流程对账为 `期初 + 有效入库 − 有效出库 ± 盘点/期初调整 = 期末`。已有人工库存调整与未识别流水不丢弃、不改名为盘点/期初，独立显示“其他库存变动”，存在时作为附加项参与对账；未知来源继续标不可验证。更正明细继续在出入库明细中以“入库更正/出库更正”展开查看并可下钻，原单单数去重，不把更正计为新单。此条取代原 C07“更正统一计入调整”的算法。
2. 包数与克数独立计算；所有分类互斥。同一操作拆出的报表分项带operationId/journalId/family及分项序号用于内部去重，UI不裸露内部ID。样品出库归正常出库，取样不进入库存等式；按条码身份去重的取样包数与次数另表统计。
3. 新增`basis=posted|restated`，默认posted；固定asOf、流水水位与日期更正水位，页面/导出明示「重述视图·按有效业务日期」。已确认单据及其数量更正/反向补偿在重述中随原单有效业务日期归期，但类型始终保留；更正单自身不携带business_date。无原单日期的调整/盘点/转移仍按自身入账日，标注例外；原单日期未知时列未归期包数/吨数及原因，不填0、不偷偷借导入日归月。
4. 原始入账日/业务日期永不覆盖。新增`document_date_corrections`追加记录：document_kind、原单外键、previous_correction_id、before_date、after_date、reason、actor、created_at、revision、idempotency关联；头表业务日期保持原值，读模型取截至asOf的最新有效日期。历史单/legacy-open仍只读；未来日期、超三个月确认、版本互斥、同键重放与审计沿用日期策略。计划接口为原单`date-corrections` POST/GET，与011未入账PATCH及数量更正路由区分；日期更正不写库存流水。
5. 重述发生额提供与posted同范围的逐类归期桥接差额；posted实际期初/期末对账始终单独保留并标注，禁止把重述发生额代入实际余额等式。只有锚点与全部重分配事件均可定位时才另展示「重述余额（非当时实际库存）」；跨T0、未知日期或证据不足则该余额/差额为不可验证并解释原因，不能伪造为零。默认余额不因开关改变。
6. 汇总包吨按互斥范围相加；单数按原单去重，分批发货另列批次数，不把批次/更正数当单数。周转按总净出库/总日均库存重算，覆盖率按总可归龄吨/总库存吨重算，跨月余额不相加；库龄保持D7五档吨数+无法归龄，重述不能自动把FIFO层日期改写成业务日，库龄/周转库存序列仍注明入账口径。
7. 来源迁移后按MASTER_DATA_SPEC的库存资格与来源证据投影；资格迁移前继续erp-product白名单，不将未知/app/SPEC纳入。新M-DATE-CORRECTIONS与M-CUTOVER-ANCHOR按后续批次分配012起迁移，非空拒绝破坏性down；本次无DDL或报表代码变更。

修订记录：C01 补报表来源资格迁移前后边界。
修订记录：C04 更新B5a日期现状，补独立追加式日期更正模型。
修订记录：C07 更正及抵消单列且不双计，明确重述归期/桥接/未知值及汇总算法。
修订记录：C17 普通报表未知类型仅中文提示，原值遵守审计折叠区例外。

### 10.1 B5d-2 读模型与契约（2026-11-12）

本批在 B5d-1 与 021 已完成的基础上实现报表重述读模型，默认入账口径不变。仅扩展查询、契约、现有导出与验证；页面重做留 B7a，不改日期更正写入或库存链路，不建立 T0 锚点，不新增迁移。

- 查询与导出 query 增加 `basis: posted | restated`（默认 posted）、`asOf`（可选，带时区的 ISO 时间，缺省为本次查询时刻；未来截止拒绝）。响应顶层增加 `basis`、`watermarks: { journalMaxId, dateCorrectionMaxId, asOf }`、`balanceMode: posted | restated | unverifiable`。
- `journalMaxId` 是本次只读快照可见流水的最大编号；`dateCorrectionMaxId` 是截止点内可见日期更正 UUID 的字典序最大值，无记录为 null。UUID 不是递增序号，不能仅用 UUID 大小判断是否属于快照；实际重放固定该次可见更正集合并按原单 revision 选择最新有效日期。水位与 asOf 在同一只读快照确定。
- posted 继续使用入账日；restated 将原单、数量更正、反向补偿按原单截至快照的有效业务日期归期，各自类型不变。无原单日期的盘点/调整/转移沿用自身入账日并附中文例外说明；原单日期未知进入未归期，不能借导入日或制单日补齐。
- restated 响应增加 `bridge`，每个分类（入库、出库、更正、盘点、期初、其他）每月一行：`month, category, inRange, postedPackages, postedGrams, restatedPackages, restatedGrams, deltaPackages, deltaGrams`；`delta = restated - posted`。分类互斥，数量更正仅在“更正”桥接分类中出现，撤销采用完整流水数，不再次叠加 correctionOffset。桥接数量采用库存 signed delta，出库扣减为负，包数和克数独立。
- 桥接事件集取同一仓品/来源范围内、入账日或有效业务日期命中查询区间的事件并集；日期缺失而无法排除的事件也保留。为同一事件同时保留入账月与重述月，因此可包含查询区间外月份；`inRange` 表示该月份是否与查询区间相交，`month=null` 时为 false。未归期按分类合并为 `month=null` 行，附去重后的中文 `reason`；已知数量原样保留，未知日期不是数量零。
- 守恒检查为所有桥接行的 `deltaPackages` 合计 = 0、`deltaGrams` 合计 = 0；**单月允许非零**。此条按用户本次更正取代“每月差额为零”。例如 10 包从一月移到二月，一月 -10、二月 +10；只查二月仍保留一月且 inRange=false。未归期行同样参与闭合。页面查询与导出共用同一 bridge 计算结果。
- `report.reconciliation` 始终是 posted 实际对账；月行既有期初/期末/对账差额字段也始终保留 posted 值。restated 月行发生额按重述日期统计，并另带 `postedBalance` 保存完整实际等式，禁止将重述发生额与既有余额字段拼成等式。另增 `restatedBalance`（总区间及月行），只表示“重述余额（非当时实际库存）”。
- 只有已存在、可验证的锚点与全部重分配事件均可定位，且没有跨锚点/未知日期/链断点时，重述余额可给出；否则 `balanceMode=unverifiable`，`restatedBalance` 的期初/期末/差额均为 null 并附原因。切换 basis 不改变默认实际余额字段。本批不伪造或建立正式切账锚点。
- 周转和库龄的库存序列与 FIFO 日期保持原入账口径，明确标注；不以重述日期重放库存。重述附加信息与桥接使用同一查询快照。
- 导出沿用现有 viewToken 校验，将本次查询水位绑定到该视图，避免缺省 asOf 在导出时重新取当前。有限期的进程内快照过期/缺失或来源证据变化时明确要求刷新，不静默使用新水位；无新数据库表、无页面重做。
- 验证：默认 posted 的既有字段与改造前相等；跨月日期更正及窄区间桥接守恒；未知日期未归期与原因；入出库数量更正/撤销不双计；双水位与 asOf 截止、UUID 非单调；查询/导出同水位同桥接；切换 basis 保留 posted 余额；不可定位重述余额为 null。复用隔离合成库，不写开发样本库。

## 11. B5d-1 已入账业务日期更正（2026-11-12）

本批实现 §10 第 4 条：仅入/出库原单的追加式日期更正，复用 011 未入账 PATCH，不覆盖头表或发货记录日期，不改变报表入账归期、数量更正与库存。分支 `codex/b5d-1-date-corrections`，起点 `e6f277e`；实现提交 `feat(documents): append-only business date corrections`。初始停止边界已完成；用户验收后授权开发样本库应用及合并推送，见 §11.2。

- 021 新建 `document_date_corrections`：UUID id、document_kind（inbound/outbound）、document_id VARCHAR(80)、可空 previous_correction_id、before_date/after_date DATE NOT NULL、reason VARCHAR(500)、actor VARCHAR(80)、唯一 operation_id UUID、created_at DATETIME(3)、revision INT UNSIGNED。按种类/原单/时间索引，原单/版本唯一，前序外键防悬空。原单归属在事务中按 kind/id 锁定校验；operation_id 为日期更正操作标识，不引用库存操作。下迁移在任何 DDL 与迁移状态变化前拒绝非空表。
- POST `/{inbound|outbound}/:id/date-corrections`：afterDate、reason、expectedRevision、backdateConfirmed；使用既有 Idempotency-Key。锁原单后读取当前日期链，初始版本 0，每次追加递增，before_date 自动取最新 after_date（首次取头表 business_date）。版本不符 409，同键同正文返回原结果，不重复审计；更正、审计及幂等结果同事务提交，不写库存表/流水/操作，不改头表。
- 入库须已确认入账；出库须有真实入账证据（部分发货/已出库/已短关均可）。历史来源、作废/撤销拒绝 422；未入账 422 提示使用未入账业务日期修改。原日期 NULL 优先返回 422「该单无原始业务日期（历史单据），不支持日期更正」，保留已有 NULL 与头表结构，不补录、不猜日期。日期不晚于上海今天；早于今天减三个日历月（月底截断）需显式确认。
- GET 同路径返回全部日期更正记录、当前有效日期、原日期、独立日期更正 revision 与可操作状态。详情保留 businessDate 原值，增加 effectiveBusinessDate；列表与详情展示有效日期，详情可展开原始日期与历史（前值→后值、原因、操作人、时间）。详情「更多」提供符合资格的「更正业务日期」，抽屉显示当前日期、新日期、原因与提交，超期二次确认；失败保留输入，重试沿用同键同正文。
- 验证覆盖两方向成功且头表/库存不变、未入账/未来/超期未确认/作废/撤销/历史/NULL audited 拒绝、超期确认成功、版本冲突、幂等重放、两次链式更正；补并发、审计失败回滚及 021 空库往返/非空拒绝测试。复用隔离 E2E 数据，1440/1280 界面证据仅存 `.local/evidence/`，不代表实体设备或生产验收。

### 11.1 实现与验证记录

- 代码：021 表及 UPDATE/DELETE 不可变触发器、空表回退/非空拒绝守卫；两类单据 POST/GET、日期链、有效日期读模型、中文审计与 OpenAPI 已实现。确认入账/首次发货/撤销后刷新日期权限，避免详情页继续显示旧入口。
- 本批 API 定向 9/9，通过跨月更正前后出入库明细与月度汇总完全一致的断言；头表、库存、库存流水、库存操作均不变。NULL audited 拒绝场景在独立测试库复现，未读取或改写开发样本库。
- 021 及既有迁移回归：021 空表 up/down/up 结构一致；不可变触发器拒绝 UPDATE/DELETE；非空 down 在任何 DDL 前拒绝，业务指纹不变；最新日期查询使用 date_correction_version 索引。旧 016/018/020 测试明确目标编号，使用当前 API 的用例先建最新结构再回退验证，不引入运行时兼容降级。
- `npm run test`：333/333，fail 0，exit 0，日志 `.local/evidence/b5d-1-test-final.log`。`npm run build`：类型检查与 Web 构建 exit 0，日志 `.local/evidence/b5d-1-build-final.log`。
- 日期界面定向 6/6：入/出库更正、超期确认、原日期与历史/列表有效日期、响应丢失原键重试、过期版本保留输入、同页入账后入口显示/撤销后隐藏；日志 `.local/evidence/b5d-1-ui-state-final.log`。截图 `.local/evidence/b5d-1-{inbound,outbound}-{drawer,history}-{1440,1280}.png`，两宽度页面无横向溢出；补等待确认框关闭后抽屉恢复可编辑，避免截到过渡状态。
- `npm run test:e2e`：134/134（主套件 125 + 目录套件 9），两套件均零失败、命令 exit 0，日志 `.local/evidence/b5d-1-e2e-passed.log`。新增业务日期列使旧列设置测试中的「商品型号」移出虚拟树初始可视区，并使旧文本拖选目标移出表格可视区；仅补测试辅助函数的滚动交互，保留列宽/显隐/重排/文本选择断言与原测试数据来源。文本选择定向 4/4，且在最终完整套件中再次通过。
- 提交前审查覆盖路由鉴权/同源、参数化 SQL、事务与版本锁、幂等与审计、历史边界、缓存刷新及契约接线；Ant Design lint 0 issues，改动源码 Prettier 与 git diff --check 通过。未引入依赖、未改变报表 SQL/库存写入链；仅本地自动化/浏览器验证，不代表现场或生产验收。

### 11.2 验收收尾（2026-11-12）

用户已验收通过，授权仅对 `127.0.0.1:3307/maozhi_dev_sample` 备份、记录全表指纹、应用 021 并执行日期更正冒烟。使用既有本地合成已入账单；原单、历史 NULL 单与库存流水不得改写。完成后更新 333/134/0、以 `merge: b5d-1 date corrections` no-ff 合并推送 master，然后停止，B5d-2 必须换新会话。

- 备份：`.local/backups/maozhi-1794484828219.sql`，6,680,123 字节；SHA-256 `1f56f24a502a6fde45a5c9e50dbfcdef7e1c1b39368fe7dad3f4ae5a7d942e49`。迁移前 49 张表指纹见 `.local/evidence/b5d-1-closeout-before.json`。
- 021 应用：首次用 wms_dev 因 binlog 下创建触发器缺 SUPER 权限而 exit 1，停在 applying；确认新表为空、无触发器、checksum 正确及既有表指纹不变后，使用同一 3307 实例的本地 root 连接完成两条缺失触发器并将状态置 applied，再由 migrateUp 完整校验，最终 exit 0。未改全局参数、未授予应用账号额外权限、未删除业务数据；48 张既有业务表指纹不变，证据 `.local/evidence/b5d-1-closeout-migration.json`。
- 开发库 API + 浏览器冒烟 exit 0：`RK-20261111-001` 原日期 2026-11-11，有效日期更正为 2026-11-10；`CK-20261112-004` 原日期 2026-11-12，有效日期更正为 2026-11-11。头表全字段不变，详情及浏览器列表均显示更正后的有效日期，追加两条更正和对应审计。
- 两方向未入账单均 422 提示走未入账日期修改，audited/NULL 旧单均 422 返回指定提示，单据与更正表不变。库存流水 839→839，库存/库存操作/扫码及原单表指纹均不变。证据 `.local/evidence/b5d-1-closeout-smoke.json`、同名 `.log`。仅开发样本库验收，不代表生产验收；临时开发服务已停止。
- 自动化结果保持 333/134/0（test 333、完整 E2E 134、失败 0；build exit 0），本轮无业务代码变化。收尾文档提交后按授权 no-ff 合并推送，合并 hash 与远端 HEAD 在最终回复报告。B5d-1 完成；B5d-2 换新会话。
