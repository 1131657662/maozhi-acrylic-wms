# 茂智云仓 · 腈纶仓储管理系统｜全栈只读审计

**P0：0 条 · P1：5 条 · P2：7 条 · P3：5 条，共 17 条。**

上述计数为修前审计基线。F01、F04、F05、F03、F02 的修前复现、逐项修后验证、完整回归结果及未覆盖环境，见 [本批修复记录](FULLSTACK_P1_ACCEPTANCE.md)。P2/P3 未在本批处理；后文的发现与优先级建议保留为历史证据。

| 证据状态 | P0 | P1 | P2 | P3 | 合计 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 已证实问题 | 0 | 5 | 4 | 3 | 12 |
| 疑似风险 | 0 | 0 | 3 | 1 | 4 |
| 待业务确认 | 0 | 0 | 0 | 1 | 1 |

审计日期：2026-11-18。最先处理的是盘点无法回写和切换手册规则冲突；其次是恢复核验与库存对账的盲区。没有取得线上事故、数据损坏或生产验收的证据。P0 表示已见必须立即停止作业的严重故障；P1 表示特定条件下核心作业受阻或关键控制失真；P2 表示局部功能错误、验证缺口或需优先量测的风险；P3 表示体验、文档、维护或语义澄清。严重度不代表证据强弱。

## 1. 发现清单

下列编号是唯一计数单位。**已证实**指能从实现、明确规格或纯内存实验确定行为，不代表已在样本库或现场发生；**疑似**指实现机制明确、影响尚无量测；**待业务确认**指证据足以提出问题，不足以裁定哪种交互正确。

### P1：核心作业与核验

**F01｜P1｜已证实问题｜盘前已存在的停用商品会被误判为盘中新增。** 全仓建快照只取启用商品；预览寻找快照外库存时却不要求启用，也不要求余额非零。仓内另有启用商品时可以开盘；只要原有停用商品仍有有效库存格且未列入发现行，即使账实未变、该格余额为零，预览也报漂移、拒绝回写。盘点保持进行中即继续限制该仓确认，不是永久死锁。证据：`apps/api/src/features/stocktake/create.ts:29`、`apps/api/src/features/stocktake/preview.ts:39`、`apps/api/src/features/stocktake/preview.ts:56`；停用不应隐藏已有余额见 `docs/MASTER_DATA_SPEC.md:13`。复核应区分盘前存量和盘中新出现的格，同时保持真实漂移阻断；不要人工清锁。

**F02｜P1｜已证实问题｜切换手册同一份文件给出相反的执行指令。** 开头要求导入普通历史单、以原号承接未完成单，步骤表要求逐单承接；后文却禁止两者。领域总纲仍描述承接单可确认，操作人不能仅靠顺序阅读确定应执行哪些步骤。证据：`docs/CUTOVER_PLAN.md:6`、`docs/CUTOVER_PLAN.md:31`、`docs/DOMAIN_RULES.md:236`，对照 `docs/CUTOVER_PLAN.md:62`、`docs/CUTOVER_PLAN.md:126`、`docs/CUTOVER_PLAN.md:176`。旧指令**与既有决定冲突**：`docs/DECISION_LOG.md:321`、`docs/DECISION_LOG.md:322` 生效。应标废旧指令并指向有效条款，保留历史；未发现本轮发生迁移或承接。

**F03｜P1｜已证实问题｜恢复演练的逐格报告不能区分同仓同商品的两条物理库存记录。** 物理主键含删除标识；基线取所有行却不取该标识，只按仓、品排序。比较又用二元键去重，并从前后各取首条。内存实验：同仓品两行分别为 1、2 包，同序显示通过但只有一个逐格包数比较项；仅交换行序即出现不一致。演练可能误报失败，逐格明细也不能单独证明两行一致；另有整表指纹，不据此推断整库损坏能通过。证据：`apps/api/migrations/003_source_snapshot.up.sql:67`、`apps/api/src/features/maintenance/baseline.ts:27`、`apps/api/src/features/maintenance/restore-report.ts:94`、`apps/api/src/features/maintenance/restore-report.ts:101`；验收口径 `docs/OPS_PAGES_SPEC.md:342`。回归应覆盖换序不误报、仅一物理行变化可定位、已有备份基线的兼容性。

**F04｜P1｜已证实问题｜合法入库单和清点批量请求会被传输层提前拒绝。** 两条业务路径均落入全局 `10kb` JSON 限制，超限映射到 413。纯内存构造：10 个不同商品，各 2 包、200000 克、行备注各 400 个「收」，序列化 12,703 字节；200 个 13 字符条码的清点请求 11,430 字节。两者业务契约校验均通过，均超过 10,240 字节；未发送 HTTP、未写库。证据：`apps/api/src/app.ts:43`、`apps/api/src/middleware/http.ts:72`、`packages/contracts/src/inbound.ts:13`、`packages/contracts/src/inbound.ts:28`、`packages/contracts/src/scan-workbench.ts:17`、`apps/web/src/features/scan-workbench/paste.tsx:41`。按路由对齐字节和行数边界；不建议去掉全局保护。

**F05｜P1｜已证实问题｜有新流水、无对应有效库存格时，对账会漏报。** 第一条 SQL 检查前后数和操作记录；第二条按流水分组后内连接有效库存，缺失的仓品从结果消失，既不产生不平衡行，也不计入测试的逐行断言。证据：`scripts/sql/verify-inventory-posting.sql:2`、`scripts/sql/verify-inventory-posting.sql:28`、`apps/api/tests/inventory-reconciliation.test.ts:32`、`apps/api/tests/inventory-reconciliation.test.ts:38`。这是校验工具的盲区，**不是实库已缺格**。验收应明确返回缺格的仓品，且独立核对参与对账的仓品数。

### P2：功能、覆盖与容量

**F06｜P2｜已证实问题｜盘点详情返回后丢失列表上下文。** 初次从 URL 读取筛选，随后提交和翻页只改组件状态；单号和查看链接不携带来路，详情返回固定的裸列表。从工作台「进行中」入口进详情再点页面返回，会丢掉状态；人工筛选和页码也不能重建。证据：`apps/web/src/features/stocktake/list.tsx:28`、`apps/web/src/features/stocktake/list.tsx:52`、`apps/web/src/features/stocktake/list.tsx:78`、`apps/web/src/features/stocktake/list.tsx:111`、`apps/web/src/features/stocktake/detail.tsx:37`。与 `docs/DECISION_LOG.md:53` 的保留筛选要求不符。验收分别覆盖页面返回、浏览器返回和复制筛选链接。

**F07｜P2｜已证实问题｜未登录直达条码目录，停在重试态。** 与其他业务页面不同，目录入口直接导出内容，未走统一登录门禁；401 失效处理清除会话，自定义重试操作又遮住通用错误组件的登录操作。证据：`apps/web/src/pages/catalog/index.tsx:1`、`apps/web/src/features/catalog/page.tsx:24`、`apps/web/src/features/catalog/page.tsx:47`、`apps/web/src/components/RequestError.tsx:73`、`apps/web/src/app.tsx:33`；对照 `apps/web/src/pages/AuthGate.tsx:15`、`apps/api/src/routes.ts:40`。这是登录恢复路径不一致，不是服务端鉴权绕过。验收覆盖匿名深链和会话过期后重新登录回原页。

**F08｜P2｜已证实问题｜盘点合计错误地沿用单格吨数上限。** SQL 对多格求和，再将结果交给只接受最多 8 位整数吨的单格解析器。两格各 `50000000.0000` 吨均合法；合计 `100000000.0000` 吨转克仍是安全整数，纯函数却抛错。因此极端数据可导致建单回读或列表读取失败；不代表实际仓库已达到该量级。证据：`apps/api/src/features/stocktake/read-model.ts:9`、`apps/api/src/features/stocktake/read-model.ts:40`、`apps/api/src/db/weight.ts:13`、`apps/api/src/features/stocktake/create.ts:86`。应单测聚合边界，不放宽单格精度。

**F09｜P2｜已证实问题｜通知定时触发到 Web 角标之间缺一段端到端验证。** 正式入口注入通知扫描回调，E2E 启动器没有注入该回调；消息夹具直接调用扫描，页面测试验证轮询，另有调度器单测。两端分别有证据，但不能证明启动后的时钟会触发扫描并刷新角标。证据：`apps/api/src/server.ts:68`、`scripts/e2e-api.ts:30`、`tests/e2e/messages-fixture.ts:46`、`tests/e2e/messages.spec.ts:85`、`apps/api/tests/messages-scheduler.test.ts:7`。这是覆盖缺口，不是已证实的定时器故障。

**F10｜P2｜疑似风险｜备份持读锁的时长可能随数据量增长，影响正常写入。** 当前库表读锁覆盖导出和基线采集，表指纹按 OFFSET 分页；获取锁的等待上限不等于持锁总时长上限。证据：`apps/api/src/features/maintenance/backup-snapshot.ts:17`、`apps/api/src/features/maintenance/baseline-tables.ts:53`、`docs/DECISION_LOG.md:26`。没有持锁时长和并行业务写入延迟数据；应在授权隔离环境分量级测两者。直接取消一致性锁**与既有决定冲突**。

**F11｜P2｜疑似风险｜粘贴清点候选逐条串行校验，大批次等待可能过长。** 每条候选均等待一次接口，服务端候选查询再次读取计划和计数；到 200 条时往返次数随条数增长。证据：`apps/web/src/features/scan-workbench/paste-check.ts:25`、`apps/api/src/features/scan-workbench/queries.ts:15`、`packages/contracts/src/scan-workbench.ts:17`。未测真实网络和尾延迟；按 1、50、200 条分别记录请求数和用时，再决定是否优化，不能牺牲逐条失败原因。

**F12｜P2｜疑似风险｜通知扫描用整类候选和锚点集合协调状态，积压时容量未验。** 同轮装载候选，整批传给 JSON_TABLE，并把每类当前集合存为扫描状态；活跃对象数升高时，数据库报文、应用内存或事务时长可能先成为瓶颈。证据：`apps/api/src/features/notifications/scan.ts:18`、`apps/api/src/features/notifications/reconcile.ts:12`、`apps/api/src/features/notifications/reconcile.ts:34`、`apps/api/src/features/notifications/reconcile.ts:46`。因未获容量数据或执行计划，不断言慢查询；量测须保留整轮原子性和锚点去重。

### P3：操作体验、维护与口径

**F13｜P3｜已证实问题｜坏书签进入 404 后没有应用内出口。** 通配路由禁用外壳，页面只渲染错误结果。新标签直接打开未知地址时既没有侧栏，也没有回工作台或登录的链接。证据：`apps/web/config/routes.ts:84`、`apps/web/src/pages/404.tsx:4`。它是兜底页缺少恢复路径，不是某个已配置菜单死链。

**F14｜P3｜已证实问题｜项目命令说明未披露 E2E 会建库、播种和删库。** 项目约束将其简写为「独立内存 API」，实际启动器会建立隔离 MySQL 测试库，清理辅助函数会删库；只读维护人员若只按前者决策，可能误跑写操作。证据：`AGENTS.md:71`、`README.md:121`、`scripts/e2e-api.ts:15`、`scripts/mysql/test-database.ts:9`、`scripts/mysql/test-database.ts:13`。现有隔离保护不可因此省略，本轮未运行此入口。

**F15｜P3｜已证实问题｜入库详情页标题缺少规定的线性图标。** 该 C 类页面直接渲染仅含单号或标题的 h1，与统一标题要求不符。证据：`apps/web/src/features/inbound/detail.tsx:33`、`AGENTS.md:25`。只涉及标题，不应据此把整个详情页改造成仪表盘。

**F16｜P3｜疑似风险｜Web 升级需验证多代依赖与固定预发布组件的组合。** Web 固定 React 19、antd 6 和 ProComponents 预发布版本；锁树中还存在工具链嵌套的其他代际。证据：`apps/web/package.json:16`、`package-lock.json:97`、`package-lock.json:8081`、`package-lock.json:9291`、`package-lock.json:23186`、`README.md:146`。锁树不等于浏览器包，未证明重复打包、运行不兼容或已知漏洞；升级前分别核对生产依赖路径、产物和表单/表格回归，不因本报告强升。

**F17｜P3｜待业务确认｜消息修饰键打开，是否也必须等已读成功？** 普通点击等待标记成功再跳；Ctrl/Cmd 等保留原生浏览器动作，异步已读失败时目标仍可能已打开。证据：`apps/web/src/features/messages/use-message-page.ts:14`、`docs/OPS_PAGES_SPEC.md:36`、`docs/DECISION_LOG.md:53`。须确认「先已读再跳转」是否仅约束普通点击，以及新标签标记失败应如何提示；强行拦截修饰键**与既有决定冲突**。确认前不当作代码缺陷。

## 2. 审计边界与架构

- **起点与范围。** `git log --oneline -5`：048edfb、0eaad48、4e2fd8e、aaea2bc、83ca2a5；当前 `master`，按工作区可见规格审查。开始时已有 `.gitignore`、`docs/DECISION_LOG.md`、`docs/IMPLEMENTATION_PLAN.md` 未提交改动，均未改动。`Get-ChildItem apps/api/migrations`：最高 029，下一号 030，仅盘点。适用 `docs/IMPLEMENTATION_PLAN.md:553`、`docs/IMPLEMENTATION_PLAN.md:566` 的 B7c-1 范围；不启动 B7c-2、改版、打印、切换或设备验收。唯一交付为本报告，不提交、不更新台账，不作新决定。
- **证据方法。** 按总控顺序读取项目、流程、导航、MySQL、E2E 六方面技能（UI/UX 仅取 A/B/C/D）；对照生效台账、规格、迁移、调用链、测试和最近 B8c 验收。不使用废弃设计。路由与契约使用本地文件和内存检查；导航为静态清点而非逐页浏览器复跑。
- **本轮验证。** `npm run typecheck` 退出 0；`node --test apps/miniapp/tests/client.test.cjs` 4/4。仅尝试白名单本地非 root 连接 `127.0.0.1:3307/maozhi_dev_sample`，结果 `ECONNREFUSED`，没有执行任何 SQL。未启动服务、调度器或浏览器，未做备份、恢复、迁移、安装依赖、整套测试或构建。完整测试会写隔离库（见 F14），构建会落产物。
- **历史验收，非本轮复跑。** B8c：完整测试 646/646、构建退出 0、浏览器 238/238（主套件 220、目录 18）；当时样本库 MySQL 8.0.46，迁移 029 后原有 55 张业务表指纹不变。证据：`docs/B8C_ACCEPTANCE.md:3`、`docs/B8C_ACCEPTANCE.md:7`、`docs/B8C_ACCEPTANCE.md:56`、`docs/B8C_ACCEPTANCE.md:60`。B8b 另有 PDA 模拟器和 JVM 记录 `docs/B8B_ACCEPTANCE.md:25`；均不等于实体 PDA、微信真机或生产验收。

| 层 | 技术与目录 | 实际边界、核对依据 |
| --- | --- | --- |
| 工作区与交付 | Node 24（本轮 24.14.1）、npm workspaces、TypeScript 5.9；API、Web、contracts 三个 workspace | 根命令分别做无输出类型检查、Web 构建、API/小程序/token 测试、两套浏览器测试；PDA 与小程序不是另外两个 npm workspace。`package.json:6`、`package.json:14` |
| Web | Ant Design Pro v6.0.3 工程，Umi Max 4.7.3、React 19.3.1、antd 6.7.0、ProComponents 3.1.15-9、TanStack Query 5、ECharts 6 | `apps/web/config` 注册路由，`pages` 承接入口，`features` 按域组织交互，`api`、`components`、`theme` 共享。模板版本不是 antd 包版本。`apps/web/package.json:5`、`apps/web/package.json:16`、`apps/web/config/routes.ts:2`。依赖风险见 F16；本轮没有外部漏洞库扫描，不出安全认证结论。 |
| API 与契约 | Express 5、TypeScript、Zod 4、mysql2 原生参数化 SQL；`packages/contracts` 共享请求、响应和文案 | 路由→领域命令/读模型→数据库；`middleware` 处理请求边界，`shared` 提供审计、散列与幂等，`features` 有 26 个一级目录。`apps/api/package.json:1`、`apps/api/src/routes.ts:40`、`apps/api/src/shared/idempotency.ts:7`。解析 `docs/api/openapi.json` 得 165 条路径、187 个操作；此数是契约规模，不代表逐一调用验证。 |
| 现场与移动端 | Kotlin Android：Room、WorkManager、OkHttp；原生微信小程序、Vant Weapp | PDA 离线记录和补传、认证失效后保留队列；不能写人工实发。小程序独立依赖与客户端测试，不能用 Web E2E 代替真机。`apps/pda/app/build.gradle.kts:28`、`apps/miniapp/package.json:6`、`docs/DECISION_LOG.md:196`。 |
| 存储、运维与验收 | MySQL 8、成对 SQL 迁移；`scripts/mysql`、`scripts/sql`、`tests/e2e`、API 域测试 | 运行期状态在库内；备份导出与恢复演练是有副作用的独立作业。Playwright 主套件与目录套件各有启动配置；本轮只读取测试。`scripts/mysql/test-database.ts:9`、`playwright.config.ts:8`、`playwright.catalog.config.ts:5`。 |

## 3. 业务流程与状态机

下表中“登记、确认、更正、撤销”是不同业务动作。共同边界：单用户保留认证与审计；不引入组织审批。包数与总吨数独立；PDA 只写事实，结束扫码不是出库；仅兼容历史冻结状态，不新增写入。依据：`AGENTS.md:6`、`docs/DECISION_LOG.md:206`、`docs/DECISION_LOG.md:357`、`docs/DECISION_LOG.md:365`、`docs/DECISION_LOG.md:41`。

| 流程 | 正常、例外与终态 | 写入/不写入边界与发现 |
| --- | --- | --- |
| 入库 | Web 录仓、商品、包数与总吨数→待确认→明确确认后已入账。未入账可作废；已入账撤销走补偿流水，不改写原流水。重试检查命令及正文。 | 登记不加库存；确认在事务内写操作、余额、流水、状态及审计。`apps/api/src/features/inbound/create.ts:31`、`apps/api/src/features/inbound/confirm.ts:11`、`apps/api/src/features/document-lifecycle/execute.ts:52`。合法多行请求的入口边界见 F04。 |
| 分批出库 | 开单→可清点/结束扫码（不是发货）→Web 填本次人工实发并确认→部分发货或全部发完；有余量可说明原因短关，待发为零才可完成。全单全零拒绝；历史冻结只读兼容。 | 扫码 UUID 和正文用于认定同一事实；重试不换 UUID，不把补传折成库存。每批确认锁计划、校验版本，写批次快照、扣库存、流水和审计；短关不额外扣库。`apps/api/src/features/scan/service.ts:42`、`apps/api/src/features/scan/freeze.ts:17`、`apps/api/src/features/shipments/create.ts:31`、`apps/api/src/features/shipments/create.ts:57`、`apps/api/src/features/shipments/short-close.ts:21`、`apps/api/src/features/shipments/complete.ts:21`。清点体验见 F04、F11。 |
| 更正 | 已入账对象→预览有效数量与差额→复核版本、原因、证据→追加更正记录并按差额入账。按发货行更正后重算有效量；短关不重开。日期更正是独立链路，不产生数量差额。 | 不覆盖原实发或原业务凭据；负库存及过期预览受限。`apps/api/src/features/corrections/prepare.ts:63`、`apps/api/src/features/corrections/create.ts:68`、`apps/api/src/features/corrections/settle-outbound.ts:17`、`apps/api/src/features/date-corrections/create.ts:43`。未把“历史数据可改”当作修复建议。 |
| 盘点 | 开盘建快照并锁仓→明盘录入，或盲盘录完后揭示→预览、核对未过账作业并确认→按差异回写、结束；未完成可按规则作废解仓。未录不是零，漂移不能强制覆盖。 | 活动窗口内限制该仓库存确认；预览校验余额、流水水位和发现行，回写再核验。`apps/api/src/features/stocktake/create.ts:75`、`apps/api/src/features/stocktake/reveal.ts:16`、`apps/api/src/features/stocktake/preview.ts:20`、`apps/api/src/features/stocktake/post.ts:52`。已证实范围矛盾 F01；导航 F06；聚合 F08。 |
| 系统通知 | 定时读取待办、发货超时、盘点超时、目录过期、备份失败、异常六类来源→产生/延续活动提醒；单条/全部已读与问题解除是不同状态。到期只清理已读或已解除项。 | 同库互斥；六类协调和清理在同一事务，失败回滚并留扫描状态；不写库存。`apps/api/src/features/notifications/scan.ts:10`、`apps/api/src/features/notifications/scan.ts:24`、`apps/api/src/features/notifications/scan.ts:42`、`apps/api/src/features/notifications/mark-read.ts:7`、`docs/DECISION_LOG.md:314`。覆盖 F09、容量 F12、交互待裁定 F17。 |
| 备份及恢复演练 | 备份排队→运行→成功/失败，服务重启识别中断。恢复先检查预备份，再建随机隔离库及专用账号→导入→逐项核验→报告；失败保留隔离库与证据，不覆盖或切换现库。 | 清理仅限受管产物；演练不是上线恢复。`apps/api/src/features/maintenance/jobs.ts:22`、`apps/api/src/features/maintenance/jobs.ts:37`、`apps/api/src/features/maintenance/run-backup.ts:15`、`apps/api/src/features/maintenance/run-restore.ts:35`、`apps/api/src/features/maintenance/run-restore.ts:95`、`apps/api/src/features/maintenance/retention.ts:38`、`docs/DECISION_LOG.md:22`。逐格报告 F03、持锁时长 F10。 |

**规格与实现的分界。** 不导历史单、不接未完单是生效决定，F02 是可执行文档冲突而非要求实现承接。部分发货后既有行计划可改、明细增删后置是已登记阶段取舍（`docs/DECISION_LOG.md:378`），不计为本轮缺陷。

## 4. Web 路由、导航与页面范式

逐项解析 `apps/web/config/routes.ts` 并按 `apps/web/src/pages` 解析组件文件：**27 个不同路径、26 个不同页面实现、16 个可见命名菜单、0 个缺失组件**。新建和编辑出库复用一份编辑器；兜底和登录不在业务菜单。页面主范式取决于主要任务，不因嵌入表格、抽屉或图表而改变。A＝工作台/分析看板，B＝高密度业务查询，C＝表单/详情流程，D＝系统与资料管理；口径见 `docs/IMPLEMENTATION_PLAN.md:559`、`docs/IMPLEMENTATION_PLAN.md:562`。下表行号均指 `apps/web/config/routes.ts`。

| 路径 | 行 | 入口/页面 | 类别及定位 |
| --- | ---: | --- | --- |
| `/` | 2 | 菜单：工作台 | A，任务与指标入口 |
| `/dashboard` | 3 | 菜单：数据看板 | A，趋势与分析下钻 |
| `/reports/details` | 4 | 菜单：出入库明细 | B，按条件核对明细 |
| `/reports/monthly` | 5 | 菜单：月度汇总 | B，汇总与下钻 |
| `/reports/turnover` | 6 | 菜单：周转率 | B，指标列表与明细 |
| `/reports/aging` | 7 | 菜单：库存库龄 | B，按时点查库存构成 |
| `/stocktakes` | 8 | 菜单：库存盘点 | B，作业清单；筛选返回错配 F06 |
| `/stocktakes/new` | 9 | 隐藏：发起盘点 | C，选择仓库、范围及方式 |
| `/stocktakes/:id` | 10 | 隐藏：盘点详情 | C，计数、揭示、差异与回写 |
| `/catalog` | 11 | 菜单：条码目录 | D 为主、查询局部用 B；批次表未单列此页，本表是审计归类。登录路径 F07 |
| `/maintenance` | 12 | 菜单：系统维护 | D，备份、恢复演练、健康 |
| `/messages` | 13 | 菜单及角标：消息中心 | D，消息管理；筛选/分页局部用 B，非改成经营看板 |
| `/me` | 14 | 隐藏：账户菜单→个人中心 | D，身份与安全 |
| `/system/document-numbering` | 16 | 菜单：单据编号配置 | D，业务配置 |
| `/user/login` | 22 | 公共：登录 | C，单任务认证表单，独立外壳 |
| `/inbound` | 27 | 菜单：入库记录 | B，业务列表 |
| `/inbound/new` | 33 | 隐藏：登记入库 | C，表头与多行录入 |
| `/inbound/:id` | 38 | 隐藏：入库详情 | C，核对/确认/更正；标题规范偏差 F15 |
| `/outbound` | 43 | 菜单：出库列表 | B，查单与作业入口 |
| `/outbound/new` | 49 | 隐藏：新建出库 | C，计划录入 |
| `/outbound/:id/edit` | 54 | 隐藏：编辑出库 | C，复用编辑器，受单据状态限制 |
| `/outbound/:id` | 59 | 隐藏：出库详情 | C，分批实发、清点与更正，不是看板 |
| `/stock` | 65 | 菜单：库存概览 | B，库存格与流水入口 |
| `/stock/journal` | 70 | 隐藏：库存流水 | B，按仓品追溯 |
| `/audit` | 72 | 菜单：操作记录 | B，查询与审计详情 |
| `/master-data` | 78 | 菜单：基础资料 | D，六页签共一路由，不虚增为六页 |
| `/*` | 84 | 公共：404 | C 类辅助结果态（非业务表单），缺回退入口 F13 |

**主要链接、按钮与返回路径。** 静态注册表未发现缺失目的组件；这不证明所有真实 ID、登录态和筛选组合均能正常返回。以下按生产入口分组，区分同一路由的合理复用与实际断点。

| 入口 | 去向、参数或返回行为 | 证据 |
| --- | --- | --- |
| 品牌、侧栏、账户与登录 | 品牌→工作台；侧栏按路由；账户→个人中心；登录门禁保留目的地址。带旧出库列表参数的根路径兼容映射到出库列表，并保留查询串、片段。目录例外见 F07。 | `apps/web/src/app.tsx:73`、`apps/web/src/app.tsx:82`、`apps/web/src/app.tsx:89`、`apps/web/src/pages/AuthGate.tsx:15`、`apps/web/src/features/outbound/list-route.ts:5` |
| 工作台、分析与报表 | 入/出指标→列表；进行中盘点→带状态清单；待办→对应业务对象；分析排名、月度/周转→带条件明细，当日库龄→库存。工作台待办、报表核对有本页锚点。 | `apps/web/src/features/workbench/kpis.tsx:44`、`apps/web/src/features/workbench/kpis.tsx:53`、`apps/web/src/features/workbench/todos.tsx:35`、`apps/web/src/features/analysis/drilldown.ts:5`、`apps/web/src/features/reports/drilldown.ts:43`、`apps/web/src/features/reports/drilldown.ts:91`、`apps/web/src/features/reports/table-summary.tsx:54`、`apps/web/src/features/reports/reconciliation.tsx:40` |
| 业务列表/详情及库存 | 入出库列表→新建/详情→返回来源列表；出库可进入同一单号编辑。库存格→流水抽屉→流水页。盘点列表有「单号/查看」双入口，详情返回丢筛选见 F06。 | `apps/web/src/components/BusinessList/navigation.tsx:8`、`apps/web/src/components/BusinessList/navigation.tsx:16`、`apps/web/src/features/stock/movement-drawer.tsx:36`、`apps/web/src/features/stock/movement-page.tsx:57`、`apps/web/src/features/stocktake/list.tsx:49` |
| 通知、审计和下载 | 消息→入/出/盘点详情、目录、库存或维护；已读规则见 F17。审计事件在页内展开，下载不是业务页跳转；登录后审计原始数据折叠区是限定例外。 | `apps/api/src/features/notifications/candidate.ts:16`、`apps/web/src/features/messages/use-message-page.ts:14`、`apps/web/src/features/audit/events.tsx:26`、`AGENTS.md:23`、`docs/DECISION_LOG.md:53` |

**重复入口与范式结论。** 入库列表的主按钮/空态登记（`apps/web/src/features/inbound/list.tsx:37`、`apps/web/src/features/inbound/list.tsx:41`）和盘点的单号/查看（`apps/web/src/features/stocktake/list.tsx:28`、`apps/web/src/features/stocktake/list.tsx:49`）是同一动作在不同上下文的入口，未发现相互矛盾的目的地址，不列伪缺陷。已证实的范式偏差集中在 B 类丢查询上下文、C 类标题不符合规范以及公共结果页无出口；未取得某整页必须换类的证据。此处不是 1440/1280 像素验收。

## 5. MySQL 设计与一致性

**证据限度：以下是迁移声明与应用调用链，不是现场 SHOW/EXPLAIN 结果。** 本地连接被拒，无法确认当前库实际 DDL、索引基数、行数、孤儿行或执行计划；历史验收的指纹也不能替代本轮对账。

| 数据组 | 结构、约束、索引 | 一致性含义 |
| --- | --- | --- |
| 基础资料、单据与库存 | 入库头/行按父单关联；库存物理主键包含仓、商品、来源删除标识；吨数用 DECIMAL(12,4)，API 转整数克。`apps/api/migrations/002_inbound_masters.up.sql:47`、`apps/api/migrations/003_source_snapshot.up.sql:67`、`apps/api/src/db/weight.ts:3` | 业务有效库存与物理全表不是同一个集合。逐格基线要么标明业务过滤，要么区分全物理键；历史快照不得当作新流水重放。见 F01、F03、F08。 |
| 入账、发货与更正 | 新流水保存前后数量，操作外键 RESTRICT、CHECK 约束差额和非负；发货批次唯一 `(order_id,seq)`、批次行唯一 `(shipment_id,order_line_id)`，有按原行反查索引；更正可外键指向批次行；日期更正留独立凭据。`apps/api/migrations/005_inventory_posting.up.sql:17`、`apps/api/migrations/016_outbound_shipments.up.sql:15`、`apps/api/migrations/016_outbound_shipments.up.sql:28`、`apps/api/migrations/020_correction_shipment_line.up.sql:4`、`apps/api/migrations/021_document_date_corrections.up.sql:18` | 既约束单行算术，又保留跨单追溯。单行正确不代表期初＋全链＝期末；现行核对还漏掉不存在的有效格，见 F05。 |
| 目录、扫码与交接 | 目录有发布版本，交接记录按交接/事实复合键并关联单据，清点条码唯一维度为计划内。`apps/api/migrations/006_catalog_versioning.up.sql:1`、`apps/api/migrations/007_pda_handoff.up.sql:14`、`apps/api/migrations/018_scan_workbench.up.sql:8` | UUID/正文重放与同单重复条码是两种校验，不是全库禁止同条码出现在不同单据。扫码事实不生成库存操作。 |
| 盘点 | 快照复合主键，实盘读数复合外键引用快照；活动仓生成列唯一，快照禁止更新/删除，发现行独立；状态/仓库+时间+ID 支持列表。`apps/api/migrations/009_stocktake.up.sql:15`、`apps/api/migrations/009_stocktake.up.sql:21`、`apps/api/migrations/009_stocktake.up.sql:31`、`apps/api/migrations/009_stocktake.up.sql:38`、`apps/api/migrations/009_stocktake.up.sql:42`、`apps/api/migrations/025_stocktake_discoveries.up.sql:9` | 一仓不能并存两个活动窗口，未录与零有别；这些约束不能纠正快照与预览选集不同，见 F01。 |
| 维护与身份 | 维护任务幂等、状态/时间索引，产物外键和唯一约束；备份基线、认证扩展各有独立迁移。`apps/api/migrations/026_maintenance.up.sql:14`、`apps/api/migrations/026_maintenance.up.sql:29`、`apps/api/migrations/027_restore_baselines.up.sql:3`、`apps/api/migrations/028_auth_extensions.up.sql:1` | 备份持锁范围与基线一致性是一项取舍，不能只优化时长而破坏快照。见 F03、F10。 |
| 通知 | `active_key` 生成列＋唯一键约束同一活动事件；列表有时间/类型/未读复合索引，另有到期索引，扫描状态按键存 JSON。`apps/api/migrations/029_notifications.up.sql:15`、`apps/api/migrations/029_notifications.up.sql:17`、`apps/api/migrations/029_notifications.up.sql:19`、`apps/api/migrations/029_notifications.up.sql:23` | 已解除后可有后续周期；分页索引存在不代表大积压扫描的实际代价可接受。见 F12。 |

**事务与幂等。** 库存命令先锁固定身份行串行化写者，再锁业务单和按商品稳定排序的有效库存格；检查盘点窗口、前值、非负和精度，再写余额与含前后值的流水，调用方在同一事务中记审计和命令结果。事务使用可重复读；提交回执丢失不等于已回滚，应沿原键核对。命令按动作、操作者、键回放且核对正文散列；扫码事实另按原 UUID 和正文判定，冲突不得静默覆盖。证据：`apps/api/src/features/inventory/operation.ts:21`、`apps/api/src/features/inventory/posting.ts:35`、`apps/api/src/features/inventory/posting.ts:59`、`apps/api/src/features/inventory/posting.ts:90`、`apps/api/src/features/shipments/create.ts:31`、`apps/api/src/shared/idempotency.ts:7`、`apps/api/src/db/transaction-outcome.ts:21`、`apps/api/src/db/transaction-outcome.ts:33`、`apps/api/src/features/scan/service.ts:42`。

**待连接恢复后的只读复核样例（未执行）。** 先核对数据库身份，再 `SHOW CREATE TABLE stock`、`SHOW INDEX FROM notifications`；对下列查询先做普通 `EXPLAIN`，确认可承受的范围后才做 SELECT。结果为空仅表示未发现这类缺格，不代表全部库存平衡。

```sql
SELECT j.warehouse_code, j.product_code, COUNT(*) AS posted_rows
FROM stock_journal AS j
LEFT JOIN stock AS s ON s.warehouse_code = j.warehouse_code
                    AND s.product_code = j.product_code
                    AND s.source_del_flag = 0
WHERE j.operation_id IS NOT NULL AND j.source_del_flag = 0
  AND s.product_code IS NULL
GROUP BY j.warehouse_code, j.product_code;
```

## 6. E2E 覆盖矩阵

`rg --files tests/e2e -g '*.spec.ts'` 清点 77 个规格文件，不是 77 个场景。「有覆盖」表示当前仓库存在下列断言；整套运行结果仅引用 B8c。主 Chromium 基准 1440，独立 API/Web 4311/5174；目录套件 4312/5175，见 `playwright.config.ts:8`、`playwright.config.ts:14`、`playwright.catalog.config.ts:5`、`playwright.catalog.config.ts:16`。测试库与浏览器不等于物理设备或线上环境。

| 场景 | 已有覆盖（代表性证据） | 尚不能由这些证据推出／最有价值的补测 |
| --- | --- | --- |
| 入库、库存与对账 | 人工确认、库存回读与流水：`tests/e2e/inventory-posting.spec.ts:14`、`tests/e2e/inventory-posting.spec.ts:79`；对账断言 `apps/api/tests/inventory-reconciliation.test.ts:38` | 合法中文多行单走真实 HTTP（F04）；流水有、有效格无应被发现（F05，优先用隔离库 SQL 测试，不必做 UI 测试）。 |
| 分批出库、清点及补传 | 分批、请求重试、清点入口、离线原正文补传：`tests/e2e/multiple-shipments.spec.ts:6`、`tests/e2e/shipment-retry.spec.ts:6`、`tests/e2e/scan-workbench.spec.ts:9`、`tests/e2e/boundary.spec.ts:10` | 200 条候选的合法提交与分阶段时延分别核验（F04/F11）；浏览器模拟离线不是实体 PDA 断网测试。 |
| 数量及日期更正 | 整单、批次行更正及日期调整：`tests/e2e/corrections.spec.ts:7`、`tests/e2e/shipment-corrections.spec.ts:6`、`tests/e2e/date-corrections.spec.ts:49`、`tests/e2e/date-corrections.spec.ts:76` | 现有证据能覆盖主路径，不以日期更正成功推断发生库存写入；新增数量或日期规则应分别验证。 |
| 明/盲盘、发现行、锁仓 | 录入/揭示、盘盈发现行、完整性和过期预览：`tests/e2e/stocktake-blind.spec.ts:10`、`tests/e2e/stocktake-discovery.spec.ts:10`、`tests/e2e/stocktake-integrity.spec.ts:10`、`tests/e2e/stocktake.spec.ts:151` | 应加盘前停用零余额格和真实漂移对照（F01）、筛选后进详情再返回（F06）；跨单格上限汇总可在读模型层测（F08）。 |
| 通知、已读和角标 | 六类真实扫描、筛选分页、网络失败、轮询：`tests/e2e/messages.spec.ts:8`、`tests/e2e/messages.spec.ts:36`、`tests/e2e/messages.spec.ts:58`、`tests/e2e/messages.spec.ts:85` | 缺服务启动→定时回调→扫描→角标的接线证明（F09）；修饰键按 F17 裁定后再固化。 |
| 备份、恢复与故障 | 任务/产物、健康、真实演练步骤、无基线、失败留证：`tests/e2e/maintenance.spec.ts:14`、`tests/e2e/maintenance.spec.ts:53`、`tests/e2e/maintenance-restore.spec.ts:9`、`tests/e2e/maintenance-restore.spec.ts:64`、`tests/e2e/maintenance-restore.spec.ts:102` | 同仓品多物理行核验需独立断言（F03）；已有功能通过不证明大库持锁时长合格（F10）。 |
| 登录、导航、报表与资料 | 身份/改密、工作台跳转、目录多态、报表下钻、流水筛选恢复：`tests/e2e/identity.spec.ts:14`、`tests/e2e/identity.spec.ts:51`、`tests/e2e/workbench-routing.spec.ts:14`、`tests/e2e/catalog-ui-states.spec.ts:32`、`tests/e2e/reports-interactions-acceptance.spec.ts:105`、`tests/e2e/stock-movements.spec.ts:6` | 目录 403 可理解不等于 401 深链可回登录（F07）；坏书签进入 404 能否不靠浏览器返回退出（F13）。 |

## 7. 建议的修复顺序

1. **先防作业受阻和误切换：F01、F02。** 在隔离测试复现“盘前已有停用格、不应报新漂移”和“真正盘中漂移、必须阻断”这对反例；同步收拢操作手册中的失效指令。不动样本余额，不改生效决策，不承接旧单。
2. **再使核验结果可信：F05、F03。** 先让缺失库存格可被对账发现，再校验恢复报告能分辨物理行、忽略纯换序并兼容旧基线。两者都要证明校验工具能主动发现反例，而不只是在正常数据上显示通过。
3. **打通合法批量作业：F04。** 入库与清点分别验证合法上界能提交、超上界仍受控拒绝，且失败不产生部分写入。
4. **补行为和回归：F06、F07、F08、F09。** 依次验证列表上下文、目录重新登录、聚合边界、实际调度接线；选择最低成本且能穿过真实故障边界的测试层，不把所有问题都塞进浏览器测试。
5. **量测后才决定优化：F10、F11、F12、F16。** 使用另行授权的隔离环境采集持锁时长、候选批次延迟、通知积压、生产包依赖路径；未知不等于失败，不改变一致性或库存规则。
6. **低成本收尾与业务裁定：F14、F13、F15、F17。** 先消除只读操作员误跑有写脚本的文档歧义，再补 404 退路和标题规范；F17 请业务明确普通点击与原生新标签的先后要求后再定。本轮止于报告，未实施修复。
