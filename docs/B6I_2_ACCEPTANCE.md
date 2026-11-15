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

## 验收状态

目前仅基线完成，尚未实现或宣称目标达成。冷指新浏览器context，不清MySQL缓存；Windows loadavg恒为0，不能据该字段推断主机没有噪声。样本未并行运行构建或回归测试。未做实体设备或生产验收。
