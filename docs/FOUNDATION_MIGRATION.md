# 基础迁移执行记录


## 009_stocktake（B3a，2026-11-08）

- 新增盘点头、不可变快照、独立实盘、仓库暂停窗口四表，新增stocktake.post操作类型与仓库查询索引；无历史状态/库存回填。启动必须009 applied，不完整则拒绝新服务。
- `npx tsx scripts/verify-stocktake-migration.ts --apply-local`：仅白名单本机127.0.0.1:3307，先确认4310已停；备份 `.local/backups/b3a-before-009-1794138264726.sql`，SHA256 `b7cb48a56f8e49d983263310eb08b1e60ae4208e6ef99329b47474e688bfaac8`。恢复到随机独立库，32表全部指纹相等；恢复副本升级后原31业务表不变，再执行开发库升级。
- 行数原样：inbound_receipts115/outbound_orders415/stock122/stock_journal828/scan_facts0/catalog_entries9018。逐表指纹包含全部字段，非仅行数；不重seed、不清队列。原始日志 `.local/evidence/b3a-local-migration.log`，指纹 `b3a-migration-fingerprints.json`。
- down实测：四张009表全空时可down/up，即使旧业务数据非空仍保留；在恢复副本创建一张盘点后，DDL前拒绝 `拒绝回退：stocktakes 含有数据，禁止删除历史数据`，全部行/迁移记录不变。临时测试库另验证纯空库down/up与旧schema启动拒绝。
- MySQL可能用新增复合索引替换隐式仓库外键索引；安全down先检查information_schema，必要时补回仓库外键支持索引，不关闭外键检查。DDL不具备整体事务，失败保留reverting/applying，核查实际结构后修复，不删迁移记录盲重试。
- 回退边界：四张盘点表全空才可停止写服务并down。已有盘点则不删历史；禁用新增、保留读取与暂停守卫后前向修复。进行中只能正常完成或明确作废释放，不能换旧包绕过暂停；不能用覆盖恢复丢弃新实盘/库存操作。备份仅恢复新库核对，不覆盖原库。
- 本批只在本机样本库迁移、临时库故障演练，无生产连接、生产迁移或实体设备验收；管理员凭据不写日志/Git。

## 008_document_lifecycle（B2a，2026-11-08）

- 新增单据终结关联`document_closures`、下发证据`outbound_plan_exposures`；扩大操作类型/入库入账状态CHECK，新增同仓商品流水序号与操作目标索引。原115入库/415出库状态、原流水、事实及目录不UPDATE，不用推测回填原确认。
- 停止本地4310写服务后运行`npx tsx scripts/verify-lifecycle-migration.ts --apply-local`：仅白名单127.0.0.1:3307；先dump，恢复新临时库并比较30张表逐行指纹，再演练008与非空down拒绝，最后升级当前开发库。备份`.local/backups/b2a-before-008-1794131296574.sql`，SHA-256 `75fd42b0e44436d38aacf38d1e17d2e8b9b4dbf1532558be473745964aa603a4`。
- 实际结果：原29业务表指纹均一致，入库115/出库415/库存122/流水828/事实0/版本目录条目9018，所有旧出库都有保守的未知下发标记。原样本事实为0，不代替非空合成事实的撤销保留测试。
- 原始输出`.local/evidence/b2a-local-migration.log`、逐表指纹`b2a-migration-fingerprints.json`；EXPLAIN命中`journal_cell_sequence`，range/Using index（空命中探针，只证访问路径，不宣称真实查询p95）。未访问生产、3306或warehouse，未清理真实队列。
- `lifecycle-migration.test.ts`实测空库down/up；样本恢复库实测`拒绝回退：outbound_plan_exposures 含有数据，禁止删除历史数据`，拒绝前后表指纹及schema_migrations不变。新增终态/补偿后只能保留兼容读取、禁用新入口或前向修复，不down删除记录。DDL非事务；applying/reverting残留须检查真实结构，不盲重跑。
- 每条误确认补偿均关联原确认操作；新的业务事务逐写入点故障验证整体回滚，包括两商品第二笔失败时第一笔也回滚。MySQL失败事务可能留下自增序号空隙，不代表有残留流水或被复用的单号。

## 007_pda_handoff 与 Room 1→2（B1c-2，2026-11-08）

- MySQL up 仅新增 `pda_handoffs/pda_handoff_records/pda_handoff_clients`；记录完整队列 SHA、原始 JSON/SHA、不可变 context、旧协议活动水位。旧业务表及 006 目录不改写；启动须 007 applied 且三表齐备。
- 已在本机 3307 样本库执行：备份 `.local/backups/maozhi-1794114891092.sql`，SHA-256 `06D35EEDD29B261D859CEE33ECBE4A7F6D98536F8DE617F98A29AD176799DA48`；先恢复独立 `maozhi_restore_3593d0dca20da020` 并逐表核对（恢复库会话按既有规则清空，原库会话不动），再迁移。日志 `.local/evidence/b1c2-local-backup.log`、`b1c2-local-restore.log`、`b1c2-local-migration.log`。
- 前后全表指纹一致：目录 9018、历史入库 115、出库 415、库存 122、流水 828；当前样本扫码事实 0，不能拿零行冒充旧队列验收。另用 M71 非空 60 条旧队列及混版事实验证。
- MySQL 空交接表 down/up 实测成功；任一交接表非空，执行 DDL 前拒绝，原表与迁移记录不变。007 不完整时启动拒绝。保留 applying/reverting 状态，DDL 中断必须检查真实结构后修复，不自动删除迁移记录或重跑 seed。
- Room 迁移只加新表，将旧缓存复制为未校验 v1；旧事实、原正文、原冻结 key 不改。原子目录切换另实测 head 写入故障，v2 条目/元数据/head 全回滚，原事实不变；Android 9/API28 可运行。
- 中断恢复：独立恢复包在真实 Room 迁移写表之后、commit 之前被宿主 force-stop；装回原基线 APK 后，schema=1、原正文 60/60、待传 55/失败 5、原冻结 key 均不变，旧 UI 真正显示 60/61。原始输出 `b1c2-migration-interruption.log`，图片 `b1c2-old-queue.png`，脚本 `scripts/pda/verify-interruption.py`。
- 回退边界：上述旧 APK 恢复只适用于未提交迁移。成功提交 Room 2 或产生 v2 事实后，不允许回到只识别 v1 的 APK，不执行破坏性 down；停止新发布、保全队列/备份并前向修复。服务端交接数据非空也禁止直接 down；不存在删除待传记录的恢复路径。

## 006_catalog_versioning（B1c-1，2026-11-08）

- up：新增 `catalog_versions/catalog_entries/catalog_head/scan_fact_context/catalog_client_activity`；现有目录原样为 v1；仅精确且唯一匹配原单 ERP 行的旧事实允许补 context，原事实与摘要不 UPDATE。旧目录封存为 archive，旧名改不可更新 v1 视图；事实外键改为版本+条码。
- 原数据校验：9018 条、141 规格、2707.9025 吨，前后完全一致；旧事实/冻结记录为 0。非空历史合成夹具另验证 2 条 / 0.6000 吨、旧冻结摘要不变并能确认；不以样本零行替代非空验收。
- 本机 `127.0.0.1:3307/maozhi_dev_sample` 迁移前备份 `.local/backups/maozhi-1794108036690.sql`，已恢复到新库并比较全部业务表指纹；恢复库先演练 up，再操作开发库。不连接 3306/生产/warehouse，不重跑 seed 或清队列。
- 执行中遇开发账号创建触发器缺少 binlog 所需权限，006 停在 applying。先检查实际结构、checksum、旧表封存和新版逐行一致，再用本地管理员仅补剩余三个触发器和视图；对账通过才标 applied。没有重跑已完成 DDL、删除迁移记录或修改全局 binlog/SUPER 授权。原始失败、检查、恢复输出分别为 `.local/evidence/b1c1-local-migration.log`、`b1c1-local-migration-inspection.log`、`b1c1-local-migration-recovered.log`。
- 已补迁移前权限预检：binlog 开启且未信任触发器创建者时，无所需权限直接在 DDL 前失败；常规 setup 使用已验证的本机管理员。运行账号仅增加本库 CREATE VIEW/SHOW VIEW/TRIGGER，用于迁移兼容读/备份；不提升全局权限。启动期检查 006 applied 与只读视图。
- down：真正空库 down/up 通过；任一版本/head/entry/context/fact/archive/client_activity 非空，DDL 前拒绝。实测 `拒绝回退：catalog_entries 含有数据，禁止删除历史数据`。已发布零条版也是历史，不靠删数据回退。
- 错版通过显式重建正确完整内容、发布后继版本纠正；不能直接 down 删版本。出现 v2 事实后只关闭新发布，保留兼容查询/补传/冻结/确认；不能回退只懂 v1 的旧应用。
- 恢复演练：`npx tsx scripts/verify-catalog-restore.ts` 在临时库创建 2 版和 2 条混版事实，再 mysqldump/新库恢复；所有相关表、source_bytes SHA、content SHA 一致。可执行对账 `scripts/sql/verify-catalog-versioning.sql`；本次无设备或生产验收。

2026-11-07：暂停新增业务页面，先迁移官方 Pro 工程及 MySQL 8。

用户已确认使用可核实的官方 Ant Design Pro **v6.0.3**，取代最初指定但官方仓库未发布的 v6.0.6。
官方来源：`ant-design/ant-design-pro`，标签 `v6.0.3`，提交 `adfd44085738ca953573a13322c1ba84aca8b9e3`。

## 执行顺序

1. 保留第一阶段只读参考资产；新开发库使用隔离 MySQL 8，不导入旧数据库文件。
2. 按官方 config/src/pages/src/services/src/components 结构迁入 Umi Max，使用内置 ProLayout。
3. 登录使用 ProForm；保留 ProTable、ProDescriptions 和既有出库业务行为。
4. 独立本机 MySQL 8 实例；开发与测试库隔离；迁移脚本 up/down。
5. 数据库重量使用 DECIMAL(12,4) 吨，外部接口继续整数克，转换不经过浮点舍入。
6. 在真实 MySQL 上验证事务回滚、重复/并发提交、审计、decimal 边界和迁移回退。
7. 构建、浏览器与客户端契约回归后交付验证记录，再继续第二阶段。

不连接现有 3306 服务，不接触生产。新的开发库固定使用本地 3307 隔离 MySQL 8 实例和明确合成数据；不自动导入旧库，也不删除历史数据。


## 005_inventory_posting（B1a 第 3 提交，2026-11-08）

- up 新增 `inventory_operations`（UUID、类型、目标、原因、操作人、时间），入库 `posting_state`/确认操作 ID，流水 operation_id 和包数/吨数前后值；外键防误删操作，CHECK 校验新流水完整性及 delta。
- 历史入库只在新列默认 `legacy`，不改原 status；历史出库 status 不变；旧流水前后值从保留的原快照读取，不生成虚构操作 UUID。库存不重新计算、不重放历史单据。
- 本机 3307 样本库执行前备份保存在 `.local/backups/maozhi-1794105428856.sql`，文件大小/SHA-256 记于 `.local/evidence/b1a3-local-migration.log`。随后 up 已完成，原状态/库存/原流水/审计/幂等数据指纹未变。本轮没有在主开发库造测试单据。
- 可复跑：`npx tsx scripts/mysql/migrate.ts up`（只读本机隔离配置），`npx tsx --test apps/api/tests/inventory-migration.test.ts`（独立临时库测试 down/up），`npx tsx scripts/verify-posting-compatibility.ts`（在临时库导入本地只读样本验证历史，不连接生产）。
- 空表 down 删除本迁移新增结构后可重新 up；非空 `inventory_operations`、`inbound_receipts` 或 `stock_journal` 任一项阻止 down，迁移状态和数据完整保留。拒绝输出见 `.local/evidence/b1a3-test.log`。
- MySQL DDL 非事务：迁移中断保留 applying 状态并拒绝盲重试，先对照实际表结构检查，不能直接删除迁移记录。发布前停止本地写服务，备份并校验，再 up、启动新代码；不得旧新写服务混跑。
- 回滚：没有业务数据的新库可以停止服务、down 后回退代码。有历史/新写入的库不得执行破坏性 down，也不能直接退回“创建即入账”的旧写服务。应停止写入，保留现库与备份，优先前向修复；必要时将迁移前备份恢复到独立库核对，再安排切换。若已有新操作，先保全增量，不能丢弃新操作来换回旧版本；本批不实施撤销/作废/业务补偿。
- 本轮实际完成：本机迁移、临时库历史兼容与回滚防护演练；没有生产迁移、实体设备或生产验收。备份文件产物及 SHA 已检查，本轮未宣称完成完整恢复演练（备份可验证性升级仍按原排期）。
