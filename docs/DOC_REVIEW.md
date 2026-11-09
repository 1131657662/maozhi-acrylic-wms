# Web 规格实现评审

评审日期：2026-11-09。代码基线：`61f4d82e95a1dd74af2027e894d869e426d6b5d2`。角色：实现方。

> 修订闭环（2026-11-09）：用户已通过本评审并确认四项业务决策；C01–C18的定点修订结果见§9。§1–8保留c5fb2af入库时的评审证据与建议，其中提问/替代建议不再作为未决规则；规格行号仅指评审快照，代码行号仍指61f4d82。本次只改文档，未复测代码/连接数据库/执行迁移。

## 1. 结论与证据边界

**可以将本批文档作为规格评审快照入库；不能将整包规格直接交付实现。** 主数据归属、分批发货、盘点录入、报表口径、目录候选、审计失败记录、打印与切换均有必须先修订或补设计的条款。下文的“新增能力”不等于现有代码缺陷；“业务冲突”则不能靠页面兼容或移除守卫解决。

本轮按 README → AGENTS → DOMAIN_RULES → UX_STANDARDS/WEB_UX_SPEC → 八份页面规格及 REPORT_SPEC/PRINT_SPEC/CUTOVER_PLAN → PARITY_MATRIX/IMPLEMENTATION_PLAN 的顺序阅读，并只读检查源码、契约、001–011 迁移和脚本。没有运行测试、构建、迁移、数据库查询或浏览器验收；既有验收数字仅引用原批次记录，不是本轮复测结果。

实际初始工作区为 **18 份变更文件（AGENTS.md + 17 份 docs 文件）**，不是 26 份。`DOMAIN_RULES.md`、`IMPLEMENTATION_PLAN.md` 初始没有未提交改动。Git 原始输出：

```text
61f4d82 feat(b5a): add quantity corrections and business dates
7b94659 docs: record confirmed domain rules and B5 boundaries
b59b5ec feat(ui1): unify inbound pages with Ant Design Pro

 M AGENTS.md
 M docs/PARITY_MATRIX.md
 M docs/REPORT_SPEC.md
 M docs/UI_DESIGN_PLAN.md
 M docs/UI_SPEC.md
?? docs/AUDIT_PAGE_SPEC.md
?? docs/CATALOG_PAGE_SPEC.md
?? docs/CUTOVER_PLAN.md
?? docs/MASTER_DATA_SPEC.md
?? docs/OPS_PAGES_SPEC.md
?? docs/PRINT_SPEC.md
?? docs/README.md
?? docs/REPORTS_PAGE_SPEC.md
?? docs/STOCKTAKE_SPEC.md
?? docs/STOCK_PAGE_SPEC.md
?? docs/UX_STANDARDS.md
?? docs/WEB_UX_SPEC.md
?? docs/WORKBENCH_SPEC.md
```

本文代码行号对应上述基线；规格行号对应本次审阅文本。入库仅增加评审、011 计划及其索引/未决项，另修复矩阵末尾表格换行；不把下列建议暗中改成已批准的业务规则。

## 2. 与代码的冲突及已有能力

### C01 商品开放维护不能只移除 403（必须补设计）

- 规格：`docs/MASTER_DATA_SPEC.md:7`（§0 本系统唯一主数据来源、local/legacy/sku-spec）、`:10`（移除只读限制、新商品立即入库）；`docs/STOCK_PAGE_SPEC.md:25`（排除 sku-spec 即可统计）。
- 代码：`apps/api/src/features/master-data/service.ts:11` 明确返回 `403 PRODUCT_MASTER_READ_ONLY`；`:23` 的通用创建只写 code/name/active；`apps/api/migrations/003_source_snapshot.up.sql:2` 的来源默认是 `app`。`apps/api/src/features/master-data/read.ts:13`、`apps/api/src/features/inventory/posting.ts:26`、`apps/api/src/features/web-lists/stock.ts:20`、`apps/api/src/features/reports/sql.ts:27`、`apps/api/src/features/stocktake/create.ts:17` 均明确限制 `erp-product`。
- 后果：直接放开按钮会创建不可选、不可入账的商品；把筛选改成 `!= sku-spec` 又会纳入既有 app/未知来源异常库存。不是一个 UI 批次可独立完成的变更。
- 修订：明确“历史来源”与“可参与库存业务”两个概念及旧数据映射。建议保留原来源证据，新增明确的业务用途/来源映射，逐项迁移建单、确认、盘点、库存、报表和契约守卫；不批量把未知来源改成合法商品。local/legacy 若用于界面，可由映射输出；若要求替换库值，必须先写迁移前后逐来源对账方案。

### C02 partially_shipped / short_closed 不是增加两个状态值（必须补业务模型）

- 规格：`docs/DOMAIN_RULES.md:105`（出库异常）、`docs/WEB_UX_SPEC.md:47`（部分发货继续发货）、`docs/CUTOVER_PLAN.md:45`（导入部分发货单）。
- **数据库实际约束**：`apps/api/migrations/001_initial.up.sql:19` 曾限制 open/frozen/confirmed，但 `apps/api/migrations/003_source_snapshot.up.sql:22` 已删除该 CHECK，以保存历史原状态。`packages/contracts/src/index.ts:24` 当前是最长 32 字符字符串。不能报告为“现存数据库枚举不允许新状态”。
- **真正阻断处**：`apps/api/src/features/scan/validate.ts:6` 仅 open 接收新事实，`:10` 禁超扫；`apps/api/src/features/scan/freeze.ts:16` 要求 open 且包吨均等于计划；`apps/api/src/features/outbound/confirm.ts:20` 仅 frozen 可确认，`:34` 整单转 confirmed；`apps/api/src/features/outbound/edit-policy.ts:17` 仅本地 open 可编辑；`apps/api/src/features/document-lifecycle/document.ts:47` 只认 confirmed 为可撤销原单。
- 修订：B5c 先定义发货批次、事实与批次唯一归属、每批冻结摘要/确认操作、已发与待发余额、短关原因/时间和晚到事实规则。部分确认只入账未记账的本批事实；短关不写库存；旧事实 UUID/正文不变。同步更正/撤销的“原确认”证据模型，不能继续假定整单只有一次确认。现有 B5a 不等于已实现 B5c。

### C03 收货档案、车辆隐式建档没有包含在 B5a（新增能力）

- 规格：`docs/MASTER_DATA_SPEC.md:40`（party_contacts）、`:55`（保存出库单自动建车辆）、`:79`（单据联系人快照）、`:94`（新接口）。
- 代码：`packages/contracts/src/master-data.ts:3` 只有 products/warehouses/customers/suppliers，`:23` 的输入只有 code/name；`apps/api/src/routes.ts:58` 挂载的是 `/master-data/:catalog`，不是 `/master/...`。`packages/contracts/src/outbound-plan.ts:16` 车号是最长 100 字符自由文本；`apps/api/src/features/outbound/plans.ts:36` 仅写 outbound_orders，`:77` 编辑仅写车号/备注。入库 `apps/api/src/features/inbound/create.ts:30` 没有送货联系人字段。001–011 无 party_contacts 或车辆建档表。
- 修订：补联系人归属外键、默认唯一约束、停用/删除规则、车辆规范化唯一键与冲突复用；自动建档、单据快照、审计必须同一建单事务，重放不能多加 use_count。明确“保存”是新建还是每次编辑、最近使用取何时、车辆合并是否保留别名及历史车号。历史 100 字符车号不得直接截成 5–10 字符。两组路由须确定兼容别名或迁移调用方。

### C04 business_date 已实现，应复用；日期更正尚未实现（部分一致）

- 规格：`docs/MASTER_DATA_SPEC.md:84`、`:86` 将 business_date 列为追加字段；`docs/DOMAIN_RULES.md:32` 至 §2 的日期规则。
- 代码：`apps/api/migrations/011_corrections_business_date.up.sql:1` 已为入/出库增加可空 DATE；`apps/api/src/features/business-date/policy.ts:8` 实现默认上海当天、未来 422、超三个月缺确认 422；`packages/contracts/src/business-date.ts:20` 按日历月并截断月底。创建审计分别见 `apps/api/src/features/inbound/create.ts:49`、`apps/api/src/features/outbound/plans.ts:60`。
- 边界：`apps/api/src/features/business-date/change.ts:21` 拒绝历史/软删/非待确认入库/非 open 出库，意味着**出库冻结时已不可直接改日期**，不止入账后锁定。`:29` 记录修改审计；`apps/api/src/features/corrections/router.ts:13` 是未入账日期 PATCH。更正头 `apps/api/migrations/011_corrections_business_date.up.sql:10` 只有更正时间与操作人，没有 business_date。
- 修订：MASTER §9 标“复用 011，禁止重复 ADD COLUMN”；保留历史 NULL，不以导入日填补。区分未入账改日期、入账后独立“日期更正”和数量更正；后两者不得混为同一入口。日期更正保留原值/理由/审计的模型与接口仍缺失，应另定批次；本轮未核验 3307 的实际迁移状态。

### C05 主数据改名不影响历史，与当前入库查询不一致（必须先补快照）

- 规格：`docs/MASTER_DATA_SPEC.md:24`、`:44`、`:80` 要求历史名称/联系人快照不变。
- 代码：`apps/api/src/features/inbound/repository.ts:15`、`:18`、`:25` 通过主数据 JOIN 读取供应商、仓库、商品的当前名称；出库 `apps/api/src/features/outbound/plans.ts:41` 保存客户名，`:103` 保存商品行快照，两端能力不对称。`apps/api/src/features/master-data/service.ts:59` 直接改 name/active，没有规格所要求的进行中引用/仓库零库存停用检查。
- 修订：先补单头/行快照和停用守卫，再开放维护。旧单无法证明当时名称时必须标“迁移时资料快照/历史未记录”，不能把当前名称回填成原始证据。主数据可编辑不代表历史单可编辑，也不能移除 source_id 的历史单保护。

### C06 库存待发/可发/库龄是新增读模型（必须补定义）

- 规格：`docs/STOCK_PAGE_SPEC.md:25` 至 §3/§8；`:34` 要求单个 agingDays，`:36` 四段色阶，`:51` 又要求五档。
- 代码：`apps/api/src/features/web-lists/stock.ts:8` 只有在库包吨与仓品，`:40` 小计；`packages/contracts/src/web-list-query.ts:54` 的库存查询不含待发、库龄、零库存等条件。`apps/api/src/features/reports/derived-totals.ts:19` 返回五档吨数及无法归龄，不能无定义地转换成一个“库龄天数”。
- 修订：待发定义为未记账剩余计划，明确更正、短关、分批后包/吨独立如何计数。可发负值是“计划缺口”，不得作为允许负库存的理由。库龄展示五档分布，或另定最老/加权平均天数；同一商品有多个 FIFO 层时不可取任意一层。全筛选小计与当前页合计分开，保留既有来源白名单和不可验证原因。

### C07 报表二次加更正、禁重述及汇总相加条款必须修订

- 规格：`docs/REPORTS_PAGE_SPEC.md:36`、`:173` 禁止切换口径，与 `docs/DOMAIN_RULES.md:42` 要求带标签的重述视图冲突；`:67`、`:83` 写“±调整 ±更正”；`:62` 默认包含更正行；`:181` 要求“四页汇总=表格合计”。
- 代码：`apps/api/src/features/reports/normalize.ts:19` 将 stock.correct 分类为 correction；`apps/api/src/features/reports/accumulate.ts:36` 同时累入 adjustment 总量与 correction 子类。`:9` 对已更正原单的撤销也拆出更正抵消部分。`apps/api/src/features/reports/sql.ts:56` 的明细筛选仍只有收发/撤销，尚不展示更正明细；`packages/contracts/src/reports.ts:14` 无重述开关。
- 修订：默认“期初 + 净入库 − 净出库 + 调整合计 = 期末”，更正是调整合计的分项，不再相加；若另列加数，应叫“其他调整（不含更正）”并给精确集合。B5d/UI-5 增加更正明细及重述读模型，不修改原入账日；重述不能假装现有流水有业务日期。比率须按总分子/分母重算（`apps/api/src/features/reports/derived-totals.ts:9`），单数去重、跨月余额不可累加。REPORT_SPEC 的 D1–D7 算术权威应明确高于页面示例。

### C08 盘点自动折吨、盲盘、盘盈行及 200 行限制改变 B3a 业务

- 规格：`docs/STOCKTAKE_SPEC.md:78` 默认按系统平均件重折算；`:84` 最多 200 行；`:86` 新增盘盈行；`:172` 盲盘接口不返回系统数。
- 代码：`packages/contracts/src/stocktake.ts:42` 当前响应包含 snapshot，输入为独立 actual 包数/重量；`apps/api/src/features/stocktake/create.ts:23` 可指定商品生成零快照，默认保留已有库存格，没有正数过滤；`:42` 仅给固定快照建立读数。`apps/api/migrations/009_stocktake.up.sql:18` 的快照及只读保护、`:25` 的读数结构没有盲盘模式/盘盈追加行/逐行原因。
- 修订：保持包吨独立输入，平均值只能在另获业务确认后作为显式估算提示，不能默认成为实盘吨数；否则盘点会复制原重量错误，且盲盘泄漏系统比例。定义零基数、半包整包记数及估算标记。追加盘盈不得更新固定快照，应独立保存“快照外发现行”并在回写校验中纳入。200 作为页面窗口/虚拟列表大小，不得把已验收万行盘点降为截断；若确为业务上限需单独决策。

### C09 盘点回写守卫和幂等不能因页面规格简化

- 规格：`docs/STOCKTAKE_SPEC.md:50` 仅建议先确认未入账单，`:105` 录入错误跳原单更正，`:113` 要求幂等键未使用，`:148`/`:150` 改用批量 PATCH/POST 预览。
- 代码：`apps/api/src/features/stocktake/post.ts:54` 先重放，`:69` 有未入账单必须人工 ACK；`apps/api/src/features/inventory/posting.ts:94` 的仓库窗口守卫也覆盖更正；`apps/api/src/features/stocktake/router.ts:15`/`:16` 当前是 GET 预览、PUT 单行。
- 修订：同键同正文返回原结果，异正文冲突；保留回写前窗口/库存漂移/token/未入账 ACK 复验与全局写锁顺序。锁仓中更正应被拒绝，页面说明作废盘点、完成必要处理后重新建快照的路径，不能增加旁路。批量保存及盲盘“已核对”版本令牌是新增契约，须定义原子性和并发编辑行为。

### C10 目录候选删除、范围校验及“已出库”文案与实现不符

- 规格：`docs/CATALOG_PAGE_SPEC.md:76`、`:110` 消失称已出库；`:97` 条码 6–32；`:98` 重量 50–5000 kg；`:130` 唯一候选、`:131` 删除不产生版本、`:134` 重启发布标失败。
- 代码：`apps/api/src/features/catalog/upload.ts:82` 上传已落 catalog_versions 并分配版本，`:62` 转 validated；`apps/api/migrations/006_catalog_versioning.up.sql:4` 状态仅 staging/validated/published。`apps/api/src/features/catalog/publish.ts:37` 锁候选并在同一事务切 head（`:75`），没有独立发布任务状态。解析 `apps/api/src/features/catalog/parse.ts:35` 复用 `packages/contracts/src/index.ts:18` 的 1–64 字符 ID，`:23` 重量上限 1,000,000,000 克，和新规格不同。发布函数没有库存扣减，真正扣减在 `apps/api/src/features/outbound/confirm.ts:20` 之后。
- 修订：消失只叫“移出当前目录”，不能据此证明 Web 已确认出库。优先保留既有版本/上传证据，以“放弃候选”代替物理删除和复用版本号；单候选规则须兼容既有多个 validated 候选。发布丢响应先查状态/同键重放，不能把已提交成功标失败再重传。新长度/重量范围须给旧记录兼容策略和异常诊断，不能让旧版事实失效。

### C11 设备实时队列与车辆离场不能从当前数据推断

- 规格：`docs/WORKBENCH_SPEC.md:24`、`:25` 离线待传/今日车辆状态；`docs/CATALOG_PAGE_SPEC.md:146` 设备版本和待补传数量。
- 代码：`apps/api/src/features/handoff/read.ts:23` 根据已登记 expected_count 和已收事实算交接 unresolved；这不是离线设备实时队列长度。`apps/api/src/features/catalog/gate.ts:17`、`:22` 保留交接与未知客户端阻断；`apps/api/migrations/001_initial.up.sql:17` 只有 vehicle_no 和单据状态，没有车辆装车/离场事件。
- 修订：设备页显示“上次上报值 + 时间 + 是否过期/未知”；新增心跳/同步确认数据及移动端协议后才显示覆盖率。确认时间不自动等于车辆离场时间。无报告设备不得填 0，未知设备范围须保留人工核验，不因页面显示“全部同步”自动开放目录发布。

### C12 工作台/看板聚合接口当前不存在（新增能力）

- 规格：`docs/WORKBENCH_SPEC.md:33`、§6 要求 `/api/v1/web/dashboard` 和 `/api/v1/web/analysis`；`:71` 响应字段还未覆盖卡片里的设备、目录健康和车辆。
- 代码边界：`apps/api/src/app.ts:41`/`:42` 是 API 总挂载；`apps/api/src/routes.ts:34` 至 `:68` 的完整业务挂载只有现有模块；`apps/web/config/routes.ts:38` 当前 `/` 是出库工作台列表，`/dashboard` 无页面路由。对 `apps/api/src`、`apps/api/migrations`、`packages/contracts/src` 检索 dashboard/analytics/notifications/print_templates/party_contacts/master_vehicles/stock_opening，没有对应模块定义。
- 修订：新建聚合契约，定义上海日界、包吨/单数单位、净量/毛量、环比零分母、同水位、未知值与缓存失效。待确认 KPI 可对列表条数，吨数 KPI 应对同筛选的吨数总量；`:86` 不能统一写“数字等于条数”。聚合优先复用已确认报表投影，不由浏览器拉多页列表拼统计。

### C13 审计“失败/渠道/时间线”尚无结构化证据

- 规格：`docs/AUDIT_PAGE_SPEC.md:35`、`:47`、`:48`、`:132`、`:151` 要失败计数、渠道、错误码、服务端变更解析及失败保留。
- 代码：`apps/api/migrations/001_initial.up.sql:66` 的 operation_log 只有 action/target/actor/trace/before/after/time；`apps/api/src/shared/audit.ts:7` 写这些列；`apps/api/src/features/web-lists/audit.ts:7` 轻列表没有 result/channel；`apps/api/src/db/mysql.ts:32` 失败回滚同事务业务审计；`apps/api/src/middleware/http.ts:67` 的错误响应并不持久化失败审计。
- 修订：成功业务审计继续与库存同事务；失败尝试在回滚后独立记录，明确不是“业务已生效”。新增 result/errorCode/channel/对象类型与业务编号/结构化字段差异，历史缺值标未记录，不回填成功。时间线关联真实事件，不把示意中的“流水/审计”拆成不存在的三次操作。新增 `/timeline` 必须排在 `apps/api/src/features/web-lists/router.ts:14` 的 `/:id` 前或改不冲突路径。原始 JSON/trace 的可见范围、脱敏及导出例外见 C17。

### C14 打印配置表与代理当前不存在；规则自身也不闭合

- 规格：`docs/PRINT_SPEC.md:15` 表、`:51` 代理、`:33` 配置前后值审计、`:63` 前端节流保证不重复生成、`:82` PDF 作废标记。
- 代码边界：完整迁移注册 `apps/api/src/db/migrate.ts:8` 至 `:85` 没有打印迁移；总路由 `apps/api/src/routes.ts:34` 至 `:68` 没有打印/配置代理。现有 `apps/web/src/features/corrections/detail-actions.tsx:30` 是 disabled + “待接入积木报表”占位。
- 修订：token 不得直接进入通用 before/after 审计（`apps/api/src/shared/audit.ts:9` 原样序列化）；配置读取只返掩码/是否配置，服务端安全保存密钥或引用。配置页显示地址（PRINT `:39`）和“地址仅服务端可见”（`:88`、`:98`）二选一明确：建议普通业务页不暴露真实地址，配置用受控服务别名。代理限定目标域名/端口与重定向，限制超时/体积，凭证 URL 不入日志。
- 前端节流只能抑制单页连点；跨页/重试不重复需服务端按单据及版本去重。前端提示不能给 PDF 加作废水印；必须由模板明确接收终态、原量/有效量、更正链/版本、部分发货批次。kind 中 stocktake 与 §5 不打印矛盾；pdf/excel 与 PDF-only 校验矛盾。先限定三模板 PDF，再另排扩展。

### C15 运维、消息与身份增强需要服务能力，不能只加页面

- 规格：`docs/OPS_PAGES_SPEC.md:30`“确认后两小时未处理”、`:87` 定时备份、`:89` 哈希清单、`:110` 监测、`:183` 改密码、`:193` 五次失败锁定。
- 代码：备份 `scripts/backup.ts:17` 是命令行 mysqldump，无调度/任务表/自动恢复校验；恢复 `scripts/restore.ts:10` 新建隔离库，`:22` 清空副本会话，`:27` 失败删除此次新库。`apps/api/src/features/auth/router.ts:14` 当前限流值 20，`:37`/`:38` 仅 me/logout；`apps/api/src/features/auth/service.ts:18` 会话只有既有过期信息。C12 的完整挂载中没有消息/维护/个人增强接口。
- 修订：待处理提醒起点应为创建或冻结，不能从已确认起算；通知定义触发/恢复/重现/去重键/已读及 90 天清理，不清业务审计。备份产品化补任务互斥、产物完整发布、SHA/大小、恢复指纹、磁盘检查/权限和失败证据保留；健康监测需采集窗口/保留期。改密明确所有渠道会话失效及 PDA 队列保留，不清事实。失败恢复副本建议先隔离保留诊断，清理只能针对本任务创建的副本。

### C16 查询、导出和全局默认值不是现有接口的别名

- 规格：`docs/WEB_UX_SPEC.md:82` 商品多选任一/全部、命中行摘要/导出；`:88` 索引；`:97` CSV/XLSX/单张。`docs/REPORTS_PAGE_SPEC.md:166`/`:167` 重命名请求响应。`docs/UX_STANDARDS.md:161` 默认 50、`:164` 10 万行。
- 代码：`packages/contracts/src/web-list-query.ts:7` 默认 20，入/出库查询没有商品反查；`packages/contracts/src/reports.ts:10` 用 fromDay/toDay/movement/sortBy，`:178` 返回 items/viewToken 等；`packages/contracts/src/web-export.ts:5` 严格请求带 viewToken/selected tokens，`apps/api/src/features/web-exports/generate.ts:52` 上限 100 万。实际表名是 `apps/api/migrations/002_inbound_masters.up.sql:56` 的 inbound_lines；型号是 `apps/api/migrations/003_source_snapshot.up.sql:3` 的 source_model，规格 SQL 的 inbound_receipt_lines/model 不存在。
- 修订：补 matchedLines/matchedLineCount、主单去重分页、任一/全部语义、行级导出 schema、保存视图存储范围及稳定 token；保留旧端兼容或明确只升级 Web。先 EXPLAIN 再选反查索引，不能指望 `(code,model,name)` 的 B-tree 自动优化任意三列包含查询。统一常量并明确 100 万降到 10 万是产品限额变更；不能借统一响应删掉快照/选择令牌。CSV、单张导出与批量撤销均是新增能力。

### C17 中文映射、危险操作、详情入口有内部矛盾（UI-2 前修订）

- 规格：`docs/UX_STANDARDS.md:28` cancelled=已取消，`:55` 未知不展示原文，`:118`“撤销一笔”优先 toast；`docs/WEB_UX_SPEC.md:42` 不放查看，`:59` 又列操作列查看、`:109` 五入口全验；`:92` 不可用操作隐藏，`:96` 打印禁用例外；`docs/PRINT_SPEC.md:70` 打印又在更多。
- 代码：`apps/api/src/features/document-lifecycle/execute.ts:52` 撤销写 cancelled，入库 posting_state 另为 reversed；`packages/contracts/src/list-display.ts:9` 当前叫已撤销确认，`:19` 未知回退原值。`apps/web/src/features/corrections/row-actions.tsx:27`、`detail-actions.tsx:24` 当前不可更正项为 disabled，打印占位见 C14。
- 修订：按对象+字段映射 cancelled，单据撤销不能误译一般取消；业务页未知值显示中文，审计诊断保留原值需要在 AGENTS 的禁止内部值规则中明确狭窄例外并脱敏。库存撤销始终二次确认，toast 只适用清空选择等界面动作。建议删除行内查看要求，用单号/双击/Enter，右键可选；确定打印可见位及阶段 tooltip。颜色一律主题 token，包括 UX `:177` 的示例；审计秒级时间与全站分钟级格式明确例外。更正“打开→填→确认”不是两个动作，不应削减 DOMAIN 要求的二次确认来达标。

### C18 切换：期初、未完单、编号与回退有库存正确性风险

- 规格：`docs/CUTOVER_PLAN.md:31` 无挂起，却在 `:45`/`:100` 迁入未完成/冻结/部分发货；`:55` 期初加“当日”发生额用于 T+1～T+7；`:67` stock_opening；`:77` 大于旧最大号而 `:93` 从 1 开始；`:112` 先恢复旧系统写入再补录或作废新系统单。
- 代码：`apps/api/src/features/inbound/confirm.ts:18`、`apps/api/src/features/outbound/confirm.ts:17` 拒绝 source_id 非空历史单；`apps/api/src/features/reports/anchors.ts:19` 缺可定位切账时间时明确不可验证；001–011 无 stock_opening。`apps/api/src/features/document-numbering/repository.ts:23` 查原号占用、`:30` 扫同前缀日期的最大序列；`service.ts:48` 仍兼容显式旧号；`apps/api/src/features/stocktake/create.ts:49` 盘点号是日期+UUID片段，并非 PD 日序号。
- 修订：期初是不可变 T0 锚点，不是禁止后续正常收发的 stock 锁；登记仓品包吨、时区、流水水位、文件哈希、批次及来源证据。日核对用 T0 至当日累计，或昨日期末加当日，不能每天重置期初。未完单选择“清零切换”或“显式承接”，后者独立保存旧单关联与剩余量/事实上下文，不通过清空 source_id 解除历史保护。已有冻结摘要、混版事实、UUID/正文需逐项交接；部分发货依赖 C02。PDA 全量旧队列收妥是切换前硬门禁（`:104`），不是 T+7 才补。
- 编号按同前缀/同日期扫描占用后递增，GZ/PD 另定义；不盲目从 1 重置，不把不同格式旧号比较成一个最大整数。发生新业务后回退必须先冻结双方、保全新系统差额与事实、演练幂等补录并对账，再恢复唯一写系统；不得把已入账动作任意作废。七天不是数据安全界线，有新账后优先前向修复。本文不授权访问或修改旧系统。

## 3. 无法直接保证或成本不适合塞入 UI 批次的条款

| 条款及证据 | 实施障碍 | 替代方案 |
|---|---|---|
| 设备实时待传、车辆已离场（C11） | 离线数据未送达，服务端没有观测事实；不能由“无请求”推出零队列 | 上次上报+时间+未知，现场人工核验；后续协议增加观测事件 |
| PRINT §1 “天然一致”、§8 三张叠图一致（C14） | 复用模板不保证模板数据源识别新单号、独立更正表、分批已发量；尚无实际配置/PDF可验 | 先签明打印数据契约，提供各模板单页/跨页/更正/撤销样本，再实打与叠图；保留 disabled 占位 |
| 前端节流保证不重复打印（C14） | 多标签页、掉响应重试绕过前端状态 | 服务端版本化请求去重，或将承诺降为“防单页连点”，由用户选择产品保证 |
| STOCKTAKE 自动吨数+盲盘+200行（C08） | 改业务数据来源，泄漏盲盘比例并缩减既有容量 | 独立包吨录入；分段/虚拟列表；盲盘两阶段专用投影 |
| 四页汇总=合计；一项库存只有一个库龄（C06/C07） | 比率、去重单数、跨月余额、多个 FIFO 层不可直接相加/折成单值 | 明确每个指标的聚合函数及可验证范围；展示分桶 |
| WORKBENCH §9 p95<1s、STOCK §11 p95<800ms、REPORTS §11 缓存30秒 | 缺硬件、数据规模、冷/热、并发和统计窗口；现有 B3c 冷首屏未达标见 IMPLEMENTATION_PLAN:15 | 先定同一基准与真实分位数；写入后缓存失效或带水位，陈旧导出仍409；性能单列，不能以缓存热值代替冷测 |
| WEB §6.3 包含查询+多商品全部+命中行导出（C16） | 已有主单摘要导出模型无法直接兼容明细结果；复合索引也不覆盖所有 LIKE | 独立读模型、EXISTS/分组命中后按主单分页；流式行导出；先基准再加索引 |
| OPS 系统维护整套、CUTOVER 七天任意回滚（C15/C18） | 前者需要任务与产物生命周期，后者需要双系统差额对账/不可变事实承接 | UI-8拆子批；迁移/切换分别独立演练；有新写入优先前向修复 |

## 4. 规格缺失：字段、接口、迁移清单

以下 `M-*` 是**拟议迁移职责名称**，不是现有文件或已分配编号。当前注册到 011；下一真实迁移从 012 顺序分配，按实施排期确定，不能重写 001–011。每份新增迁移需 up/down、旧列指纹保留、非空拒绝破坏性 down、启动就绪检查；MySQL 8 继续用精确 DECIMAL/整数克，时间保留 UTC，business_date 用 DATE。

| 页面/能力 | 尚缺的数据与契约 | 迁移与前置关系 |
|---|---|---|
| MASTER_DATA | 分类、商品规格/包装/颜色/预警、仓库地址、往来联系人、默认归属、车辆唯一规范化值/别名/使用计数；新增/停用/设默认/合并 API；引用守卫 | `M-MASTER`：主数据扩列、分类/联系人/车辆表、真实 FK/默认唯一；来源/业务用途映射须先定 C01 |
| 入出库表单/详情（MASTER §8–9、WEB） | 单头联系人、类型/柜号，行型号/合同/备注，原始名称快照；编辑允许状态、审计前后值、导出/打印字段 | `M-DOCUMENT-SNAPSHOTS`；复用 011 日期及 corrections，不重建；允许的 bill_type 不得暗开 DOMAIN 暂缓的 RMA，样品出库不得等同不减库存的取样 |
| WORKBENCH | dashboard/analysis 两聚合 API；KPI单位/净量、时间窗、共同水位、趋势/TopN稳定排序、缓存键/失效；设备/车辆未知态 | 只读聚合本身无必需迁移；库存统计依赖 M-MASTER 口径；真实设备/车辆状态依赖 M-DEVICE-OBSERVATIONS 及事件定义 |
| STOCK_PAGE | 待发/可发、最近流水、库龄分布、范围小计；分页流水筛选/单格下钻/导出 | 先扩只读 API；B5c 后接发货余额模型；索引按 EXPLAIN 另定，不凭规格硬建 |
| STOCKTAKE | mode、盲盘预览修订/确认凭据、逐行原因、快照外盘盈行、未入账/设备待传的可靠提示、空白表与结果导出 | `M-STOCKTAKE-EXTENSIONS`；保持快照不可变、现有窗口/ACK，拒绝篡改009触发器来追加盘盈 |
| REPORTS | 更正/抵消明细、独立类型筛选、单数语义、重述视图 basis 与水位、日期更正记录、同口径导出、按月/仓品不同粒度 | B5d；只读分列无需新的库存表；日期更正如实施需 `M-DATE-CORRECTIONS`，与011数量更正分开；正式期初依赖 M-CUTOVER-ANCHOR |
| CATALOG | 当前目录查询/规格聚合/条码历史、任意版本对比与导出、放弃候选/重发历史版本、设备概览；版本和事实兼容 | 保留006/007；若保存放弃状态需 `M-CATALOG-CANDIDATES`；`M-DEVICE-OBSERVATIONS` 持久最后上报版本/hash/时间/队列观测，不改事实正文 |
| AUDIT | channel/result/errorCode/targetKind/业务编号、字段差异、关联库存操作、trace详情/时间线/JSON导出；失败尝试独立落点和脱敏策略 | `M-AUDIT-ATTEMPTS`；旧审计缺值NULL；成功/失败分开计数；时间线可先只读投影已有事件 |
| OPS 消息 | 通知、事件键、首次/最后发生、恢复状态、已读时间、扫描水位；列表/未读数/标读接口 | `M-NOTIFICATIONS`；触发源依赖已定义的单据/盘点/目录/备份事件 |
| OPS 维护/个人 | 备份任务、大小/SHA/完成状态/产物路径引用、恢复校验结果、任务互斥；健康采样；密码变更与会话列表/失效、锁定计数 | `M-MAINTENANCE`、`M-AUTH-EXTENSIONS`；不把凭证或任意文件路径交给浏览器；不建立多用户审批 |
| PRINT | 模板配置、启用唯一、密钥引用、单据版本化数据契约、生成请求/审计、配置/测试/下载接口 | `M-PRINT-TEMPLATES`；安全与模板对接先定，不能把占位视为已接入 |
| CUTOVER | T0时间/时区/水位、批次/文件SHA、仓品开账值、单号占用、未完单承接映射、事实交接清单 | `M-CUTOVER-ANCHOR`；开账只一次且可验证；承接额外建模，绝不由普通历史导入解除保护 |
| B5c 状态前置 | 发货批次/行/事实归属、已确认量/剩余量、短关、溢发原因；取样独立 sample_marks | `M-SHIPMENTS`、`M-SAMPLE-MARKS`；对应 DOMAIN B5c，不能埋入 UI-3/UI-4。B5b 的追加入库/转移也需独立业务方案 |

横向缺项还包括：批量撤销的逐单 token/幂等与失败结果、是否整批原子；保存视图持久化范围；GET参数兼容/导出字段版本；全局常量与文案模块实际路径；空态/未知态与错误码映射。以上均应在所属规格落定后写代码。

## 5. PARITY_MATRIX 需要补行和改判定

行号以本轮审阅正文为准。不能仅在末尾追加“已完成”，同时留下正文相反结论。

| 原行/功能 | 应改为的现状与差距 | 证据/关联 |
|---|---|---|
| `docs/PARITY_MATRIX.md:5` 总体排期；`:63` 更正 | B5a 数量更正/业务日期已有，B5b–d与入账后日期更正未做；011开发库应用另列 | C04；IMPLEMENTATION_PLAN:349；B5A_ACCEPTANCE，不作本轮复测 |
| `:15` 工作台 | 当前是出库列表，不是完整聚合工作台；新增 UI-3 工作台/看板两行 | C11/C12；apps/web/config/routes.ts:38 |
| `:21` 商品，`:22`–`:24` 仓库/客户/供应商 | 当前产品只读；“ERP维护”为被新目标取代的历史决定；新增分类、联系人、车辆、历史快照、引用停用差距 | C01/C03/C05；不能先标“CRUD已完成” |
| `:31`/`:33` 入库，`:39`/`:41` 出库 | 将更正/日期从后置移至B5a已实现；补有效量/累计差额/最近更正/抵消链；短溢装、分批、短关、取样仍P差距 | C02/C04；apps/api/src/features/corrections/summary.ts:67；reversal.ts:59 |
| `:32`/`:40` 单据查询导出 | 现有XLSX主单三范围已做；商品反查、命中行导出、CSV、单张导出、批量动作未做 | C16，不能用UI-2整页完成覆盖接口缺口 |
| `:42` 未知状态 | 原文回退是旧验收；新业务页中文、诊断例外待修订 | C17 |
| `:48` 打印 | 保留“未实现”；补配置、代理、三模板、新单数据源、安全及实打验收，B5a只有占位 | C14 |
| `:55` 目录/PDA | 既有混版/交接证据保留；新增目录分组/历史轨迹/候选放弃/设备上报/差异导出，真实队列验收仍未完成 | C10/C11；不能把目录改版写成重新实现全部B1c |
| `:62`/`:64` 库存查询与来源 | 单一ERP来源是现状；新业务商品来源策略、待发/可发/库龄及全量流水筛选为差距 | C01/C06 |
| `:70`/`:72` 盘点 | B3a已做独立包吨/固定快照/窗口/ACK；明盲盘、逐行原因、盘盈行、空白表新列P，万行能力不降级 | C08/C09 |
| `:78`–`:81` 四报表，附注`:120`–`:122` | B3b/B3c代码已有；周转冷首屏未达目标必须保留U差距；重述、更正明细、图表联动另列，不统称全部已验收 | C07；IMPLEMENTATION_PLAN:15/24 |
| `:96` 编号 | RK/CK/GZ已有；PD仍UUID片段，切点/旧号占用与规格需对齐 | C18 |
| `:102` 日志 | 当前轻列表+JSON详情；失败/渠道/结构化差异/时间线/trace导出未做 | C13 |
| `:104` 备份、`:110` 消息、`:116` 个人 | CLI备份/新库恢复已有；定时与指纹产品化、健康监测、通知、改密/会话管理仍缺 | C15 |
| 新增切换行 | T0锚点、未完单承接、PDA门禁、编号、演练与有新写入后的回退分别验收 | C18 |

本轮仅修复 `PARITY_MATRIX.md:136` 表格与商品说明粘连的 Markdown 换行。上述语义修订清单随评审入库，待规格修订时同步正文；其末尾“规格定稿”不表示已消除本评审发现的冲突。

## 6. UI-3～UI-8 批次映射与建议顺序

收到的 README 只列页面和实现状态，**没有 UI-3～UI-8 编号映射**。现有映射来自 `docs/PARITY_MATRIX.md:129` 至 `:134`；本节沿用该编号，不另造一套。MASTER_DATA、STOCKTAKE、PRINT、CUTOVER 不应遗漏，也不应强塞进 UI-3～8。

| 批次 | 具体规格/交付边界 | 迁移及依赖 | 建议顺序 |
|---|---|---|---|
| 前置：规格修订+011开发应用 | 本评审、011独立计划；本轮仅文档 | 011先备份/恢复/指纹/冒烟，另轮执行 | 0 |
| 主数据/单据字段批次（单列） | MASTER_DATA §0–12、WEB表单与详情；落实C01/C03/C05 | M-MASTER、M-DOCUMENT-SNAPSHOTS；复用011 | 1，决定所有库存/报表口径 |
| UI-2（前置公共交互） | UX_STANDARDS、WEB_UX_SPEC；解决C16/C17 | 展示层无需必然迁移；反查索引按实测；批量写另审事务 | 2，先公共壳和查询契约 |
| UI-7 操作记录 | AUDIT_PAGE_SPEC §3–12 | 基础投影无迁移；M-AUDIT-ATTEMPTS后开放失败/渠道筛选 | 3，可先提供后续批次审计可观测性 |
| UI-6 条码目录 | CATALOG_PAGE_SPEC；保留B1c门禁 | M-CATALOG-CANDIDATES（若采用放弃状态）、M-DEVICE-OBSERVATIONS；需移动协议时单列 | 4，设备字段未具备时明确未知 |
| 盘点增强（单列） | STOCKTAKE_SPEC，C08/C09修订后实施 | M-STOCKTAKE-EXTENSIONS；继续使用009窗口 | 5，不与UI-4混作样式调整 |
| UI-4 库存概览/流水 | STOCK_PAGE_SPEC | 既有库存读模型扩展；依赖主数据口径；分批待发依赖B5c/M-SHIPMENTS | 6；可先交在库/流水，分批能力另标未完成 |
| UI-5 报表四页 | REPORTS_PAGE_SPEC + REPORT_SPEC D1–D7 + DOMAIN B5d | 分列/图表可无DDL；重述依赖日期策略，必要时M-DATE-CORRECTIONS；正式锚点M-CUTOVER-ANCHOR | 7，先算术/导出一致，再图表 |
| UI-3 工作台/看板 | WORKBENCH_SPEC | 聚合本身无必需迁移；复用UI-4/5与UI-6观测，车辆事件另定 | 8，先定义可信指标再聚合 |
| UI-8 消息/维护/个人 | OPS_PAGES_SPEC三个子批，不作为一个大提交 | M-MAINTENANCE → M-AUTH-EXTENSIONS → M-NOTIFICATIONS；通知接稳定事件 | 维护基础与011准备可前置；完整UI在9 |
| 打印/切换（独立门禁） | PRINT_SPEC、CUTOVER_PLAN | M-PRINT-TEMPLATES、M-CUTOVER-ANCHOR；未完单承接依赖B5b/c等已验能力 | 打印配置齐备后实施；切换最后 |

以上是依赖顺序，不是本轮开工授权。编号不要求执行顺序递增。B5b 的入库异常/转移、B5c 的分批/短关/取样保持 DOMAIN 的独立业务批次；其未完成字段不应在 UI 验收中伪造。

## 7. 哪些可以照做，哪些先修订

| 文档 | 结论 | 实施前必须处理 |
|---|---|---|
| AGENTS / DOMAIN_RULES | 核心业务约束继续执行：单用户、事实不可变、Web事务入账、负库存阻断、包吨独立、更正保留原值 | 仅需澄清诊断原值例外；DOMAIN末尾“只提交文档不开始B5a”是早期批次记录，不是当前实现状态 |
| UX_STANDARDS / WEB_UX_SPEC | token、中文、单一主操作、二次确认、零位移、查询上下文可作为实施约束 | C16/C17：动作/入口/映射矛盾、限额与契约、索引名；批量写与保存视图补设计 |
| MASTER_DATA_SPEC | 本系统维护主数据的目标明确；当前不能只删只读守卫 | C01/C03/C04/C05：来源、快照、联系人/车辆、冻结日期边界、类型排除RMA/取样歧义 |
| WORKBENCH_SPEC | 布局与按需图表方向保留；需新聚合实现 | C11/C12：可靠数据源、KPI单位、缺响应字段、未知态、性能条件；热力图补Heatmap/Calendar注册，颜色用token |
| STOCK_PAGE_SPEC | 在库与流水下钻方向保留 | C01/C06：来源白名单、剩余待发、可发负值文案、单值库龄/五档与小计 |
| STOCKTAKE_SPEC | 固定快照、锁仓、人工回写、终态不可重开继续执行 | C08/C09：独立吨数、盲盘投影/令牌、盘盈行、容量、ACK/幂等/更正路径 |
| REPORT_SPEC / REPORTS_PAGE_SPEC | D1–D7可作为既有算术依据；布局复用现有报表读模型 | C07/C16：重述、避免更正双计、不可加总指标、API兼容/缓存水位；REPORT_SPEC状态“B3c实施中”需更新 |
| CATALOG_PAGE_SPEC | 全量快照、原子发布、历史版本保留、事实不改继续执行 | C10/C11：候选生命周期、删码文案、校验范围、失败恢复、设备观测 |
| AUDIT_PAGE_SPEC | 轻列表、按需详情、审计不可删继续执行 | C13/C17：失败独立记录、历史未知、真实时间线、中文与脱敏诊断例外 |
| OPS_PAGES_SPEC | 新库恢复不覆盖原库、单用户最小身份目标保留 | C15：定时/产物/指纹任务、提醒触发、恢复证据、身份/队列边界 |
| PRINT_SPEC | 服务端代理积木PDF方向保留；当前占位保持 | C14：安全、配置可见性、模板字段/版本、PDF水印、去重、格式范围与实际验收输入 |
| CUTOVER_PLAN | 必须先演练、逐仓品零差异、不双写的方向保留 | C18：未完单策略、T0与累计等式、编号占用、旧队列门禁、有新写入的回退顺序 |
| README / PARITY / IMPLEMENTATION | 可作导航及历史记录，不能用概括“已完成”消除差距 | 补本评审链接、UI批次映射；矩阵逐行更新见§5；构建/自动化/设备/生产分层 |

## 8. 评审时的业务提问（已全部决策，见§9）

1. **切换时未完成作业采用哪一种策略？** 建议首轮“完成/收妥后切换”；如必须带单切换，需明确允许的 open/frozen/partially_shipped 集合和剩余量承接，完成专项方案与演练后再排上线。不能同时写“无挂起”和“迁入挂起”。
2. **盘点吨数是否坚持独立实测录入？** 建议坚持，自动均重只作提示且不默认入账；外部规格新增的“只填包数自动折吨”和“半包按整包”需要业务确认。盲盘不得依赖返回系统数量来计算。建议200行仅为显示窗口，不作盘点容量上限。
3. **“样品出库”是否代表整包实际离仓？** DOMAIN的取样不减库存，MASTER另列样品出库。建议本批先移除有歧义类型；只有确认独立实物出库业务后才定义，RMA继续后置，不用“只是分类”绕过规则。
4. **是否允许审计详情的脱敏诊断区显示/复制原始状态、错误码和追踪号？** 建议允许受控诊断例外，普通业务列表仍只显示中文；需同步AGENTS与UX/AUDIT，避免既要求排障原文又全面禁止。

主数据开放方向、负库存禁止、数量更正公式、入账后日期锁定、重述视图和更正不得重复入收发量已有上位规则，不再次请求批准。来源映射、事务锁序、兼容路由、失败日志分表、打印凭证保管等由实现方形成具体修订；打印的地址/模板参数/旧PDF属于后续集成输入，不在本轮索要密钥。

011 的备份、指纹、应用、冒烟与回退另见 [MIGRATION_011_APPLICATION_PLAN.md](MIGRATION_011_APPLICATION_PLAN.md)。本轮到文档入库结束，不开始任何功能批次。

## 9. C01–C18定点修订闭环（本轮）

四项业务决定以DOMAIN_RULES §5.2/11/12/13为准：原号legacy-open承接且仅确认/作废；盘点包吨独立、默认可覆盖折吨/半包手填/200仅渲染；样品整包出库扣库与取样不扣库分离；登录审计详情原始数据区例外。C08原建议“仅手工、不默认折算”、C18原建议“首轮清零”等均被本次明确决策取代。

| 条款 | 定点修订位置 | 本轮结论/后续能力 |
|---|---|---|
| C01 | DOMAIN §12；MASTER §0/10；STOCK §3/11；REPORT §10 | 来源与inventory_eligible分离，保留旧证据/未知排除；先统一资格/快照再移除PRODUCT_MASTER_READ_ONLY，B6a实施 |
| C02 | DOMAIN §5.1–5.2；WEB §12；CUTOVER §8/12 | 原行计划+发货批次/事实唯一归属+包吨独立余额，完整状态/短关/更正撤销影响；B5c，样品出库另类型且扣库 |
| C03 | MASTER §5–7/10 | 联系人真实外键/默认唯一、车辆规范键/别名/去重使用关联与事务幂等；新增M-MASTER |
| C04 | DOMAIN §2；MASTER §9；REPORT §10 | 复用011不重复DDL、冻结日期边界、历史NULL保留；入账后日期更正属B5d新追加式记录 |
| C05 | MASTER §8.3 | 头/行/往来/车辆/联系快照与停用守卫；无历史证据不伪造原名称，M-DOCUMENT-SNAPSHOTS |
| C06 | STOCK §3–4/8/11 | 待发=独立包吨剩余量，可发负值是计划缺口；五档库龄+未知，全筛选/本页合计分开；B6f |
| C07 | REPORT §10；REPORTS §2/4/5/13–16；README权威顺序 | 更正/抵消是调整子项不双加；显式重述/归期桥接、未知规则、不可加总指标；B5d→B7a |
| C08 | DOMAIN §11；STOCKTAKE §4–5/10/13 | 默认折算可覆盖/零基数及半包手填；盲盘核对阶段折算揭示；发现行独立表、200渲染上限不丢草稿；B6e |
| C09 | STOCKTAKE §6–11 | 保留锁序/窗口/漂移/ACK/令牌、同键重放；批量保存整批原子；更正先作废盘点重建，无旁路 |
| C10 | CATALOG §6–8/12–16 | 移出目录不等于出库；候选保留版本、放弃替代删除、响应丢失查状态；校验与既有硬范围对齐；B6d |
| C11 | WORKBENCH §2/9；CATALOG §9；STOCKTAKE §4；OPS §五 | 仅展示已登记交接/单据证据，实时队列、覆盖率、在装/离场均不支持；未来观测未排入本批 |
| C12 | WORKBENCH §5–9 | 新聚合API/单位/归期/水位/缓存、冷热基准和图表注册，B7b实施，不声称已有服务 |
| C13 | AUDIT §4–15；DOMAIN §13 | 失败尝试独立表/回滚后记录、旧字段未知、真实事件投影及路由顺序；原值仅登录详情raw；B6c |
| C14 | PRINT §1–10 | 三模板PDF、服务别名/密钥引用/脱敏、代理安全/服务端去重、模板版本与实际水印；B9依赖真实集成输入 |
| C15 | OPS三页正文及§五 | 通知去重/恢复周期、备份任务/产物hash/恢复指纹、失败证据、采集器、账户/会话；B8a→b→c |
| C16 | WEB §6/11；各页公共契约引用 | 现有参数/items/token兼容、商品反查主单分页/行导出、逐单批量事务、本地视图、分页/导出常量迁移；B6b |
| C17 | AGENTS；UX §2/3/6/7/10；WEB §2/5/7/8；AUDIT/PRINT/图表 | 原值狭窄例外、cancelled按对象、撤销始终确认、三入口/三行操作/单primary、打印占位例外、颜色token |
| C18 | DOMAIN §12；CUTOVER全文相关条款 | 原号legacy-open不可改单、仅确认/作废；T0锚点与累计对账、编号占用、旧队列硬门禁、双冻结差额回退；B10 |

PARITY_MATRIX已定点改28个既有功能行并新增八份页面规格正式行，不再只追加“完成”概括；B3c冷首屏、011应用、实体/生产差距保留。UI编号与实施编号的唯一排期表在IMPLEMENTATION_PLAN末节，README与矩阵同步。

本轮结论：18组规格冲突均有明确条款落点，**剩余业务决策0**。新增表/API/服务能力仍待所属批次实施及验收，不等于功能已完成；模板连接/旧PDF、实际切换数据和现场设备证据在执行阶段获取，不本轮索取或操作。011应用计划未执行亦未改变。

修订记录：C01 按§9对应规格落点记录处理结果，保留原评审证据与实现未完成边界。

修订记录：C02 按§9对应规格落点记录处理结果，保留原评审证据与实现未完成边界。

修订记录：C03 按§9对应规格落点记录处理结果，保留原评审证据与实现未完成边界。

修订记录：C04 按§9对应规格落点记录处理结果，保留原评审证据与实现未完成边界。

修订记录：C05 按§9对应规格落点记录处理结果，保留原评审证据与实现未完成边界。

修订记录：C06 按§9对应规格落点记录处理结果，保留原评审证据与实现未完成边界。

修订记录：C07 按§9对应规格落点记录处理结果，保留原评审证据与实现未完成边界。

修订记录：C08 按§9对应规格落点记录处理结果，保留原评审证据与实现未完成边界。

修订记录：C09 按§9对应规格落点记录处理结果，保留原评审证据与实现未完成边界。

修订记录：C10 按§9对应规格落点记录处理结果，保留原评审证据与实现未完成边界。

修订记录：C11 按§9对应规格落点记录处理结果，保留原评审证据与实现未完成边界。

修订记录：C12 按§9对应规格落点记录处理结果，保留原评审证据与实现未完成边界。

修订记录：C13 按§9对应规格落点记录处理结果，保留原评审证据与实现未完成边界。

修订记录：C14 按§9对应规格落点记录处理结果，保留原评审证据与实现未完成边界。

修订记录：C15 按§9对应规格落点记录处理结果，保留原评审证据与实现未完成边界。

修订记录：C16 按§9对应规格落点记录处理结果，保留原评审证据与实现未完成边界。

修订记录：C17 按§9对应规格落点记录处理结果，保留原评审证据与实现未完成边界。

修订记录：C18 按§9对应规格落点记录处理结果，保留原评审证据与实现未完成边界。
