# B6i-2 测量与验收

## 改前基线

代码起点 `2ebd3ce`；生产构建 SHA-256 见 `.local/evidence/b6i2/baseline/environment.json`。`npx tsx scripts/b6i2/measure.ts baseline` exit 0，固定隔离夹具，每组30次，全部样本保留。方法见 B6I_2_PERFORMANCE_SPEC。

| 路径 | 端到端 p95 ms | API p95 ms | SQL await p95 ms | 浏览器脚本 p95 ms | 响应字节 |
|---|---:|---:|---:|---:|---:|
| 入库反查第5页 | 724.09 | 385.86 | 381.86 | 249.20 | 57948 |
| 出库反查第5页 | 752.19 | 406.88 | 403.19 | 259.05 | 57299 |
| 周转冷首屏 | 1523.27 | 626.25 | 335.52 | 577.71 | 140842 |
| 周转热首屏 | 1255.63 | 627.06 | 346.51 | 347.87 | 140842 |

独立 profile：入库全命中汇总291.21ms/COUNT73.81ms，出库300.63/85.28ms，本页SQL约1–2ms。入库 EXPLAIN ANALYZE 为主单驱动，经明细关联两次及临时去重，约10000次明细索引查找，295ms。周转代表请求38条读SQL，月单数聚合90.70ms，五批事件读取57.49/43.68/34.10/24.46/15.72ms；并非单条297ms。多于早期独立周转夹具的查询来自同库20000张反查主单的无关标签指纹扫描。前后采用同一套合成数据，不与早期不同夹具数字直接计算收益。

周转后端 CPU profile 自耗时主要为 localIso66ms、shiftDay54ms、consumeRow26ms、snapshotLocalTime24ms，说明有重复日期转换与日期范围生成。浏览器使用 CDP Performance + CPU profile + Timeline，非 React actualDuration；压缩产物函数名不能直接当源码级归因。SQL probe 是验证进程 await 墙钟；服务器 slow log OFF，未修改全局配置。

组内内容hash均一致：入库 `dd3bad293799a69fec825f38aa68bf48ddd3429bd27df0c99b9e728cc62126dd`；出库 `a07f3b804086cc1f1160c0e4f396ccd57e1185bf08c6e6bb0aeb6400dba43b6b`；周转冷/热 `222a794f3508c33f4879f7c838b87b10598e8284cec11ad629a3f12f9970270e`。只排除token/查询指纹身份字段，业务字段完整保留。

原始证据：`.local/evidence/b6i2/baseline/summary.json`、逐次 `*-requests.json`、`*-profile-{browser-cpu,server-cpu,trace,plans}.json`。baseline初版计划按SQL去重时选到周转末尾空批，其对应EXPLAIN不能用于首批归因；`experiments/plans.json`补存相同夹具真实首批SQL/参数的计划，原始记录保留。

## 查询实验（实现前）

同夹具每条查询独立10次：反查改为命中明细直接关联主单并一次 COUNT DISTINCT/SUM，明确由商品索引驱动，入库/出库 p95 29.09/29.40ms；原汇总约290–300ms，未指定驱动顺序的改写仍143.63/147.65ms。使用现有 product_code/outbound_product_fk 和主单PRIMARY，不需新索引。周转首批现有PRIMARY显式有序范围读取56.87→14.99ms；原计划虽标PRIMARY，后续哈希连接使LIMIT前处理大量剩余行，具体树见实验EXPLAIN ANALYZE。未建026。

## 改后实测与目标

同夹具、同筛选、同生产构建方式，改后每组30次，未剔除慢样本。独立profile不纳入p95，p95为nearest-rank第29/30个；各阶段p95不相加，也不将p95相除称为请求等待占比。

| 路径 | 改前端到端 p95 ms | 改后端到端 p95 ms | 改后 API p95 ms | 改后 SQL await p95 ms | 改后脚本 p95 ms | 响应字节（前→后） | 目标结论 |
|---|---:|---:|---:|---:|---:|---|---|
| 入库反查第5页 | 724.09 | 390.47 | 13.48 | 9.12 | 266.00 | 57948→57948 | ≤500ms 达成 |
| 出库反查第5页 | 752.19 | 396.92 | 16.68 | 12.94 | 266.48 | 57299→57299 | ≤500ms 达成 |
| 周转冷首屏 | 1523.27 | 1184.47 | 303.10 | 126.04 | 594.72 | 140842→49192 | ≤800ms 未达成，仍超384.47ms |
| 周转热首屏 | 1255.63 | 880.06 | 254.55 | 114.15 | 340.42 | 140842→49192 | 单列热测，不代替冷测 |

本表使用含图表容器修复的最终生产构建重新采集的四组各30次，`measure-final.log`对应命令exit0。此前改后测量完整保留在`after-before-containment/`，其端到端p95为387.92/386.65/1150.41/888.70ms；不选择较快一轮替代最终代码数据，也不将轮次间小幅变化归因于单行裁切样式。

反查全范围聚合改用现有商品索引驱动，服务端按筛选及写入版本复用准确总数/汇总。周转每次请求仍计算数据，跳过未使用的月单数和单据标签扫描，复用请求内日期转换/派生结果，稳定图表与列定义引用；未缓存周转结果。周转响应减少91650B（约65.1%），来自修正公式D的重复日期数组；未裁掉业务行、数值列或图表结果。反查响应及脚本耗时基本保持，浏览器侧284ms问题本批没有证实消除。

## 改后 SQL / profile 证据

- 反查首次聚合：独立profile入库36.99ms、出库38.73ms；EXPLAIN分别为明细 `product_code` / `outbound_product_fk` 的ref查找、主单PRIMARY的eq_ref；ANALYZE聚合39.1/52.6ms。第5页的30份请求均无筛选总数COUNT及全范围SUM，首次恰有一条合并COUNT/SUM。出库本页摘要仍含按单统计扫码记录数的COUNT子查询，这是页面业务字段，不属于筛选总数查询。
- 周转独立profile由38条读SQL降为12条；五个2000行批次14.55/18.33/14.31/14.17/14.33ms，末尾空批0.88ms，余额锚点20.72ms，两条诊断7.20/9.27ms。原SQL等待是多次读取累计，不是单条297ms。实际首批ANALYZE见 `after/turnover-profile-plans.json`，复用PRIMARY范围，避免原计划在LIMIT前构造10000行临时结果；不新增026。
- 后端CPU采样中localIso自耗时约66→23ms；请求内日期复用后shiftDay/snapshotLocalTime不再是主要自耗时。CPU profile包含采样器开销，不能当作30次接口耗时。
- 浏览器提供CDP ScriptDuration/LayoutDuration/RecalcStyleDuration、CPU profile与Timeline。周转冷脚本p95为577.71→594.72ms，热脚本347.87→340.42ms，未证明冷脚本收益；剩余冷启动/页面渲染成本显著。压缩函数名不作为React组件级归因，未声称拿到React actualDuration。

原始证据位于 `.local/evidence/b6i2/after/`：`environment.json`、`summary.json`、`comparison.json`、`field-verification.json`、逐次 `*-requests.json`、`*-profile-{browser-cpu,server-cpu,trace,plans}.json`。最终comparison使用`comparisonHashMatches`明确表示排除公式说明后的comparisonHash；逐字段复核另外只规范化公式D的日期列表，四组各30份全部通过。所有证据不进Git。

## 正确性与边界

- 入/出库每次total=10000，第5页50行；全部字段、汇总与顺序hash和基线相同，分别为 `dd3bad293799a69fec825f38aa68bf48ddd3429bd27df0c99b9e728cc62126dd`、`a07f3b804086cc1f1160c0e4f396ccd57e1185bf08c6e6bb0aeb6400dba43b6b`。
- 周转每次total=50。冷/热60次排除行formula后的业务hash均为 `7e9757200ef61cd5b29c4909b236536501bc2d6e2b81555225015c99090a7547`，与原始基线重算一致。额外逐字段复核将基线D日期数组换为数组长度后，冷/热各30份完整业务响应与改后完全一致；没有忽略formula的其他差异。完整业务hash由 `222a794f3508c33f4879f7c838b87b10598e8284cec11ad629a3f12f9970270e` 变为 `1cda8c159eb1480261bf8fc37f8d66df0fc91380b7ecec26fb2b5752fae82048`，不宣称全文hash不变。
- 独立API回归验证首查COUNT=1、第5页筛选COUNT=0、明细更新后重新COUNT且汇总包数+1；既有任一/全部/重复编码、软删、多条件与导出测试保留。缓存仅Web列表使用，客户端不能提交已知总数；数据写入前后和有写入事务结束推进失效版本。
- 缓存为当前API进程内5分钟、最多256条；数据库/审计水位参与键。无审计的外部SQL写入无法推进进程版本，应重启API或等待过期，不宣称支持任意多实例/外部直写强一致。当前验证只用本地隔离合成库。
- B7a-3导出仍回放服务端保存的不可变完整读模型，过期/缺失409；未改导出代码、业务计算、库存写入、分页/导出上限或既有性能阈值。没有新增索引迁移，026往返/非空down不适用。

## 环境噪声与剩余瓶颈

前后同机i5-11400F、32GiB、Node24.14.1、MySQL8.0.46/128MiB buffer pool，生产Web构建；测量期间未并行运行构建/测试。冷指新浏览器context，无HTTP/React Query缓存；未清MySQL buffer pool，造数可能暖库，不声称物理冷盘。反查每次首查前清理本批服务端汇总缓存；周转无跨请求结果缓存。

反查减少约334/355ms且伴随全范围SQL消失，周转冷API约626→303ms且SQL条数/日期CPU工作下降，属于有查询计划及profile支持的真实收益。周转冷/热SQL p95约126/114ms，浏览器冷脚本594.72ms、热340.42ms的差距持续存在，冷首屏未达标不能归为一次环境偶发。Windows loadavg恒为0不能证明无主机噪声，未记录完整主机CPU调度，不把毫秒级差异当作确定收益。排序/拖拽AF-056不在本批闭环范围。

## 验证与提交状态

最终 `npm run test` 531/531，失败/取消/跳过=0/0/0；`npm run build` exit0。专项18/18、列表7/7通过；缓存测试独立文件1/1通过。测试文件拆分时一次build因两项未用导入/函数失败，清理后完整test和build重新通过，未修改测试断言。

最终完整`npm run test:e2e` **191+18=209/209**，失败/跳过/重试=0/0/0，exit0；主套件21.8分钟、目录专项3.6分钟，日志`.local/evidence/b6i2/e2e-accepted.log`。原性能门槛与断言均保留。

此前失败和对照完整保留：首轮190/191（月报切宽溢出），第二轮189/191（月报/周转切宽溢出）；两轮均因`&&`短路未执行目录专项。Trace显示1280窗口仍保留1022px旧画布、右边界1359px，切宽后约15ms即检查。月报单项3/3，月报/周转各3次5/6；临时撤回memo仍5/6，窗口resize同步监听4/6，后者已撤回。日志依次为`e2e-monthly-repeat.log`、`e2e-report-repeat.log`、`e2e-chart-restore-repeat.log`、`e2e-chart-resize-fix.log`；完整失败trace见`e2e-first-failure/`和`e2e-second-failure/`。

图表容器增加overflow裁切后6次切宽全部通过，但一次脚本scrollLeft后立即检查表头/表底坐标差300px（`e2e-chart-containment.log`）。仅该用例增加两次rAF绘制同步，原<2px断言不变；最终专项6/6（`e2e-chart-final-repeat.log`），随后上述完整209项通过。没有修改截图helper、数据来源或测试阈值。该问题有具体DOM/异步绘制证据与修复，不能归为环境噪声；不宣称AF-056闭环。

月报/周转1440与1280截图已复核，图表、汇总、对账和表格稳态布局正常，文件为`.local/evidence/b7a3-{monthly,turnover}-{1440,1280}.png`，不入Git。最终生产构建日志`build-final.log`，性能重采期间没有并行构建/E2E。

代码审查覆盖全部差异，核对参数化SQL、事务失效、单据任一/全部条件、原快照回放、memo依赖及图表tooltip的confine约束；未发现功能/安全阻断问题，`git diff --check`通过。基线提交 `6c416ba`，实现 `c296e5c`，第3笔为本验收及验收中发现的容器/绘制同步修复；前两笔未改写。代码和本地自动化验证完成，反查目标达成、周转冷目标未达成，待用户验收。本批未合并/推送，未做实体设备或生产验收；第三笔后停止。
