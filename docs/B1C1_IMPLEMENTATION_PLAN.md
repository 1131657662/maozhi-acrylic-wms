# B1c-1 实施计划：目录版本化服务端与 Web 上传

状态：**待用户确认，只交计划；未编写业务代码、迁移或测试，未执行迁移。**
基线：`ee25c0a7f12029c34999be84f8ef8d271a8fd5c0`；计划日期：2026-11-08。
本批属于 P 对齐。范围为版本目录、Web 上传/差异/发布/历史、服务端事实兼容和冻结/确认解耦；PDA 实现与设备切换留 B1c-2，列表壳/导出/打印留 B1b，撤销/作废/更正留 B2。无新增依赖，不修改技术栈，不连接生产、3306 或 warehouse。

## 1. 选择与现状证据

推荐 **A：不可变整版快照 + 当前指针 + 不可变事实上下文**。同一张单不固定目录版本；“最新版”仍指 PDA 上次完整同步的本地版，不要求在线扫码。

| 比较项 | A：整版快照（采用） | B：版本区间（不采用） |
|---|---|---|
| 表达 | 每版完整 entries；head 指向当前版 | 条码属性带 from/to 版本区间，查询时重建整版 |
| 发布 | 全量候选先校验，短事务切 head | 同事务关闭旧区间、打开新区间、处理消失/重现 |
| 历史事实 | 直接定位 `(version, barcode)`；版本永久保留 | 依赖区间无重叠、无缺口及边界约定 |
| 成本与回退 | 约 9k 条/版的额外存储；对账和恢复直观 | 少存未变条目，但差异、历史重建与回滚更复杂 |
| 判断 | 当前按需上传规模下，正确性收益高于存储成本 | 没有证据表明需要为节省这部分空间引入区间模型 |

当前需要实际修改的耦合点：

- [001_initial.up.sql:37](../apps/api/migrations/001_initial.up.sql#L37)：目录 barcode 单键；事实版本限制为 1，且外键引用旧目录。
- [contracts/index.ts:42](../packages/contracts/src/index.ts#L42)、[rows.ts:20](../apps/api/src/features/outbound/rows.ts#L20)：事实/目录版本在契约和读取中写死为 1。
- [repository.ts:15](../apps/api/src/features/outbound/repository.ts#L15)：从当前目录获取旧事实商品归属；[assemble.ts:22](../apps/api/src/features/outbound/assemble.ts#L22)：直接序列化事实数组生成摘要，扩展字段可能误伤旧摘要。
- [validate.ts:8](../apps/api/src/features/scan/validate.ts#L8)：存在七天回传窗口，随后按当前目录验证重量和商品；不能直接用于新版发布后的离线旧版事实。
- [PDA FactBuilder.kt:12](../apps/pda/app/src/main/java/cn/maozhi/wms/pda/scan/FactBuilder.kt#L12)：旧设备只支持 v1。本批只读检查，不改 Android 代码、不声称完成离线端验收。

2026-11-08 计划阶段只读检查：显式连接 `127.0.0.1:3307`，先设会话只读并使用只读事务；目录 **9018 条 / 141 规格 / 2707.9025 吨 / 全部 v1**，扫码事实 **0**，冻结记录 **0**，出库单 **415（全部历史来源）**。目录吨数仅用于迁移校验，不是库存或经营统计。当前样本没有事实，必须另用非空合成历史夹具验证迁移，不能将零行核对当作历史冻结/确认通过。

## 2. 表结构与不变量（拟 006）

沿用 MySQL 8、UTC `DATETIME(3)`、`DECIMAL(12,4)` 吨；外部重量是整数克且为 100g 的整数倍。版本 ID 采用正整数 INT AUTO_INCREMENT，允许空号、不复用；与现有事实 catalog_version 类型一致。

| 表 | 关键字段 | 约束与用途 |
|---|---|---|
| `catalog_versions` | `version_id` PK、`upload_uuid` UNIQUE、`base_version_id/base_revision`、`status`（staging/validated/published）、`source_kind`、`source_name`、`source_encoding`、`source_sha256/content_sha256`、`parser_version`、`source_bytes MEDIUMBLOB`、条目/规格数、操作者和校验/发布时间 | 校验后条目及来源内容不可改；只允许状态单向推进。旧版仍是 published，是否当前由 head 决定；相同内容恢复成后继新版本，content hash 不设全局唯一 |
| `catalog_entries` | `(version_id, barcode)` PK；`source_spec VARCHAR(255)`、`raw_weight_kg` 原字符串、`weight_tonnes`；v1 可保留 `legacy_product_code` | 版本 FK RESTRICT；重量正数；条码大小写/前导零保留，列类型及排序规则与事实一致。新版不创建 SPEC 商品、不建 ERP 映射；同码可存在多版 |
| `catalog_head` | `id=1`、`active_version_id`、`revision` | 单行约束；版本 FK RESTRICT；只由发布事务切换；空的新库初始化前允许无行，不用虚假 v0 |
| `scan_fact_context` | `fact_id` PK/FK、`catalog_version_id`、`barcode`、`outbound_line_id`、`erp_product_code`、`source_spec`、`weight_tonnes`、`resolved_at`、`binding_source`、`context_hash` | 事实、历史条目复合键、出库明细均 FK RESTRICT；插入后不可覆盖。版本/码/重量须与事实完全相同；ERP 行须属于原单。迁移无法知道本机解析时间时 resolved_at 留空并注明 provenance，不能编造时间 |

`scan_facts` 原 UUID、重量、版本、payload_hash、时间、记录人不改；只将 `catalog_version=1` 限制放宽为正整数，并把旧 barcode 外键替换为 `(catalog_version, barcode) → catalog_entries(version_id, barcode)`。旧 `scan_catalog` 暂保留为只读 v1 兼容快照，不由上传更新，不再用于冻结/确认。

新上传的规格、原始 kg、重量均必填；迁移旧夹具中原本为空的 source_spec 时保留空值及 legacy 来源标识，不用商品名补造原规格。条目/context 中仅为历史未知信息保留的 nullable 字段不得成为新上传的校验豁免。

原文件存储建议在 A 内采用 **数据库 MEDIUMBLOB**：先限制单文件 5 MiB、最多 100000 行，当前规模不需要另设对象存储。原文件、manifest、候选条目可同事务保存，现有 `mysqldump --hex-blob` 自动包含产物，避免引入文件系统与数据库双写/双备份。此为对 U-06“受管文件存储”的具体落地选择，待本计划确认后同步 DD-15；不改 U-06 的快照/事实/离线原则。读取列表不 SELECT 原文件字段，日志不输出文件正文；所有本地验证材料仍只存 `.local/`。

源文件原摘要和规范化内容摘要分开：内容摘要按条码二进制稳定顺序，对 `[barcode, sourceSpec, weightGrams]` 的固定 JSON 投影计算 SHA-256，明确 UTF-8/字段顺序/无 locale 排序；不使用易被截断的 GROUP_CONCAT。只改换行或文件编码但内容相同，不重复发布。

## 3. 上传、预览与发布的事务边界

### 3.1 接收与差异预览

1. Web 选择全量 txt 和明确编码（默认沿用现有 gb18030，可选 UTF-8，服务端 fatal 解码）；使用专用 raw body 上传接口，不把全局 JSON 的 10kb 限额放大，不增加 multipart 依赖。鉴权、Web 来源检查后才解析文件；原文件名仅作展示，不能作为路径。
2. 完整校验后才入候选表：缺列、乱码、非法条码、非数字/非正重量、超出既有整数克契约、不能精确到 0.1kg、重复条码（即使重量相同）整版拒绝；返回行号和原因，不跳过坏行、不四舍五入。规格内部文字/空格按原字段保留；60–389.5kg 不是校验上下界。
3. 在一个候选事务中读取一致的 head/base，写版本 metadata/source bytes → 分批 INSERT 全量 entries（分批但不分事务）→ 校验条数/摘要及差异 → 标记 validated → 写上传审计和幂等结果 → COMMIT。中途失败整笔回滚，head 从未改动。同 upload UUID、相同原文件摘要/编码重放原结果；异正文同键拒绝。规范化内容已等于活动版时返回 noChange，不分配新版本，也不提供重复发布动作。
4. 预览显示新增、消失、重量变化、规格变化、不变；总“变化”按条码去重，规格/重量可重叠。提供每类明细和旧→新重量，不能仅给总数。`旧条数 + 新增 - 消失 = 新条数` 必须成立。
5. 明确选择的零字节/仅空白 txt 是可解析的零条快照：醒目提示“本版移除全部”，仍用同一次发布操作；缺少文件元信息/上传截断/解析失败不等同于零条有效目录。消失仅表示目录移除，不扣库存、不改单、不加逐条失效审批。

### 3.2 发布事务

同一请求携带发布 Idempotency-Key、versionId、预览时 baseRevision/contentSha256。锁顺序固定：`app_meta.identity → catalog_head → catalog_versions 候选行`；沿用已有单用户写操作顺序，不锁所有库存/单据。

事务内顺序：**幂等重放 → 核验迁移门禁、候选状态/完整性、base revision、版本单调性 → 版本标记 published → 更新 head 及 revision → operation_log 发布前后版本/差异摘要 → idempotent_commands 结果 → COMMIT**。不写 scan_facts/context、出入库单、scan_submissions、库存或库存流水。

- 候选全量数据此前已完整提交但对作业不可见；普通读取和事实接收只允许 published 版，不能读取 staging/validated。业务始终只能看到完整旧版或完整新版。
- 任一步报错回滚版本状态/head/审计/幂等结果；候选仍可供重试，当前目录仍是上一版。提交成功但响应丢失时，同键重放或按 upload UUID 查已发布结果，不生成新版本、不谎报“未发布”。
- 两个候选基于同一 base 并发发布只允许一个成功；另一个返回 `CATALOG_BASE_CHANGED`，保留原预览，重新校验形成后继候选，不能把旧编号覆盖到新版本前面。
- 发布后不修改旧 published 状态为“失效”，也不关闭它接收事实的资格。已发布的内容不提供 UPDATE/DELETE API；源码写路径只允许 INSERT 条目和受控状态切换。

## 4. 事实接收、冻结/确认与旧客户端

### 4.1 服务端兼容协议

- 旧事实请求原形继续接受（catalogVersion=1）；不向原 body 注入默认字段，不改变现有 `hash(JSON.stringify({planId,fact}))` 规范化次序。同 UUID/正文已接收时先重放，再做目录/单据状态判断；新版移除条码或单据冻结不能破坏重放。
- 新协议采用显式 envelope：`{schemaVersion:2, fact:{原字段，catalogVersion 为正整数}, context:{outboundLineId, sourceSpec, resolvedAt}}`。原 fact 独立计算旧格式 payload_hash，context 单独规范化哈希；相同 UUID 但 fact 或已绑定 context 不同返回冲突，不覆盖。旧队列后续可外带归属 context，原 fact 本文不改，此客户端工作留 B1c-2。
- 首次接收只按事实声明的历史 `(version, barcode)` 验证：published、条码存在、实重/规格吻合；按显式 ERP 行验证属于原单、有效且商品来源是 erp-product。同单允许 v1/v2/... 共存；不建立 SPEC↔ERP 全局关系。
- 无 context 的旧 v1 请求只能沿用原 v1 商品编码与原单 ERP 行的**唯一精确关联**；不能按名称/前缀猜测，也不能仅因“单据只有一行”就替旧正文猜归属。无法定位返回可恢复的 `FACT_CONTEXT_REQUIRED`；服务端不改原事实，PDA 队列保留。实机存在这种队列时，发布启用门禁保持关闭，待 B1c-2 交接补齐。
- 首次事实、context、单据 revision、scan.record 审计同事务写入；全局条码唯一约束保留。跨版本重复码仍返回 DUPLICATE_BARCODE，不再次计包；旧 scan_catalog 条码行锁移除，冲突由全局唯一键和明确错误映射兜底。
- 移除过去超过七天即拒收的临时限制；合法历史版不因目录年龄/离线时长过长被拒收。日期格式及现有未来七天上界校验保留，身份、单据状态、超扫、同 UUID 异正文等真实校验继续存在。
- 当前版本改重/改规格/删码仅由独立上下文/差异查询返回提示，不进入 fact/hash/digest，不影响接收事务。差异查询失败可重试，不撤回事实或拒绝冻结。未知版本、未发布版、该版缺码、该版重量不符均明确报错；本批不新增版本撤销接口。

### 4.2 不依赖目录的冻结与确认

- 行实扫量只按 `scan_fact_context.outbound_line_id` 分组，包数数事实 UUID，重量累加 **scan_facts.weight_tonnes**。版本/目录条目只用于首次接收与追溯，冻结、确认和其读模型不查询 catalog_head/scan_catalog/catalog_entries。
- 将现有 digest 提取为显式稳定投影：保持当前 facts 的字段、属性顺序、按 id 排序、整数克和时间格式。context、规格说明、当前版本差异提示不加入该投影；本批不升级摘要算法，不改已有 scan_submissions.digest。
- 新增 context 的引用和正文插入后不可变；因此不纳入旧 digest 也不会出现“摘要未变但事实归属被改”。已有事实后的明细禁改规则保留。
- 新事实被接收才正常推进原单 revision/digest；单纯发布目录不推进二者。冻结仍要求计划包数和实重完全一致；确认沿用 B1a 事务扣库/流水/审计/幂等，不增加差异放行。

### 4.3 B1c-1 / B1c-2 切分

- 旧 `GET /scan/catalog` 保留原数组/字段并固定返回真实 v1 快照；不能把 v2 伪装为 v1。新 manifest 和显式版本分页端点准备好，支持新客户端以后原子同步。
- 本批用实际 PDA 身份的 API 请求作为协议测试驱动，覆盖原单混版/旧事实回传；**这是服务端和 Web 验收，不是 PDA 离线/Room/实体设备验收**。不修改 Android/小程序代码。
- 保留 U-06 设备交接门禁：隔离测试库允许发布并验收 v2；现有现场作业环境启用新版发布前，必须完成旧设备/待传队列清点以及 B1c-2 的快照式客户端升级。旧端仍以 v1 工作不能算“已用最新版”，服务端不强迫它在线扫码。新发布入口应有默认关闭的部署开关及明确未开放提示；测试环境显式开启，不能绕过迁移异常门禁。

## 5. API 契约计划

均位于 `/api/v1`，继续使用现有响应信封、会话/traceId；所有上传和发布只允许 Web 同源身份，PDA/小程序返回 403。新版本查询允许 Web/PDA；旧读取接口保持兼容。

| 端点 | 请求与关键响应 |
|---|---|
| `POST /catalog/uploads` | raw txt；query encoding/fileName；Idempotency-Key 即 upload UUID；返回 uploadId/versionId、state、baseVersion/baseRevision、source/content SHA、条目/规格数、diffCounts、noChange。坏文件 422 并给行号错误；无候选残留 |
| `GET /catalog/uploads/:uploadId` | 返回校验/发布结果及发布操作 ID，用于掉响应恢复；不泄露原文件正文 |
| `GET /catalog/versions/:versionId/diff` | kind=added/removed/weight/spec/unchanged，按条码游标分页；返回冻结的 base 和旧/新规格、整数克，禁止随当前 head 静默改变预览 |
| `POST /catalog/versions/:versionId/publish` | `{baseRevision,contentSha256}` + 独立 Idempotency-Key；返回 activeVersion/revision、publishedAt、diffCounts、operationId；同键重放优先于 base 冲突检查 |
| `GET /catalog/versions` | 简单版本历史分页；published/validated、当前标识、条数、来源/发布时间、hash；无通用查询壳、导出或打印 |
| `GET /scan/catalog/manifest` | 当前已发布 versionId、条目数、contentSha256、parser/hash 规则版本；整版零条也有 manifest |
| `GET /scan/catalog/versions/:versionId/entries` | afterBarcode/limit；始终读取请求的已发布版，返回 barcode/sourceSpec/weightGrams/catalogVersion；发布并发不让分页混版 |
| `POST /scan/plans/:id/facts` | 兼容旧正文与 schemaVersion=2 envelope；仍仅 PDA 身份可写；响应旧 Detail 结构不加会改变摘要的字段 |
| `GET /scan/plans/:id/fact-contexts` | Web/PDA 按事实游标读取当时 ERP 行、版本/规格/实重和独立差异提示；不改原 Detail/digest，供 Web 追溯及 B1c-2 使用 |

错误计划：401/403 延续；413 `CATALOG_FILE_TOO_LARGE`；415 `CATALOG_ENCODING_UNSUPPORTED`；422 `CATALOG_FILE_INVALID`（含行号）、`VALIDATION_ERROR`；409 `CATALOG_BASE_CHANGED`、`CATALOG_NOT_PUBLISHABLE`、`CATALOG_VERSION_UNAVAILABLE`、`CATALOG_MIGRATION_NOT_READY`、`FACT_CONTEXT_REQUIRED`、`FACT_CONTEXT_MISMATCH`、`IDEMPOTENCY_CONFLICT`；发布部署开关关闭返回 409 `CATALOG_PUBLISH_DISABLED`。既有 UNKNOWN_BARCODE/WEIGHT_MISMATCH/DUPLICATE_BARCODE/PLAN_CLOSED/PLAN_DIFFERENCE/STALE_PLAN 保留语义。失败展示明确中文和重试方式，不把当前版差异当错误。

## 6. 006 迁移步骤与回退

1. **停止本地写服务，备份并恢复到新隔离库核验。** 只用 3307；清点 v1 行/重量/内容 hash、所有事实各列与 payload_hash、全部出库明细实扫量/revision/digest、scan_submissions；基线材料只写 `.local/evidence/`。不重 seed、不清队列。
2. **先跑只读预检再做 DDL。** 每个旧事实必须 version=1、v1 条码/重量一致，并能唯一精确关联原单 ERP 明细；发现缺失/歧义/非 ERP 归属就输出异常并拒绝迁移启用。不能修改事实去“适配”最新文件。当前样本事实为 0，非空条件用合成旧库测试覆盖。
3. **006 创建新表并记录 applying。** 001–005 不改；MySQL DDL 不假装可事务回滚，沿用迁移锁和短 lock_wait_timeout。新增专用迁移前后置钩子，不重写通用迁移框架。
4. **一个数据事务封存 v1、回填 context、初始化 head。** 从现有 scan_catalog 原样复制 barcode/已存规格/吨数/旧 SPEC 编码；不依据最新 txt 覆盖它。当前 sku.txt 仅在每码/重量全量核对一致时保存为 v1 来源文件和原始 kg；不一致则保留数据库快照来源标识并报告差异，不冒称该文件就是旧版。v1 来源可能是 legacy-db，不编造上传时间。context 仅 INSERT，旧事实/摘要/审计/幂等正文不 UPDATE。
5. **替换事实版本约束与外键，运行逐项对账。** 历史行及旧 frozen 摘要必须字节级/规范化 hash 相等；通过后标记 migration applied 和数据就绪。遇 DDL 中断保留 applying、停止新写入，人工核对实际结构后按明确步骤续作，不自动删迁移记录。
6. **新空库路径。** 006 只创建结构，scan_catalog/facts 都空且没有项目身份时不造 v1/head；正常空库 seed 在其原事务内同时初始化 v1。样本 seed/合成 seed 保持非空拒绝覆盖，既有测试的旧建库版本路径单独保留。
7. **空/非空 down。** 真正空库先解除事实对 entries 的新 FK，恢复事实 v1 CHECK/旧 FK，再按依赖逆序移除 context/head/entries/versions，随后 up 通过。任何版本、条目、context、扫码事实或旧目录非空就拒绝 down，拒绝前不执行 DDL；已发布零条版也属于非空历史，不能删。
8. **发布错版的业务纠正。** 上传正确全量文件（也可使用留存旧版文件）生成后继版本，再预览并发布；版本号不倒退，错版及其事实保留，不重称已扫包。出现 v2 事实后安全降级为停新发布、保留兼容读/补传/冻结/确认，不能退回只懂 v1 的应用或 down 删除版本。恢复演练只用新库，不覆盖现有作业库。

## 7. 拟改文件清单

以下是获准实施后的范围清单，标“新增”的文件目前不存在；本轮只写本计划及 IMPLEMENTATION_PLAN 索引。

| 区域 | 文件 | 本批修改 |
|---|---|---|
| 迁移 | 新增 `apps/api/migrations/006_catalog_versioning.up.sql`、`.down.sql`；修改 `apps/api/src/db/migrate.ts` | 表/FK/CHECK、前后置钩子与非空 down 门禁；不改 001–005 |
| v1 迁移 | 新增 `apps/api/src/db/catalog-migration.ts`、`catalog-migration-checks.ts`；新增 `scripts/verify-catalog-migration.ts` | 预检、v1/context 回填、旧摘要/逐行对账、迁移报告；脚本只允许本地库 |
| 空库初始化 | `apps/api/src/db/seed-catalog.ts`、`seed-test.ts`；必要时 `seed.ts` 的空库保护；`scripts/verify-sample-seed.ts` | 空库双写只读旧 v1 与新版表；实际迁移不调用 seed；9018 基线继续核对 |
| 目录服务 | 新增 `apps/api/src/features/catalog/` 下 `controller.ts`、`parse.ts`、`repository.ts`、`diff.ts`、`upload.ts`、`publish.ts`、`hash.ts` | 单一职责实现解析、完整候选、差异、原子发布、历史读取和稳定摘要；原文件不泄漏到日志/普通响应 |
| 路由/契约 | `apps/api/src/routes.ts`、`apps/api/src/openapi.ts`；新增 `packages/contracts/src/catalog.ts`、`scan-context.ts`，修改 `index.ts` | 专用 raw 上传路由（鉴权后）、版本/上传契约、新旧事实 union、明确错误；不放大全局 JSON 限额 |
| 事实服务 | `apps/api/src/features/scan/catalog.ts`、`controller.ts`、`validate.ts`、`service.ts`；新增 `context.ts`、`notices.ts` | v1 兼容读/历史版解析、context 同事务、重放优先、七天旧限制修正；差异提示独立查询 |
| 冻结/确认读模型 | `apps/api/src/features/outbound/repository.ts`、`assemble.ts`、`rows.ts`；新增 `fact-projection.ts`；`scan/freeze.ts`、`outbound/confirm.ts` 仅必要核验 | 去当前目录依赖；固定事实投影；按 context 行 + fact 重量累计；保留 B1a 库存事务 |
| Web 入口 | `apps/web/config/routes.ts`；新增 `apps/web/src/pages/catalog/index.tsx` | 独立“条码目录”导航，不挂到库存来源入口 |
| Web 功能 | 新增 `apps/web/src/features/catalog/` 下 `page.tsx`、`upload.tsx`、`diff-preview.tsx`、`version-history.tsx`、`queries.ts`、`use-upload.ts`、`use-publish.ts`、`keys.ts`；必要时局部修改 `apps/web/src/api/client.ts` | ProForm/Upload + ProTable 差异 + ProDescriptions 历史；raw 文件请求与同 UUID 恢复；不提取 B1b 共用列表壳 |
| API 测试 | 新增 `apps/api/tests/catalog-parser.test.ts`、`catalog-versioning.test.ts`、`catalog-migration.test.ts`、`catalog-facts.test.ts`、`catalog-rollback.test.ts` | 解析拒绝、候选/发布并发幂等、非空历史迁移、混版/旧摘要、各阶段故障；既有 scan/integrity/迁移测试按需适配 |
| SQL / E2E | 新增 `scripts/sql/verify-catalog-versioning.sql`；新增 `tests/e2e/catalog-versioning.spec.ts`、`catalog-upload-errors.spec.ts`、`catalog-helpers.ts` | 可执行全量对账；浏览器上传→预览→发布；实际 PDA 身份 API 驱动混版；截图与原始输出 |
| 说明 | `docs/IMPLEMENTATION_PLAN.md`、`FOUNDATION_MIGRATION.md`、`ACCEPTANCE.md`、`PARITY_MATRIX.md`、`UI_SPEC.md`、`DESIGN_DECISIONS.md`、`UPGRADE_PROPOSALS.md`、`README.md` | 标明 B1c-1/B1c-2 交接和证据档位、版本数据备份/回退及本计划落地决策；不重写 12 章矩阵 |

原文件进入数据库后，现有 SQL 备份已覆盖它；验证脚本需检查恢复后的 raw SHA/manifest/entries/context，而非顺带重做 B2 通用备份平台。`docs/api` 生成物继续独立提交，不与本批源码混合；本计划不默认放行额外提交。

## 8. Web 页面与截图档位

沿用 Umi Max / ProLayout / ProForm / ProTable / ProDescriptions / antd 6.7.0，使用组件 API/token，不覆盖 `.ant-*`，不增加 UI 库。

- `/catalog` 同页：当前服务端版/条数/用途说明 → 选择文件及编码 → 校验/差异预览 → 发布结果；版本历史抽屉。PDA 尚未接入时不显示虚构的设备同步状态。
- 差异阶段只有“发布整版”一个主按钮；新增/消失/重量变化数字常驻，旧→新重量用 kg 和四位吨数。移除说明“本版移除；已扫事实保留，库存仍由 Web 确认”。不显示目录库存金额或库存重量合计。
- 加载：“正在校验完整目录，当前版本仍可用”；空态：“当前版本无有效条码”；错误：行号/原因与重试入口，保留文件和预览；发布结果未知：“正在核验发布结果”；无权限：“仅 Web 登录用户可发布目录”。发布开关关闭和迁移未就绪分别说明原因，不伪装为文件错误。
- 复用既定 max-width 1440、抽屉 min(720px,100%)，键盘能选择/校验/发布/返回；条码固定左、查看固定右，规格换行，允许表内滚动但 1440/1280 无页面横滚。
- 上传页、差异预览、版本历史均产出 1440 截图；上传/差异关键页额外 1280，历史抽屉也检查 1280 溢出。截图只放 `.local/evidence/b1c1-*.png`，不用 toHaveScreenshot。

## 9. 验收计划（全部待执行）

| 用例/证据 | 必须断言 |
|---|---|
| E2E `catalog-mixed-version-continuation` | 独立合成 v1 含 A/B/X；原 ERP 单先接收 A/B=各 300kg。Web 上传 v2（去 A/B，X 改重，新增 C=300kg）→差异新增1/消失2/改重1→发布。A/B 各列、版本、摘要/revision不变；原单接收 C=v2，按 [1,1,2] 冻结；再发布零条 v3，原冻结单仍能 Web 确认且只扣一次。整个过程不重建单据 |
| E2E `catalog-invalid-snapshot-rejected` | 缺列、坏编码、非数字、精度不符、重复码各整版 422；active、versions/entries、事实、单据、审计/幂等业务表无半套写入；错误行可见，可换文件重试 |
| E2E `catalog-publish-failure-keeps-v1` | 候选 v2 已完整校验；在更新 head 后/写审计或幂等后注入 MySQL 失败；发布500、head仍v1、候选仍validated、业务全部回滚；移除故障原键重试成功 |
| E2E `catalog-publish-response-lost` | commit 后断响应，页面先核验任务结果；原键重试只一版/一次发布审计，不回退指针、不再上传新候选 |
| API `catalog-old-version-facts` | v2发布后新到达的v1事实按v1实重接受；新版改重/删码仅提示；已接收事实在 frozen 后原 UUID 重放成功；超过七天的合法过去事实不因年龄拒收 |
| API `catalog-history-independent-freeze` | 冻结/确认的查询路径断言无当前目录/版本 entries 查询；非空 v1 frozen 单迁移后原 revision/digest 可确认；新版拒收测试不修改任何原事实 |
| API `catalog-context-and-concurrency` | 新旧正文兼容；同UUID异context冲突、错误ERP行拒绝、跨版本同码去重、两候选并发仅一版发布；固定version分页过程中发布下一版不混页 |
| API `catalog-upload-atomicity` | 候选第N条写入失败、标validated失败、发布各写阶段失败均整笔回滚；故障仅临时数据库触发器，不向业务API加故障开关 |
| Migration `catalog-006-up-down` | 空库 up/down/up；导入9018后up且前后一致；非空事实/冻结旧单夹具up；非空 down 和已发布零条版down均拒绝且数据/迁移状态不变；不靠删历史解锁 |
| SQL + 恢复 | v1逐行/总量、事实逐行/总量/版本分布、context完整性、全部单据旧投影摘要、冻结摘要逐项一致；新隔离库恢复后 source SHA 与 contents/事实关联一致 |
| 权限/回归 | PDA/小程序上传、发布均403；原确认/调整端限制、/stock用途隔离、原事实/冻结幂等回归；npm run test、npm run test:e2e、npm run build通过 |

所有测试写入仅随机 `maozhi_test_*` / `maozhi_restore_*` 的 3307 库；目录发布用例与既有 v1 E2E 夹具隔离。真实样本仅从本地只读文件导入临时库；不在主开发库造验收事实。性能只在测量后报告：9018 行解析/差异目标 <10s、发布短事务 p95 <500ms；当前没有实测结果。

## 10. 对账 SQL 与结果口径

下面是计划交付的只读查询骨架；新增表目前不存在，**迁移后结果待实施时生成**，不把期望值冒充执行输出。计划阶段已执行的前置查询结果：`scan_catalog=9018 / 2707.9025吨 / 141规格`，`scan_facts=0 / 0吨`，`scan_submissions=0`。

```sql
-- 迁移前执行，并将结果及逐行/单据摘要基线存 .local/evidence/。
SELECT COUNT(*) AS entries, COUNT(DISTINCT source_spec) AS specifications,
       COALESCE(SUM(weight_tonnes),0) AS tonnes FROM scan_catalog;
SELECT COUNT(*) AS facts, COALESCE(SUM(weight_tonnes),0) AS tonnes FROM scan_facts;
SELECT catalog_version, COUNT(*) AS facts, SUM(weight_tonnes) AS tonnes
FROM scan_facts GROUP BY catalog_version;

-- 迁移后：v1 总量；与保留的旧目录双向核对，期望缺失/多出/差异均 0。
SELECT COUNT(*) AS entries, COUNT(DISTINCT source_spec) AS specifications,
       COALESCE(SUM(weight_tonnes),0) AS tonnes FROM catalog_entries WHERE version_id=1;
SELECT COUNT(*) AS missing_or_changed
FROM scan_catalog old
LEFT JOIN catalog_entries e ON e.version_id=1 AND e.barcode=old.barcode
WHERE e.barcode IS NULL OR e.weight_tonnes<>old.weight_tonnes
   OR NOT (e.source_spec <=> old.source_spec)
   OR NOT (e.legacy_product_code <=> old.product_code);
SELECT COUNT(*) AS extra_v1
FROM catalog_entries e LEFT JOIN scan_catalog old ON old.barcode=e.barcode
WHERE e.version_id=1 AND old.barcode IS NULL;

-- 迁移后与前置结果完全相同；混版用例另报告 [1,1,2] 的分布，不改旧行。
SELECT COUNT(*) AS facts, COALESCE(SUM(weight_tonnes),0) AS tonnes FROM scan_facts;
SELECT catalog_version, COUNT(*) AS facts, SUM(weight_tonnes) AS tonnes
FROM scan_facts GROUP BY catalog_version;
SELECT COUNT(*) AS missing_or_changed_context
FROM scan_facts f LEFT JOIN scan_fact_context c ON c.fact_id=f.id
WHERE c.fact_id IS NULL OR c.catalog_version_id<>f.catalog_version
   OR c.barcode<>f.barcode OR c.weight_tonnes<>f.weight_tonnes;
```

总量相同不够：验证脚本还需逐 UUID 比较事实全部原列及 payload_hash、逐订单比较原字段投影/revision/digest/行实扫、逐 scan_submission 比较全部原列。SHA 采用排序后逐行流式计算，不能只加总重量或依赖 GROUP_CONCAT。迁移样本的事实为 0，另列非空合成数据的实际行数、吨数、原摘要匹配数和确认结果。

## 11. 实施顺序、交付与风险

确认后顺序：①先写稳定事实投影和迁移预检/兼容测试；②实现 006 与 v1/context、去当前目录依赖；③实现候选上传/差异/原子发布和权限；④完成 Web 同页上传/历史；⑤完整回归、故障注入、SQL/恢复和截图；⑥完成本批一个业务提交并停下。OpenAPI 生成物另行，不自动推进 B1c-2/B1b/B2。

| 风险 | 机制与失败边界 |
|---|---|
| 旧事实缺 ERP 归属或与 v1 重量不符 | 迁移前逐条检查；不模糊匹配、不改事实；阻断发布就绪并报告具体异常 |
| 摘要被新增字段/排序变化污染 | 固定旧字段投影；context单独保存；非空旧frozen夹具迁移后用原摘要确认 |
| 发布半套、竞态或掉响应重复 | 候选整体事务、固定base、head行锁、发布幂等；失败注入覆盖指针更新之后；结果未知先查询 |
| 旧 PDA 误收新版或无法接续 | 旧端点固定真实v1，新端点按显式version；本批仅协议验收；设备升级/队列交接仍是现场放开门禁 |
| 错版已经用于离线事实 | 历史版继续可接收、事实不改重；仅发布纠正版，不能以当前改重/删码拒收旧事实 |
| 原文件丢失或错误恢复 | source bytes与版本同库备份；在新隔离库核对source/content SHA和上下文；不删除非空版本来回滚 |

交付时提供 commit hash、diff --stat、原始 API/E2E/build 输出、可执行 SQL 与实际结果、006 空/非空 up/down 输出、上传/预览/历史截图；分别注明服务端已测、Web已测、PDA未实施、实体/生产未验收。
