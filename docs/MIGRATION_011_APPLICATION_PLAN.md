# 011 开发库应用计划与执行记录

日期：2026-11-09。对象：茂智云仓 · 腈纶仓储管理系统的本机合成开发库。代码基线：`61f4d82e95a1dd74af2027e894d869e426d6b5d2`。

> 本计划在 B6a 开工前已按用户授权执行；实际记录见第 8 节。第 1–7 节保留执行前计划语境，其中“本轮未执行”指文档评审批次，不表示当前数据库仍缺少 011。

## 1. 范围与现有入口

仅目标 `127.0.0.1:3307 / maozhi_dev_sample`；以执行前读取的安全连接元数据和数据库身份再次核对。若实际 `.local/mysql/dev.json` 指向其他库，停止并报告，不自动替换配置、不转接 3306/生产/warehouse。凭证留在本机配置，不输出密码或连接串。

| 项目 | 已核对的代码事实 |
|---|---|
| 迁移编号 | `011_corrections_business_date`；up/down 在 `apps/api/migrations/`；注册见 `apps/api/src/db/migrate.ts:84` |
| up | 入/出库增加可空 business_date 与默认0的 correction_revision；编号支持correction；操作支持stock.correct；增加更正头/行及流水correction_id外键。旧日期不回填，见 `011_corrections_business_date.up.sql:1` |
| down | 删除011新增表/列并恢复编号/操作CHECK，必须经过守卫，不能直接运行SQL文件 |
| CLI | `npx tsx scripts/mysql/migrate.ts up` / `down`；脚本固定读取 developmentConfig，见 `scripts/mysql/migrate.ts:6`。根 package.json **没有** db:migrate 脚本，不能照脚本旧提示写 npm run db:migrate |
| up范围 | `migrateUp(db, through?)` 支持内部上限，CLI不传through，故执行全部未应用迁移。固定此基线、确认最高登记011且仅011待应用后才运行CLI |
| down范围 | `apps/api/src/db/migrate.ts:144` 倒序找已应用迁移，`:164` 在退完第一条后立即return。**每次只退最高一条，不是全库down**；执行前必须确认最高为011，禁止连续重试把010也退掉 |
| DDL状态 | 同连接命名锁、5秒锁等待；状态applying→applied / reverting→删除记录；checksum不匹配或中断拒绝重跑，见 migrate.ts:98/114/144。MySQL DDL不能视为整段事务回滚 |
| 启动守卫 | `apps/api/src/db/correction-migration.ts:3`、`apps/api/src/server.ts:30` 要求011 applied；应用前不能把B5a写服务当成可启动 |
| 备份/恢复 | `npm run backup`、`npm run restore -- <绝对SQL路径>`。备份校验app_meta.identity；恢复只新建maozhi_restore_*，不覆盖原库，见 scripts/backup.ts:9、scripts/restore.ts:10 |

## 2. 执行前检查与停止条件

1. 记录 UTC/上海时间、操作者、Git HEAD/status、Node/MySQL版本、迁移文件SHA-256。固定 reviewed code；如出现012及以后、011内容变化、工作区代码未提交，重新审查执行范围。
2. 用项目白名单连接读 host/port/database、`SELECT DATABASE(), VERSION(), @@datadir`、`app_meta.identity`。实例目录按 `scripts/mysql/local-config.ts:14` 校验为本项目 `.local/mysql/data/`；身份应为 `maozhi-local-mysql8-v1`。
3. 读取 `schema_migrations` 全部记录及checksum/state，预期001–010 applied、011不存在。任何applying/reverting、checksum不符、011局部DDL、未知迁移均停；如果011已完整应用，报告并跳过应用，不能重建/重seed。
4. 读取011目标表/列/约束当前结构，确认没有同名残留；读取活动盘点窗口、导出/建单等进行中任务。记录并协商维护窗口，不能删除窗口或队列来达到“无活动”。盘点数据仍保留，不回退不懂暂停的旧服务。
5. 停止本项目所有会写目标库的API/后台任务/脚本；关闭或禁用客户端写入，PDA离线原事实保留。只停止确认归属的进程，不按所有node/浏览器名批量终止。备份、指纹、迁移、迁移后比较之间保持无业务写入及无并行DDL。
6. 确认磁盘、mysqldump/mysql工具可用、备份目录受限且在Git忽略范围。证据拟放 `.local/evidence/migration-011-<时间>/`，SQL在 `.local/backups/`；这只是约定，本轮不创建备份文件。

## 3. 备份与恢复演练

1. 冻结写入后采集基线指纹B0（§4），保存schema与迁移清单；执行 `npm run backup`，记录完整stdout/stderr/退出码。命令退出、输出流结束后确认文件完整、大小稳定、SHA-256。`scripts/backup.ts:27` 等待dump进程，文件大小/恢复校验仍须另做，不能只凭“备份已建立”日志判成功。
2. 检查dump是否包含表、视图、触发器及所需定义；现有脚本 `--skip-routines`，如盘点发现额外存储例程/事件，先补备份覆盖方案再继续，不宣称全量覆盖未知对象。
3. 使用这份SQL恢复到新随机白名单库。`scripts/restore.ts:22` **会删除恢复副本的sessions**：这是会话失效处理，必须在恢复报告单列“副本sessions=0；原库sessions未改”。除这项明确差异，所有业务数据必须与B0完全相同，不能宣称所有表都100%相同。
4. 记录恢复库名、SQL SHA、结构清单、业务指纹、登录身份可用性。恢复工具失败时会删除它刚创建的副本（restore.ts:25）；必须先保存过程错误日志和目标库名，不能让“副本已清理”冒充恢复校验通过。若要保留失败库诊断，需另轮改进恢复工具，本轮不改。
5. 在已校验恢复副本演练011 up→空B5a数据down→up，验证每步只影响011，001–010记录仍在；再使用另一份独立合成库验证有业务日期/更正时拒绝down。写入测试数据的副本不得用作原库零差异比较基准。
6. **副本不能直接运行开发CLI冒充改了目标库。** developmentConfig只读固定dev.json，不吃临时数据库名参数。执行轮应使用已有 `migrateUp(db, '011_corrections_business_date')` / `migrateDown(db)` API，显式传经白名单核验的副本连接；将受审执行器与输出一起留档。现有旧批次 verify-* 脚本可能含开发库写入/旧编号目标，不得不审查直接复用。

恢复失败或任何业务指纹不一致时，到此停止；不应用开发库。保留原库和备份。

## 4. 指纹定义与允许差异

复用 `scripts/b4a-fingerprint.ts:15` 的“旧列投影+行数+逐行稳定排序SHA-256”思路。它一次读全表，当前本地样本可用；大库应流式分块且固定主键排序。固定MySQL驱动日期/DECIMAL/二进制序列化，包数与整数克独立核对，不能浮点汇总或仅比较总行数。

| 对象 | 必须记录与比较 |
|---|---|
| 全部旧业务基表 | B0每表原有列名/顺序、行数、完整行哈希；B1（恢复）和B2（迁移后）按B0列投影比较；包括软删行、source_id/source_row_json、原状态和原数量，禁止只查可见业务行 |
| 库存 | 仓×品逐格包数/吨数及总体行数、包吨和哈希；迁移delta=0 |
| 事实与冻结 | scan_facts UUID/正文摘要/原重量/目录版本、scan_fact_context、scan_submissions revision/digest、交接原始JSON/哈希；迁移前后逐项相同 |
| 目录与历史 | catalog_versions/entries/head、v1 archive、相关不可变触发器/视图；行指纹/活动版本相同 |
| 审计、幂等、操作、编号、盘点 | operation_log、idempotent_commands、inventory_operations、number rules/counters、stocktake四表和活动窗口均不变；迁移不制造业务审计或编号 |
| 身份/会话 | 原库迁移前后owner/sessions不变；恢复副本sessions被清空是§3明确差异。登录冒烟在指纹比较之后执行并单列会话变化 |
| schema_migrations | 001–010逐行内容不变；仅新增011 applied及正确up checksum/applied_at；不是把整张表从检查中排除 |
| 011新结构 | 更正头/行均空；所有既有原单business_date=NULL、correction_revision=0；既有流水correction_id=NULL；新增FK/CHECK/唯一键与SQL一致 |
| DDL | SHOW CREATE TABLE、视图/触发器、列/索引/约束基线；只允许011列出的结构差异。恢复副本环境相关定义差异单列说明，不能跳过检查 |

比较阶段在写入停止的固定快照内进行。不得先做建单冒烟再把新增行从哈希中排掉。备份/指纹文件包含业务信息，仅留本地受限目录，不加入Git。

## 5. 应用到开发库

前置：§2–4全部通过，记录实施窗口；确认实际目标仍是同一数据库，代码最高仍011、待应用只有011。

在项目根目录执行以下**计划命令，本轮未执行**：

```powershell
npx tsx scripts/mysql/migrate.ts up
```

必须保存stdout、stderr、退出码及实际耗时。成功后独立查询011 state/checksum和所有新结构，计算B2与B0比较；记录“新增两表为空、旧日期NULL、旧版本0、旧流水引用NULL、旧行指纹一致”。一句 `MySQL 迁移 up 完成` 不替代这些验证。

如遇锁等待/DDL错误/applying残留：保持写服务停止，保存最后成功语句及实际schema，查明真实结构后制定修复步骤；不删schema_migrations记录、不伪造applied、不直接重跑、不重seed。

## 6. 冒烟与放行

**开发库只读冒烟**在B2比较通过后启动匹配B5a版本的API/Web；观察011启动守卫通过。登录引起的sessions变更单列，读取入/出库列表和历史详情、库存、盘点窗口、报表、编号只读预览。既有日期未知仍NULL，历史单仍只读；不存在更正时摘要原量=有效量、累计差额0。记录实际HTTP状态、响应字段及服务日志，不输出会话凭证。

**写入冒烟在独立合成/恢复测试副本**，不污染原开发库以便保留可回退条件。执行轮可复用 B5a 测试夹具，但先确认临时库绑定及销毁范围。至少留以下原始输出：

| 用例 | 必须证明 |
|---|---|
| 入库→仅改包数→撤销 | 吨数更正时不变，库存按包数差额变；最终净变化0；原数量/日期不改；原流水+更正+抵消配对 |
| 出库更正 | 库存变化为后值减前值的相反数；有效量/累计差额/最新更正号与时间线一致 |
| 负库存/历史单/成环/盘点窗口/禁改字段 | 业务冲突409或契约422与B5a契约一致；业务数据库前后指纹相同 |
| 同键重放/同版本双并发 | 一次生效；并发不同命令仅一胜一409，记录流水/审计/幂等数量 |
| 业务日期 | 上海默认、过去可填、未来422、超过三日历月无确认422/有确认成功且审计、入账后改422；冻结出库仍锁定 |
| 下迁移守卫 | 空B5a结构单步down/up；仅业务日期非空也拒绝；有更正拒绝；拒绝前后DDL/迁移状态/业务指纹相同 |

测试结果与历史 `B5A_ACCEPTANCE.md` 分开标日期、环境及原始输出；不能复制旧“168/168”当本次结果。代码/构建/浏览器/设备/生产分层，开发库迁移不构成实体设备或生产验收。

## 7. 回退决策

### A. 尚无任何 B5a 数据，011 完整 applied

1. 停止所有写服务，再做当前备份/指纹；确认最高迁移恰为011，schema与状态完整。
2. `apps/api/src/db/correction-migration.ts:7` 的全部检查必须为空：更正头/行，任意原单非空business_date或非零correction_revision，流水correction_id，stock.correct操作，correction编号规则/计数器，correction/business-date幂等及对应审计。
3. 守卫通过后才执行**一次** `npx tsx scripts/mysql/migrate.ts down`。不得直接运行down SQL；若最高不是011，不能使用此命令回退本批。
4. 保存输出/退出码，核对011记录及新增结构消失、001–010仍applied、原业务列指纹等于B0，010 memo等旧字段仍在。再以匹配010结构的完整Web/API版本启动；当前B5a版本会因011缺失拒绝启动，不能绕过守卫。

### B. 已有任意 B5a 数据

**拒绝down，不删数据以通过检查。** 即使没有更正、只是新建了带business_date的单据，也不满足回退条件。保留011结构及更正/审计/幂等/编号/原事实；停止相关写入、保留兼容读取，前向修复。

迁移前备份只能恢复到新的隔离库用于核对。恢复旧备份并切换会丢失迁移后业务，不能作为默认回退。若确需切换，另审全部增量、幂等重放与对账方案；不覆盖现库、不删除新业务。

### C. DDL 中断或结构不完整

保留applying/reverting状态及原库；当前服务保持停止。通过SHOW CREATE/迁移日志确定已执行部分，先在副本复现恢复方案，再决定补完011或受控修复至010。正常down入口会拒绝非applied状态；不能手工改状态欺骗它，也不能假设ROLLBACK能撤销MySQL DDL。

## 8. 执行轮交付清单

- 安全目标元数据、Git hash、迁移文件SHA、001–011状态/结构检查原始输出。
- 备份路径/大小/SHA、恢复库名、恢复结果与sessions例外。
- B0/B1/B2原列指纹及逐仓品/事实/冻结摘要比较，无差异或逐条解释。
- 副本up/down/up及非空拒绝输出；开发库up输出；读取冒烟响应；隔离写用例结果。
- 是否恢复写服务、回退条件是否仍成立、保留的原库/副本/证据位置。

本计划没有应用结果栏的预填“成功”。下一轮获实施授权后按实际输出填写，任一阻断保留现场并报告。


## 8. B6a 前置执行记录（2026-11-09）

实际目标 `127.0.0.1:3307 / maozhi_dev_sample`，MySQL 8.0.46；identity=`maozhi-local-mysql8-v1`，datadir=`D:\maozhi-acrylic-wms\.local\mysql\data\`。仅停止经核实的本项目 dev 启动树 PID 24024；未批量结束其他 Node/浏览器。全程没有连接3306或生产。

- 备份：`.local/backups/maozhi-1794236722353.sql`，6,187,320 字节；SHA256=`1A06F0A101625795F081784E1EAD946DDABF3B0197901A0A5719B693A79DEFDD`。
- 恢复副本：`maozhi_restore_b75623b5746b1bc3`，保留；原库 sessions=5，恢复脚本将副本 sessions 清为0，其余原表指纹相同。DDL差异仅显式字符集声明/触发器创建时间，规范化后匹配。
- 副本011 up→down→up通过；独立合成库更正/日期/迁移验收26项通过。
- 开发库执行 `npx tsx scripts/mysql/migrate.ts up`，当时最高注册为011；原始输出 `MySQL 迁移 up 完成`。
- 011状态 applied，applied_at=`2026-11-09 15:07:05.427` UTC；checksum=`546374a8a7417534929a181f040cdee8fc3ef5582966f4927c8ac7b17d6ea390`。

原始核验输出：

```text
B2_VERIFIED {
  originalTablesUnchanged: 35,
  oldMigrationsUnchanged: 10,
  oldDatesNull: true,
  revisionsZero: true,
  correctionTablesEmpty: true,
  journalCorrectionNull: true
}
```

开发API启动、登录、入库/出库/库存/盘点/编号/历史详情/月报读取均200。首次冒烟选中了软删历史入库导致404，已保留失败日志；改为可见历史单后重试通过。迁移后业务指纹比较在登录前完成；重试登录单列 sessions 5→6、operation_log 9→10，不将这些认证写入称为迁移零差异。

原始证据：[目录](../.local/evidence/migration-011-20261109/)、[应用](../.local/evidence/migration-011-20261109/dev-up.log)、[副本演练](../.local/evidence/migration-011-20261109/rehearsal.log)、[指纹](../.local/evidence/migration-011-20261109/postflight.log)、[26项验收](../.local/evidence/migration-011-20261109/isolated-smoke.log)、[开发库冒烟](../.local/evidence/migration-011-20261109/dev-smoke-retry.log)。这是本地合成开发库应用，不是生产/实体设备验收。后续012状态见 B6A_ACCEPTANCE。
