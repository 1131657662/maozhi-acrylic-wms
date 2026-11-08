# 第一里程碑验收记录

## B4a：边界修补（2026-11-08）

限定 R1/R2/R3/R5/R6；代码及本地验证完成，待用户验收。实现及逐项实际输出见 [B4a 验收证据](B4A_VALIDATION.md)。开发库 010 已升级，备份恢复核验通过，35 张业务表原有列指纹不变；API/小程序134项、E2E主套件48项＋目录套件9项全部通过，构建通过。代码/构建、API 测试、浏览器与离线协议模拟分别记录；不宣称实体 PDA 或生产验收，不将 B3c、打印及其他审计项标为完成。

## B3b：出入库明细、月度汇总及 XLSX（2026-11-08，待用户验收）

基线 `e37083c79dd81465aa84367f5a0bb2d00502d879`。用户已确认D1–D5及三条硬规则；本批仅Web/API读模型和既有XLSX通道。只用本机3307随机测试库，样本来自已存在的只读CSV；没有生产连接、迁移/回填、移动端改动或新依赖。D6/D7、打印、B2b未做。下列“可验证”是余额证据状态，不表示历史时区已核实。

### P 覆盖率（本批限定路径3/3，不代表四类报表全部完成）

| 路径 | 实测结果 | 证据 |
| --- | --- | --- |
| 月度汇总 | 仓品月份、入出确认/负向撤销、人工/盘点/导入/未知变动分列；单号/操作数去重，未知关联null；每页独立包/吨收发存与差额 | `reports.test.ts`、`report-integrity.test.ts`、`reports.spec.ts`；三月独立SQL |
| 入账明细与质量提示 | 保留原确认及补偿，原单可下钻；可筛入/出方向且不缩减对账；历史上海原文与“时间未核实”；断点不可验证、缺边界null，合成差额1包/0.3000吨保留，调整列仍0 | `B3B_RECONCILIATION`、`B3B_GAP`、`B3B_DIRECTION_UI/EXPORT`；1280断链截图 |
| XLSX三范围 | 明细35字段、月报42字段API逐格比对；浏览器实际可见列/顺序与对账附页比对；全部/当前页/选中均差异0，余额/单数不错误求和 | `report-export.test.ts`、`reports.spec.ts`；`B3B_XLSX`、`B3B_SCREEN_XLSX` |

### U 指标达成

| 指标 | 方法/基线 | 实测与限制 |
| --- | --- | --- |
| 数据覆盖与完整导出 | 旧明细服务LIMIT 10000；本机正式构建、单仓品、时间单调10万入库流水，逐行读取成品核ID | 100000/100000，重复0，末ID100001（ID1为期初导入锚点），不截断；生成中翻页成功 |
| 生成耗时/内存 | 复用B1b-2 streaming writer，2000行投影/1000行写文件；Node每25ms采样 | 最终构建导出18.897秒；堆起始114/峰值170MiB，RSS峰值329MiB；文件3607065字节；单次本机实测，不是p95/SLA |
| 查询延迟 | 正式构建空浏览器上下文首屏；导出中翻页；另测月报API | 最终构建首屏6788ms、翻页7263ms、月报5309ms；**未达原U目标1500/500ms**；非单调时间的大规模排序尚未单独压测 |
| 可读性与恢复 | 1440/1280页面scrollWidth断言，核心数量固定列boundingBox；四态/原筛选重试 | 页面级横滚0，核心数量在可视宽内；空/403/网络失败可辨识、重试恢复；无真实用户人工耗时结论 |

### N 已批准清单

| 新增能力 | 本批状态 |
| --- | --- |
| 无 | 本批仅已批准基础报表；不借报表增加经营看板、库龄/周转规则或打印。 |

### 随机三个月逐仓逐商品 SQL

首次随机选到2026-05/07/08，随后固定同三个月复跑，避免挑选“好看”的月份。命令：`npx tsx scripts/verify-report-samples.ts --months=2026-05,2026-07,2026-08`。SQL文件 `scripts/report-reconciliation.sql` 在同一只读快照连接设置 `@report_start/@report_end` 后执行；仓品先聚合再JOIN，无多对多放大。SQL/hash/明细/原因保存在 `.local/evidence/b3b-sample-reconciliation.json`，不提交真实明细或吨位。

| 月 | 仓品单元 | 明细行 | SQL/明细与报表差异 | 可验证 | 不可验证 | 非零或未知差额 | 排除软删 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 2026-05 | 121 | 41 | 0 | 0 | 121 | 121 | 24 |
| 2026-07 | 121 | 153 | 0 | 83 | 38 | 38 | 24 |
| 2026-08 | 121 | 113 | 0 | 103 | 18 | 17 | 24 |

合计363个仓品月单元计算一致，**不等于363个余额全部验证通过**：186可验证、177不可验证。原因包括区间前无可定位边界、流水衔接断点；差额即使恰为0，断点仍不可验证。所有非零/未知差额均有原因且无补平；24条软删包含缺主数据关联的行，不能因JOIN丢失而只报告20。原始导入库存锚点可核对，但正式上线T0/水位登记与历史时区仍未验。

### 原始输出、复现与截图

```text
npm run test: tests 127, pass 127, fail 0, skipped 0
npm run build: exit 0（严格TypeScript + Umi Webpack）
npm run test:e2e: 45 passed (4.3m); 9 passed (1.4m)
B3b页面/方向筛选修订后定向复跑: 4 passed (45.1s)
B3B_RECONCILIATION months=3 cells=18 detailRows=48 mismatches=0
B3B_GAP differencePackages=1 differenceGrams=300000 adjustment=0 state=不可验证 missingOpening=null
B3B_EXPORT_GUARD missing=null/text stale=EXPORT_VIEW_CHANGED file=none
B3B_DOCUMENT_COUNTS repeatedLines=2 distinctDocuments=1 missingReference=null reversalOperations=1
B3B_KEYSET direction=asc/desc rows=2105 duplicates=0
B3B_DIRECTION_UI rows=24 reconciliation=unchanged monthly=both-directions
B3B_DIRECTION_EXPORT direction=inbound rows=24 mismatches=0 reconciliation=full-range
```

- 原始日志：`.local/evidence/b3b-test.log`、`b3b-build.log`、`b3b-e2e-full.log`、`b3b-e2e.log`；完整字段输出`B3B_XLSX`在test日志。既有四列表、盘点、撤销、目录E2E全绿；antd CLI检查0问题。
- 性能复现：`npm run build`后`npx tsx scripts/verify-report-performance.ts`；原始JSON/log为`b3b-performance-100000.*`，完整文件`b3b-100000-details.xlsx`。这是本机合成验收，没有生产压测；本轮未追加Excel/WPS人工打开验收。
- 三张截图均已实际查看，均为合成数据、不进Git：[明细1440](../.local/evidence/b3b-details-1440.png)、[月报1440](../.local/evidence/b3b-monthly-1440.png)、[月报1280断链及差额](../.local/evidence/b3b-monthly-1280.png)。没有视觉回归快照断言。
- 回退为revert本批只读代码；不down009、不删除历史/事实/目录。OpenAPI更新声明源码，生成物按约定另批；本轮无生产、实体设备或B3c验收。

## B3a：Web 盘点闭环（2026-11-08）

本批从B2a基线 `ef3eb06ca0755e123ca69903d24d37d94fecd7e1` 开始。仅本地MySQL 3307、Web与API；不做PDA盘点、B2b更正、报表或打印。入库不扫码，盘点独立填写包数与吨数；扫码目录不参与库存。用户已确认：**完成或作废释放暂停，进行中只有作废可提前释放**，没有手动或超时解锁。以下为本批实测记录，较早批次保留当时范围。

### P 覆盖率（本批限定路径5/5，不代表整个ERP的P完成率）

| 路径 | 实测结果 | 证据 |
| --- | --- | --- |
| 新建与固定快照 | ERP仓库/可选商品范围；快照UPDATE/DELETE拒绝，未录NULL不当作0；同仓20并发开始仅1张成功 | `stocktake-capture.test.ts`；`stocktake.spec.ts` |
| 列表、详情、逐行实盘 | 单号/状态筛选、分页、独立包吨录入；行revision防覆盖，重复保存只一次；1440/1280无页面级横滚 | `stocktake.spec.ts`；`b3a-list-*`、`b3a-reading-*` |
| 人工差异回写 | 全录入、原因、预览token、人工提交；前后值/流水/审计/幂等同事务，零差异完成但不写伪流水 | `stocktake-post.test.ts`、`stocktake-positive.test.ts`；全量SQL |
| 仓库暂停与作废 | 同仓确认/调整/撤销409；他仓成功，PDA补传/冻结正常；作废库存和流水均不变，记录保留 | `stocktake-window.test.ts`、`stocktake-failures.test.ts` |
| 未入账收发与遗忘入口 | 单号+登记/计划包吨、已扫包吨分列；默认阻断，显式快照口径确认留完整审计；新单/晚到补传使旧预览失效；菜单数量直达盘点 | `stocktake-unposted.test.ts`；`stocktake.spec.ts`；`b3a-unposted-preview-*`、`b3a-forgotten-window-*` |

### U 指标达成

| 指标 | 基线与方法 | 本批实测/限制 |
| --- | --- | --- |
| 找回暂停原因 | 原型无盘点；旧ERP人工定位耗时待实测。首页菜单存在1张进行中时点击入口 | 1次点击定位该单；确认409含盘点号/路径；退出页面不释放 |
| 故障自助恢复 | 浏览器注入审计失败后原抽屉重试；不以人工耗时未测数据宣称提速 | 原因和勾选保留，原幂等键重试成功，失败时全部表指纹不变 |
| 万行正式构建首屏/翻页 | `verify-stocktake-browser.ts`，本机独立合成库，30个新浏览器context，1440×960；从goto到首行可见/点击下一页到第21行可见 | 首屏p50 **1084ms**、p95 **1122ms**、max1154ms；翻页p50 **121ms**、p95 **141ms**、max143ms；分别低于1500/500ms |
| 万行服务端处理 | `verify-stocktake-volume.ts`：同机MySQL 3307；查询/单行保存各30次，快照/预览/回写各1次 | 快照383ms、预览61ms、10000行回写649ms；单行保存p95 9ms、200行查询p95 31ms；分页使用快照复合主键 |
| 数据量与布局 | 正式构建显示200行，双宽度页面scrollWidth断言；SQL逐条检查10000行及末条 | 页面级横滚0；末条COUNT-10000命中；全量mismatches=0。人机实盘录入时长待实测 |

性能不是生产SLA：本机回环网络、单用户合成库；初次开发模式首屏曾超过1.5s，不能与正式构建混为同一测量。现有全局库存writer锁使万行回写期间他仓确认等待 **658ms** 后成功，并非零等待；仅本仓受持久业务暂停。RSS前后191→209MiB是采样值，**不是峰值**。万行脚本部分实盘通过合成夹具填充，产品本轮仍只有逐行录入，不宣称实现批量导入。

### N 已批准清单

| 项 | 结论 |
| --- | --- |
| 新增业务能力 | 无；本批为P盘点闭环。未实现差异放行、PDA盘点、自动确认或超时解锁 |

### 并发、失败、未入账及暂停的原始输出

```text
B3A_POST same_key=true concurrency=20 success=20 conflicts=0 operations=1 snapshot_unchanged=true after_complete_confirm=200
B3A_POST same_key=false concurrency=20 success=1 conflicts=19 operations=1 snapshot_unchanged=true after_complete_confirm=200
B3A_ACK default=409 stale_ack=409 current_ack=200 audit_unposted=2
B3A_LATE_FACT older_order=true upload_during_pause=success planned=2/0.6000 scanned=1/0.3025 stale_ack=409 unchanged=true
B3A_WINDOW inbound=409 outbound=409 adjustment=409 reverse=409 rejected_database_unchanged=true pda_upload_freeze=success void_stock_journal_unchanged=true after_void_confirm=200
B3A_ISOLATION other_warehouse_confirm=200 zero_snapshot=0/0 mobile_channels=403
B3A_VOLUME second_batch_failure_at=501 partial_writes=0 prior_batch_rolled_back=true
```

回写真实触发器失败注入覆盖 `inventory_operations → stock → stock_journal → stocktakes → stocktake_windows → operation_log → idempotent_commands` 七阶段，均输出 `partial_writes=0 window_retained=true`；开始快照六阶段失败也无残留，作废释放失败保留原窗口，10轮“开始与确认”并发 `snapshot_drift=0`。失败比对全部业务表行指纹，不只是行数；MySQL自增号空隙不算残留。正差异、负差异、零差异、零库存商品与软删库存键冲突均覆盖。

浏览器另验证失败500后输入保留、原键重试、20次HTTP重放只1操作；异键20个HTTP并发恰1个200、19个409；空原因422、旧预览409、未确认口径409。遗忘场景输出 `confirm=409 visible_entry_locates_document=true void_stock_delta=0 void_journals=0 after_void_confirm=200`。PDA行为仅后端协议回归，未宣称本批实体设备实测。

### 全量 SQL 对账与末条证据

可执行SQL：[`scripts/sql/verify-stocktake.sql`](../scripts/sql/verify-stocktake.sql)。通过 `npx tsx scripts/verify-stocktake-volume.ts` 创建随机临时库并实际执行，输出 `.local/evidence/b3a-volume-sql.json`（10000行完整结果）与 `b3a-volume-metrics.json`。浏览器完整闭环另输出 `b3a-e2e-sql.json`。不以开发样本库没有盘点记录的0行查询冒充验收。

| 对账 | 实际结果 |
| --- | --- |
| 每个商品：实盘−固定快照＝流水delta，非零差异恰1流水、零差异0流水 | 10000/10000 `balanced=1` |
| 前后包数/吨数、操作类型、目标盘点及原因 | `mismatches=0` |
| completed只有1笔库存操作/审计；其他状态没有回写操作 | `mismatches=0` |
| counting保留窗口，completed/voided释放 | `mismatches=0` |
| 当前库存等于最后有效流水后值 | `mismatches=0` |
| 末条COUNT-10000 | 快照2包/0.6000吨；实盘1包/0.3001吨；delta−1包/−0.2999吨；流水1条、同值、balanced=1 |

### 009 迁移、真实恢复演练与安全回退

```text
B3A_RESTORE all_tables=32 fingerprints_equal=true
B3A_MIGRATION business_tables_unchanged=31 counts={"inbound_receipts":"115","outbound_orders":"415","stock":"122","stock_journal":"828","scan_facts":"0","catalog_entries":"9018"}
B3A_SAMPLE_EMPTY_DOWN success=true re_up=true historical_rows_preserved=true
B3A_SAMPLE_DOWN Error: 拒绝回退：stocktakes 含有数据，禁止删除历史数据 unchanged=true
B3A_LOCAL_009 applied=true
```

实际顺序：停止本地API→备份→新库完整恢复并比对32表指纹→恢复副本009 up→盘点表空时down/up→构造盘点后非空down拒绝且指纹不变→本地开发库up。原31业务表（不含迁移登记表）逐行指纹不变。备份 `.local/backups/b3a-before-009-1794138264726.sql`，SHA-256 `b7cb48a56f8e49d983263310eb08b1e60ae4208e6ef99329b47474e688bfaac8`；原始输出 `b3a-local-migration.log`，迁移指纹 `b3a-migration-fingerprints.json`。

down必须走迁移runner的非空门禁；DDL不事务化，中断保留applying/reverting。非空不得删历史，优先禁用新入口/前向修复；存在进行中窗口时不能回退到不识别暂停的旧写服务。没有生产连接/迁移、没有清理真实作业队列。主开发库未造盘点测试单。

### 命令、截图与提交前审查

- `npm run test`：**118/118，fail 0**，原始日志 `.local/evidence/b3a-full-test.log`。
- `npm run build`：exit 0，严格类型检查与Web构建通过，日志 `.local/evidence/b3a-build.log`。
- `npm run test:e2e`：**主套42/42 + 目录套9/9，共51/51，exit 0**；原始输出 `42 passed (5.0m)`、`9 passed (1.5m)`，日志 `.local/evidence/b3a-full-e2e.log`。
- 万行SQL/服务性能与正式构建浏览器脚本均exit 0；日志 `b3a-volume.log`、`b3a-production-performance.log`，30次原始样本在 `b3a-production-performance.json`。
- 双宽度截图：`.local/evidence/b3a-{new,reading,unposted-preview,completed,forgotten-window,list,volume}-{1440,1280}.png`；失败恢复 `b3a-post-failure-retry.png`。没有视觉快照断言，截图/备份/真实样本全部不进Git。
- 回归修正记录：万行浏览器移到独立临时库，避免污染共享E2E首页；未知类型用例在检查前自行创建最近流水夹具；库存请求断言精确匹配 `/stock/`，不再误收 `/stocktakes`。005/008历史迁移测试固定原schema；005显式构造非空操作/库存/流水/审计/幂等夹具后验证拒绝down，不调用要求009的新写服务。保留原有业务断言，未为测试改变生产筛选/分页行为。失败尝试日志保存在 `b3a-e2e-first-attempt.log`、`b3a-e2e-fixture-isolation-attempt.log`，不作为最终通过证据。
- 提交审查：参数化SQL、Web通道、原因/Zod校验、事务锁序、历史快照与009回退门禁已核对；无新依赖，无PDA/小程序业务变更。OpenAPI只改声明源码，生成物按约定另批。

## B2a：误确认撤销与未入账作废（2026-11-08）

本批仅Web本地新单纠错；撤销不代表实物退货，作废只允许可证未入账。原单、原流水、原号、扫码事实均保留；终态`cancelled/voided`不重新开放确认或扫码。115张历史入库、415张历史出库只读，原状态不回填。已下发/已扫/冻结/交接未收妥的出库作废留B2b，不把服务端0事实当成现场0队列。下方旧批次记录保留当时范围。

### P 覆盖率（本批限定路径4/4，不是整个单据模块P完成率）

| 路径 | 实测结果 | 证据 |
| --- | --- | --- |
| 入库误确认撤销 | confirmed→cancelled，posting_state=reversed；以原操作逐项delta取负，补偿净包数/净吨数均0 | `lifecycle-reverse.test.ts`、`document-lifecycle.spec.ts`及下方SQL |
| 出库误确认撤销 | confirmed→cancelled，保留原冻结/事实；新扫码/再冻结/再确认被拒，已收UUID同正文重放可用 | 同上；事实全字段前后相等 |
| 未入账入库作废 | pending→voided；无库存操作/流水，原号永久保留，新单不复用 | `lifecycle-guards.test.ts`及页面E2E |
| 未入账出库作废 | 仅无入账证据/事实/冻结/交接/下发风险的open单→voided；下发竞争不泄漏可继续作业的open单 | `lifecycle-guards.test.ts`、`lifecycle-races.test.ts` |

### U 指标达成

| 指标 | 基线与方法 | 本批实测/限制 |
| --- | --- | --- |
| 自助纠错与恢复 | 原型无入口，旧ERP耗时待实测；浏览器原详情→核对抽屉→填原因→提交 | 不用重建原单；注入审计失败后原因保留、原键恢复200；不宣称提速百分比 |
| 可核对的补偿 | 浏览器核对当前值/delta/后值；SQL独立算包数与DECIMAL吨数 | 原+补偿净0，每对操作数2；前后值、操作关联、终态、库存末值4组mismatches均0 |
| 布局与终态可见 | 1440/1280截图与页面scrollWidth断言；截图关闭有限动画并回到页顶 | 预览、阻断、作废和终态均留证；常驻原因/原操作/补偿ID；不以截图替代业务断言 |

### N 已批准清单

| 项 | 结论 |
| --- | --- |
| 新增业务能力 | 无；未实现实物退货、更正、盘点、报表、打印或移动端新功能 |

### 四条验收的原始证据

两类各20个**首次**HTTP并发来自API测试；浏览器另验证提交成功后20并发重放，二者不混称为同一场景。

```text
B2A_CONCURRENCY kind=inbound requests=20 statuses=200,200,200,200,200,200,200,200,200,200,200,200,200,200,200,200,200,200,200,200 compensation=1 stock=6/1.8000
B2A_CONCURRENCY kind=outbound requests=20 statuses=200,200,200,200,200,200,200,200,200,200,200,200,200,200,200,200,200,200,200,200 compensation=1 stock=6/1.8000
B2A_UI_RECOVERY reason_preserved=true same_key=true failed_transaction_unchanged=true retry=200
B2A_E2E dependency=409 all_tables_unchanged=true blocker_visible=true void_stock_unchanged=true void_journal=0
B2A_MULTILINE second_product_failure=true first_product_rollback=true all_tables_unchanged=true same_key_recovery=success
```

原始日志：`.local/evidence/b2a-full-test.log`、`b2a-full-e2e.log`。故障通过随机临时MySQL库的真实AFTER触发器注入，生产代码没有故障开关。入/出库分别在`inventory_operations → stock → stock_journal → 单据 → document_closures → operation_log → idempotent_commands`七处失败，均500、`partial_writes=0 database_unchanged=true`，原键恢复200；多商品第二笔失败时第一笔也回滚。检查全部表行指纹，不仅比较行数。MySQL自增计数器允许留下未提交空隙，不将空隙冒充残留业务行。

依赖验收覆盖后续入库/出库/手工调整、库存余额缺口、原证据缺失、预览过期、历史只读、空原因422、两个移动通道403。PDA四种计划读取路径均记下发，10轮“读取与作废”并发不会同时得到open计划与成功作废；仅Web读取不误标。各拒绝场景前后行指纹不变。

### 可执行 SQL 与结果

SQL：[`scripts/sql/verify-document-lifecycle.sql`](../scripts/sql/verify-document-lifecycle.sql)，由E2E逐条真实执行于3307随机临时库；命令`npx playwright test tests/e2e/document-lifecycle.spec.ts`可重建夹具、重跑SQL并保留JSON。不能拿没有补偿的样本库0行结果代替净零验收。

| 核对 | 实际结果 |
| --- | --- |
| 原操作＋补偿，按原单/仓/商品汇总 | 所有行`packages_net=0, tonnes_net=0.0000, operation_count=2, balanced=1` |
| 新流水前后值与delta | `mismatches=0` |
| 补偿类型、原操作及原单关联 | `mismatches=0` |
| 终态、作废无库存操作 | `mismatches=0` |
| 库存与最后有效流水后值 | `mismatches=0` |

逐行原始JSON：`.local/evidence/b2a-inbound-sql.json`、`b2a-outbound-sql.json`；只使用合成夹具，真实业务数据未写入断言或文档。

### 008 迁移、恢复与回退

```text
B2A_RESTORE all_tables=30 fingerprints_equal=true
B2A_MIGRATION business_tables_unchanged=29 missing_exposure=0 counts={"inbound_receipts":"115","outbound_orders":"415","stock":"122","stock_journal":"828","scan_facts":"0","catalog_entries":"9018"}
B2A_SAMPLE_DOWN Error: 拒绝回退：outbound_plan_exposures 含有数据，禁止删除历史数据 unchanged=true
B2A_LOCAL_008 applied=true
```

输出摘自`.local/evidence/b2a-local-migration.log`。停本地写服务后备份，先恢复独立库并核对30表指纹，再演练008、拒绝非空down，最后升级本地3307开发库；原29业务表未改。样本事实数0，不冒充非空真实队列验收。备份路径/SHA见FOUNDATION_MIGRATION；空库down/up及旧结构拒绝启动由`lifecycle-migration.test.ts`验证。有业务数据时只可保留兼容读取、禁用入口/前向修复，不直接down删记录或回退到可能重开原单的旧包。

### 测试与审查

`npm run test`原始摘要：`tests 104 / pass 104 / fail 0`，包括API及小程序既有测试；`npm run build`退出0，严格类型检查及Web构建通过（`Compiled successfully in 16.95s`）。日志分别为`.local/evidence/b2a-full-test.log`、`b2a-build.log`。Ant Design检查0 issues，审查记录`b2a-review.md`。

`npm run test:e2e`完整运行退出0：主套39项、目录套9项，合计48项全部通过，无跳过。主套包含本批5项和全部既有列表/导出/编号/确认/用途隔离；目录套覆盖上传、混版原单续扫与交接门禁。完整原始输出见`.local/evidence/b2a-full-e2e.log`，重跑次数不累计为新用例数。

回归中修正三处测试顺序耦合：新B2a复用隔离库会话，不消耗原登录UI套件额度；编号撞号按真实下一号构造，不写死0010；库存页按分页逐格对照独立ERP全量结果，不假设全量永远少于一页。007迁移用例显式固定007，仍验证其自身up/down。生产限流和库存查询业务均未修改，原失败日志另存`b2a-full-e2e-before-isolation-fix.log`、`b2a-full-e2e-before-pagination-fix.log`。

### 截图与范围

以下每项均有`-1440.png`和`-1280.png`，位于`.local/evidence/`，不进Git：`b2a-inbound-reverse-preview`、`b2a-inbound-cancelled`、`b2a-outbound-reverse-preview`、`b2a-outbound-cancelled`、`b2a-dependency-blocked`、`b2a-void-preview`、`b2a-voided`。

仅更新OpenAPI声明源码，生成物留独立提交；未新增依赖、未改PDA APK/小程序代码、未连接生产/3306/warehouse、未清理真实队列。实体设备、生产验收未测。B2b更正、历史纠错、已扫出库作废、实物退货、盘点、报表仍未做；打印继续延后，依赖积木报表配置。

## B1b-2：四个 Web 列表 XLSX 导出（2026-11-08）

本节为本批当前状态，下方B1b-1等记录保留当时范围。仅Web四列表导出；CSV未做（可选）、打印留B1b-3；无库存/目录逻辑或迁移改动。全部写测试使用3307随机临时库、合成夹具；未访问生产、3306或warehouse。WPS实开不等同Microsoft Excel实开；后者本机未发现，明确未测。

### P 覆盖率（本批导出4/4，不等于全项目P完成率）

| 页面 | 已跑通的导出范围 | 内容与边界 | 证据 |
| --- | --- | --- | --- |
| 入库 | 全筛选240 / 当前页40 / 跨页选择2 | 单据一行、明细摘要；包数/吨数独立；原状态与入账状态并列 | E2E: `tests/e2e/web-exports.spec.ts` |
| 出库 | 240 / 40 / 2 | 计划与实扫分列，未知状态保留说明及原文 | E2E: `tests/e2e/web-exports.spec.ts` |
| ERP库存 | 240 / 40 / 2 | 只认erp-product，合计为本次范围，不把全筛选小计混成当前页/选中合计 | E2E + API: `apps/api/tests/web-export-integrity.test.ts` |
| 操作日志 | 240 / 40 / 2 | 只导出可见数据列；前后JSON仍在详情，未冒充屏幕字段导出 | E2E: `tests/e2e/web-exports.spec.ts` |

### U 指标达成

| 指标 | 基线 | 本批证据/结果 |
| --- | --- | --- |
| 逐字段一致 | 原型无导出 | 浏览器真实DOM读取，再打开下载XLSX逐格独立比对；四页三范围12组 + 列隐藏重排1组，目标及实测0差异；各组文件/JSON保存在`.local/evidence/b1b2-*-verified.xlsx/json` |
| 字段顺序与格式 | 无统一导出 | 首列身份保留，按实际可见列顺序；中文、前导零、换行、公式前缀按文本；包数number、吨数`0.0000`、日期Date+上海时间；所有合计与面板/逐行求和一致 |
| 操作与恢复 | 无导出流程 | 默认全部范围：打开→生成→下载3次点击，改范围另加1次；非模态面板可关闭，UUID同键复用；第二任务409明示；失败/取消不开放部分文件 |
| 响应式 | 原查询壳基线保留 | 4页×1440/1280截图及页面横滚0断言；下载按钮在两档首屏内，预览表仅表内滚动；原列表E2E回归结果见下方 |
| 大数据完整性 | 无10万行导出基线 | 10k和100k四页均流式读回每条标识符，顺序正确、末条命中、重复0、截断false；耗时与内存见下表 |
| 应用实开 | 无真实文件 | WPS 12.1.0.29690打开四类实际导出，中文/日期/四位吨数/合计可读；入库40条=80包/24.0000吨；Microsoft Excel未测 |

### N 已批准清单

| 项 | 本批结论 |
| --- | --- |
| 新增业务能力 | 无；仅已批准B1b-2导出。最新授权允许新增一个服务端XLSX依赖，不推进其他N、B1b-3或移动端导出 |

### 逐字段对比与故障原始输出

| 页面 | all / page / selected 比较单元格数 | 各组差异 | 合计示例（all / page / selected） |
| --- | --- | --- | --- |
| 入库 | 2160 / 360 / 18 | 0 / 0 / 0 | 包数480/80/4；吨数144.0000/24.0000/1.2000 |
| 出库 | 2400 / 400 / 20 | 0 / 0 / 0 | 计划包数480/80/4、吨数144.0000/24.0000/1.2000；实扫均0 |
| 库存 | 1200 / 200 / 10 | 0 / 0 / 0 | 包数480/80/4；吨数144.0000/24.0000/1.2000 |
| 日志 | 1200 / 200 / 10 | 0 / 0 / 0 | 仅记录条数，不虚造数值合计 |
| 隐藏/重排 | 出库180 | 0 | 隐藏客户、时间前移，文件表头/每格跟随实际DOM |

以下摘自`.local/evidence/b1b2-test.log`；write为第1000条之后异常注入，并非声称物理磁盘已写满。测试只开放代码级钩子，HTTP没有故障注入开关。

```text
B1B2_CONCURRENT {"busyStatus":409,"busyMessage":"已有导出在进行，请查看进度或取消后再试","snapshotLastPackages":2,"databaseLastPackages":99,"rows":1200,"retrySameSha":true}
B1B2_FAILURE {"failure":"write","state":"failed","processed":1000,"total":1200,"downloadStatus":409,"bytes":0}
B1B2_FAILURE {"failure":"cancel","state":"cancelled","processed":1000,"total":1200,"downloadStatus":409,"bytes":0}
B1B2_RECOVERY {"readySurvivesRestart":true,"interrupted":"EXPORT_INTERRUPTED","partialRemoved":true,"corruptRejected":true,"downloadStatus":200}
B1B2_GUARDS {"illegalColumn":422,"crossSource":422,"changedRetry":409,"empty":"EXPORT_EMPTY"}
B1B2_TEXT {"formulaCount":0,"leadingZeroPreserved":true,"unicodeAndNewlinePreserved":true}
```

重启恢复验证通过重建导出服务、载入持久任务和未完成part进行，不冒充真实断电演练。并发更新在首1000条之后，将末条库存从2包改成99包；文件仍为原快照2包。无效/匿名/移动端分别422/401/403，旧业务接口回归保留。

### 性能实测

生产构建、Windows本机回环、3307 MySQL、同进程API+测试驱动；每批1000条，前端最多预览20条。heap/RSS为整个Node进程（含测试驱动），每20ms采样，不是纯writer内存，也不含浏览器/数据库进程。每类规模各跑一次，生成中实际翻页次数见表；少于30次的p95只代表小样本，不能当稳态容量承诺。文件下载另计，毫秒；每份完整文件仅数MiB，生产代码没有全量rows数组。验收reader逐行读回全部记录。

| 记录数 | 页面 | 生成秒 | 下载ms | heap起点→峰值MiB | RSS峰值MiB | 翻页次数 | 翻页p95 ms | 已核对末条 |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 10,000 | 入库 | 1.343 | 11 | 132→139 | 303 | 5 | 372 | WL-RK-009999 |
| 10,000 | 出库 | 1.404 | 8 | 108→156 | 311 | 5 | 517 | WL-CK-009999 |
| 10,000 | ERP库存 | 0.853 | 6 | 124→183 | 332 | 3 | 535 | WL-P009999 |
| 10,000 | 日志 | 0.421 | 5 | 153→184 | 341 | 1 | 203 | WL-R009999 |
| 100,000 | 入库 | 36.054 | 24 | 164→268 | 465 | 30 | 481 | WL-RK-099999 |
| 100,000 | 出库 | 23.428 | 20 | 183→233 | 464 | 30 | 432 | WL-CK-099999 |
| 100,000 | ERP库存 | 33.947 | 14 | 175→248 | 464 | 30 | 1112 | WL-P099999 |
| 100,000 | 日志 | 6.174 | 14 | 250→306 | 499 | 30 | 265 | WL-R099999 |

10k生成<10秒、100k生成<60秒、行数与逐条顺序硬断言全部通过。**不宣称所有场景翻页<500ms**：100k库存p95=1112ms，10k出库/库存小样本分别517/535ms；生成期间可继续操作，但上述响应目标未完全达成。此前B1b-1万级稳态基线与本轮并行导出压力不同。库存首次122.351秒未达生成目标；定位为每批重复总数/库存小计后，仅在同一导出快照内复用这些值，降为33.947秒；保留`b1b2-performance-100000-before-cache.log/json`，不覆盖失败证据。

原始数据：`.local/evidence/b1b2-performance-10000.log/json`、`b1b2-performance-100000.log/json`。复现：`npm run build`后分别运行 `npx tsx scripts/verify-export-performance.ts 10000` / `100000`，脚本只允许这两种规模并只写随机临时库。

### 依赖与审查

ExcelJS **4.4.0 / MIT**；npm压缩包4,716,975字节（约4.50MiB）、解包21,825,509字节（约20.81MiB）；当前完整依赖闭包（含复用包）194个物理包、36,376,316字节（约34.69MiB），不是全部新增体积。扫描无`.node`、binding.gyp或安装脚本；只加API依赖，浏览器不打包ExcelJS。使用stream.xlsx.WorkbookWriter、逐行commit、禁用sharedStrings，100k不整体读入内存。原始扫描`b1b2-exceljs-package.json`、`b1b2-dependencies.json`。

`npm audit --omit=dev`记录3项moderate、0 high/critical：既有csv-parse、ExcelJS及其uuid传递告警（后两者同一链）。uuid告警针对v3/v5/v6外部buffer，ExcelJS源码仅在条件格式调用v4，本功能不写条件格式，也不解析用户上传XLSX；不宣称依赖已修复或零告警。审计输出`b1b2-npm-audit.json`，审查记录`b1b2-review.md`；未借本批升级无关依赖。

### 测试、截图与回滚

`npm run test`原始摘要：tests 93 / pass 93 / fail 0（`.local/evidence/b1b2-test.log`）。全量E2E 34+9=43项全部通过；最后仅将下载按钮移至预览上方、增加首屏可见断言，再跑全部5项导出E2E和构建。13组共1148条记录、8358个单元格，差异0。以下为实际原始摘要，不把重跑5项累计成48个不同用例。

```text
npm run test
ℹ tests 93
ℹ pass 93
ℹ fail 0

npm run test:e2e
34 passed (3.5m)
9 passed (1.4m)

npx playwright test tests/e2e/web-exports.spec.ts
5 passed (52.3s)

npm run build
√ Webpack: Compiled successfully in 15.43s
```

完整日志：`.local/evidence/b1b2-test.log`、`b1b2-e2e-final.log`、`b1b2-e2e-export-final.log`、`b1b2-build-final.log`。最终导出E2E更新全部8张浏览器截图及13组verified文件；构建包含API/Web严格类型检查。Browserslist数据库过期提示仍存在，本批未升级无关依赖。

- 浏览器：`.local/evidence/b1b2-{inbound,outbound,stock,audit}-preview-{1440,1280}.png`，包含三范围、字段、预览及范围合计。
- WPS实开：`b1b2-wps-inbound.png`、`b1b2-wps-inbound-total.png`、`b1b2-wps-outbound.png`、`b1b2-wps-stock.png`、`b1b2-wps-audit.png`；实际文件为对应不带verified后缀的早期验收产物，字段和格式与最终实现相同；避免覆盖用户正在WPS查看的文件，最终自动下载另存`*-verified.xlsx`并再次核对。
- 截图/日志/XLSX均在`.local/evidence/`忽略目录，不入Git，没有更新docs/evidence已批准图片。
- 无数据库迁移；revert本批源码/依赖提交即可撤回导出，已有库存/目录/作业队列不受影响。单进程锁不支持多API实例协调，多实例部署须另设计；文件24小时到期在启动/新建任务时清理。
- OpenAPI只更新声明源码，生成物留独立提交。CSV未实现、B1b-3打印未开工、Microsoft Excel实开未测；不进入下一批。

## B1b-1：四个 Web 列表的统一查询与布局（2026-11-08）

仅实现三批中的第一批：入库/出库/ERP库存/操作日志的共用查询壳、服务端分页和交互。B1b-2 导出、B1b-3 打印尚未实施，不以本节验收代替。没有新增依赖/迁移，不改库存、目录、PDA或小程序业务；所有写测试使用3307随机临时库。代码和本地浏览器已验证，公网、生产、打印机及实体设备不在本批。

### P 覆盖率（本批4个列表查询范围4/4；不是全项目P完成率）

| 页面 | 本批已跑通 | 仍未完成 | 证据 |
| --- | --- | --- | --- |
| 入库 | 单号/登记日期/状态/供应商/仓库/入账状态筛选、排序、分页、列设置、返回上下文 | 导出、打印；撤销/作废/更正属B2 | E2E: web-lists.spec.ts；web-list-preferences.spec.ts |
| 出库 | 单号/建单日期/状态/客户/仓库/车牌；计划与实扫独立摘要，选择和原上下文返回 | 导出、打印；无批量库存确认 | E2E: web-lists.spec.ts |
| ERP库存 | 商品/仓库筛选、稳定分页、同筛选全量小计；原调整及最近流水保留；拒绝错源 | 导出、逐行流水过滤；预警后置 | E2E: stock-source.spec.ts；inventory-posting.spec.ts；web-lists.spec.ts |
| 操作日志 | 时间/action/对象/traceId、完整分页、前后值详情；Esc关闭 | 导出、在线会话页；没有结果码字段，不推测成功/失败 | E2E: web-lists.spec.ts；API: web-lists.test.ts |

四页统一使用 BusinessList + QueryFilter + ProTable：20/50/100/200行，列设置按页持久化；跨页/排序保留选择，筛选改变清空；未知/null状态保留原文。日期查询采用上海业务日的含首尾边界。统计/页面/摘要在同一数据库快照中读取；两组出库聚合不相乘。

### U 指标达成

| 指标 | 原型基线 | 本批实测/边界 |
| --- | --- | --- |
| 读查询成本 | 旧入库50行逐条取明细，10k数据p95 303.62ms | 新按页批量摘要p95 35.04ms；第200页37.27ms；每项30次，同机临时库 |
| 库存大列表 | 旧接口一次返回所有库存，查询p95 12.43ms | 新带同范围小计查询p95 84.88ms，查询成本增加；屏幕每次最多200行，不能称所有SQL提速 |
| 日志可达性 | 旧接口只返回最近100条 | 240条夹具分页200+40，万级完整查询p95 12.71ms；详情按需取JSON |
| 布局 | 旧原型四套做法、窄屏宽表 | 四页共用1套壳；四页200行、1440/1280页面横滚均0、pageerror均0；横滚仅限表内 |
| 操作连续性 | 旧返回列表丢上下文/列设置各自实现 | 详情返回URL筛选/页码/排序逐字一致；隐藏车牌刷新后保留；跨页选择2条、改筛选清空；Enter查询/Esc关抽屉已断言 |
| 恢复与口径 | 错误可能残留先前结果 | 四页加载/空态/错误重试/403均通过；ERP错源响应不展示记录/小计；原确认/调整故障回滚E2E全绿 |

最终生产构建 + 本机回环网络 + 3307 MySQL + 每列表10000条合成数据；1440×960、每页50行，每项30次新浏览器上下文（空缓存，复用已登录状态，不计手工登录时间）。首屏从导航开始到首行可见，翻页从点击到首行ID变化。脚本对p95 <1500ms / <500ms作硬断言；不代表公网或生产机器。

| 页面 | 首屏 p95（ms） | 翻页 p95（ms） |
| --- | ---: | ---: |
| 入库 | 1121.71 | 287.42 |
| 出库 | 1067.71 | 274.99 |
| 库存 | 1071.36 | 336.33 |
| 日志 | 1063.34 | 320.16 |

原始计时：`.local/evidence/b1b1-browser-performance-final.log`、`b1b1-browser-performance.json`；SQL计时和EXPLAIN：`b1b1-query-performance.log/json`。入库使用既有inbound_created、主数据eq_ref；日志仍filesort但10k p95 12.71ms，本批无008。真人步骤/耗时和更大数据量待实测，不捏造旧UI计时。

### N 已批准清单

| 项 | 本批结论 |
| --- | --- |
| 新增业务能力 | 无；仅已批准B1b-1共用列表能力，未开始导出、打印或其他N |

### 原始输出与SQL证据

```text
npm run test
ℹ tests 82
ℹ pass 82
ℹ fail 0

npm run test:e2e
29 passed (2.8m)
9 passed (1.3m)

npm run build
√ Webpack: Compiled successfully in 12.23s

B1B1_QUERY inbound=240 pages=200+40 unique=240 soft_deleted_lines_excluded=true status_raw=79 null=1
B1B1_AGGREGATION planned=3/0.7000 actual=2/0.6000 fanout=0 business_writes=0
B1B1_STOCK erp_rows=3 subtotal=24/7.2460 filtered_rows=1 source_guards=5x422
B1B1_AUDIT total=240 page2=40 before_after_detail=matched
B1B1_AUTH invalid=4x422 anonymous=401 mobile=10x403 legacy_contracts=unchanged
B1B1_PREFERENCES hidden_column_reload=preserved cross_page_selection=2 filter_change_selection=0
B1B1_STATUS unknown_raw=visible null_status=1 combined_filter=0
B1B1_SQL [{"rows_count":"10000","packages":"20000","tonnes":"6000.0000"}]
```

完整日志：`.local/evidence/b1b1-test.log`、`b1b1-e2e-final.log`、`b1b1-build-final.log`。首次全套新增用例重复登录触发429，原失败日志保留为`b1b1-e2e-login-limit.log`；仅列表测试改用临时库专用会话后全套38项通过，登录UI与限流代码未改。审查记录`b1b1-review.md`，新增代码文件均<200行，未增加.ant-*覆盖。

可复现SQL（由 `scripts/verify-list-performance.ts` 在隔离夹具库执行）：

```sql
SELECT COUNT(*) AS rows_count,SUM(packages) AS packages,SUM(weight_tonnes) AS tonnes
FROM stock
WHERE source_del_flag=0 AND product_code LIKE 'WL-P%';
-- rows_count=10000, packages=20000, tonnes=6000.0000
```

这组数字是合成夹具对账，不替代生产样本基线；没有重跑样本seed或写业务库。新端点的计划/事实汇总与原详情逐字段一致，库存来源守卫和旧/stock、/scan/plans契约另有实际断言。

### 截图与回退

| 页面 | 1440 | 1280 |
| --- | --- | --- |
| 入库 | [.local/evidence/b1b1-inbound-1440.png](../.local/evidence/b1b1-inbound-1440.png) | [.local/evidence/b1b1-inbound-1280.png](../.local/evidence/b1b1-inbound-1280.png) |
| 出库 | [.local/evidence/b1b1-outbound-1440.png](../.local/evidence/b1b1-outbound-1440.png) | [.local/evidence/b1b1-outbound-1280.png](../.local/evidence/b1b1-outbound-1280.png) |
| 库存 | [.local/evidence/b1b1-stock-1440.png](../.local/evidence/b1b1-stock-1440.png) | [.local/evidence/b1b1-stock-1280.png](../.local/evidence/b1b1-stock-1280.png) |
| 日志 | [.local/evidence/b1b1-audit-1440.png](../.local/evidence/b1b1-audit-1440.png) | [.local/evidence/b1b1-audit-1280.png](../.local/evidence/b1b1-audit-1280.png) |

八图均已逐张查看；截图不进Git，不用toHaveScreenshot。当前提交独立revert即可撤回新列表与只读接口，不执行down，B1a/B1c数据及事务保持原状。OpenAPI仅更新定义源码，生成物未混入；B1b-2/3与其屏幕/导出/打印一致性验收待下一批。

## B1c-2：PDA 本地目录版本、跨版本补传与旧队列交接（2026-11-08）

本批仅 B1c-2。代码、构建和隔离实体 M71 验证分别记录；不宣称现场实际队列、生产或厂商扫码枪已验收。M71 初查无本项目包，没有可盘点的本项目现场队列（不能据此将其他应用的队列记为 0）；75bdbbee 已由用户明确排除。非空迁移使用独立应用包制造 60 条旧队列：待补传 55、失败 5，其中 2 条服务端已收到而本机未收到响应，丢响应数须联网比对，不是额外 2 条。

### P 覆盖率（本批四组 4/4；不代表全项目/生产验收）

| 组 | 实际结果 | 原始证据 |
| --- | --- | --- |
| G1 离线与刷新 | API 不可达下新扫 100；Room 重开后正文与 context 100/100；刷新失败后第 101 条可扫；坏 SHA / head 失败保持 v1 | `.local/evidence/b1c2-device-final-safety.log`；`OfflinePersistenceTest`、`CatalogSafetyTest` |
| G2 历史版与同单混版 | 同一原单 60 条 v1 + 1 条 v2；原 60 正文逐字一致、61/61 收妥；冻结 18.3020 吨后由 Web 语义确认；另一单 101 条离线 v1 在 v2 发布后接收；未知版本冲突保留、不阻塞另一合法记录 | `b1c2-device-readback.log`、`b1c2-device-mixed.log`、`b1c2-device-output.log`、`b1c2-server-reconciliation.log` |
| G3 旧队列与门禁 | 60 完整清单，2 已收妥/58 未收妥；58 条一次用户批量操作绑定原单行；60/60 收妥确认后门禁放行；新旧协议活动重新阻断；跨单绑定、改正文/context 均拒绝 | `b1c2-test-final.log`、`b1c2-e2e-final.log`、`catalog-handoff.spec.ts` |
| G4 迁移与回退 | 实际 Room 写入后/commit 前强停，旧 APK 可开原队列、60/60 正文与原冻结 key 不变；007 空表 down/up，非空拒绝；006-only 启动被拦 | `b1c2-migration-interruption.log`、`b1c2-old-queue.png`、`b1c2-test-final.log` |

### U 指标达成（只报告实测范围）

| 指标 | 原状态/目标 | 本批实测与边界 |
| --- | --- | --- |
| 批量交接 | 逐条核验会随条数线性点击 | 58 条待归属按原单一次批量动作，自动按 100 条请求分片；未测万级人机耗时 |
| 离线可靠性 | 刷新失败不得影响已扫/后续扫码 | 100/100 重开保留，失败后第 101 条成功；真实硬件扫码连续速度/焦点未测 |
| 历史事实不变 | UUID/正文/版本/重量变化为 0 | M71 原 60 条原文逐字比对 60/60；同单增加 v2，无重建单据 |
| 可恢复性 | 错误记录不能静默丢失 | 未知版本 409，原正文重开仍在；合法 v1 独立成功；错误 SHA/事务失败都不切本地 head |
| 可解释门禁 | 能看到剩余设备和记录 | 1440/1280 截图显示设备、完整清单、已/未收妥、待归属、客户端活动与确认条件；从未联网设备仍需人工盘点 |

### N 已批准清单

| 项 | 结论 |
| --- | --- |
| 本轮新增能力 | 无；B1c-2 是已批准目录/PDA 对齐范围，未进入 B1b/B2 或其他 N |

### 原始输出摘录（完整日志在 .local/evidence，不进 Git）

```text
B1C2_OFFLINE network=unreachable scans=100 durable_after_reopen=100/100 contexts=100/100 refresh_failed=true subsequent_scan=101 head=v1
B1C2_LOCAL_TRANSACTION failed_head=rolled_back v2_entries=0 v2_metadata=0 head=v1 facts=unchanged
B1C2_CATALOG corrupt_hash=refused active_version=1 subsequent_offline_scan=success concurrent_handoff_20=one_manifest
B1C2_RECHECK incomplete_manifest=retained confirmed_manifest=new_snapshot
B1C2_DEVICE_READBACK original_raw_payloads=60/60 identical=true received=61/61 pending=0 failed=0 conflict=0
B1C2_CONFLICT unknown_version=409 retained_after_reopen=true original_body=unchanged other_valid_v1=accepted_after_v2
B1C2_OLD_APK UI original_queue_text=60/61 rendered=true
B1C2_OLD_APK reopened schema=1 total=60 pending=55 failed=5 raw_payloads=60/60 freeze_key=unchanged
B1C2_DOWN_ACTUAL 拒绝回退：pda_handoff_clients 含有数据，禁止删除历史数据
B1C2_MIGRATION 007 empty_down_up=success
B1C2_HANDOFF rollback_registered=0 pda_miniapp_confirm_adjust=403
```

- `npm run test`：77 tests / 77 pass / 0 fail；原始 `b1c2-test-final.log`。
- `npm run build`：严格类型检查与 Web 编译通过；原始 `b1c2-build-final.log`。
- `npm run test:e2e`：16 passed + 9 passed（共 25），原始 `b1c2-e2e-final.log`；截图列宽微调另定向复跑交接用例，见 `b1c2-handoff-visual-final.log`。
- Android `assembleDebug testDebugUnitTest lintDebug`：BUILD SUCCESSFUL；3 个单元测试，lint 0 errors / 25 warnings（主要既有硬编码显示文案等，未将警告写成零）；原始 `b1c2-android-final.log`。
- 实体仪器：最终安全复测 `OK (3 tests)`；另按阶段实测升级、旧队列补传、离线、同单混版、冲突/UI、迁移中断。完整执行顺序见 `scripts/pda/README.md`，不能将有状态阶段测试随意在原队列上重跑。
- `antd lint apps/web/src/features/catalog --format json`：0 issues；未引入依赖或 `.ant-*` 覆盖。OpenAPI 仅更新源操作定义，生成物不混入此提交。

### SQL 与备份核验

执行 `npx tsx scripts/pda/verify-server-sql.ts`，SQL 源为 `scripts/sql/verify-pda-handoff.sql`，完整实际输出 `b1c2-server-reconciliation.log`。隔离数据结果：原单 v1 60/18.0000 吨、v2 1/0.3020 吨；另一单 v1 102/30.6000 吨（101 离线记录 + 冲突验证中的 1 条合法记录），全部 context_mismatches=0。出库流水 500→439 包、150.0000→131.6980 吨，delta=-61/-18.3020，delta_matches=1。PDA 仅上传/冻结，扣减由独立 Web 确认服务测试产生。

开发初测发现 worker 与手动交接竞态，产生两份对应相同 60 UUID 的清单；修复为共享 mutex + Room 原子 firstHandoff。历史清单均保留并收妥确认，未删证据；SQL 按事实 UUID 统计仍是 60，不按两份清单重复加总。20 并发本地回归实际仅一份，后续已确认清单只能明确重新清点产生新的头。

本地样本库 007 前先备份并恢复到新库逐表比对，迁移后原表指纹完全一致：目录 9018、入库 115、出库 415、库存 122、流水 828；原库会话不变。样本事实为 0，非空兼容由实体合成队列另证。证据 `b1c2-local-backup.log / b1c2-local-restore.log / b1c2-local-migration.log`，备份 SHA 与回退边界见 `FOUNDATION_MIGRATION.md`。

### 截图与验收限制

- Web：`b1c2-handoff-blocked-{1440,1280}.png`、`b1c2-handoff-records-{1440,1280}.png`、`b1c2-handoff-ready-{1440,1280}.png`，页面级无横滚断言；交接表仅内部滚动且操作列固定。
- M71：`b1c2-mixed-pda.png`（原单混版）、`b1c2-version-notice-pda.png`（已接受 v1、当前 v2 改重提示）、`b1c2-old-queue.png`（中断后真正运行的旧 APK）。都是隔离合成数据截图，存 `.local/evidence/`。
- 未验收：真实生产队列、厂商扫码枪/广播/功能键、真实现场网络切换与跨天弱网、生产上线。100 包是实体设备上的仓储层自动录入与落盘测试，不冒称人工扫码枪 100 次测试。
- 成功 Room 2 迁移后不得安装只识别 schema1 的旧 APK；已承载交接数据的 MySQL 不得 down。只能保全队列后前向修复；未提交迁移回退是另一明确边界。


## B1c-1：目录版本化服务端与 Web 上传（2026-11-08）

本节保留 B1c-1 原批次验收记录。A 方案落地为不可变整版目录、当前指针和不可变事实上下文；只验收服务端与 Web，PDA 客户端仍属 B1c-2。未进入 B1b/B2；未新增依赖；未连接生产、3306 或 warehouse。目录重量只用于解析/核对，不计库存、单据计划或经营统计。

### P 覆盖率（本批 6/6；不代表完整 PDA 功能或全项目完成）

| 本批范围 | 本地结果 | 证据与边界 |
| --- | --- | --- |
| 完整上传、差异预览、发布、版本历史 | API/E2E 通过 | 新增/消失/改重分别计数及明细；坏文件整版拒绝；候选与发布各自原子；当前版只由发布切换 |
| 重复内容产品规则 | API/E2E 通过 | 与任一完整历史版本内容 hash 相同时默认不建版；页面“与第 2 版内容一致”；显式确认后才重建，hash 非全局唯一 |
| v1 迁移与旧名只读 | SQL/真实 DML/启动校验通过 | 9018 逐行及重量一致；旧名不可更新视图、封存表三种写入触发器；旧接口固定 v1 |
| 已扫事实与原单混版 | API/E2E 通过 | 同单 [1,1,2]；发布不改旧事实/摘要；发布零条 v3 后原单仍确认；冻结/确认查询中目录读取为 0 |
| 可执行发布门禁与渠道限制 | API/E2E 通过 | 显式开关 + 006/context 完整 + 旧协议活动/待交接计数为 0；旧请求即持久阻断；PDA/小程序上传发布 403 |
| 失败恢复及历史保全 | API/E2E/恢复演练通过 | 上传/发布各 4 个故障阶段整事务回滚；丢响应核验；空库 down/up，非空及已发布零条版均拒绝 down |

### U 指标达成

| 指标 | 实际结果 | 测量方法与边界 |
| --- | --- | --- |
| 重复上传版本增量 | 0；版本数 2→2 | 浏览器上传相同文件并查 MySQL；弹出二次确认之前及默认操作均不增版 |
| 发布后的旧事实/摘要变更 | 0 | 同单混版用例逐列比较、旧 Detail 全字段比较；原单无需重建 |
| 上传/发布故障留下半套数据 | 0 | 真实 MySQL 触发器故障注入，对照全表快照；失败原键可重试 |
| 9018 行解析+差异+候选提交 p95 | 176.88ms（目标 <10s） | `scripts/verify-catalog-performance.ts`，本机 3307 独立库 20 次；不包含网络传输/PDA 同步 |
| 发布事务 p95 | 25.97ms（目标 <500ms） | 同一脚本 20 次；不是生产并发/网络性能承诺 |
| Web 1440 / 1280 | 无页面横向溢出；主发布按钮首屏可见 | Playwright DOM 断言及截图人工检查；抽屉等待完全展开后截图，不做视觉基准断言 |

### N 已批准清单

| 新增候选 | 本轮处理 |
| --- | --- |
| 无 | 本批为旧 PDA SKU 管理的服务端/Web 对齐基础，不将版本化另标 N；客户端尚未完成 |

### 测试、SQL 与原始输出

- `npm run test`：**75 passed / 0 failed**，`.local/evidence/b1c1-test-final.log`。含实际 MySQL、旧契约、小程序模块、历史事实、各阶段回滚和只读拒绝。
- `npm run test:e2e`：既有 16 条 + 目录 8 条，原始输出 `.local/evidence/b1c1-e2e-final.log`；目录用例在 `tests/e2e/catalog-versioning.spec.ts`、`catalog-upload-errors.spec.ts`、`catalog-ui-states.spec.ts`。每例独立 3307 临时库；协议用 PDA 身份请求，不能等同 Android 离线验收。
- `npm run build`：严格类型检查与 Web 构建通过，退出 0，`.local/evidence/b1c1-build-final.log`。AntD 检查 0 issues，`.local/evidence/b1c1-antd-lint-final.json`。OpenAPI 源码 9 个新路径校验通过，未写生成物，`.local/evidence/b1c1-openapi-check.log`。
- 可执行 SQL：[verify-catalog-versioning.sql](../scripts/sql/verify-catalog-versioning.sql)。它用封存表 `scan_catalog_v1_archive` 双向核对 entries v1，不用迁移后的兼容视图做自比。`npx tsx scripts/verify-catalog-migration.ts` 从本地只读样本导入临时 005 库并执行 006，结果见 `.local/evidence/b1c1-sample-initial.log`。

| 核对指标 | 迁移前 | 迁移后 |
| --- | --- | --- |
| v1 条目 / 规格 | 9018 / 141 | 9018 / 141 |
| v1 校验用吨数 | 2707.9025 | 2707.9025 |
| 缺失或变化 / 多出条目 | 基线 | 0 / 0 |
| 样本事实 / 冻结记录 | 0 / 0 | 0 / 0 |
| context 缺失或重量版本不符 | 基线 | 0 |
| 旧业务行指纹 | 基线 | 全部相同，未重 seed |
| 非空合成历史事实 | 2 / 0.6000 吨 | 2 / 0.6000 吨；原摘要、正文相同，原冻结凭据确认成功 |
| 混版验收事实分布 | v1 两条 | v1 两条 + v2 一条；合计 0.9000 吨，仅为事实验收值 |

以下为实际测试输出摘录；完整日志保留 `.local/evidence/`，不提交业务原始行或截图：

```text
B1C1_READ_ONLY INSERT Error: The target table scan_catalog of the INSERT is not insertable-into
B1C1_READ_ONLY UPDATE Error: The target table scan_catalog of the UPDATE is not updatable
B1C1_READ_ONLY DELETE Error: The target table scan_catalog of the DELETE is not updatable
B1C1_MIGRATION empty_down_up=success
B1C1_MIGRATION zero_entry_published_down=refused versions_unchanged=true readiness=passed
B1C1_MIGRATION nonempty_down=refused unchanged=true
B1C1_CONTEXT same_uuid_changed_context=409 cross_version_barcode=409 freeze_confirm_catalog_reads=0
B1C1_E2E_DUPLICATE versions_before=2 versions_after=2 message=与第 2 版内容一致 explicit_confirmation_creates=3
B1C1_E2E mixed=[1,1,2] old_facts_unchanged=true old_digest_unchanged=true empty_v3_confirm=success
```

- 封存表写入另断言 `SCAN_CATALOG_READ_ONLY`；没有开放绕过写入口。只读测试与非空事实迁移在 `apps/api/tests/catalog-migration.test.ts`，可单独 `npx tsx --test apps/api/tests/catalog-migration.test.ts` 复跑。
- 本机样本库备份并恢复到新库核验后执行 006；中途触发器权限失败按实际结构续作，最终 applied。原始失败、结构检查与恢复记录见 `FOUNDATION_MIGRATION.md`；最终 `.local/evidence/b1c1-local-migration-recovered.log` 中 `all_old_rows_unchanged=true`，非空 down 输出“拒绝回退：catalog_entries 含有数据，禁止删除历史数据”。未改全局权限或 binlog。
- `npx tsx scripts/verify-catalog-restore.ts`：`.local/evidence/b1c1-restore-drill.log` 记录 `versions=2 facts=2 mixed_versions=[1,2] source_bytes_sha=equal content_sha=equal all_rows=equal`。恢复目标始终是新隔离库，未覆盖开发库；已实际验证原文件字节、目录内容及上下文，而非仅检查备份文件存在。
- `npx tsx scripts/verify-catalog-performance.ts C:\Users\qq113\Desktop\sku.txt`：原始输出 `.local/evidence/b1c1-performance.log`。该脚本仅在随机测试库运行，不在开发库发布样本目录。

### 截图与未做项

上传、差异、历史、重复提示、发布门禁、坏文件、故障恢复各有 **1440 / 1280**：`.local/evidence/b1c1-{upload,diff,history,duplicate,gate,invalid,rollback}-{1440,1280}.png`。均为合成验收数据，不进入 Git。初次历史截图处于抽屉动画中途，已改为等待完整进入视口并关闭截图动画，再重新截图；不把裁切图片当最终证据。

开发样本库仍默认关闭 `CATALOG_PUBLISH_ENABLED`；零旧请求不能证明离线设备无待传队列，必须清点并在 B1c-2 交接后放开。旧协议活动不自动清零，本批无解除门禁接口。没有实施 PDA 客户端、B1b、B2，也没有模拟器/实体设备/生产验收。错版只能发布纠正版；非空库不可 down，已有 v2 事实后不可退回只理解 v1 的旧应用。OpenAPI 生成源码已更新，`docs/api` 生成物按约定留独立提交，本轮不混入。

## B1a 第 3 提交：确认入账与库存调整（2026-11-08）

本节保留该批次验收；仅正向入库确认、出库确认流水证据和 ERP 库存调整，该批未进入 B1b/B1c/B2。所有破坏性测试均使用 3307 随机临时库；真实数据只读取本地样本，不连接生产/3306/warehouse。

### P 覆盖率（本批 4/4，非全项目覆盖率）

| 范围 | 本地结果 | 证据与边界 |
|---|---|---|
| 入库创建→明确确认 | API/E2E 通过 | 创建库存不变；确认同键 20 并发只入账一次；新键重复确认拒绝；历史只读 |
| 出库确认前后值/类型/ID | API/E2E 通过 | 原 revision/digest/幂等协议保留；10 并发只扣一次；库存不足 409 全回滚 |
| 库存调整 | API/E2E/SQL 通过 | 原因必填 422；正负独立包数/重量；过期前值拒绝；同键重放；跨单调整不改单据明细 |
| 原子性与端权限 | API/E2E 通过 | 17 个写入阶段故障注入均完整回滚；PDA/小程序对入库确认、出库确认、调整各 403 |

### U 指标达成（本批范围）

| 指标 | 实测 | 测量方法 |
|---|---|---|
| 幂等重复库存变更 | 0 次 | 入库/调整各 20 并发同键，出库 10 并发同键；查询操作/流水与最终库存 |
| 事务失败残留 | 0 行 | MySQL AFTER trigger 在操作、库存、流水、状态、审计、幂等写入后抛错；比较全部相关表快照 |
| 失败恢复 | 原键可恢复，原输入保留 | 浏览器确认末段 500 后原键重试 200；调整不足 409 后保留原因/调整量 |
| 流水证据和库存对账 | 新操作差额错误 0、断链 0；历史 828/828 前后值相符 | 可执行 SQL 与样本迁移兼容脚本；无新增性能/录入耗时声明 |

### N 已批准清单

| 候选 | 本批处理 |
|---|---|
| 无新增 N 实施 | 撤销/作废/更正仍 B2；目录版本化仍 B1c；未扩展审批/多用户 |

### 原始测试、SQL、迁移和截图

- `npm run test`：**52 passed / 0 failed**，原始输出 `.local/evidence/b1a3-test.log`。包含 MySQL 真实事务、迁移、并发、源隔离、旧契约及实际小程序请求模块。
- `npm run test:e2e`：**16 passed**，原始输出 `.local/evidence/b1a3-e2e.log`。本批新增 `tests/e2e/inventory-posting.spec.ts`（4 条）及 `inventory-outbound.spec.ts`（1 条）；其余既有 11 条回归通过。
- `npm run build`：严格类型检查与 Web 构建通过，原始输出 `.local/evidence/b1a3-build.log`。`antd lint` 检查修改的入库/库存/标签与确认 hook，0 issues，输出 `.local/evidence/b1a3-antd-lint.log`。
- [`verify-inventory-posting.sql`](../scripts/sql/verify-inventory-posting.sql) 可只读执行：逐条 after-before=delta；按库存格验证首笔前值+全部已提交 delta=最新后值=当前库存，并检查相邻流水连贯。`inventory-reconciliation.test.ts` 实测 4 条新流水、mismatches=0、chain_breaks=0、balanced=1；浏览器跨单调整也执行同一 SQL。历史导入流水不重复作为新记账量累加。
- `npx tsx --test apps/api/tests/inventory-rollback.test.ts`：入库 6、出库 6、调整 5 个故障阶段；日志 `B1A3_ROLLBACK ... all_tables_unchanged=true`。故障仅存在临时数据库触发器，业务 API 无故障开关。
- `npx tsx --test apps/api/tests/inventory-migration.test.ts`：`005 down empty=success`；历史非空 up 保留原状态；非空 down 输出“拒绝回退：inbound_receipts 含有数据，禁止删除历史数据”或 inventory_operations，同步保留迁移 applied 和全部数据。没有删除历史来绕过门禁。
- `npx tsx scripts/verify-posting-compatibility.ts`：读取本地样本导入临时库执行 004→005；115 张入库、415 张出库原状态及库存指纹不变，828 条历史流水证据完整、delta 828/828 匹配；历史重复确认均拒绝。输出 `.local/evidence/b1a3-history.log`，不将原始业务行写进文档。
- 本机开发样本库已经备份后 up 至 005；备份文件大小/SHA、迁移状态和指纹一致性见 `.local/evidence/b1a3-local-migration.log`；恢复与非空回退限制见 `FOUNDATION_MIGRATION.md`。不把文件校验声明为本轮完整恢复演练。
- 截图均在 `.local/evidence/`：`b1a3-inbound-confirm-1440.png`、`b1a3-inbound-confirm-1280.png`、`b1a3-stock-adjustment-1440.png`、`b1a3-stock-adjustment-1280.png`。已检查主操作/前后值可见、无页面横向溢出；截图为合成验收数据，不进 Git。
- 首轮全量 E2E 发现夹具共享编号、正常登录审计计入写入比较、旧按钮名/加载图标影响定位；已调整夹具和精确验收范围，完整重跑通过。初始失败输出留 `.local/evidence/b1a3-e2e-first-full.log`、`b1a3-e2e-second-full.log`，丢响应重试单独复核输出 `b1a3-retry.log`。

本次没有实体 PDA、小程序真机或生产验收。OpenAPI 生成源码已同步；`docs/api` 生成物按约定留独立提交，本轮未混入。只完成这一个业务提交，后续批次等待放行。


## 用途隔离修正验收（2026-11-08）

当前业务口径：库存与单据只认 ERP 商品；sku.txt / sku-spec 是扫码目录，只属于 B1c 页面（未开发）。本次只纠正库存视图和相关证据，不改建单/确认写入行为、历史数据或 API 契约。

| P 覆盖项 | 本轮验证 |
| --- | --- |
| ERP 唯一库存视图 | E2E 检查无页签、无非 ERP 行/空表/占位，库存与流水请求固定 erp-product；包括出库确认后库存变化 |
| 防混源与兼容 | 保留拒绝 all/多来源/总计参数及严格契约；旧 stock 三渠道兼容继续回归 |
| 未归属诊断 | 只记结构化警告行数；不增加响应字段；连续同计数查询不重复警告 |
| 未知状态 | 原常驻说明保留；未知流水在 ERP 视图回归 |

| U 指标 | 证据 |
| --- | --- |
| 原 3 个库存入口→1 个 ERP 视图；非 ERP 请求/占位 0 | `tests/e2e/stock-source.spec.ts`；1440/1280 截图 |
| 错源响应显示 0、重试恢复 ERP | 同一 E2E 文件；加载/错误/空态/403 断言 |

| N 已批准清单 | 本轮处理 |
| --- | --- |
| 无 | 未实施新增能力，B1c 仅修正文档归属 |

实测结果：API/小程序测试 **40/40**、E2E **11/11**、严格类型检查与 Web 构建通过；AntD 检查 0 issues。原始输出：`.local/evidence/erp-inventory-test-output.txt`、`erp-inventory-e2e-output.txt`、`erp-inventory-build-output.txt`。新截图：`.local/evidence/erp-inventory-only-1440.png`、`erp-inventory-only-1280.png`、`erp-inventory-unknown-journal-1440.png`；均不进入 Git。截图是临时库合成夹具，不能代替实体设备或生产验收。

## B1a 第 2 提交验收：双来源不合计（2026-11-08）

> 以下保留原批次历史证据；其中 SPEC/未归属库存入口与相加数值验收已被上方用途隔离修正取代，不是当前验收口径。

仅本地 MySQL 8 / 浏览器验收。没有迁移、重跑样本 seed 或历史数据改写；未连接生产、3306 或 warehouse。本批源码与 OpenAPI 生成物分开提交。第 3 批事务调整、B1b 及四类报表仍未完成。

### P 覆盖率（本提交范围）

| 能力 | 结果 | 证据及边界 |
| --- | --- | --- |
| 库存来源隔离 | 已通过 API/E2E | source_kind 分组；无全部/总计入口；只挂载一个来源；未知/缺失主数据仅明细 |
| 来源内小计与流水 | 已通过 SQL/E2E | 来源必填、拒绝 all/多值/额外 total 参数；混源响应拒绝；软删事实排除；目录重量不入库存 |
| 旧调用兼容 | 已通过回归 | `/stock` 原数组不变；三渠道契约；实际小程序模块回归、PDA 扫码/冻结/确认链路继续通过 |
| 未知状态可理解性 | 已通过 E2E/截图 | 灰色“状态待识别：原文”及详情常驻解释/核对指引；出库确认禁用 |
| 报表 | 未实现 | 新单来源契约可复用；不能把契约验收计成四类报表完成 |

### U 指标达成

| 指标 | 实际结果 | 测量方法 |
| --- | --- | --- |
| 非零双源夹具跨源数字误显示 | 0 次 | ERP 18 包/5.4460 吨；SPEC 30 包/9.1440 吨；错误相加 48 包/14.5900 吨，在 SQL 候选值和真实 DOM 均 0 命中 |
| 来源切换时旧数字残留 | 0 | 延迟目标来源响应，断言旧数字已卸载；错源响应不显示；重试恢复本来源 |
| 无来源库存请求 | 0 | E2E 捕获本页所有库存/流水请求，均为 by-source 且 source 必填 |
| 四态与版面 | 通过 | 加载、空态、错误重试、403；1440/1280 截图检查，无页面横滚 |

### N 已批准清单

| 新增候选 | 本轮处理 |
| --- | --- |
| 无 | 无 N 能力实施 |

### 可执行 SQL、测试与截图

- [`scripts/sql/verify-stock-sources.sql`](../scripts/sql/verify-stock-sources.sql)：第一条按来源出小计；第二条仅用于验收，计算禁止展示的跨源值并与库存明细/小计/最近流水的包数、吨数逐项比对。业务查询不引用该验收总计。
- `npx tsx --test apps/api/tests/stock-source.test.ts`：在 3307 独立临时库建立两来源非零夹具，执行 SQL，打印 `B1A2_SQL`，结束后清理本次临时库。
- `npx tsx scripts/verify-stock-sources.ts`：固定读取本机样本库，使用 READ ONLY 事务；真实输出留 `.local/evidence/b1a2-sample-sql-output.txt`。
- **数学边界**：真实样本 SPEC 库存为零，因此 ERP+0 的数值必然等于 ERP 页面小计；真实 SQL 的 matches=1 是该巧合，不能宣称真实数据满足严格不等式。非零夹具 SQL 的两项 matches=0；来源参数、响应契约和实际 DOM 共同证明没有跨源计算路径。不把条码目录总重量伪装为 SPEC 库存。
- `npm run test`：39/39 通过，`.local/evidence/b1a2-test-output.txt`；包含既有幂等/事务/编号及实际小程序模块回归。
- `npm run test:e2e`：11/11 通过，`.local/evidence/b1a2-e2e-output.txt`；新的三个用例在 [`stock-source.spec.ts`](../tests/e2e/stock-source.spec.ts)，未知状态解释在 [`numbering.spec.ts`](../tests/e2e/numbering.spec.ts)。
- `npm run build`：类型检查与生产构建通过，`.local/evidence/b1a2-build-output.txt`；AntD 检查 0 issues，`.local/evidence/b1a2-antd-lint.json`。
- 首轮 E2E 发现旧 MFSU 缓存导致新增契约导出为 undefined；已排除工作区契约的依赖预编译，完整回归通过。失败日志保留 `.local/evidence/b1a2-e2e-before-cache-fix.txt`，不将首次失败隐去。
- 截图：`.local/evidence/b1a2-stock-erp-product-1440.png`、`b1a2-stock-sku-spec-1440.png`、`b1a2-stock-spec-1280.png`、`b1a2-unknown-status-1440.png`、`b1a2-unknown-status-1280.png`、`b1a2-unknown-inbound-1440.png`、`b1a2-unknown-journal-1440.png`；均不进 Git。

回滚：先回退独立 OpenAPI 生成物提交，再回退本批实现；无需 down，数据库事实完全保留。尚未验证实体 PDA/小程序真机和生产环境。

## B1a 第 1 提交验收（2026-11-08）

本轮仅 RK/CK 自动取号、编号配置预览、旧请求兼容与统一原文回退。以下为本地 MySQL 8 / 浏览器模拟验收，不代表实体 PDA、小程序真机或生产验收。测试只用 3307 上新建的 `maozhi_test_*` 库；未访问生产/3306/warehouse。

### P 覆盖率（本提交范围）

| 能力 | 本批结果 | 证据/未完成边界 |
| --- | --- | --- |
| RK/CK 自动号与配置预览 | 已通过 API 与浏览器验收 | `numbering.spec.ts`；两类各 50 并发；宽度 2..8；预览不占号 |
| 未知状态/流水类型回退 | 已通过现有 Web 列表/详情/流水验收 | `numbering.spec.ts`；灰色原文；未知状态不画本地步骤；原始 null 保留 |
| 旧请求兼容/幂等/保号 | 已通过 API 回归和丢响应专项验收 | `numbering-history.test.ts`、`retry-numbering.spec.ts`；显式旧号不被静默替换 |
| 双来源不合计 | 未执行 | 第 2 提交，等用户放行 |
| 入库审核/明确确认、出库确认、库存调整事务完善 | 未执行 | 第 3 提交，等用户放行；现有创建即入库行为未改变 |
| 撤销审核/作废/更正 | 未执行 | B2，补偿流水及下游依赖检查；B1b 不处理状态机 |
| 单用户权限体系 | N/A | 不实现多用户/RBAC，不计入 P 分母 |

此表不把两个完成子项折算为整张 12 章矩阵已完成；其他 P 保持原缺口。

### U 指标达成

| 指标 | 基线 → 本轮结果 | 测量方法 |
| --- | --- | --- |
| 人工输入单号 | 每种表单 1 个 → 0 个 | `outbound.spec.ts` 实际创建/编辑；界面显示自动号说明 |
| 并发唯一性 | 未验证 → 入库/出库分别 50/50 唯一 | 真 HTTP Promise.all 并发；再查 DB GROUP BY；全号列表在原始日志 |
| 宽度碰撞 | 无保护 → 409、0 新增、0 重复组、原宽度/计数器不变 | `numbering-history.test.ts`；页面保存失败保留宽度输入 |
| 未知值可见性 | 入库硬编码/仅出库局部映射 → 0 空白、0 页面异常 | 真实临时 MySQL 注入未知值；API 和 E2E 断言、截图人工检查 |
| 丢响应后重试 | 基线未验证 → 保留表单，原键/原正文返回原单据 | Playwright 先让服务端提交再丢响应，断言按钮可用且非加载，再点击重试 |
| 任务耗时、首屏性能 | 待实测 | 本提交不宣称 B1b 性能/查询壳达标 |

### N 已批准清单

| 本轮新增候选 | 批准/执行情况 |
| --- | --- |
| 无 | 未实施任何 N 功能；最近流水只作原文类型展示载体 |

### 测试与截图

- `npm run test`：35/35 通过；原始输出 `.local/evidence/b1a-test-output.txt`，包含全部并发单号、碰撞响应、down 拒绝输出。
- `npm run build`：严格类型检查与 Umi 构建通过；`.local/evidence/b1a-build-output.txt`。
- `npm run test:e2e`：8/8 通过（53.6s），最终全量结果 `.local/evidence/b1a-e2e-output.txt`；丢响应专项结果 `.local/evidence/b1a-retry-output.txt`。重试按钮同时断言可用且无 loading 状态，避免图标进入可访问名称使精确文字选择器误判。
- AntD CLI：0 issues；`.local/evidence/b1a-antd-lint.json`。未新增依赖、未修改 UI 栈、未修改 `.ant-*` 样式。
- 真实数据库未知状态/类型截图：`.local/evidence/b1a-unknown-status-1440.png`、`b1a-unknown-status-1280.png`、`b1a-unknown-inbound-1440.png`、`b1a-unknown-journal-1440.png`。
- 编号配置截图：`.local/evidence/b1a-numbering-1440.png`、`b1a-numbering-1280.png`、`b1a-numbering-collision-1440.png`。已检查原文可见、主操作可见、无页面横滚；不是截图像素回归。
- 编号配置四态采用模拟错误响应；未知状态/类型和宽度碰撞来自真实临时 MySQL fixture，不用 mock 成功响应充当业务验收。
- 修改文档中的 83 个文件链接已核查存在；带行号引用未越界，均可点开复核。截图/原始日志/生产样本均留 `.local`，不进 Git。

### SQL 对账与原始输出

并发场景仅使用合成测试数据，以下语句由测试在临时库执行：

```sql
SELECT receipt_no, COUNT(*) AS n FROM inbound_receipts GROUP BY receipt_no HAVING COUNT(*) > 1;
SELECT order_no, COUNT(*) AS n FROM outbound_orders GROUP BY order_no HAVING COUNT(*) > 1;
SELECT COUNT(*) AS n FROM inbound_receipts;
SELECT COUNT(*) AS n FROM outbound_orders;
SELECT SUM(packages) AS packages, SUM(weight_tonnes) AS tonnes FROM inbound_lines;
SELECT packages, weight_tonnes AS tonnes FROM stock
 WHERE warehouse_code='DEMO-WH' AND product_code='ACR-032' AND source_del_flag=0;
SELECT COUNT(*) AS n FROM stock_journal;
SELECT COUNT(*) AS n FROM operation_log WHERE action='inbound.confirm';
```

实际输出（完整请求顺序单号见原始日志）：

```text
B1A_CONCURRENCY {"kind":"inbound","requested":50,"succeeded":50,"unique":50,"duplicates":0,"replaySame":true,"counter":50}
B1A_CONCURRENCY {"kind":"outbound","requested":50,"succeeded":50,"unique":50,"duplicates":0,"replaySame":true,"counter":50}
B1A_RECONCILIATION {"inboundRows":50,"outboundRowsIncludingFixtures":53,"inbound":{"packages":"50","tonnes":"15.1250"},"stock":{"packages":56,"tonnes":"16.9250"},"journal":50,"audit":50,"duplicateGroups":0}
B1A_MIGRATION_DOWN {"nonempty":"rules","output":"拒绝回退：document_number_rules 含有数据，禁止删除历史数据","state":"applied","dataPreserved":true}
B1A_MIGRATION_DOWN {"nonempty":"counters","output":"拒绝回退：document_number_counters 含有数据，禁止删除历史数据","state":"applied","dataPreserved":true}
```

碰撞 HTTP 返回 `409 / NUMBERING_COLLISION`；数据库出库表 beforeRows=5、afterRows=5、newRows=0、duplicateGroups=0；width=4、counter=1 未变。该 5 行包含 3 条初始 fixture、1 条自动号、1 条软删历史碰撞号。

004 已仅应用到本地 `127.0.0.1:3307/maozhi_dev_sample`；规则/计数器各 0 行，历史入库 115、出库 415、流水 828 未新增/删改。迁移前后对入库及明细、出库及明细、库存、流水、商品、条码目录共 8 表执行 `CHECKSUM TABLE`，完全一致。证据：`.local/evidence/b1a-local-migration.json`。生产和 3306 未连接。

回滚：空 004 表经迁移器 down；非空则只成套回退 Web/API 并保留表及数据，禁止为了 down 清表。入库审核/撤销归属见矩阵与提案；不把本轮号码事务等同第 3 提交的业务事务完善。

## 真实样本导入验收

来源：`erp.nbsmzwl.cn` 的 `wms` 数据库只读事务与本地 `C:\Users\qq113\Desktop\sku.txt`。生产连接先执行 `SET SESSION TRANSACTION READ ONLY`，导出在 `START TRANSACTION READ ONLY ... COMMIT` 中完成；原始 CSV 只存于被 Git 忽略的 `.local/prod-sample/`。

| 数据集 | 导出总行 | 导入总行 | 有效行 | 软删行 |
| --- | ---: | ---: | ---: | ---: |
| product（ERP历史商品） | 428 | 428 | 428 | 0 |
| inbound_order | 115 | 115 | 114 | 1 |
| inbound_order_detail | 182 | 182 | 166 | 16 |
| outbound_order | 415 | 415 | 414 | 1 |
| outbound_order_detail | 544 | 544 | 531 | 13 |
| stock | 122 | 122 | 121 | 1 |
| stock_journal | 828 | 828 | 804 | 24 |
| supplier | 2 | 2 | 1 | 1 |
| customer | 376 | 376 | 376 | 0 |
| warehouse | 3 | 3 | 2 | 1 |
| sku.txt 包级条码 | 9018 | scan_catalog 9018 | 9018 | 0 |

库存流水采用双口径：总行 828、有效行 804，差异为 24 条 `del_flag=1` 软删历史；软删行保留原状态、流水类型和来源 JSON，不参与当前统计。

| 聚合 | 生产只读副本 | 本地导入 | 结果 |
| --- | ---: | ---: | --- |
| 有效库存包数 / 吨 | 4688 / 1408.5930 | 4688 / 1408.5930 | 一致 |
| 有效入库包数 / 吨 | 12639 / 3806.4760 | 12639 / 3806.4760 | 一致 |
| 有效出库包数 / 吨 | 12527 / 3775.7690 | 12527 / 3775.7690 | 一致 |

条码全量校验：9018/9018 命中，重量 9018/9018 一致，未从条码推算；抽样 10 条逐条比较通过。可复现命令：`npm exec tsx scripts/verify-sample-seed.ts`。

`sku.txt` 的 141 种规格独立生成 `SPEC-001` 至 `SPEC-141` 条码目录商品；ERP 428 个历史商品保留原 code。两套商品不建立映射，原因是缺少可靠映射键。`manifest.json` 中行数为本轮验收口径，交接参考数字已过期。

日期：2026-11-07。范围：新项目本地合成数据；没有连接生产数据库/服务器，没有复制旧项目源码。

## 已验证

| 检查                | 结果              | 验证边界                                                                           |
| ------------------- | ----------------- | ---------------------------------------------------------------------------------- |
| TypeScript 严格检查 | 通过              | API、Web、共享契约                                                                 |
| 后端/小程序测试     | 18 项通过         | 每轮独立临时 MySQL 8 库；含小程序真实请求模块与 HTTP 后端对接                      |
| 浏览器 E2E          | 2 项通过          | 登录→详情→Web 确认→库存→日志；1280 空态与退出；1440 布局                           |
| Android Debug 构建  | 通过              | 全新包名 cn.maozhi.wms.pda.debug                                                   |
| Android JVM 单测    | 3 项通过          | 两个实重不相等、缺重拦截、100g 精度拦截                                            |
| Android lint        | 0 errors          | 保留依赖更新/target SDK/中文资源化等警告，不用忽略规则掩盖错误                     |
| Android 仪器测试    | 3 项通过          | Room 关闭重开后事实不变；实际 API 补传/冻结；键盘输入落库与界面截图                |
| 小程序资源检查      | 通过              | Vant 资源、全局组件入口和页面文件完整                                              |
| 小程序 API 对接检查 | 通过              | channel=miniapp；page/pageSize/keyword；items/total；lines/重量字段对齐；401重登录 |
| 小程序 UI 静态检查  | 通过              | 原生+Vant、空态/错误/重试/加载/分页、安全区、长文本省略、按钮防重                  |
| 备份/恢复           | 通过              | MySQL `mysqldump` 单事务备份、库身份检查，恢复到白名单新库，恢复库会话失效         |
| npm 官方安全审计    | 0 vulnerabilities | 执行时已安装 Node 依赖树；不等同生产安全验收                                       |
| AntD CLI 检查       | 0 issues          | 当前 Web 源码                                                                      |

## 第二阶段增量验收

| 检查                    | 结果      | 验证边界                                                                    |
| ----------------------- | --------- | --------------------------------------------------------------------------- |
| 严格类型检查与 Web 构建 | 通过      | Umi Max / Ant Design Pro 工程                                               |
| API 与小程序测试        | 26 项通过 | 临时 MySQL 8 库；含 Web 同源写入及 PDA/小程序权限边界                       |
| 浏览器 E2E              | 4 项通过  | 入库详情、主数据新增、出库计划新建/编辑；另含既有出库确认流程和 1280 宽布局 |
| OpenAPI 文档            | 已更新    | 覆盖主数据、入库、出库计划创建和编辑                                        |

上述结果分别表示代码完成、构建通过和浏览器模拟验收，不代表微信开发者工具、实体 PDA 或生产环境验收完成。

## 核心业务证据

- `302500g + 297500g = 600000g = 0.6000 吨`；未使用统一件重推算。
- PDA 接收事实、重复补传、冻结期间库存和库存流水均不改变。
- Web 确认后由 6 包 / 1.8000 吨变为 4 包 / 1.2000 吨。
- 重复确认同幂等键返回原结果，不重复扣库存；新键携旧修订号被拒绝。
- 不同正文复用事实 ID、同条码重复、跨计划重复、目录重量不符均被拒绝。
- 缺包/计划实重不符/摘要或修订变化不允许冻结。
- 一个单据后续商品库存不足，会回滚此前商品的扣减与流水，单据仍冻结待确认。
- PDA 与小程序会话都不能调用库存确认；Web 会话不能写扫码事实。
- 本机条码队列保存固定 UUID 和原始正文；回传成功与缓存计划更新在 Room 事务中提交。

## 本地证据位置

- `.local/evidence/web-list-1440.png`
- `.local/evidence/web-list-1280.png`
- `.local/evidence/web-detail-1440.png`
- `.local/evidence/inbound-detail-1440.png`
- `.local/evidence/master-data-1440.png`
- `.local/evidence/outbound-plan-1440.png`
- `.local/evidence/pda-scan.png`
- `apps/pda/app/build/reports/tests/testDebugUnitTest/`
- `apps/pda/app/build/reports/lint-results-debug.html`
- `.local/backups/*.sql` 与恢复脚本输出的 `maozhi_restore_*` 新库

## Android 仪器测试复现

使用新建的隔离模拟器或只读 AVD，勿针对承载实际作业队列的设备清数据。
启动独立测试 API：PowerShell 设置 `$env:TEST_PORT='4312'` 后执行 `npx tsx scripts/e2e-api.ts`。
将指定测试模拟器的 `tcp:4310` reverse 到本机 `tcp:4312`；安装本项目 Debug APK 和 AndroidTest APK。
运行 `adb -s <测试模拟器> shell am instrument -w cn.maozhi.wms.pda.debug.test/androidx.test.runner.AndroidJUnitRunner`。
三项测试分别使用独立 Room 数据文件或本项目隔离测试应用，合成计划 002/003；每轮从新测试 API/隔离模拟器开始。
本轮使用 `emulator-5580`，只读 Pixel_6 AVD，没有在连接的实体 PDA 上安装/改数据。

## 不宣称完成的验收

1. 微信开发者工具/微信真机渲染及发布：当前环境没有可用的开发工具 CLI，未用静态检查冒充真机验收。
2. 实体扫码枪厂商广播、功能键、连续 100 包、跨天弱网和设备时钟偏差。
3. 真实条码目录、现场称量、短装/超发放行、作废重扫、计划变更、生产 MySQL 兼容。
4. 生产迁移、备份留存/异地恢复、HTTPS 部署、release 签名和覆盖升级。
5. 第一阶段库存来自合成期初数；第二阶段入库和主数据功能已代码实现并通过浏览器模拟验收，但入库撤销/更正仍未开放；CSV/打印等业务尚未实现。

## 已知技术取舍

- 本地 MySQL 8 仅用于合成数据开发和测试，不把它当成生产部署、生产迁移或现场验收完成。
- ProComponents 3 为固定预发布版本；已跑浏览器测试，仍需随正式版本评估升级。
- Web 采用路由懒加载；ProComponents/AntD 共享包仍较大，生产性能预算尚待后续优化。
- 本阶段列表用有上限的服务端 OFFSET 分页，面向单用户少量单据；大规模导出/游标分页不在第一闭环内。
- 首轮浏览器失败由按钮中文空格、searchbox 语义和重复空态文案匹配引起，已修正选择器及可访问名称；最终两项均通过。
