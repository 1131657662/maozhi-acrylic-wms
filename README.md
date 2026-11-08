# 茂智云仓 · 腈纶仓储管理系统

## B3b 出入库明细与月度汇总（2026-11-08）

Web菜单新增两个报表入口，按上海入账日、仓库、ERP商品查询，支持三种范围XLSX导出。每页有独立包/吨收发存对账及差额说明；历史时间标“时间未核实”，断链和缺失期初标“不可验证”，不填零、不补平。扫码目录不参与报表。口径与已测/未测边界见 [REPORT_SPEC](docs/REPORT_SPEC.md) 和 [ACCEPTANCE](docs/ACCEPTANCE.md)；十万行导出已核完整性，查询时延尚未达到既有U目标。周转率、库龄仍留B3c；无新增迁移或依赖。

## B3a Web 库存盘点（2026-11-08）

菜单“库存盘点”可选仓库/ERP商品范围生成固定快照，逐行录入实盘包数与吨数，人工核对差异、填写原因后一次回写。进行中数量常驻；该仓入库/出库确认、调整及误确认撤销暂停，PDA扫码/补传/冻结照常。完成或作废后恢复；进行中仅作废可提前释放，没有手动/超时解锁。快照后未入账收发货默认阻断回写，明确按快照时点核对后才可继续，并保留审计。

已有本机3307样本已安全应用009；不要重跑seed。其他本地副本先停API并备份/恢复演练，再应用迁移；脚本 `npx tsx scripts/verify-stocktake-migration.ts --apply-local` 只接受本机隔离配置。009有盘点记录禁止down，不可用旧写服务绕过暂停。回退与证据见 [迁移说明](docs/FOUNDATION_MIGRATION.md) 和 [验收记录](docs/ACCEPTANCE.md)。

复现：`npm run test`、`npm run build`、`npm run test:e2e`；万行 `npx tsx scripts/verify-stocktake-volume.ts`，正式构建浏览器性能 `npx tsx scripts/verify-stocktake-browser.ts`。仅3307随机合成测试库，截图/原始日志保留`.local/evidence/`。B2b更正、PDA盘点、报表未做；打印已延后，依赖积木报表配置。

## B1b-2 Web XLSX 导出（2026-11-08）

入库、出库、ERP 库存、操作日志列表可导出 **全部筛选结果 / 当前页 / 跨页选中记录**，选择前显示各范围条数。字段、列顺序、状态文案与当前可见列一致，生成完成后可核对预览和本次范围合计。关闭面板可继续操作；同一时间仅运行一个任务，第二请求明确提示“已有导出在进行”。

服务端每批1000条，在同一只读快照内流式生成 XLSX；失败/取消不开放部分文件，重试保留输入。完整文件24小时内可重下；服务重启后未完成任务标记失败，须重新生成。跨页选择最多5000条；单文件最多100万条、生成上限5分钟，超限提示缩小范围，不截断。

新增服务端 ExcelJS 4.4.0（MIT，无原生安装依赖）；没有数据库迁移，PDA/小程序和库存/目录业务逻辑不变。本批不提供 CSV，不做 B1b-3 打印。WPS 实开截图、逐字段比对、依赖审计和性能边界见 [ACCEPTANCE](docs/ACCEPTANCE.md)。复现：先 `npm run build`，再 `npx tsx scripts/verify-export-performance.ts 10000` / `100000`，仅使用3307随机临时库。

## B1b-1 Web 列表查询（2026-11-08）

入库、出库、ERP 库存和操作日志共用筛选/分页/列设置/四态；筛选、页码、排序保留在 URL，详情返回不重填。库存小计包含当前筛选的全部分页，扫码目录不计库存；日志可查询完整历史并按需看前后值。B1b-1 当时没有新增依赖或迁移，旧 PDA/小程序接口不变。导出进展以上方 B1b-2 为准，打印留 B1b-3；验收、截图和本地万级性能条件见 [ACCEPTANCE](docs/ACCEPTANCE.md)。

性能复现（只创建3307随机临时库）：`npx tsx scripts/verify-list-performance.ts`；先 `npm run build`，再 `npx tsx scripts/verify-list-browser-performance.ts`。浏览器脚本每页30个全新缓存上下文，p95首屏<1500ms、翻页<500ms才退出成功，不代表公网或生产机器时延。

## B1c-2 离线目录与升级交接（2026-11-08）

- PDA 的“最新版”是上次完整同步并校验的本地版；下载固定版本分页并核对条数/唯一条码/SHA 后，Room 事务一次切换。断网或校验失败仍可用原版继续扫。
- 同一原单允许混版。服务端接受合法历史版事实；新版改重/删码只提示，未知版本等异常保留冲突。扫码目录不自动映射 ERP，单行计划默认原行，多行需选原单作业行。
- 旧队列原 UUID/正文/冻结请求不修改；按完整交接清单上传，Web 按原单批量补齐上下文（超过 100 条自动分批，一次用户操作），核对收妥后确认交接。丢响应须联网核验，不能按本机失败数猜测。
- 升级已有库前备份并恢复演练；先停本地写服务，再 `npx tsx scripts/mysql/migrate.ts up` 应用 007，启动期拒绝未迁移库。样本库已迁移且原表指纹一致；007 非空拒绝 down。
- 实测/复现与回退边界见 `docs/ACCEPTANCE.md`、`docs/FOUNDATION_MIGRATION.md`、`scripts/pda/README.md`。实体 M71 使用独立包，不覆盖现场应用；75bdbbee 经用户确认不在范围。

简称：**茂智腈纶仓**。英文：**Maozhi Acrylic Fiber WMS**。

四端全新实现的第一里程碑：**本地 MySQL 8 样本出库闭环**。种子由 `sku.txt` 的 9018 条包级条码与 ERP `wms` 只读副本生成；不包含生产写入，不导入旧源码，不连接或修改 warehouse 系统。

## 快速运行

环境：Node.js 24.14+（24.x）、npm；Android 构建另需 JDK 17/21 和 SDK 36。

```powershell
npm ci
npm run setup:sample # 导入忽略目录中的只读样本；仅空库，已存在时拒绝覆盖
npm run dev
```

Web：`http://127.0.0.1:5173`；API：`http://127.0.0.1:4310/api/v1`。
用户名与随机密码写在 `.local/demo-access.txt`；仅本机使用，该文件已被 Git 忽略。
样本库使用 `maozhi_dev_sample`；如需继续使用原型测试库，执行 `npm run setup:demo`。原始 CSV 只在 `.local/prod-sample/`，由 Git 忽略。

## 目录

```text
apps/web          React 19 / Ant Design Pro v6.0.3 / Umi Max 工作台
apps/api          Express 模块化后端，MySQL 8 本地隔离开发库
apps/miniapp      原生微信小程序，只读出库查询
apps/pda          Kotlin / Room / WorkManager 出库扫码
packages/contracts  Zod 请求/响应契约、单位与类型
scripts           初始化、测试服务、备份/恢复、API 文档生成
tests/e2e         浏览器验收
docs/references   已有只读参考资产
docs/api          生成的 OpenAPI 3.1 与接口目录
```

## 第一条业务闭环

1. Web 登录查看导入的出库历史和待处理计划。
2. PDA 下载计划和 9018 条包级实重目录，选择一个未软删计划。
3. 扫描目录中的真实样本条码；每包重量来自目录实重，包数与总吨数独立累计。
4. 可全程断网扫码，本机按已同步版本解析并保存事实；恢复连接补传原 UUID、正文与版本上下文，不重新生成事实。
5. PDA 核对并冻结，库存仍等待 Web 明确确认。
6. Web 详情“核对并确认出库”，在同一事务中扣库存、记流水和审计。
7. 小程序查询显示出库状态。

条码只作为目录键，不从字符串猜重量。入库仍只录包数和总吨数，不扫码。

## Android PDA

```powershell
cd apps/pda
# 在 local.properties 中填写自己的 sdk.dir，或由 Android Studio 配置
.\gradlew.bat assembleDebug testDebugUnitTest lintDebug
```

APK：`apps/pda/app/build/outputs/apk/debug/app-debug.apk`。
新包名 `cn.maozhi.wms.pda.debug`，不会覆盖旧 PDA 包。
真机本地测试先执行 `adb -s <设备号> reverse tcp:4310 tcp:4310`，再安装新 APK。
模拟器可填写 `http://10.0.2.2:4310`。本阶段地址白名单仅允许本机；release 不允许明文连接。
支持扫码枪键盘输入 + Enter，以及手输**条码**验证；尚未实现/验收具体厂商广播、物理功能键或 100 包连续硬件扫码。
必须先下载计划与目录才可离线作业。服务端接受合法历史版本事实，不再按过去七天拒收；服务端会话八小时过期，可重新登录，队列保留。
冲突记录保留，不会自动改重量、删记录或冒充成功；当前版本不开放作废重扫和差异放行。

## 微信小程序

```powershell
npm run miniapp:prepare
```

该命令安装依赖并准备 Vant 官方发行资源，验证页面及组件入口。微信开发者工具导入 `apps/miniapp`，使用测试 AppID（当前为 touristappid），启动本地 API即可预览。无需再手动构建 npm。
开发环境已关闭域名校验，以便访问本机；正式发布必须换自有 AppID、HTTPS 合法域名并开启域名校验。
查询页有登录、分页/前缀查询、详情、刷新、错误/空态与会话失效处理；没有库存写入按钮或 PDA 作业能力。

## 验证

```powershell
npm run test
npm run build
npx playwright install chromium
npm run test:e2e
npm run openapi
```

E2E 使用独立临时 MySQL 库；既有用例为 4311/5174，目录用例为每例独立库与 4312/5175，运行结束后自动删除临时库，不更改开发库。
Android 仪器测试使用单独测试库。`ScanIntegrationTest` 需要启动 `scripts/e2e-api.ts` 的独立测试 API，详见验收文档。

## B1c-1 条码目录

Web 的“条码目录”可上传 txt 全量快照（默认 GB18030，可选 UTF-8），核对新增/消失/重量变更后整版发布；支持版本历史与候选恢复。目录只查扫码实重，不进入库存/单据/报表统计。同内容提示“与第 N 版内容一致”且默认不建版，重建须二次确认。

已有本地库必须先备份并演练恢复，再由本机迁移管理员执行 006；不要用 seed 覆盖。当前样本库已完成迁移，细节见 `docs/FOUNDATION_MIGRATION.md`。旧目录是只读 v1 视图，上传原文件与所有版本一起纳入 SQL 备份。

`CATALOG_PUBLISH_ENABLED` 默认未开启。B1c-2 提供设备完整清单、原正文收妥核验、原单 ERP 行批量确认和 Web 交接确认；确认记录旧协议活动水位，计数不清零，后续旧请求会重新阻断。仍须人工清点从未联网的设备。已扫事实与冻结确认不依赖当前目录，历史版重量不被新目录覆盖。M71 隔离包合成队列已实测，不代表现场实际队列已切换。

## 备份与恢复

```powershell
npm run backup
npm run restore -- D:\maozhi-acrylic-wms\.local\backups\<文件名>.sql
```

备份使用 MySQL 8 `mysqldump` 的单事务导出。恢复创建白名单内的新库，导入后校验项目身份并清理恢复库会话；**不会覆盖现有开发库**。
需要切换时先停止 API，确认恢复库可用后再显式修改本地开发配置；不提供删除历史数据的自动重置命令。

## 状态与取舍

这是可运行的本地里程碑，**不是生产版，也不是四端全部业务已完成**。
开发库使用隔离的 MySQL 8（3307）及本地 ERP 只读样本；业务 SQL、迁移和测试按 MySQL 行为实现。本轮未连接生产或 3306。
Web 使用可核实的官方 Ant Design Pro v6.0.3 工程结构、Umi Max、ProLayout、ProForm、ProTable 和 ProDescriptions；AntD 6 对应的 ProComponents 3 当前使用固定预发布版本 `3.1.15-9`，已纳入构建和浏览器验收，不自动追新。
目录 Web 上传/版本化已完成 B1c-1；B1c-2 的本地版本同步、离线混版补传与旧队列交接已完成本地及 M71 隔离验证。四列表XLSX导出已完成B1b-2；差异容差、手工称重、CSV/打印及撤销更正尚未实施。
架构、兼容策略、未定规则见 `docs/IMPLEMENTATION_PLAN.md`；验收证据与局限见 `docs/ACCEPTANCE.md`。
