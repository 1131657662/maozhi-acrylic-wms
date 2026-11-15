# B6i-2b 周转率冷首屏评估结论

日期：2026-11-16
状态：**评估后放弃**
代码/阈值：未修改

## 结论

周转冷首屏p95为 **1184.47ms**，高于800ms目标。当前主要成本在浏览器脚本执行，不在SQL。评估后不实施A（合并SQL）、B（60秒服务端结果缓存）或C（chunk预加载），也不组合方案。

| 选项 | 实测依据 | 决定 |
|---|---|---|
| A：合并诊断COUNT | 代表请求中两条诊断COUNT共16.47ms；合并预计仅节省约10–16ms。按当前冷首屏差距，收益不足 | 放弃 |
| B：服务端60秒结果缓存 | 60秒内相同参数的三次完整页面请求都执行12条SQL；缓存不存在。缓存命中不能改善冷启动请求 | 放弃 |
| C：chunk预加载 | 代表trace记录36个JS资源；网络区间去重并集34.08ms，主线程解析/编译3.16ms。可覆盖的部分远小于脚本执行成本 | 放弃 |

后续B6i-3前端渲染优化纳入周转冷首屏复测。若仍高于800ms，按用户决定接受1184ms，并写明「目标未达，成本集中在框架初始化」。该记录不启动B6i-3。

## 测量拆分

既有改后30次样本的冷首屏端到端p95为1184.47ms，API p95为303.10ms，SQL await p95为126.04ms，浏览器`ScriptDuration` p95为594.72ms。SQL await包含数据库引擎、传输和解码墙钟，不等于数据库CPU时间。

另对一次代表性CDP Performance trace按主线程忙区间去重分类。该profile不是30次样本的p95，也不是DevTools面板截图：

| 主线程分类 | 时间 | 主线程忙时占比 |
|---|---:|---:|
| Loading（HTML/CSS解析） | 4.23ms | 0.55% |
| Scripting | 660.88ms | 85.45% |
| Rendering | 82.21ms | 10.63% |
| Painting | 25.66ms | 3.32% |
| 未分类 | 0.38ms | 0.05% |
| 合计主线程忙时 | 773.37ms | 100% |

脚本p95的594.72ms和代表trace中的85.45%来自不同统计口径；85.45%不是脚本p95占端到端p95的比例。主线程解析/编译3.16ms；另外36个JS资源编码大小约3.68MB、网络区间并集34.08ms，后台解析CPU累计114.38ms。网络、后台线程和主线程工作有重叠，不相加，也不等同于可直接节省的首屏墙钟时间。trace函数归因不能把全部脚本工作精确拆成框架、React、图表和周转业务计算。

## SQL与缓存证据

代表周转请求API耗时261.87ms，SQL await累计115.02ms，共12条SELECT：

| 查询内容 | 次数 | SQL await累计 |
|---|---:|---:|
| 会话认证 | 1 | 0.71ms |
| 快照水位 | 1 | 0.29ms |
| 日期更正水位 | 1 | 0.27ms |
| 流水键集批次 | 6 | 76.55ms |
| 库存余额锚点 | 1 | 20.72ms |
| 删除/未分配来源诊断COUNT | 2 | 16.47ms |

EXPLAIN显示流水按`stock_journal`现有PRIMARY索引范围读取。两条诊断COUNT在同一来源和筛选条件上分别统计删除记录、未分配来源记录，理论上可条件聚合，但最多只触及这16.47ms的当前await总量，预计节省10–16ms；该收益是评估估算，没有通过改写实测。

在2.181秒内对同参数完成三次完整页面重导航，三次各执行12条SQL，SQL await为124.07、114.15、125.37ms；三次业务结果hash均为`1cda8c159eb1480261bf8fc37f8d66df0fc91380b7ecec26fb2b5752fae82048`。因此未观察到同参数60秒结果缓存。该探针用于确认请求路径，不构成新的30次p95样本。

## 证据与验证边界

- 30次改后p95与原始性能验收：[B6I_2_ACCEPTANCE.md](B6I_2_ACCEPTANCE.md)，`.local/evidence/b6i2/after/summary.json`。
- SQL逐条等待与EXPLAIN/EXPLAIN ANALYZE：`.local/evidence/b6i2/after/turnover-profile-requests.json`、`.local/evidence/b6i2/after/turnover-profile-plans.json`。
- 离线trace分类与三次重复请求：[breakdown.json](../.local/evidence/b6i2b/diagnosis/breakdown.json)、[repeat60-summary.json](../.local/evidence/b6i2b/diagnosis/repeat60-summary.json)。
- 评估使用本地隔离合成数据库；数据库buffer pool未清空。没有改代码，故未运行完整test/build/E2E，也没有新增改后30次样本。B6i-2原验收的数值一致性及完整验证记录仍以B6I_2_ACCEPTANCE为准。
