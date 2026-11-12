# 四端重建 / 第一里程碑

## B4e / B4g：已完成（2026-11-12，用户验收通过）

- **B4e 单据字段扩展：269/119/0**。test 269/269、完整 E2E 119/0、build exit 0，三项 exit 均为 0；单据类型默认值/筛选/导出、柜号、出库行合同号及行备注已完成。017 已备份后应用 3307 开发样本库，历史 NULL 展示、新建默认值与「全部」包含历史单的冒烟通过；已合并推送，merge `19022412fe9bd84844f9f559b51b6c8c2f8d7ade`。
- **B4g Web 清点工作台：276/120/0**。test 276/276、完整 E2E 120/0（主 111 + catalog 9）、build exit 0，三项 exit 均为 0；单条/候选/混合商品粘贴、商品归属、进度、撤销、带入实发与扫码清单导出已完成。验证与边界见 [OUTBOUND_FACT_SPEC.md §13](OUTBOUND_FACT_SPEC.md#13-b4g-实现与本地验证2026-11-12)。
- 018 已于本轮备份后应用 `127.0.0.1:3307/maozhi_dev_sample`，状态 `applied`；仅 `scan_facts` 结构变化，所有原有业务列数据指纹一致。备份、完整结构指纹及冒烟原始结果见 `.local/evidence/b4g-closeout/`。
- 018 应用后 API/数据库冒烟：`CK-20261112-001` 录入条码 `003A0050164`，商品 `002`，`source=manual`、`attribution=manual`；同单重复返回 422「已录入」。撤销后进度 1→0 包、300000→0 克，导出 1→0 行，原记录与审计保留、库存不变；冒烟计划保留，未确认出库。
- B4g 非快进合并 `9eeeb6705cf7b780b4938c60c90da8b6c6fa1c72`，合并与推送 exit 均为 0。上述全量验证为本批已验收结果，本次收尾仅执行迁移及冒烟；自动化与截图仅覆盖本地合成库、Chromium，不代表实体设备或生产验收。

## B4d：人工实发与发货 #1（2026-11-11）

人工实发、扫码预填/确认快照、发货 #1、扫码清单 XLSX、016 与扫码结束标记已实现并验证：test 263/263、build exit 0、E2E 117/117（主 108 + catalog 9）、Android `assembleDebug testDebugUnitTest lintDebug` exit 0。016 已备份后应用到 3307 开发样本库并完成结束扫码/新建发货冒烟；未连接生产、未做实体 PDA/小程序设备验收。验收见 [B4D_ACCEPTANCE.md](B4D_ACCEPTANCE.md)。

裁定：同商品多行更正主键调整纳入 016；`frozen` 仅兼容历史记录且代码不再写入，确认仍兼容 `open/frozen`；结束扫码改写 `scan_closed_at` 且不改单据状态，重新扫码仅限 `open` 且无发货记录。历史时间回填来源及样本无历史 `frozen` 单据详见 B4D_ACCEPTANCE。B5c 多批/短关未实现；B4g 清点工作台已在后续批次完成，见本文顶部。

## B6c：三小步已完成（2026-11-11，用户验收通过）

B6c-1 失败留证、B6c-2 安全投影与时间线、B6c-3 页面与导出均已完成并通过用户验收。最终验证 **240/116/0**：test 240/240、完整 E2E 116/0、build exit 0；三项命令 exit 均为 0。015 已应用开发样本库；本轮按授权统一合并推送。

## B6c-3：操作记录页面与导出（2026-11-11，已完成，用户验收通过）

已完成页头导出、当前筛选统计、列表/对象时间线切换、近 7 天/类型/关键字/渠道/结果/危险操作筛选、URL 与保存视图、中文结果和危险标签、结构化详情及按需原始数据。复用 B6c-2 安全投影与诊断鉴权、B6b 异步导出，不新增迁移/索引/依赖。普通 XLSX 实测 100000 条、45.584 秒、重复 0；100001 条 422，过期视图 409，失败/取消无半文件。

本轮 test 240/240、build exit 0、完整 E2E 116/0（主 107 + catalog 9），三项 exit 均为 0。10 张 1440/1280 状态截图与原始证据见 [B6C_3_ACCEPTANCE.md](B6C_3_ACCEPTANCE.md)。收尾分支 `codex/b6c-3-audit-page`，按授权统一合并推送；仅本地合成库与 Chromium，不代表实体/生产验收。

## B6c-2：安全查询、原始数据专用入口与时间线（2026-11-11，已完成，用户验收通过）

已实现两类记录的安全投影、结构化变化、登录 Web 专用 raw/trace JSON、按对象分页的时间线，入库/出库/盘点详情共用失败事件来源；旧 `/audit` 已收紧。没有新增迁移或索引，015 开发样本库页面冒烟完成。B6c-2 原开发分支 `codex/b6c-2-audit-projections`，随 B6c-3 统一收尾；统计条和页面收尾见本文 B6c-3。验收证据见 [B6C_2_ACCEPTANCE.md](B6C_2_ACCEPTANCE.md)。

全量 test 238/238、最终审计边界补测 11/11、build exit 0、完整 E2E 114/0（主 105 + catalog 9），命令 exit 均为 0。前两轮 E2E 分别有旧定位冲突与一次 61ms 拖拽长任务，修正定位、保留性能门槛后完整复跑通过；原始失败与复核日志均保留。仅 Chromium 和本地数据验证；大窗口查询扫描成本及诊断边界替身测试的限制见验收记录。

## B6c-1：操作记录留证基础（2026-11-11，用户验收通过，已合并推送）

已按批准范围澄清规格、增加 015_audit_attempts，并实现业务/鉴权/输入/批量逐单失败留证。成功事件与业务同事务；失败在回滚后独立保存，提交结果不确定记「结果待核实」。渠道来自验证后的会话或固定路由，输入摘要只存白名单，嵌套对象与 JSON 字符串递归脱敏。迁移先做 EXPLAIN，非空证据表在任何 DDL 前拒绝 down。

已验收基线 test 227/227、build exit 0、完整 E2E 113/0（主 104 + catalog 9），三项 exit 均为 0。015 已在备份和独立恢复校验后应用开发样本库 3307；迁移只增加尝试表与扩展成功记录表，旧数据指纹一致。样本 422 一条、确认重放两次仍只有一条成功事件；页面可见性在 B6c-2 代码完成后补验。分支规范为 `codex/b6c-1-audit-attempts`，非快进合并 `c9311d8455214ebb188dfe30e5926073be9319a8`，远端 master 同值，push exit 0。原始证据见 [B6C_1_ACCEPTANCE.md](B6C_1_ACCEPTANCE.md)。

## 体验修复 A/B（2026-11-11，已完成，用户验收通过）

A 批以 `0d8d293` 合并、推送 master。B 批已完成错误分类、业务文案、本机草稿/离开保护与提交锁，通过用户验收，并以 `19ebad05a092f0ec7a8e47d8a832e62381697a97` 非快进合并、推送 master，远端 HEAD 核对一致，push exit 0。本批无迁移，不改生产/开发样本库；B6c 当前进度见本文顶部。

B 批最终验证 **212/113/0**：test 212/212、build exit 0、完整 E2E 113/0（主 104 + catalog 9），三项 exit 均为 0。Web 禁止词 50 → 0；连点、超时重试、回车连发、双击确认均只产生 1 条记录或操作。仅 Chromium，截图与原始输出见 [WEB_UX_B_ACCEPTANCE.md](WEB_UX_B_ACCEPTANCE.md)，不代表其他浏览器、设备或生产验收。

### 体验修复遗留项

- 排序结果绘制 p95 579ms（请求仅 10.6ms），瓶颈在前端渲染，待 React Profiler 定位。本轮登记，未实施性能优化。

## B6a-num 编码补充批（2026-11-10，已完成，用户验收通过）

最终验证 **208/86/0**：test 208/208、完整 E2E 86/0（主 77 + catalog 9）、build exit 0，三项 exit 均为 0。014 已备份后应用本机 3307 开发样本库；新客户 C00001、新仓库 W01、新入库 RK-20261110-001 冒烟通过，旧编码和库存不变。样本库无 RK/CK 四位序号旧号：样本原号打开与独立测试库四位号兼容分别验证，不混写数据来源。详见文末本批记录及 [B6A_NUM_ACCEPTANCE.md](B6A_NUM_ACCEPTANCE.md) §5；体验修复批、B6c、B10 未开始。

## B6b 公共交互（2026-11-10，已完成，用户验收通过）

- Step 1–4 已按确认完成：默认 50/四档分页、身份/页面/schema 隔离视图、严格参数；入/出库商品反查；详情三入口与逐单批量撤销；两种导出 schema、三种范围、XLSX/CSV、10 万行上限及重放/失败完整性。
- Step 5 补入/出库高级查询抽屉、条件 tag/URL、Esc 焦点返回；修复非可撤销记录被误禁选而无法导出的问题，批量撤销仍只接收符合条件的单据。表格浅色选中不新增边框；1440/1280 全部四态页面宽度相等，表格矩形变化 0px。
- 最终验证 **200/84/0**：test 200/200、完整 E2E 84/0（主 75 + catalog 9）、build exit 0，三项命令 exit 均为 0。已完成历史单可选、三态排序、列宽拖拽和服务端列偏好；完整套件在追加排序修复 `f88cee3` 后通过，未用定向结果替代。
- 013_list_preferences 已于 2026-11-10 应用本机 3307 开发样本库，备份、前后结构/数据指纹与登录→拖宽→刷新冒烟通过；清缓存也能从服务端恢复。仅新增偏好表，原结构与业务数据不变；没有生产连接变更。详情见 [B6B_ACCEPTANCE](B6B_ACCEPTANCE.md) §12。
- 每类 1 万主单/10 万有效明细，普通列表与商品反查、并发 1/5、冷/热各 30 次。普通列表并发 1 达标；反查与并发 5 有超阈值项，用户确认不阻塞本批。详细 p95、接口/SQL 时间、原始样本及库存导出 EXPLAIN 见 [B6B_ACCEPTANCE](B6B_ACCEPTANCE.md)。未新增性能索引或改写查询。
- 已消除“商品 130”证据歧义：Step 2 为开发样本库出库 `130`，33 单/34 有效行/1532 包/463.7705 吨；Step 4 为随机合成库入库 `WL-P000130`，1 单/2 行/2 包/0.6000 吨。打印规格独立提交；B6c 和后续批次未开始。

### 遗留与后续

- **B6b-perf**：反查翻页约 850–900ms（完整原值见验收 p95 表）；库存 10 万行导出深分页约 62s，SQL 等待约 93%。先做 EXPLAIN 与单查询基准再决定优化；本轮不实施。
- 并发 5 为压力场景，单用户以并发 1 为准；保留并发 1 的反查超标，不以压力口径掩盖。
- 跨浏览器恢复仅验证独立 Chromium context 与新登录会话，Firefox/WebKit 未覆盖。

## B6a 主数据与单据快照（2026-11-10，代码、012 开发库应用及本地自动化验收完成）

商品来源/库存资格按逐商品报告映射；主数据可维护并有四类进行中引用停用守卫；新增 party_contacts、车辆归一化与单据快照。012 已应用至本机 3307 开发样本库，旧业务日期和历史快照保持 NULL，非空库拒绝回退。本轮复跑：`npm run test` 179/179，`npm run build` exit 0，`npm run test:e2e` 66/0（主套件57、catalog套件9）。代码与本地自动化完成不代表实体设备或生产验收；详细证据见 [B6A_ACCEPTANCE.md](B6A_ACCEPTANCE.md)。不包含 UI-2、B5b/B5c、打印或工作台。

## B4a 边界修补（2026-11-08，代码与本地验证完成，待用户验收）

- 范围仅 R1/R2/R3/R5/R6；R4 报表性能、R7/R8 PDA、R9 Android 测试更新、B3c、打印均不在本轮。以下覆盖早期主数据 CRUD 与出库编辑描述，验收状态以 [ACCEPTANCE](ACCEPTANCE.md) 顶部为准。
- R1：本地 `open` 计划只允许修改车号/备注，不写明细行，行 ID 保留；已下发或已有事实仍可安全改表头。原客户、仓库、单号不可更换；旧客户端可以原样回传明细。明细变更返回 `409 PLAN_LINES_IMMUTABLE`，含用户确认的提示。沿用修订号/摘要、行锁、审计与命令幂等；冻结、终态、历史源单不可编辑。
- 作废边界保持 B2a：提示同时说明已下发/已扫计划当前不能直接作废；B4a 不新增撤回、丢弃离线队列或放宽作废规则。
- R2：用户已确认商品仅由 ERP 维护，Web 明示“商品由 ERP 维护，此处只读”；商品新增、编辑、启停 API 均拒绝。列表和选择器只返回 `erp-product`；入/出库建单均检查 ERP 来源。原有 `app`/`sku-spec` 资料保留，不清理、不改来源；仓库/客户/供应商保留维护入口。**（已废弃：B6a 起商品改由本系统维护，只读限制移除，见 MASTER_DATA_SPEC §2 与 DECISION_LOG）**
- R3：四类主数据统一 `{items,total,page,pageSize}`；默认 20、最大 200，服务端编码/名称搜索、稳定编码排序，取消 500 条截断；精确编码 GET 支持已选项回显（停用可回显、不可新选）。入库、出库和盘点仓库选择器接入分页查询。盘点商品范围沿用其专用 ERP 查询接口。
- R5：计划重量上限按**每行 1000 吨**，整数克、100 克精度；创建输入与明细输出共用同一契约，Web 最大值同步。单据总量仍按多行求和，不把每行上限误用于整单。
- R6：业务类型映射使用 `Map`；`constructor`/`__proto__` 回退未分类，保留原文并标记不可验证，按中低风险处理。
- 迁移：新增 `010_outbound_memo`，仅为 `outbound_orders` 增加可空 `memo VARCHAR(500)`，无回填。已先备份并恢复校验，再应用到本机 **127.0.0.1:3307 / maozhi_dev_sample**；35 张业务表原有列指纹不变。证据见 [迁移记录](../.local/evidence/b4a-migration-1794149745233.json)。010 未完成时拒绝启动 API；非空备注禁止 down，禁止通过回退删除备注。
- 验证分层：API/浏览器使用随机隔离 MySQL 测试库；开发库只做备份、010 和读取冒烟。离线时序使用保存原始 JSON 的协议模拟器加真实 Web 编辑，不代表实体 PDA 验收；本轮不运行 Android 验证。生成 OpenAPI 同步当前注册契约（包括之前仅更新源码的接口），不据此扩大功能完成范围。

## B3c 周转率与库龄（2026-11-09，代码完成；周转率冷首屏未达性能目标）

- 范围：仅 Web/API 两张只读派生报表及现有 XLSX 通道；复用 B3b 的 ERP 来源、同一只读快照、对账行和“不可验证”原因。无迁移、不改库存入账或移动端。屏幕/API/XLSX 共用字段与合计定义，显示公式、分母、日期、水位和数据口径。
- D6 期间：默认上海自然日“本月 1 日至昨日”；可选“上月”（完整自然月）、“近 30 天”（截至昨日的 30 个完整日）、自定义含首末日。选到今天标“未完结”，今天不计入完整日 D 或确定指标；若本月 1 日当天使默认 D=0，则明确显示空期间，不暗换上月。最大查询范围沿用 B3b 的 367 天。
- D6 计算：每日 Q(d) 取可验证的日终 ERP 吨数；无流水日沿用前一日日终余额并仍计入 D。净出库 O 只含出库确认与撤销，M=ΣQ(d)/D，次数=O/M，天数=D×M/O；汇总重新计算比率。所有有效库存变化（含人工/导入调整、盘点回写）进入 Q(d)，不进入 O。页面和导出标“本期含调整 N 笔、含盘点回写 M 次”；调整按人工/导入流水行计，盘点按操作 ID 去重（历史无 ID 以流水 ID 计），未知类型另列诊断。报告说明写明调减/盘亏可降低分母、使周转率偏高。未知日/断链不补零或缩短 D；零分母、无出库等按 REPORT_SPEC 显示。
- D7 库龄：同截止日/水位按已入账顺序重放吨数 FIFO，分 0–30 / 31–90 / 91–180 / 181–365 / >365 天及“无法归龄”；不按吨数反推包数。入库撤销若原层已被出库耗用，相关仓品剩余余额整体转“无法归龄”，不回填原层或重写既有出库层分配；新单据继续由 B2a 下游依赖检查阻断该撤销，保守分支处理历史/异常证据。可证归零后从可靠新层恢复估算。
- 库龄查询另带与周转一致的本期起止日，用于两页逐仓品显示同一格式的调整/盘点回写笔数；截止日独立决定 FIFO 余额水位。选到今天时报告标“未完结”，本期计数截止昨日。
- 独立只读 SQL 核日终结转、ΣQ、净出库、调整/盘点笔数、收发存等式及“五档+无法归龄=同水位吨数”；缺锚点/断链只报告未知。验收提供可手算逐日库存（含无流水日）、部分 FIFO 耗用、入/出库补偿夹具；逐字段比屏幕/API/XLSX，覆盖无出库、零日均、无法归龄及今日未完结。10k 有效流水在隔离测试库实测冷/热首屏、翻页和全量导出耗时；冷档含该报表首次查询/索引读取，不手工预热，但夹具写入可能触及 MySQL 缓冲池。首屏按冷档与 <1.5s 比较，实测超标如实记录。测试、构建、E2E 与浏览器验证分层记录，生产/实体设备不在本批验收；数字及限制见 [ACCEPTANCE](ACCEPTANCE.md)。

## B3b 出入库明细与月度汇总（2026-11-08，已实现/本地验证，待验收）

- 用户已确认 [REPORT_SPEC](REPORT_SPEC.md) 的 D1–D5；D6周转率/D7库龄留B3c。开工基线 `e37083c79dd81465aa84367f5a0bb2d00502d879`；本轮只做Web/API报表及复用XLSX，不改变库存、目录、单据状态或移动端协议。
- 日期：历史读取原流水JSON的create_time，按上海本地原文解释并常驻“时间未核实”；不对导入created_at加8小时。新操作读取inventory_operations.created_at（UTC）转上海日。筛选为起日含/末日次日不含，缺日期单列诊断；业务日期/制单时间独立保留，不冒充入账日。
- 粒度与字段：erp-product仓库×商品×月份；历史inbound/outbound与新confirm/reverse归收发，撤销在发生月记负量；check/stocktake.post归盘点、stock.adjust归人工、import归导入、未知原文归未分类调整。包数/整数克独立精确累计，软删排除但计数保留。确认单数按单号去重、撤销按operation_id计数，不跨商品合计；无关联证据用null。
- 每页对账：期初+入库−出库±调整=期末，另列差额/原因；净入库不含调整。历史前后值取原JSON，新操作取结构化before/after。只用已观察的边界余额并与导入原stock快照、末流水/当前stock交叉验证；断点覆盖区间不可验证，未知不补零、不造期初调整。跨月份余额不相加，包含未知单元的总边界也是null。
- 读取与权限：GET `/api/v1/web/reports/details|monthly`；source固定erp-product，fromDay/toDay、warehouse/product、page/pageSize、sortBy/direction严格校验。明细movement=all/inbound/outbound，仅过滤明细；对账仍含同仓品日期范围全部变动，月报非all方向422。READ ONLY REPEATABLE READ，最大367天；PDA/小程序403，all来源/混源/总计参数422。响应items/total/viewToken/rowTokens/report，report含水位、时间/软删/未知诊断和对账行。
- XLSX复用B1b-2单任务/三范围/取消/失败原子发布。共同字段定义保证屏幕/文件一致，附sheet“收发存对账”固定全部筛选区间；选中/当前页主sheet只计其发生额。查询视图变化409拒绝陈旧导出；1000行流式写、2000行投影，不整体读入10万事实。无新增依赖；OpenAPI只更新声明源码，生成物按约定另批。
- 迁移/回退：**无010迁移，无历史回填**。回退本批commit可移除只读报表入口/路由，不回退009，不触碰已完成/进行中盘点及库存事务。保留既有XLSX文件生命周期，不把报表回退变成删除业务记录。
- 未决项/实测边界：正式上线的不可变T0与水位登记仍未具备，历史时区未核实；不能把当前样本导出时刻声明为正式T0。无映射的141个SPEC商品仍不参与报表。完整性只对有证据的范围认证；首屏/翻页U目标及非单调时间10万行排序性能尚未达成/未测。原始SQL、性能、截图和全回归见ACCEPTANCE，生产未验。


## B3a Web 盘点闭环（2026-11-08，已验收）

- 范围：选仓/可选ERP商品范围→生成固定快照→逐行实盘→差异预览→人工原因确认→库存回写；另有列表、详情、作废、常驻进行中入口。B2b更正已后置，PDA盘点/报表/打印未实施；未新增依赖。打印仍依赖积木配置。
- 状态机已确认：创建即 `counting`；仅允许 `counting→completed` 或 `counting→voided`。完成或作废释放暂停；进行中只有作废可提前释放，没有手动/超时解锁。作废不改库存、不写库存流水，快照/实盘/原号保留；不重新开放终态。
- 009新增 `stocktakes` 头（仓库/范围/固定时间/hash/流水水位/revision）、`stocktake_snapshots`（ERP商品、固定包数/DECIMAL吨数，UPDATE/DELETE拒绝触发器）、`stocktake_readings`（初始NULL、行revision、操作者/时间）、`stocktake_windows`（窗口历史及唯一active_warehouse）。原31业务表行指纹不变，历史115入库/415出库不回填。
- 范围：默认全仓有效ERP库存；指定最多100个ERP商品时，无库存也生成0快照。未录为NULL，不等于0；包数与实重独立录入，不扫码、不按统一件重换算。库存软删键碰撞禁止覆盖。盘点号 `PD-日期-UUID片段` 仅为本批追溯号，不扩展RK/CK配置功能。
- 持久暂停按仓库生效，入库确认/出库确认/手工调整/B2a撤销均经同一库存写守卫返回409并给盘点号/详情路径；其他仓照常，PDA离线扫码/事实补传/冻结照常。全局库存writer只在短事务持有，万行回写时他仓确认可能短暂等待，实测时延见ACCEPTANCE。
- 开始：writer锁→校验仓库/窗口→头与窗口→INSERT SELECT快照→hash/count→NULL实盘行→审计→幂等。录入：头行锁→幂等重放→counting/行revision→保存实盘→头revision递增→审计/幂等。回写：writer→头→相关未入账出库行锁（首次一致性读之前）→幂等重放→窗口/预览/token/人工ACK复验→操作→按商品锁库存并每500行批写库存及流水→终态/窗口释放→审计/幂等→统一COMMIT。
- 回写基准仅固定快照：预览验证仓库流水水位、逐格余额和全仓新出现库存格；异常409禁止覆盖。差异=实盘−快照，正负分量独立；零差异也人工完成但不制造0流水。全部步骤失败整体ROLLBACK，快照/原输入/窗口保留。同键同正文重放；异键已终态409。前后包吨、operation_type=stocktake.post、operation_id及原因可追溯。
- 未入账：列出快照后新建待确认入库，及新建/修改/收到补传/冻结的本地未确认出库；入库登记量，出库计划量和已扫量分列，单号可直达。默认409；人工勾选“按快照时点口径回写”表示实盘排除后续收发，完整清单/token/原因/operationId额外记审计。新单/修改/补传改变预览token，旧勾选失效。不是短装超发/差异放行，不自动确认这些单据。
- Web接口均需同源会话：GET/POST `/stocktakes`；GET `/stocktakes/options/products`、`/:id`、`/:id/lines`、`/:id/preview`；PUT `/:id/lines/:product`；POST `/:id/post`、`/:id/void`。写操作UUID幂等键；实盘body `{expectedRevision,actual:{packages,weightGrams}}`，回写 `{expectedToken,reason,acknowledgeSnapshotBasis}`，作废 `{expectedRevision,reason}`；外部整数克、库内DECIMAL(12,4)。GET列表/行默认20、上限200。
- 错误：空原因/契约422；移动通道403；`WAREHOUSE_STOCKTAKE_PAUSED / STOCKTAKE_CLOSED / STOCKTAKE_INCOMPLETE / STOCKTAKE_STOCK_DRIFT / STALE_READING / STALE_STOCKTAKE_PREVIEW / UNPOSTED_DOCUMENTS_REQUIRE_ACK / STOCKTAKE_POSTING_INVALID`等业务冲突409。失败抽屉保留输入，可原键重试；预览变更须显式刷新并重新勾选。
- 本地009已备份→新库恢复32表指纹比对→恢复副本up/down/up→非空拒绝down→开发库up；全部只用3307。新表全空才down；非空保留历史、禁用新入口并前向修复。存在进行中窗口时绝不能直接退回不识别暂停的旧写服务。DDL中断保留applying/reverting，检查真实结构再恢复，不盲重跑或重seed。
- 验证分档：API与浏览器E2E、万行合成库SQL与性能、1440/1280截图、本地样本迁移恢复；数值与原始日志见ACCEPTANCE。本批没有实体设备或生产验收。OpenAPI仅更新声明源码，生成物按约定另批，不混本提交。

## B2a阶段安排记录（2026-11-08；当前以顶部B3a状态为准）

- B2a用户已确认：撤销只纠正误确认，不含实物退货；作废仅限未入账。终态分别为`cancelled`/`voided`，原单/原流水/原号保留，原号不复用，不重新开放扫码。退货独立排期，B2b更正、盘点、统计、打印不进入本批。实现与证据见本文件下方B2a节及ACCEPTANCE，较早“待确认”记录以本节为准。

- B2a开工基线：`3e0d31325718d9fd096ad81c4e14c9bea9b2fe32`（已确认排期文档），之前代码基线为`7502d14f530d0cf92da206adbb6cfacd4af50ae3`。B1a、B1c-1/2、B1b-1/2已按对应批次验收；不扩大为生产或未测设备验收。下文较早批次记录保留当时状态，本节优先。
- 业务前提固定：入库仅包数/总吨数；库存/单据/报表只认ERP商品。手动上传的sku.txt是按需更新的全量扫码目录快照，事实绑定本地同步版本；PDA现场全程离线新扫，仅补传/刷新联网。RK-/CK-各自前缀；差异放行本轮不做。
- **B1b-3打印：已延后，依赖积木报表配置，未完成。** 不排在下一批，不部署积木服务、不以HTML/CSS或新A4模板复刻旧版式。已完成的XLSX字段schema不负责生成打印版式。
- 以后打印实现固定为：打印模板配置表（积木地址、报表ID、token、参数名、格式）→服务端代理调用积木导出PDF→单据按钮下载；模板包含入库单、出库单、出库套打三类。token只在服务端保密保存，不传前端或写日志/仓库；此轮只记录设计，不创建表/接口/按钮。
- 打印验收使用旧ERP与新代理输出的同一单号、同一参数PDF，固定纸张与渲染条件叠图核对；页数/文字/位置/合计须一致，差异必须说明并解决，不能以DOM或XLSX字段对照代替。需提供地址、三个报表ID、token、各模板参数名/值示例及旧PDF；配置未到不影响下列批次。

### 原排期记录：B2a及后续候选（B2b现已后置，B3a先行）

| 顺序/批次 | 范围与依赖 | 可量化验收及证据（B2a实测见ACCEPTANCE；其余为计划） |
| --- | --- | --- |
| 1 / B2a 单据撤销与作废 | 优先修复误确认后的恢复路径；依赖B1a确认操作/前后值/审计。只做本地新单可验证的撤销确认与未入账作废，不同时做字段更正、盘点或实物退货。 | 原确认delta与补偿delta相加为0；20个同键并发仅1笔补偿；逐写入阶段失败后单据/库存/流水/审计/幂等均0残留。下游依赖、库存不足、历史只读、PDA/小程序越权全部拒绝且库不变；给原始E2E、SQL与1440/关键1280截图。 |
| 2 / B2b 关联更正 | 依赖B2a补偿与终态保护。未确认单按版本校验编辑；已确认单保留原单/原流水，新增可追溯的更正关系与显式确认，不原地重写历史。已扫码出库的作废/更正需单独处理事实及晚到队列。 | 原单/已扫UUID正文重量版本指纹变化0；新旧单号各自唯一、关系可双向追溯；重复/并发更正只生效1次，故障无半套更正；屏幕可比较变更前后。E2E、事实指纹SQL、库存净变化SQL及双宽度关键截图。 |
| 3 / B3a Web盘点闭环 | 依赖B1a调整事务与B2纠错链；ERP仓库/商品快照→实盘包数和总吨数→差异→Web明确回写。PDA盘点扫码不自动加入本批，扫码目录不充当库存。 | 差异=实盘−快照，已批准回写delta与流水/库存逐格一致；重复回写只1次；盘中有变动必须提示并阻止旧差异直接覆盖，拒绝时0写入。覆盖零差异/盘盈/盘亏/并发/失败恢复；1万行分页不截断，SQL全量对账、E2E及1440/1280截图。 |
| 4 / B3b 基础统计：出入库明细、月度汇总 | 依赖B2/B3a确定确认、补偿、调整和盘点事件口径；复用列表/导出基础。单据明细与库存流水分别核对，不拿单据创建日期冒充库存入账日期。 | 每仓ERP商品：期初+期间全部有效delta=期末，包数/整数克差异均0；入库/出库/补偿/调整/盘点分列，软删排除量单列。月末/跨日/重复/未知类型用例；屏幕与XLSX逐字段差异0、10万行末条命中；SQL、E2E、性能原始输出及截图。 |
| 5 / B3c 派生统计：周转率、库龄 | 依赖B3b可对账的基础台账，且须先确认分母/时间窗/耗用规则。历史不足时显示“不可计算/待核实”及覆盖率，不静默套FIFO或用SPEC日期推算。 | 人工可核算边界夹具与SQL结果一致；零库存/零出库不出现Infinity/NaN；库龄分段与可归龄ERP余额合计差异0，未能归龄量独立列示；冻结截止日重算一致。逐字段XLSX比对、SQL、E2E、耗时及截图。 |

选择依据：B2a业务价值在于纠错且写库风险最高，先稳定补偿依据，才能安全扩展更正与盘点；报表后做可避免把状态/补偿规则固化两遍。B3b先交可直接对账的两报表，B3c再处理更依赖历史证据和业务定义的两报表。以上批次名细化旧B2/B3，不把旧矩阵同编号的其他U/N项目自动纳入。

### B2a已确认安全边界

- 撤销用于“误确认”的账务纠错，不自动代表实物退货。原确认/流水不删除，以关联原操作ID的反向补偿入账；撤销后保留明确终态，不能直接退回可重复确认/继续扫码的状态。改数量/商品的更正留B2b。
- 不能把余额足够当成无依赖：按同仓ERP商品关联后续出入库、调整、盘点及已有补偿检查；缺少可靠逐批消耗关系时不推测FIFO，先阻止自动撤销并展示阻断记录。记录理由和前后值；库存/审计/幂等继续同事务。
- 115张历史入库、415张历史出库保持原状态和只读约束，不猜测原确认操作。历史纠错若确实需要，须先补齐原操作与下游证据并单列验收，不能宣称本批已经支持所有历史撤销。
- 未确认作废先限于可证无库存动作的本地单；有事实、已下发PDA或队列状态不明的出库单，不以“服务端目前0事实”推断安全作废。这部分留B2b明确收妥/晚到事实规则，任何已扫事实不得删除或静默丢弃。PDA和小程序均不获得库存写权限。

### 后续队列与输入清单

- 五批之后建议：系统配置（字典/参数白名单）→个人中心与在线会话（同一身份模块）→消息中心。三者分别独立交付；配置不能任意改写状态机，在线展示自己的设备会话，消息只接已定义业务事件。主数据字段、首页、库存流水下钻及既有U体验欠账仍保留矩阵，不因本安排消失，也不塞进B2a。
- 备份/恢复不降为可选：每次改变库存生命周期或做迁移前，运行既有隔离备份恢复核验，行数/重量/事实指纹100%一致；失败即停止该批数据升级。原库不覆盖。通用备份恢复产品化缺口仍单独保留。
- B2a前提已确认：仅误确认，实物退货独立；历史只读、后续库存动作阻断，不放宽为余额够扣即可。已入账不得作废，终态不得重开或复用原号。
- B2b前需确认：已扫出库更正允许改哪些字段，实物已离场/仍在场如何区分，晚到离线事实如何归档；建议事实不搬单、不重写、数量更正不伪造扫码事实。
- B3a已确认并按本轮执行：按仓库暂停库存确认/调整/撤销，PDA扫码补传不暂停；完成或作废释放。未入账收发需显式快照口径确认；B2b更正继续后置。
- B3b/B3c前需确认：业务日期、历史状态/流水类型含义、期初完整性；周转率按包数或吨数、平均库存算法及零分母；库龄起算点、耗用规则和分段。先列旧实现与候选公式对照，不默认它们天然正确；证据缺失不编造历史。
- 打印输入可后给：积木地址、入库/出库/套打三个报表ID、服务端token、各参数名/值示例、格式/纸张、同单号旧PDF（建议每类覆盖单页/跨页/特殊字符各1例）。不需要为本安排提供生产写权限或新服务。

执行方式：以下为B2a时的安排记录；当前只做获确认的B3a，一个可回滚提交，交付原始测试/SQL/截图后停下。每批保留原始记录；无新业务数据时可回退代码/安全空表迁移，已有补偿/盘点/更正数据时须保留兼容读取，禁用入口或前向修复，不靠down删除历史。性能验收复用B1b本机/临时库条件，列表目标首屏p95<1.5s、翻页<500ms；未达标单列，不宣称通过。

## B2a 单据误确认撤销与未入账作废

- 入库：`pending→confirmed→cancelled`，或`pending→voided`；posting_state分别`pending/confirmed/reversed/voided`。出库：原`open→frozen→confirmed`不变，仅增加`confirmed→cancelled`、无事实/无下发风险`open→voided`。不建立重开、删单、退货、更正或跨单级联接口。
- 新增Web专用`GET /{inbound,outbound}/:id/lifecycle`预览，返回`action/allowed/token/blockers/lines/originalOperationId/closure`；`POST .../:id/reverse`及`.../:id/void`接受严格`{reason,expectedToken}`与UUID幂等键。PDA/小程序403；空原因422；非法转换/依赖/证据不足/库存不足/预览过期均409，明确原因。
- 原确认操作须唯一且逐项流水能与原单数量/实重核对；入库还校验confirmation_operation_id。补偿以原流水delta取负，原流水不修改。`journal_cell_sequence`按仓/ERP商品/有效标记/递增ID查后续动作，不用毫秒时间排序或推测FIFO；余额与原确认后值不符也拒绝。
- 写事务顺序：全局库存写锁→单据行锁→幂等重放→重算预览及依赖→新增inventory_operations→逐商品锁库存并写库存/stock_journal→单据终态→document_closures→operation_log→idempotent_commands→提交。每个商品锁按编码顺序；失败全部回滚，原键可重试，异正文同键拒绝。
- 008新增`document_closures`，原确认/补偿操作各唯一外键，入库/出库真实FK二选一；添加reverse操作类型与入库终态CHECK，不回填历史状态。`outbound_plan_exposures`迁移前计划标`pre-migration-unknown`；所有PDA计划列表/详情（含旧/outbound别名）在响应前记`pda-read`，与作废共用库存写锁。先下发则作废阻断，先作废则PDA收到终态；丢响应也按已下发处理。
- 出库作废另查事实、冻结和交接清单，不把服务端0事实等同现场无队列。已下发/已扫/冻结/交接不明作废留B2b。终态旧UUID同正文可重放已收事实，新事实明确PLAN_CLOSED并保留客户端冲突；PDA APK/小程序未修改，不宣称本轮实体设备验收。
- 迁移演练及本机3307样本up已执行：30表备份恢复指纹一致，原29业务表升级前后一致，115/415张历史单原状态不变；当前真实样本事实0，另用非空隔离事实验证正文/重量/版本不变。空库down/up可执行；任一受影响业务表非空在DDL前拒绝down。008应用不完整时拒绝启动写服务。
- 回滚：尚无新终态/补偿时可撤回代码但保留008结构；全空库才允许008 down。已有新业务数据时必须保留终态契约/只读显示/旧事实幂等入口，禁用终结按钮及写路由后前向修复；不得直接回退到会把新终态当可操作单据的旧包，更不能down或删除补偿。原备份只恢复新库核对，不覆盖现库。
- OpenAPI本批仅更新声明源码，生成物仍按独立提交约定留后续；无新增依赖，业务端仅Web新增操作。E2E/SQL/截图及未完成项以ACCEPTANCE本批表为准。

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

- 业务已确认：用户按需上传 `sku.txt`，每次为有效条码全量快照；消失仅表示移出当前目录（C10修订，旧“视为已出库”措辞撤销），无失效审批；目录只供扫码查规格/实重，不作为库存、单据或报表的数据集，不自动扣库存。库存/单据只认 ERP 商品，扫码产生的不可变实重事实仍供出库核对。
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

## B5a：更正与业务日期（2026-11-09，代码及本地验收完成）

- 已按确认方案实现；只做入/出库数量更正、业务日期、详情摘要/时间线及指定入口。UI-2 查询抽屉、批量栏、反查单据、B5b–B5d 不展开。
- 011 新增更正头/行、原单业务日期与更正版本；复用编号计数器（GZ）、库存操作/流水、审计/幂等。原单数值及扫码事实不改写。
- 有效数量 = 原数量 + Σ(后值−前值)；入库库存差额同向，出库反向；包数/吨数独立，允许只改包数。
- 锁顺序沿用库存写锁→原单→库存行；同版本不同键并发一胜一409；重放先于版本/状态检查。全行预校验后才写编号及业务数据。
- 已更正原单撤销核验原确认及全部更正的连续流水，按有效数量反向，链标记抵消；其他单据的后续库存依赖仍阻断自动撤销。
- 日期默认上海当天，三个月按日历月/月底截断；未来、缺少超期确认和入账后直接改日期为422；更正单没有业务日期。迁移前业务日期未知保留NULL。
- 日期更正独立流程本批未实现。未入账日期更改提供专用接口，仍服从原单可编辑状态（出库已冻结不可改）。
- 现有报表页面更正分列留 B5d；本批固定更正类型、correctionPackages/Grams 及撤销的 correctionOffsetPackages/Grams 元数据，并验证不计正常收发；既有不可验证提示保留。
- 迁移仅在独立合成测试库验证：011 up、空库 down/up、旧行保留通过；已有更正或业务日期时 down 拒绝，库与 DDL 不变。没有升级或重置已有开发数据，未连接生产。
- 最终原始结果：`npm run test` 为 168/168、失败 0；`npm run build` 为 EXIT_CODE=0；`npm run test:e2e` 为 55 passed + 9 passed、EXIT_CODE=0。首次 E2E 的未筛选测试商品定位失败已修复并完整重跑；没有降低断言。
- 完整逐项 JSON、迁移 up/down、日期边界、浏览器坐标和构建输出见 `B5A_ACCEPTANCE.md` 与 `.local/evidence/b5a-*`。代码、构建及真实浏览器已验；未做模拟器、实体设备或生产验收。本批结束，不启动后续批次。

## 2026-11-09 文档评审与入库（无功能实施）

- 本轮实际收到18份未提交文件（AGENTS + 17份docs）；DOMAIN_RULES与本文在开工时均无未提交改动。以代码 `61f4d82` 只读核对外部规格，未运行测试/构建/数据库查询/迁移，未开始B5b、B5c、B5d或UI改造。
- [DOC_REVIEW.md](DOC_REVIEW.md) 记录18组代码与规格对照、不可直接保证的条款、缺失字段/API/迁移、矩阵正文修订清单与UI-3～8依赖顺序。外部规格按评审快照收录，未把建议默认为业务批准。
- 新的主数据目标为本系统唯一维护方；当前代码仍执行B4a商品只读与erp-product守卫。实施前必须完成来源/业务用途映射、单据快照、联系人/车辆及停用保护，不能只移除PRODUCT_MASTER_READ_ONLY。
- 必修订项包括：分批发货的批次与事实模型；盘点独立包吨/盲盘/盘盈/ACK；报表更正避免双计且保留重述视图；目录候选保留证据与设备未知态；审计失败独立记录；打印凭证/模板数据契约；切换T0累计对账与有新账后的回退。
- 评审时的四项业务问题现已全部由用户决策关闭：原号legacy-open承接且仅确认/作废；盘点包吨独立、默认可覆盖折吨/半包手填/200仅渲染上限；样品整包出库扣库存与条码取样分离；审计原值仅登录详情原始数据区。DOC_REVIEW §8保留历史提问，执行以本文件末节及DOMAIN_RULES为准。
- [MIGRATION_011_APPLICATION_PLAN.md](MIGRATION_011_APPLICATION_PLAN.md) 单列3307合成开发库的备份、原列指纹、恢复副本演练、011应用、分环境冒烟与非空拒绝回退。用户说明011尚未应用；本轮未连接数据库验证或执行，执行轮必须重新核验实际状态。
- 历史批次章节保留当时状态；当前读代码结论与后续规格缺口以本节及DOC_REVIEW为导航，不能用早期“更正后置”“报表未实现”覆盖B5a/B3b/B3c，也不能将代码完成写成性能/设备/生产全部通过。

## 2026-11-09 C01–C18定点修订与实施编号（仅文档）

四项决策已进入DOMAIN_RULES及相关规格；C01–C18处理结果见DOC_REVIEW §9。业务待决策项：**0**。真实连接/模板/旧PDF/设备清单等属于未来执行输入，不是待定业务规则；没有据此开始功能实施。011仍仅有应用计划，本轮不连接3307、不运行迁移或测试/构建。

### UI-3～UI-8与正式实施批次对照

| 页面编号 | 实施批次编号 | 具体规格 | 迁移职责/前置 | 建议顺序 |
|---|---|---|---|---|
| UI-3 | B7b 工作台/数据看板 | WORKBENCH_SPEC | 新dashboard/analysis聚合；复用B6f库存+B7a报表+B6d目录证据，本身无必需DDL；实时设备/离场不支持 | 8 |
| UI-4 | B6f 库存概览/流水 | STOCK_PAGE_SPEC | B6a资格、B5c/M-SHIPMENTS剩余量、B3c库龄；新只读投影与实测索引 | 6 |
| UI-5 | B7a 报表页面 | REPORTS_PAGE_SPEC + REPORT_SPEC | 先B5d更正分列/日期更正重述（M-DATE-CORRECTIONS）；正式开账证据由B10/M-CUTOVER-ANCHOR提供，未有锚点仍标不可验证 | 7 |
| UI-6 | B6d 条码目录 | CATALOG_PAGE_SPEC | M-CATALOG-CANDIDATES；保留006/007与既有交接门禁，不在本批加设备实时协议 | 4 |
| UI-7 | B6c 操作记录 | AUDIT_PAGE_SPEC | 已完成，240/116/0；015、成功/失败安全投影、受控 raw/trace、时间线及页面导出；见 B6C_3_ACCEPTANCE | 3 |
| UI-8 | B8a维护 → B8b身份 → B8c通知 | OPS_PAGES_SPEC | M-MAINTENANCE → M-AUTH-EXTENSIONS → M-NOTIFICATIONS；通知依赖稳定业务/任务事件 | 维护可前置，完整页9 |

编号用于稳定跟踪，不表示必须按数值升序实施。UI编号保留页面归属，B编号负责代码/API/迁移/验证范围，不用UI页面完成掩盖后端缺口。

### 前置与独立批次

| 实施批次 | 交付与对应规格 | 迁移职责/门禁 |
|---|---|---|
| 011应用专项（非功能批次） | MIGRATION_011_APPLICATION_PLAN | 另轮按备份/指纹/副本演练/冒烟/非空拒绝回退执行，现有CLI足够，不等待维护UI |
| B6a 主数据与单据快照 | MASTER_DATA_SPEC；C01/C03/C04/C05 | 已完成；012_M及快照迁移已应用本机开发库；逐项状态见B6A_ACCEPTANCE；顺序1 |
| B6b 公共交互（UI-2） | UX_STANDARDS、WEB_UX_SPEC；C16/C17 | 已完成并通过用户验收；test 200/200、E2E 84/0、build exit 0；013_list_preferences 已应用 3307 开发样本库，备份/指纹/冒烟通过；性能另列 B6b-perf；见 B6B_ACCEPTANCE；顺序2 |
| B6a-num 编码补充批 | NUMBERING_SPEC、MASTER_DATA_SPEC | 已完成并通过用户验收；208/86/0；014_master_code_counters 已备份后应用 3307，预期结构差异、旧码保留及浏览器冒烟核验；见 B6A_NUM_ACCEPTANCE；历史重编留 B10 |
| B6e 盘点增强 | STOCKTAKE_SPEC；C08/C09 | M-STOCKTAKE-EXTENSIONS；保留009快照触发器、窗口/ACK；顺序5 |
| B5b | DOMAIN §4，短溢装/追加入库/纠错转移 | M-INBOUND-EXCEPTIONS、M-STOCK-TRANSFERS；独立业务批次，入库仍不扫码；B6a之后 |
| B5c | DOMAIN §5–6，短溢发/分批/短关/取样 | M-SHIPMENTS、M-SAMPLE-MARKS；发货头/行/事实唯一归属、包吨独立剩余量；样品出库类型走普通扣库，取样不扣库；B6a之后、B6f之前 |
| B5d | DOMAIN §2/7 + REPORT_SPEC §10，分列/重述/日期更正/详情单张导出 | M-DATE-CORRECTIONS，原日期不覆盖；更正单无业务日期；打印仅占位；B5c后、B7a前 |
| **B4d 出库手工实发** | OUTBOUND_FACT_SPEC §11–12、B5C_SPEC §3.1 | 已完成；016 发货头/行、scan_closed_at、scan_* 快照、行序与更正行主键兼容；人工实发、发货 #1、预填/XLSX、扫码结束/重开；已应用 3307 开发样本库；验证见本文顶部与 B4D_ACCEPTANCE |
| **B4f PDA 文案改口** | PDA_SCAN_SPEC §8.1 | 无迁移；只改文案，B4d 合并后立即做 |
| **B4e 单据字段扩展** | MASTER_DATA_SPEC §9 | 已完成并通过用户验收；269/119/0（test/E2E/build）；017 已应用 3307，历史/新建/类型筛选冒烟通过；范围及合并记录见本文顶部 |
| **B4g Web 清点工作台** | OUTBOUND_FACT_SPEC §5.1 | 已完成并通过用户验收；276/120/0（test/E2E/build）；018 扩展原扫码表的来源/归属/撤销元信息与订单内条码唯一约束，已应用 3307；录入/去重/撤销与导出冒烟通过，已合并推送 |
| **B6i 性能专项** | LIST_UX_AUDIT、B6B_ACCEPTANCE | 排序绘制 579ms、反查翻页 850ms、10 万导出 45.6s；B7b 前 |
| **B8d 小程序补页** | README 术语表 | 补入库、库存、流水只读页；B8c 后 |
| **B11 PDA 连续扫码** | PDA_SCAN_SPEC | 广播优先 + 键盘楔兜底、手工输完整条码、撤销、声音；B9 前 |
| B9 打印接入 | PRINT_SPEC | M-PRINT-TEMPLATES（含请求去重），依赖主数据快照/B5c/B5d数据契约及真实模板配置，先合成样本PDF验收 |
| B10 切换专项 | CUTOVER_PLAN | **不承接未完成单据、不迁移历史单据**；只导主数据与期初库存，主数据编码重编，PD 编号对齐；B6a/B5c/B8a及业务页面/打印完成后，先隔离演练再另行执行切换 |

**当前主链（2026-11-12 更新）**

```
B4d 出库手工实发
 → B4f PDA 文案
 → B4e 单据字段（已完成）
 → B4g Web 清点工作台（已完成）
 → B5c 分批发货（1、2、3 已完成并合并，3 视觉补修合并 e6f277e）
 → B5b 入库异常（后置：入库无计划字段，短装/溢装口径待定）
 → B5d（1 追加式业务日期更正已完成，333/134/0；2 报表重述读模型已完成、用户验收通过，349/134/0）
 → B6j 设计系统（B6j-1 token + lint；B6j-2 再接入目标值与迁移页面）
 → B6g 联想搜索
 → B6d 目录页
 → B6f 库存页
 → B6e 盘点增强
 → B7a 报表页
 → B6i 性能专项
 → B7b 工作台/看板
 → UI 全量评审（oil-ui 存量润色，只审最终页面）
 → B8a/B8b/B8c 运维
 → B8d 小程序补页
 → B11 PDA 连续扫码
 → B9 打印
 → B10 切换
```

**B6j 定义**：不定“好不好看”，只定“怎么统一”——token 值、共享组件清单、裸值 lint；已有页面只迁移会保留的（主数据、审计、登录、列表壳），将被重写的页面按新系统直接建。

执行拆分：**B6j-1 仅 token + Web 检查，不改变页面视觉**；全局圆角保持 8，目标卡片 12 和 CSS 变量供 B6j-2 使用。共享组件、页面迁移、AF-053 均不在 B6j-1；详见 VISUAL_SPEC §13 与本文末尾本批记录。

**界面评审时机**：全量评审放到页面全部完成之后（B7b 后），不审将被重写的旧页；每批页面交付时可做一次轻量对照，不单独成批。

已完成：B1a、B1b、B1c、B2a、B3a、B3b、B3c、B4a、B4b、B5a、B6a、B6a-num、B6b（含修复）、B6c。

此表仅排期，不授权任何实际开工/迁移/生产切换。

所有M-*只是迁移职责，不是现存文件或已占编号；真实迁移从012按实施顺序编号，明确up/down、原列/来源指纹及非空拒绝破坏性down，不重写001–011。跨批次复用字段不得重复ADD COLUMN。设备观测M-DEVICE-OBSERVATIONS留后续未排期，页面不等待它来伪造实时指标。

修订记录：C01 主数据、快照、日期复用归B6a，保留代码与规格状态区分。
修订记录：C03 主数据、快照、日期复用归B6a，保留代码与规格状态区分。
修订记录：C04 主数据、快照、日期复用归B6a，保留代码与规格状态区分。
修订记录：C05 主数据、快照、日期复用归B6a，保留代码与规格状态区分。
修订记录：C02 分批订单余额/事实模型归B5c，不作为UI状态值补丁。
修订记录：C06 库存与报表读模型分别归B6f/B5d/B7a，保留不可验证及冷首屏差距。
修订记录：C07 库存与报表读模型分别归B6f/B5d/B7a，保留不可验证及冷首屏差距。
修订记录：C08 盘点决策与安全增强归B6e。
修订记录：C09 盘点决策与安全增强归B6e。
修订记录：C10 目录和工作台按可核验证据规划，不支持的设备/车辆观测不强塞本批。
修订记录：C11 目录和工作台按可核验证据规划，不支持的设备/车辆观测不强塞本批。
修订记录：C12 目录和工作台按可核验证据规划，不支持的设备/车辆观测不强塞本批。
修订记录：C13 明确审计、打印、运维的表与服务批次。
修订记录：C14 明确审计、打印、运维的表与服务批次。
修订记录：C15 明确审计、打印、运维的表与服务批次。
修订记录：C16 公共交互/查询/文案归B6b，UI-3～UI-8映射固定。
修订记录：C17 公共交互/查询/文案归B6b，UI-3～UI-8映射固定。
修订记录：C18 legacy-open/T0/回退归B10；四项业务待决策关闭为0。

## B6a-num：系统生成主数据编码与三位单据号（2026-11-10，已完成）

- 批准范围：客户 C+5、供应商 S+4、仓库 W+2；事务计数器、唯一键碰撞重试、不复用与容量守卫。新建不接收 code，编辑只读 code、允许改名；名称优先、辅助编码可复制。
- 用户确认新号固定 3 位、编号规则页只读。RK/CK 按新建业务日期分段，GZ 按上海创建日（更正单无业务日期）；旧 4 位与导入号保留，旧计数续接。PD 编号统一、切换重编归 B10，商品编码仍手工，B6c 不展开。
- 014_master_code_counters：新计数器、三类 legacy_code 回填、不修改原 code；规则默认/已有位宽固定 3，不重置计数。空库 up/down/up 与逐表非空 down 拒绝已在随机测试库通过。2026-11-10 22:57:04.976（上海）备份后应用至 127.0.0.1:3307/maozhi_dev_sample，状态 applied；42 个原结构对象一致，43 张表原有列数据指纹一致，仅有预期 DDL 与回填。
- **已完成，用户验收通过，208/86/0**：完整 test 208/208、E2E 86/0（主 77 + catalog 9）、build exit 0；三项 exit 均为 0，OpenAPI 同步 exit 0。收尾沿用已验收完整验证，本轮补迁移和浏览器冒烟；独立库旧四位号定向复核 1/1、exit 0，不重复累计至 86。原始输出、截图、回退边界见 [B6A_NUM_ACCEPTANCE.md](B6A_NUM_ACCEPTANCE.md)。
- 开发样本库真实登录后创建 C00001、W01、RK-20261110-001；入库保持待确认，库存/流水和既有主数据/单据未改。样本旧号 IN20261107001 可查询打开；样本库无 RK/CK 四位序号旧号，RK-20260101-0088 的兼容读取在独立合成库验证。
- 本批开发分支 codex/b6a-system-numbering；收尾按用户授权合并并推送 master，之后停止。外部 UX 四份规范原样单独提交 b450ebf，未开始其体验修复内容、B6c 或 B10；开发库与自动化验收不代表实体设备或生产验收。


## B5c-1：多次发货、完成发货与短关（2026-11-12，已完成）

- **B5c-1 已完成，295/121/0**：已验收完整基线 test 295/295、build exit 0、E2E 121/0（主 112 + catalog 9），三项 exit 均为 0；OpenAPI 同步 exit 0。本轮计划编辑补修另跑相关 API 回归 23/23、build exit 0，未将补测数冒充完整复跑。
- 019 复用 016 发货表，只加四个可空短关字段；空库 up/down/up 与四列逐项非空 down 拒绝已在随机隔离库通过。本轮备份后应用至 3307/maozhi_dev_sample，状态 applied；结构仅新增四列，原有列数据指纹一致。两次发满自动结单、短关保存剩余量、改计划重算待发三项真实 Web 登录 API 冒烟通过，记录见 B5C_SPEC §15.4。
- 按用户最后裁定，confirm 保留为 shipments 严格别名；使用提交的本次人工实发，发满自动结单，未满保留待发。complete 检查逐行包数/克数，短关只记剩余证据，不写库存流水；整单撤销补偿全部发货记录。
- 计划修改只改现有行；每行新计划包数、克数不得低于已发量，否则 422 指出行，终态编辑 422；发货与库存不变。编辑待发归零后仍须显式完成。增删明细、发货行更正、分批页面、打印及报表衔接留后续 B5c。
- 已按用户授权合并并推送：merge `9c3fcd22c4654f7dc1f2075e3cf19c43ae49eaea`，该次远端 HEAD 一致、push exit 0。未开始 B5c-2，不将整个 B5c 标完成。原始输出、回退方式见 [B5C_SPEC.md §15](B5C_SPEC.md#15-实施拆分与工作量)。

## B5c-2：更正迁移到发货行（2026-11-12，已完成）

- **B5c-2 已完成，322/122/0**：已验收完整测试 322/322、完整 Chromium E2E 122/0（主 113 + catalog 9）、build exit 0，三项 exit 均为 0；OpenAPI 同步 exit 0。本次收尾未重复运行全套，另完成开发样本库四项 API 冒烟，exit 0。
- `020_correction_shipment_line` 已在备份后应用到 `127.0.0.1:3307/maozhi_dev_sample`；结构仅更正明细表发生预期变化，全部原有业务列的数据指纹一致。样本库原有更正行 0，本次历史回填 0；单批回填与回退守卫仍以 §16.1 的隔离库验证为证。
- 冒烟：两批发货未选发货行返回 422、选第二批成功；已出库更正 −20 包转部分发货、待发 20 包；短关更正 −10 包仍短关、剩余 10→20 包；同日同商品/仓库报表与库存流水均为 165 包 / 49.5 吨。新建两张冒烟单据保留，净库存变动 −160 包 / −48 吨。
- 外部文档原样提交：`3a58644`（会话交接约束）、`55ddd02`（B5b 后置计划）。代码合并 `1841d2d18baeaa49009d45920762c93dbeafd6e0`，合并推送 exit 0、该次远端 HEAD 一致；本节为推送后的收尾记录，另提交同步。
- 备份、结构指纹与冒烟原始输出见 [B5C_SPEC.md §16.3](B5C_SPEC.md#163-开发样本库应用与收尾2026-11-12)。本地代码、构建与自动化验收不代表实体设备或生产验收。
- **B5c-3 未开始，必须换新会话**；不把整个 B5c 标为完成。后续仍按 B5C_SPEC §9.1 观察同一订单行拆更正单频率；非空发货行引用禁止 020 down，保留证据、前向修复。

## B5c-3：出库详情分批发货界面（2026-11-12，功能验收与视觉补修完成）

- 起点 `4f9f3a9`，前置 B5c-1/2 均已完成；分支 `codex/b5c-3-shipment-ui`。本节取代上一批收尾时“B5c-3 未开始”的执行状态。
- 范围：计划/有效已发/待发合计，本次实发与差异，确认弹窗（车牌、行数、合计、逐行溢发原因），完成发货、短关原因、发货记录，送货单打印禁用占位。
- 用户已定差异 = 本次实发 − 后端逐行待发；前端不重复计算有效已发/待发，不用差异判定提交资格；空白按零，全单全零禁止；完成按钮有待发禁用并给明确提示。定义见 B5C_SPEC §8/§17。
- 复用现有接口与事务规则；发货 GET 补齐展示所需后端数量，不新增接口、迁移或数据库结构。打印对接留 B9；PDA、报表口径、更正界面、计划明细增删不在本批。
- 三提交：范围同步、界面实现、验证记录。运行 test/build/完整 E2E；1440/1280 详情录入、确认弹窗、短关弹窗截图仅存 `.local/evidence/`，复用隔离测试数据，不向开发样本库写入。完成后停止，不合并、不推送；不宣称用户/设备/生产验收。
- **本地验证 324/127/0**：`npm run test` 324/324；`npm run test:e2e` 127/127（主 118 + catalog 9）；`npm run build` exit 0，三项 exit 均为 0。OpenAPI 已同步，Ant Design 检查 0 issues，差异检查与格式检查通过。失败重试额外连续验证 3 次，原键/正文保持一致且只扣一次库存。
- 范围同步提交 `3c42bfa`，界面实现提交 `9c3530a`，本节随第三次验证记录提交。完成六张截图复核；首轮失败、修复经过与最终完整结果见 [B5C_SPEC.md §17](B5C_SPEC.md#17-b5c-3-页面实施边界2026-11-12)。没有迁移、开发样本库写入、合并或推送；保持当前批次待用户验收，不进入下一批。

### 视觉补修与验收后收尾

- 用户验收功能后授权修复 AF-049～052；AF-053 输入框单位与宽度留 B6j。三列加宽并保持数字单行右对齐，差异统一显示正负号与单次状态词，确认弹窗商品名独立成行且原因标签为「溢发原因」。
- 修复后 `npm run test` 324/324，`npm run build` exit 0，`npm run test:e2e` 主 118/118 + catalog 9/9；定向 shipment UI E2E 4/4。Ant Design lint 0 issues，Prettier 检查及 `git diff --check` 通过。
- 更新截图仅在 `.local/evidence/`：详情录入 `b5c-3-visual-entry-{1440,1280}.png`，差异列横向滚动后 `b5c-3-visual-entry-difference-{1440,1280}.png`，确认弹窗 `b5c-3-visual-confirm-{1440,1280}.png`，短关弹窗 `b5c-3-short-close-{1440,1280}.png`。均为本地 Chromium 隔离 E2E 数据，不代表实体设备或生产验收。
- 用户已授权以 no-ff 合并并推送本分支，执行边界与验证记录见 B5C_SPEC §17.3；最终回复报告合并与远端 HEAD。没有开发样本库写入、迁移或扩大本批范围。

### AF-054 商品列补修（实现与验证完成）

- 由已推送的 `621c3de` 新建 `codex/b5c-3-af054`，按用户最新指定列宽实施：商品最小 200 并吸收宽屏剩余空间，三数量列固定 130、实发列 160、差异列 200；总宽至少 950，超出时只在表格内滚动。
- 商品名称单行省略；非空合同号、行备注组合第二行，均为空时隐藏，长文本有 Tooltip。差异单元格使用 theme token 调整内边距与字号，以容纳完整符号与状态词；AF-053 控件样式仍留 B6j。
- 修复提交 `e9db3e6`；test 324/324，build exit 0，完整 E2E 128/128（主 119 + catalog 9），定向界面回归 8/8，全部 exit 0。AF-054 已修 B5c-3；截图与原生像素裁切仅存 `.local/evidence/`，原始日志和几何测量记录见 B5C_SPEC §17.4。
- 用户已授权本次 no-ff 合并推送；最终回复报告合并 hash 与远端 HEAD。不进入下一批；无开发样本库写入、迁移或实体设备/生产验收。

### AF-054 1280 复测补修

- 起点 `9613f99`，分支 `codex/b5c-3-af054-difference`；仅差异单元格改两行左对齐、逐行 nowrap，包数首行、吨数与单次状态词第二行。保留列宽策略、确认弹窗及业务逻辑。
- 1440/1280 默认未横滚时逐行文字均在单元格与表格可视容器内，页面无横向溢出；1280 第二行右边界 1196.56px，小于可视右边界 1215px。两张原生表格裁切仅存 `.local/evidence/b5c-3-af054-retest-table-{1440,1280}.png`。
- test 324/324、fail 0、exit 0，build exit 0，定向界面 E2E 5/5、exit 0；本轮未重跑完整 E2E。Ant Design lint 0 issues，改动源码 Prettier 与差异检查通过。详见 B5C_SPEC §17.5；AUDIT_FINDINGS AF-054 已补「1280 复测」。
- 用户已授权测试及界面回归后 no-ff 合并推送，最终回复报告合并 hash 与远端 HEAD；仅本地隔离数据验证，不进入下一批。

## B5d-1：已入账业务日期更正（2026-11-12，已完成，333/134/0）

- 起点 `e6f277e`、分支 `codex/b5d-1-date-corrections`；前置 011 未入账改期与 B5c-1/2/3 已完成。仅实现 REPORT_SPEC §10 第 4 条，细节见 §11；不把整个 B5d 标为完成。
- 021 追加日期更正表与非空回退守卫，独立日期版本链/并发/幂等/审计；头表日期不可变，详情与列表展示有效日期，增加详情更多入口、抽屉与历史。
- 原日期 NULL 的 audited 旧单按用户指定文案 422，原单和更正表不变；保留旧头表结构和 NULL，不补录。复用上海今天及三个日历月月底截断规则。
- 不做重述开关、报表归期、打印、PDA、数量更正改造或历史迁移。开发样本库应用已由验收收尾单独授权，见下。
- 一个提交：`feat(documents): append-only business date corrections`。test 333/333、build exit 0、完整 E2E 134/134（主 125 + 目录 9），日期界面定向 6/6；均通过。1440/1280 抽屉与历史截图仅 `.local/evidence/`，验证记录见 REPORT_SPEC §11.1。
- 用户验收通过；实现提交 `b9ef159`。021 已经备份→指纹→应用→冒烟落到 3307 开发样本库：48 张既有业务表迁移前后指纹一致；两方向已入账日期更正成功、原日期不变、浏览器列表显示有效日期，未入账/历史 NULL 均422，库存流水839→839；详细证据及触发器权限恢复过程见 REPORT_SPEC §11.2。
- 自动化验收 **333/134/0**，build exit 0。授权 `merge: b5d-1 date corrections` no-ff 合并推送 master；完成即停止，B5d-2 换新会话，不在本会话开工。不代表实体设备或生产验收。

## B5d-2：报表重述读模型（2026-11-12，已完成，用户验收通过，349/134/0）

- 起点 `3348e30`，分支 `codex/b5d-2-report-restatement`；B5c-1/2/3、B5d-1 已合并，021 在 3307 开发样本库已 applied 且校验和匹配，两个不可变触发器齐全。本批不执行迁移或开发样本库写入。
- 范围：REPORT_SPEC §10.1，查询/导出 basis 与 asOf、流水/日期更正双水位、重述归期、逐月分类桥接、未归期诊断与独立余额；不改原日期或库存事实。桥接含查询区间外月份和未归期行，逐行 inRange，所有行总 delta 为零，单月允许非零。
- 不做：B7a 页面重做、日期更正写入、库存链路、T0 锚点、迁移、打印、PDA/小程序和生产验收。不可定位重述余额返回 null 与不可验证原因，posted 实际余额不随 basis 切换。
- 实现阶段已批准三提交：文档同步、读模型与契约（含测试）、验证记录。运行匹配本批的隔离测试及既有 test/build/完整 E2E；无需截图，不改冒烟数据来源。原“完成后停止，不合并、不 push”已由本日验收收尾授权取代，见下。
- 已实现四类报表 basis/asOf、水位快照、跨月分类桥接及现有 XLSX 同快照导出；posted 实际余额独立保留，重述余额因尚无正式锚点返回 null 与不可验证原因。查询默认 posted 的既有字段与起点旧代码实际运行基线相等；日期更正 UUID 不按递增序号推断可见性。进程内快照到期、淘汰或重启须刷新，详细契约与限制见 REPORT_SPEC §10.1–10.2。
- **最终本地验证 349/134/0**：`npm run test` 349/349；`npm run test:e2e` 134/134（主 125 + catalog 9）；`npm run build` exit 0，三项 exit 均为 0。新增 16 个用例，最终报表专项 39/39；OpenAPI 同步及源码格式/差异检查通过。首轮 E2E 两项旧列表拖拽性能测试未过，保持门槛和代码不变，以最终代码独立重跑完整套件后通过；首轮失败与最终日志均保留，见 REPORT_SPEC §10.2。
- 文档同步提交 `767e4b2`，读模型/契约提交 `036985c`，验证记录提交 `249276f`。迁移最大编号仍为 021，本批未迁移、未写开发样本库、未做页面重构或实体设备/生产验收。
- 用户验收通过，授权以 `merge: b5d-2 report restatement` 非快进合并 `codex/b5d-2-report-restatement` 并推送 `origin master`，完成状态 **349/134/0**。本次仅更新收尾文档并合并推送，沿用已验收的完整测试与构建结果；merge hash、远端 HEAD 与 exit code 在最终回复报告。完成即停止，B6j 未开始，换新会话实施；详见 REPORT_SPEC §10.3。

## B6j-1：目标 token 与 Web 检查（2026-11-12，实施中）

- 起点 `c643cd7c5a94dc4c248d63b53d4f4215257d0007`，分支 `codex/b6j-1-design-tokens`；前置 B5d-2 已验收，349/134/0。迁移最大编号 021，本批无迁移。
- 按用户批准的 VISUAL_SPEC §13：目标圆角 card=12/control=8、间距 4/8/16/24、常规字号 20/16/14/12 与 KPI=28、AntD 语义颜色映射、CSS 变量输出；当前全局主题与页面保持原有效值。
- 只扫 Web src 的颜色/圆角/padding 静态裸值；逐项 allowlist 保留旧违规，新增违规命令失败；padding 的 0/百分比/非长度关键字及 token/CSS 变量引用豁免，裸四档间距也违规。小程序/PDA 留各自批次。
- 不做共享组件、页面迁移、配色改版、暗色模式、AF-053、数据库写入或截图基础设施；规格、决策同步后实施，沿用现有测试框架。
- 三提交已批准：规格与台账、token 与脚本、验证记录；完成检查用例、既有单测与构建后停止，不合并、不 push。代码、本地验证与设备/生产验收分别记录。
