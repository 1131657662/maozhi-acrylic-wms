# 四端重建 / 第一里程碑

## 当前状态与后续安排（2026-11-08；安排待确认，未开始实现）

- 当前代码基线：`7502d14f530d0cf92da206adbb6cfacd4af50ae3`。B1a、B1c-1/2、B1b-1/2已按对应批次验收；不扩大为生产或未测设备验收。下文较早批次记录保留当时状态，本节优先。
- 业务前提固定：入库仅包数/总吨数；库存/单据/报表只认ERP商品。手动上传的sku.txt是按需更新的全量扫码目录快照，事实绑定本地同步版本；PDA现场全程离线新扫，仅补传/刷新联网。RK-/CK-各自前缀；差异放行本轮不做。
- **B1b-3打印：已延后，依赖积木报表配置，未完成。** 不排在下一批，不部署积木服务、不以HTML/CSS或新A4模板复刻旧版式。已完成的XLSX字段schema不负责生成打印版式。
- 以后打印实现固定为：打印模板配置表（积木地址、报表ID、token、参数名、格式）→服务端代理调用积木导出PDF→单据按钮下载；模板包含入库单、出库单、出库套打三类。token只在服务端保密保存，不传前端或写日志/仓库；此轮只记录设计，不创建表/接口/按钮。
- 打印验收使用旧ERP与新代理输出的同一单号、同一参数PDF，固定纸张与渲染条件叠图核对；页数/文字/位置/合计须一致，差异必须说明并解决，不能以DOM或XLSX字段对照代替。需提供地址、三个报表ID、token、各模板参数名/值示例及旧PDF；配置未到不影响下列批次。

### 建议执行窗口：下一批 + 随后四批

| 顺序/批次 | 范围与依赖 | 可量化验收及证据（均为计划，未执行） |
| --- | --- | --- |
| 1 / B2a 单据撤销与作废 | 优先修复误确认后的恢复路径；依赖B1a确认操作/前后值/审计。只做本地新单可验证的撤销确认与未入账作废，不同时做字段更正、盘点或实物退货。 | 原确认delta与补偿delta相加为0；20个同键并发仅1笔补偿；逐写入阶段失败后单据/库存/流水/审计/幂等均0残留。下游依赖、库存不足、历史只读、PDA/小程序越权全部拒绝且库不变；给原始E2E、SQL与1440/关键1280截图。 |
| 2 / B2b 关联更正 | 依赖B2a补偿与终态保护。未确认单按版本校验编辑；已确认单保留原单/原流水，新增可追溯的更正关系与显式确认，不原地重写历史。已扫码出库的作废/更正需单独处理事实及晚到队列。 | 原单/已扫UUID正文重量版本指纹变化0；新旧单号各自唯一、关系可双向追溯；重复/并发更正只生效1次，故障无半套更正；屏幕可比较变更前后。E2E、事实指纹SQL、库存净变化SQL及双宽度关键截图。 |
| 3 / B3a Web盘点闭环 | 依赖B1a调整事务与B2纠错链；ERP仓库/商品快照→实盘包数和总吨数→差异→Web明确回写。PDA盘点扫码不自动加入本批，扫码目录不充当库存。 | 差异=实盘−快照，已批准回写delta与流水/库存逐格一致；重复回写只1次；盘中有变动必须提示并阻止旧差异直接覆盖，拒绝时0写入。覆盖零差异/盘盈/盘亏/并发/失败恢复；1万行分页不截断，SQL全量对账、E2E及1440/1280截图。 |
| 4 / B3b 基础统计：出入库明细、月度汇总 | 依赖B2/B3a确定确认、补偿、调整和盘点事件口径；复用列表/导出基础。单据明细与库存流水分别核对，不拿单据创建日期冒充库存入账日期。 | 每仓ERP商品：期初+期间全部有效delta=期末，包数/整数克差异均0；入库/出库/补偿/调整/盘点分列，软删排除量单列。月末/跨日/重复/未知类型用例；屏幕与XLSX逐字段差异0、10万行末条命中；SQL、E2E、性能原始输出及截图。 |
| 5 / B3c 派生统计：周转率、库龄 | 依赖B3b可对账的基础台账，且须先确认分母/时间窗/耗用规则。历史不足时显示“不可计算/待核实”及覆盖率，不静默套FIFO或用SPEC日期推算。 | 人工可核算边界夹具与SQL结果一致；零库存/零出库不出现Infinity/NaN；库龄分段与可归龄ERP余额合计差异0，未能归龄量独立列示；冻结截止日重算一致。逐字段XLSX比对、SQL、E2E、耗时及截图。 |

选择依据：B2a业务价值在于纠错且写库风险最高，先稳定补偿依据，才能安全扩展更正与盘点；报表后做可避免把状态/补偿规则固化两遍。B3b先交可直接对账的两报表，B3c再处理更依赖历史证据和业务定义的两报表。以上批次名细化旧B2/B3，不把旧矩阵同编号的其他U/N项目自动纳入。

### B2a建议安全边界（需随本安排确认）

- 撤销用于“误确认”的账务纠错，不自动代表实物退货。原确认/流水不删除，以关联原操作ID的反向补偿入账；撤销后保留明确终态，不能直接退回可重复确认/继续扫码的状态。改数量/商品的更正留B2b。
- 不能把余额足够当成无依赖：按同仓ERP商品关联后续出入库、调整、盘点及已有补偿检查；缺少可靠逐批消耗关系时不推测FIFO，先阻止自动撤销并展示阻断记录。记录理由和前后值；库存/审计/幂等继续同事务。
- 115张历史入库、415张历史出库保持原状态和只读约束，不猜测原确认操作。历史纠错若确实需要，须先补齐原操作与下游证据并单列验收，不能宣称本批已经支持所有历史撤销。
- 未确认作废先限于可证无库存动作的本地单；有事实、已下发PDA或队列状态不明的出库单，不以“服务端目前0事实”推断安全作废。这部分留B2b明确收妥/晚到事实规则，任何已扫事实不得删除或静默丢弃。PDA和小程序均不获得库存写权限。

### 后续队列与输入清单

- 五批之后建议：系统配置（字典/参数白名单）→个人中心与在线会话（同一身份模块）→消息中心。三者分别独立交付；配置不能任意改写状态机，在线展示自己的设备会话，消息只接已定义业务事件。主数据字段、首页、库存流水下钻及既有U体验欠账仍保留矩阵，不因本安排消失，也不塞进B2a。
- 备份/恢复不降为可选：每次改变库存生命周期或做迁移前，运行既有隔离备份恢复核验，行数/重量/事实指纹100%一致；失败即停止该批数据升级。原库不覆盖。通用备份恢复产品化缺口仍单独保留。
- B2a前需确认：撤销只处理误确认还是也要涵盖实物退货；建议本批只处理误确认。建议先保留历史只读、遇后续库存动作拒绝自动撤销；若不接受，需提供可复现的历史纠错/依赖处理案例，不自行放宽。
- B2b前需确认：已扫出库更正允许改哪些字段，实物已离场/仍在场如何区分，晚到离线事实如何归档；建议事实不搬单、不重写、数量更正不伪造扫码事实。
- B3a前需确认：可否按仓/商品短时停止业务确认；建议先用相关范围暂停确认的盘点窗口，不暂停PDA本地扫码，期间事实仍可补传；若必须边作业边盘点，另确认移动对账规则。该建议尚未实施，不静默把快照差异套到当前库存。
- B3b/B3c前需确认：业务日期、历史状态/流水类型含义、期初完整性；周转率按包数或吨数、平均库存算法及零分母；库龄起算点、耗用规则和分段。先列旧实现与候选公式对照，不默认它们天然正确；证据缺失不编造历史。
- 打印输入可后给：积木地址、入库/出库/套打三个报表ID、服务端token、各参数名/值示例、格式/纸张、同单号旧PDF（建议每类覆盖单页/跨页/特殊字符各1例）。不需要为本安排提供生产写权限或新服务。

执行方式：只在本安排获确认后开始B2a；一次只做一批，一个可回滚提交，交付原始测试/SQL/截图后停下。每批保留原始记录；无新业务数据时可回退代码/安全空表迁移，已有补偿/盘点/更正数据时须保留兼容读取，禁用入口或前向修复，不靠down删除历史。性能验收复用B1b本机/临时库条件，列表目标首屏p95<1.5s、翻页<500ms；未达标单列，不宣称通过。

## B1b-1 四个 Web 列表与只读分页（2026-11-08，保留原批次记录）

- 用户批准 B1b 分三批、每批一个 commit 后停下：本批仅入库/出库/库存/日志统一查询、分页、列设置、布局与读接口；B1b-2 导出、B1b-3 打印未开始。不改 PDA/小程序、库存确认/调整、目录版本化或 B2 撤销。
- 前端使用 `components/BusinessList`、`features/web-lists` 共用 QueryFilter/ProTable/四态与返回上下文；旧详情仅接入安全的列表返回链接，创建/确认/调整成功额外失效新列表缓存，命令正文和幂等键不改。包数/吨数优先显示、单号/商品与操作固定，页面不通过隐藏溢出来掩盖内容。
- 新增 `GET /api/v1/web/lists/{inbound,outbound,stock,audit}`，返回 `items,total,page,pageSize,viewToken`；库存另有字面量 `source=erp-product` 和同筛选范围全分页 `subtotal`。列表项为轻量摘要，不传包级事实或日志大 JSON。`viewToken` 仅为本次响应摘要，不承诺跨请求数据库快照或导出能力。
- 入库支持单号、上海时区登记日、原始 nullable status/statusMissing、postingState、供应商、仓库；出库支持单号、建单日、原始状态、客户、仓库、车牌；库存支持 ERP 商品/仓库；日志支持时间、action、target、traceId。日志表没有独立结果码，不猜测“成功/失败”；如需失败请求检索另行建模，不改历史审计。
- `GET /web/lists/{inbound,outbound}/statuses` 返回有效单据的原始状态选项；`GET /web/lists/audit/:id` 按需读取 beforeJson/afterJson。全部仅 Web 会话；匿名 401、PDA/小程序 403、非法参数 422 `VALIDATION_ERROR`、日志不存在 404 `NOT_FOUND`。
- 所有查询严格白名单；分页20/50/100/200、页号1..100000、每个文本最多200字符；排序字段枚举且以主键稳定兜底。日期统一转 UTC，LIKE 转义通配符并参数化。拒绝未知字段、all、多来源和总计参数；响应逐行 ERP 字面量验证，校验失败不展示旧数字。
- 计数/页面/摘要在同一个 REPEATABLE READ 只读业务事务中查询；入库按页批量聚合有效明细，出库计划和事实分别分组，避免 JOIN 相乘；事实重量来自 scan_facts，不依赖当前扫码目录。未归属库存仅调用原诊断日志。旧 `/stock`、`/outbound`、`/scan/*`、`/audit` 和移动契约保持不变。
- 本批不建008：万级临时数据实测现有 inbound_created 排序索引及主数据主键 eq_ref 可用；日志仍有 filesort，但10k读模型p95为12.71ms。没有证据支持本批加索引/迁移；更大规模或新查询形态需重新 EXPLAIN。回滚仅 revert 本批提交，不执行 down、不改历史数据。
- 验证使用3307随机临时库和合成夹具，行数/精度/状态/ERP守卫与旧契约一起回归；生产构建浏览器30次计时与截图见 ACCEPTANCE。列表E2E复用临时库专用会话，原登录UI测试/限流保留。无新增依赖；OpenAPI只改源码声明，生成物按原约定独立提交，不混本批。

## B1c-2 PDA 离线目录与交接（2026-11-08，保留原批次记录）

- 四组验收：①离线新扫、重启落盘、刷新失败继续扫；②版本事实回传、混版冻结/确认、版本差异提示；③旧队列完整交接、批量确认和发布门禁；④迁移中断后旧 APK 可恢复。仅本批范围，不进入 B1b/B2。
- Room 1→2 只加本地版本/条目/head、事实上下文旁表和持久交接清单；不改旧 facts、plans、catalog、submissions。旧缓存作为未校验 v1 保留；首次完整同步核验后启用版本化。SHA 协议为排序后的 `[barcode,sourceSpec,weightGrams]` JSON，下载期间发布新版本不会混页。
- 新事实本地原子写 UUID/正文与上下文；既存事实正文不重序列化、不改版本/重量/摘要。无可靠 ERP 键的旧记录由 Web 按原单明确选行，禁止模糊映射和跨单绑定；同批超过 100 条分段幂等提交，失败保留已完成的绑定及剩余可见记录。
- `POST /scan/handoffs` 登记 deviceId/appVersion/expectedCount/manifestSha/catalogVersion/catalogSha/previousSessionHashes；`POST /scan/handoffs/:id/records` 每次最多 3 条原 JSON/原 SHA/本机状态；`GET` 分页返回收妥结果与不可变 context。PDA 通道与 X-Device-Id 校验；全部沿用会话认证，不能由 PDA 确认交接、出库或调整。
- Web `/catalog/handoffs` 总览、`/:id` 明细、`/:id/bind`（每次最多 100 UUID）、`/:id/clients`（人工核实设备归属）、`/:id/confirm`。修改记审计；清单头/事实原文重试必须相同；已封存清单允许完全相同原记录重传，不能增加/覆盖。未收妥/正文不符/未归属/旧请求水位变化均阻止确认。
- 发布门禁以 `outstandingClientsSql` 的未核验客户端水位 + 未确认交接清单 + 缺 context 的历史事实为准，叠加原有发布开关/候选完整性/base 校验。确认水位不删除旧活动，后来旧请求重新阻断。服务端无法证明从未联网设备的队列情况，必须保留人工设备范围确认；本轮未打开样本库发布开关。
- 错误包括 `HANDOFF_INCOMPLETE / HANDOFF_CLIENT_CHANGED / HANDOFF_DEVICE_MISMATCH / HANDOFF_CONTEXT_SEALED / HANDOFF_SEALED / IDEMPOTENCY_CONFLICT`；422 表单/契约失败、403 通道不符、409 业务冲突。异常事实与网络失败均不清队列；一条真正冲突不妨碍其他合法事实补传。
- 007 新增三张交接表，非空拒绝 down；006 只读目录契约保留。Room 成功升级后只能向前修复；仅中断且未提交的迁移可以启动旧 APK，已在 M71 实测，不推广为成功迁移后任意降级保证。
- 未决/未测：141 SPEC ↔ 428 ERP 仍无全局映射；未做真实作业队列切换、厂商扫码枪/功能键、跨天弱网或生产。M71 初查无本项目包；隔离合成旧队列 60（待传 55、失败 5，丢响应 2 是其中子集）；75bdbbee 已排除。OpenAPI 仅更新源码，生成物仍留独立提交。

日期：2026-11-07。来源：用户本轮指令优先于只读交接包中的旧技术/审批建议。

## B1c-1 目录版本化（2026-11-08，保留原批次记录）

- A 方案：006 建立完整版本/条目、单行 head、不可变 fact context 与旧协议活动门禁。Web `/catalog` 提供全量 txt 上传、固定基线差异、整版发布、历史与刷新后候选恢复；未修改 PDA/小程序、B1b/B2。
- 同一规范化 content hash 匹配任一完整版本，默认返回 `duplicate=true`、`matchedVersionId`、`message=与第 N 版内容一致`，版本数不增加。显式二次确认携 `rebuildOfVersionId`，后端核对内容一致才创建后继候选；不设 hash 全局 UNIQUE。
- `scan_catalog_v1_archive` 封存原行并有三种 DML 拒绝触发器；`scan_catalog` 是固定 v1、不可更新的视图。006 后 seed 只写版本表。启动须检查 006 applied 和视图不可更新，失败拒绝启动。
- 发布须同时满足：`CATALOG_PUBLISH_ENABLED=true`、006 applied、所有事实有 context、head/base 未变、候选完整，以及 `SELECT COUNT(*) FROM catalog_client_activity WHERE legacy_requests>0 OR queue_verified=0` 为 0。任一不符返回 409 `CATALOG_PUBLISH_BLOCKED` 或基线/完整性错误，页面常驻原因。开关默认关闭；服务器无法推断断网设备队列，B1c-2 交接前不能因为零请求就开启。没有清零/绕过接口。
- 旧 `/scan/catalog` 固定 v1，旧 PDA 请求/正文持久计入门禁。新 manifest/固定版本分页及 `schemaVersion=2` 事实上下文已提供。服务端接受合法历史版，包括过去七天以前的记录；当前版改重/移除只提示。冻结/确认按 `scan_facts.weight_tonnes` 与 context 中 ERP 行累计，原 digest 投影不变。
- 本地样本已有目录原样封存，不使用最新 txt 覆盖旧值。v1 来源记录 `legacy-db` 数据库快照；不冒称原始上传文件。新上传原字节、SHA、原 kg 随完整候选同库保存。新规格直接存目录条目，不创建 ERP 商品、不建立 141↔428 全局映射。
- 上传/发布接口仅 Web 同源 Cookie，PDA/小程序均 403。新版读取仅 Web/PDA；旧数组契约不改。空文件表示零条快照，坏文件整版 422；最多 5 MiB / 100000 有效行。失败保持输入与原幂等键，掉响应查询上传结果，已提交不再次发布。
- 实际 SQL/恢复/测试与截图见 `ACCEPTANCE.md`。B1c-2 仍须实现本地目录原子切换、离线事实 envelope、冲突队列与设备交接；本轮 HTTP 驱动不是实体设备验收。

## 范围与决策

当前增量状态以本文开头“B1b-1 四个 Web 列表与只读分页”及 `ACCEPTANCE.md` 最新验收节为准；较早批次记录保留为实施历史。

B1c-1 的已执行计划见 [B1C1_IMPLEMENTATION_PLAN.md](B1C1_IMPLEMENTATION_PLAN.md)：仅目录版本化服务端与 Web 上传，已完成本地实现与验证；PDA 留 B1c-2，列表壳/导出/打印留 B1b。计划保留离线本地同步版本与历史事实接收规则，并明确旧设备交接门禁。

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

## B1c 条码目录版本化设计边界（2026-11-08，仅文档）

- 业务已确认：用户按需上传 `sku.txt`，每次为有效条码全量快照；消失视为已出库，无失效审批；目录只供扫码查规格/实重，不作为库存、单据或报表的数据集，不自动扣库存。库存/单据只认 ERP 商品，扫码产生的不可变实重事实仍供出库核对。
- 排期建议：旧 PDA 本地版本/导入/云更新属于 P，作为独立 B1c（U-06/DD-15），在 B1a 第 3 提交确认事务稳定后、现场常态作业前完成；不依赖 B1b 导出/打印 schema。本轮只设计，未创建迁移、API 或页面。
- 设计选择：完整不可变版本/条目 + 单行活动指针，整版校验后原子发布；事实独立保留版本、当时规格/实重和原 ERP 明细行归属。目录发布不更改单据版本/revision/digest；同一原单可以先用本地 v1 离线扫码、补目录并完整刷新后用 v2 继续，冻结/确认/对账不回查活动目录。
- 最新版与离线边界（已定）：最新版是 PDA 上次完整同步的本地目录版本，不是服务端此刻活动版；本地同步版本 + 服务端接受历史版本事实。常态断网解析/取重/成功落盘，联网按原 UUID/正文回传；当前版改重/删码只提示，不改事实、不拒收、不拦冻结。目录相关仅版本不存在/被撤销等数据异常拒绝并进可见冲突队列，不静默丢弃；不以版本年龄或离线时长拒绝合法事实。迁移仍清点旧队列，但日常接收不受预登记名单限制。
- 尚无可靠的全局 SPEC↔ERP 映射，不建立推测关系；新扫码建议使用原出库单显式 ERP 作业行（单行可默认、多行须选择）。旧事实若无法精确唯一绑定原 ERP 行，列迁移异常，保留记录并阻止开启 B1c 发布；不猜测补值、不重建单据。现场选错行的防错效果须实体 PDA 验收。
- v1 迁移待实施：先备份/恢复与事实/冻结摘要对账，封存原 v1、增加 context、解耦读取，再升级 PDA/登记旧队列，最后开放上传；旧 UUID/正文/hash/重量和 frozen 摘要保持。出现 v2 事实后不得回退只懂 v1 的代码或执行删除版本的 down，需保留兼容链路；目录纠错以新版本发布历史内容，不能重算已扫重量。
- 验收门禁与未决能力：U-06 保留场景 A 的原单混版/删码后冻结确认；场景 B 明确第一段全程断网扫 3 包→回传→上传新目录→刷新→继续离线扫，并含新版先发布再回传旧版事实及失败注入，均尚未执行。错误已接受事实的更正流程、全局商品关系维护不在本批自动实现；离线新扫已确定，不再列为待放宽约束。N-02 只剩额外通用辅助录入候选，不再把条码目录上传标成 N。


## B1a 第 3 提交：确认入账与库存调整（2026-11-08）

范围仅为正向入库确认、出库确认流水证据、ERP 库存调整。B2 撤销/作废/更正、B1b 查询壳/响应式重构/导出打印 schema、B1c 目录版本化均不实施；已批准的离线目录设计不变。

### 状态、事务与历史兼容

- 新入库 `pending → confirmed`：创建只保存单头/明细、创建审计和创建幂等结果；显式确认才增加库存。`posting_state` 区分 `legacy/pending/confirmed`，`confirmation_operation_id` 指向本次操作。没有编辑/撤销/作废入口。
- 出库仍为 `open → frozen → confirmed`；扫码/冻结不扣库。本次确认沿用旧 `confirm:用户名:幂等键` 以及原请求 hash/响应重放规则，补写前后值和操作标识。原 `source_id` 非空的 ERP 历史单据禁止再次确认。
- 锁顺序：`app_meta.identity FOR UPDATE`（沿用单用户串行写锁）→ 单据行 `FOR UPDATE` → 主数据共享锁 → 按商品编码排序锁本仓有效库存行。库存调整没有单据锁，锁同一库存格；不同单据共用同一商品库存，不修改原单据明细。
- 同一连接/事务内：检查幂等重放与状态 → 新建 `inventory_operations` → 库存前值/边界校验 → 写库存及含前后值的 `stock_journal` → 更新单据状态（调整无单据状态）→ `operation_log` → `idempotent_commands` → COMMIT。任意异常 ROLLBACK；不在事务外预占幂等键，不吞异常后继续写。
- 同键同规范化请求返回原结果；不同单据/不同正文使用同一作用域的键返回 `IDEMPOTENCY_CONFLICT`。调整前值必须等于请求 `expected`，过期返回 `STALE_STOCK`；重放优先于前值检查。前端失败保持正文/键和已填字段；库存刷新须由用户明确操作，不自动用新前值重提调整。
- 新库存写入只允许有效 `erp-product`。包数与重量独立，不设统一件重；重量按 100 克精度在 API 整数克与 MySQL DECIMAL(12,4) 吨间转换，负库存/溢出均拒绝。调整不是某单据的“修正”，其原因、前后值及操作 ID 可独立追溯。
- 115 张历史入库单原状态 `audited/submit` 不映射、不猜测已入账标记；新增 `posting_state` 默认 `legacy`，保留旧状态、库存和单据为只读，防止重复入账。旧本地创建即入账的入库同样归 `legacy`。415 张历史出库原状态也不回填。未知状态继续原文提示。
- 历史流水从原 `source_row_json` 提取原前后值，保留原流水类型；`evidenceKind=source-snapshot`、`operationId=source_id` 是历史定位，不冒充新事务 UUID。新流水 `evidenceKind=transaction`，操作 ID 指向操作记录；旧本地若从未保存前后值则明确 `legacy-unrecorded`，不反推历史。真实样本 828 条快照完整且 delta 全部一致。

### API 增量（接口仍为整数克）

| 端点 | 请求 | 响应/行为 |
|---|---|---|
| `POST /inbound` | 原创建字段和 Idempotency-Key；兼容原 receiptNo | `status=pending, postingState=pending, confirmationOperationId=null`；不入账。旧缓存 Web 应刷新以取得确认入口，不能再把创建成功当入账 |
| `POST /inbound/:id/confirm` | 严格空对象 `{}` + UUID Idempotency-Key | 入库详情；`confirmed` 和 `confirmationOperationId`；重复原键返回原结果 |
| `POST /outbound/:id/confirm` | 原 revision/digest + UUID Idempotency-Key | 原详情契约不变；新流水/审计含操作标识 |
| `POST /stock/adjustments` | warehouseCode/productCode、packagesDelta、weightDeltaGrams、expected:{packages,weightGrams}、reason（trim 后非空且≤500）+ UUID Idempotency-Key | operationId、operationType=stock.adjust、仓库/商品/原因、before/after（包数/整数克） |
| `/stock/journal`、`/stock/by-source/journal` | 原查询参数不变 | 增加 before/after、operationId、operationType、reason、evidenceKind；历史类型不枚举改写，新增字段可空/有兼容默认值 |

错误：422 `VALIDATION_ERROR`（含空原因/两个 delta 都为零/非法精度）；409 `INSUFFICIENT_STOCK`、`STOCK_OVERFLOW`、`STALE_STOCK`、`IDEMPOTENCY_CONFLICT`、`ALREADY_CONFIRMED`、`LEGACY_RECEIPT/LEGACY_ORDER`、`PRODUCT_NOT_INVENTORY`；出库保留 `NOT_FROZEN/STALE_PLAN/DIGEST_MISMATCH`。三个写入口均限 Web 同源 Cookie 会话；PDA/小程序一律 403，无效身份 401。`/stock` 旧数组与防 all/多来源/total 守卫不变。

### 迁移、验证与未做项

- 新增 005 up/down：操作表、入库 posting_state/确认操作引用、流水前后值及操作外键；新事务流水 CHECK 保证非空且 after-before=delta。001–004 不修改。
- 3307 本地样本库已先备份再 up；历史状态/库存/原流水/审计/幂等指纹一致。空表可 down/up；操作、入库或流水任一非空则 down 拒绝，不能靠删除历史数据绕过。完整回退说明见 `FOUNDATION_MIGRATION.md`。
- 故障注入只在随机 `maozhi_test_*` 库使用 MySQL AFTER trigger；业务 API 没有测试开关或故障请求头。原始结果和可复跑命令见 `ACCEPTANCE.md`。
- 来源新增/全局商品映射仍是未决能力：本轮没有把 `app` 或 `sku-spec` 自动改成 ERP，也未改主数据模型。真实商品使用原 ERP 主数据；测试合成商品显式标注为 ERP 用于单一库存流程。
- 本轮只提交源码/迁移/测试/说明；OpenAPI 生成源码已更新，`docs/api` 生成物留独立提交，未混入本提交。没有新增依赖、修改生产配置或访问生产/3306/warehouse。

## B1b-2：四列表 XLSX 导出（2026-11-08）

- 最新授权以 XLSX 为主，允许一个服务端依赖；覆盖先前“本批仅CSV”的方案。本批只做Web入库/出库/ERP库存/操作日志导出，不做CSV、打印、PDA/小程序导出，不改库存/目录逻辑，无表结构迁移。
- 字段权威：`packages/contracts/src/list-display.ts` 定义中文标题、类型、XLSX宽度与显示；BusinessList传实际可见列顺序，操作按钮/选择框不作为数据字段。文件每行对应列表一条记录，不把明细展开成更多行；未知状态原文回退一致，软删与ERP用途边界复用原列表查询。
- 范围：all=同筛选全部记录；page=当前页；selected=同筛选内跨页选择且沿当前排序。每种先显示数量。页面viewToken和已选rowToken校验防旧视图误导出；变化返回明确错误，刷新核对后再生成，不静默更换选择。
- 快照：先以RR只读事务读取当前页/总数/库存小计，验证viewToken，再在同一连接里按稳定排序+唯一键分页1000条。总数和库存小计只在该快照复用，不缓存给别的请求；页面HTTP仍严格拒绝额外字段。按整数克BigInt累计本次范围，文件末行和生成面板展示同一合计；只合计导出的数字列，不合计扫码目录。
- 数值：XLSX包数写number、吨数number+`0.0000`、日期Date+`yyyy/mm/dd hh:mm:ss`（上海墙上时间），单号/编码写string以保留前导零并防公式注入。超过Excel精度/单元格容量明确失败，不截断或静默失真。
- 发布：ExcelJS流式逐行commit、关闭共享字符串；`.part`→完成/哈希/大小校验→原子改名→持久化ready→开放下载。失败或取消删除本任务部分文件并禁止下载；下载再次核对大小/SHA。任务JSON、XLSX仅放忽略的`.local/exports/<database>/`，没有用户可控路径，下载须Web Cookie身份。
- 任务：UUID requestId+请求hash，同键同正文复用任务/文件，异正文409；单进程每库一活动任务，第二任务409 `EXPORT_BUSY`。状态running/ready/failed/cancelled；页面可关闭非模态抽屉继续查询，sessionStorage保存任务ID，任务明确标页别、范围、创建时间。失败保留输入；下载在新标签处理错误，不替换原列表。
- 生命周期：文件24小时过期；启动或新建任务时清理过期产物。启动将运行中任务标为 `EXPORT_INTERRUPTED` 并清理半成品，不继续不同快照。审计记录generated/failed/cancelled（generated表示完成生成，之后取消仍可另有cancelled）；日志导出自身审计在读取快照结束后写入，不污染本次数据集。
- 限制透明：单任务最多100万记录、5分钟；选中最多5000条，超过时引导使用全部筛选结果；出口JSON上限6MiB覆盖最长合法选择正文。CSV为可选未实现。批次超限、空范围、视图变化都明确失败，不生成截断文件。

| 端点（统一前缀 `/api/v1`） | 请求 | 返回/错误 |
| --- | --- | --- |
| POST `/web/exports` | requestId UUID、kind(inbound/outbound/stock/audit)、scope(all/page/selected)、原列表query字符串字典、columns、viewToken、selected[{id,token}] | 202任务；422字段/列非法、409 EXPORT_BUSY/IDEMPOTENCY_CONFLICT |
| GET `/web/exports/active` | 无 | 活动任务或null，刷新/丢响应时找回 |
| GET `/web/exports/:id` | UUID | state/processed/total/columns/totals/preview前20/createdAt/expiresAt/error/errorCode/sha256/bytes/elapsedMs/requestHash；404 EXPORT_EXPIRED |
| POST `/web/exports/:id/cancel` | UUID | 标记取消请求，任务完成清理后变cancelled；已ready保持ready |
| GET `/web/exports/:id/download` | UUID | 完整XLSX附件；409 EXPORT_NOT_READY/EXPORT_FILE_MISSING；认证401、移动端或跨源写入403 |

异步任务错误码还包括 `EXPORT_VIEW_CHANGED/EXPORT_EMPTY/EXPORT_TOO_LARGE/EXPORT_TIMEOUT/EXPORT_CANCELLED/EXPORT_PRECISION/EXPORT_CELL_TOO_LONG/EXPORT_FAILED/EXPORT_INTERRUPTED`。接口已返回202后失败，通过任务errorCode展示，不伪造为成功下载。

依赖：ExcelJS 4.4.0、MIT；npm包4,716,975字节，解包21,825,509字节；本机含复用传递依赖的完整闭包194个物理包、36,376,316字节，无`.node`/binding.gyp或install脚本。新增依赖只在API，未进入Web bundle。npm audit仍有3项moderate（既有csv-parse及ExcelJS→uuid）；uuid告警涉及v3/v5/v6外部buffer，本导出不调用该路径，不声称依赖零告警；详情/扫描见`.local/evidence/b1b2-dependencies.json`、`b1b2-npm-audit.json`。

验收：固定合成夹具三范围逐格、列显隐重排、并发更新快照、二任务409、中途故障/取消、重启/损坏文件、中文/换行/前导零/公式文本，以及10k/100k完整末条核验。仅写3307随机临时库，不连接生产或3306，不重跑真实样本seed。完整输出与WPS实开边界记录在ACCEPTANCE；所有截图/文件不进Git。OpenAPI源码声明已更新，生成物不混入本批。revert本批提交即可撤回导出，不回滚业务数据；B1b-3仍等待放行。
