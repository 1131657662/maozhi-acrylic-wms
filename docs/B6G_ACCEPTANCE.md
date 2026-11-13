# B6g 验收记录

日期：2026-11-13
分支：`codex/b6g-persisted-search-text`
起点：`3ae28f8`
范围：商品、客户、供应商、车辆持久化 `search_text`；022 迁移；统一生成与写入同步；NULL 幂等回填；`q` 与旧 `keyword` 兼容。

## 数据与迁移

- 依赖固定为 `pinyin-pro@3.29.5`，许可证为 MIT，许可证文本随 npm 包提供。
- `search_text` 为四表 nullable `VARCHAR(512)` 和非唯一普通索引。全拼和首字母采用 pinyin-pro 默认多音字规则；小写化并去空白/Unicode 标点；超过 512 个 Unicode 字符拒绝写入，不截断。
- down 在执行 DDL 前检查四表，任一值非 NULL（包括空串）即拒绝；专项测试验证拒绝后列仍存在。
- `maozhi_dev_sample` 首次回填：商品 569 行、客户 377 行、供应商 2 行、车辆 4 行。再次运行 `npm run backfill:search-text -w @wms/api`：四表均为 0 行。迁移前后业务字段指纹一致；只写入新检索列。

## EXPLAIN 与耗时

环境为本机隔离的 MySQL 8 `maozhi_dev_sample`，身份 `maozhi-local-mysql8-v1`。当前列表范围为启用商品库存候选 428 行、启用客户 377 行。EXPLAIN 查询结构如下，`%jl%` 为代表性关键词：

```sql
EXPLAIN SELECT * FROM master_products
WHERE source_del_flag=0 AND source_kind<>'sku-spec' AND inventory_eligible=1 AND active=1
  AND (search_text LIKE '%jl%' OR code LIKE '%jl%' OR name LIKE '%jl%')
ORDER BY code LIMIT 20;

EXPLAIN SELECT * FROM master_customers
WHERE source_del_flag=0 AND active=1
  AND (search_text LIKE '%jl%' OR code LIKE '%jl%' OR name LIKE '%jl%')
ORDER BY code LIMIT 20;
```

执行计划（MySQL 8 `EXPLAIN`）：

| 表               | type  | possible_keys            | key                      | key_len | rows | filtered | Extra                              |
| ---------------- | ----- | ------------------------ | ------------------------ | ------: | ---: | -------: | ---------------------------------- |
| master_products  | range | product_inventory_lookup | product_inventory_lookup |       3 |  428 |    26.79 | Using index condition; Using where |
| master_customers | index | NULL                     | PRIMARY                  |     322 |   20 |     0.30 | Using where                        |

完整原始字段：

```json
{
  "products": [
    {
      "id": "1",
      "select_type": "SIMPLE",
      "table": "master_products",
      "partitions": null,
      "type": "range",
      "possible_keys": "product_inventory_lookup",
      "key": "product_inventory_lookup",
      "key_len": "3",
      "ref": null,
      "rows": "428",
      "filtered": 26.79,
      "Extra": "Using index condition; Using where"
    }
  ],
  "customers": [
    {
      "id": "1",
      "select_type": "SIMPLE",
      "table": "master_customers",
      "partitions": null,
      "type": "index",
      "possible_keys": null,
      "key": "PRIMARY",
      "key_len": "322",
      "ref": null,
      "rows": "20",
      "filtered": 0.3,
      "Extra": "Using where"
    }
  ]
}
```

两条计划都未选择 `search_text` B-tree。商品使用库存资格索引，客户按主键（编码顺序）扫描并过滤。`LIKE '%q%'` 的前置通配不能用 B-tree 做范围定位；有该普通索引不代表本查询可以使用它。

每类串行调用完整 `listMasterItems` 服务 10 次，每个关键词不同；计时包含总数查询、分页、投影，不含 HTTP 网络、认证及浏览器耗时。p95 使用 nearest-rank，10 个样本下等于最大值：

| 商品关键词 |        ms | 客户关键词 |        ms |
| ---------- | --------: | ---------- | --------: |
| jl         |     6.878 | nbzx       |     3.381 |
| jinglun    |     3.132 | ningbo     |     2.098 |
| 腈纶       |     3.510 | 浙江       |     2.419 |
| acrylic    |     3.654 | 客户       |     2.447 |
| 032        |     3.912 | DEMO       |     1.761 |
| model      |     2.564 | cust       |     1.766 |
| duanxian   |     2.310 | C000       |     2.605 |
| shortfiber |     2.610 | xian       |     1.767 |
| P000       |     2.456 | zhongxian  |     2.188 |
| fiber      |     2.996 | customer   |     1.820 |
| **p95**    | **6.878** | **p95**    | **3.381** |

两类当前本机样本均低于 150ms，可接受于这次测得的数据规模；这不外推到更大数据量、其他硬件、网络或生产环境。若后续实测超过 150ms，再提出并评估查询方案，不自动增加分页缓存。

## 验证状态

- 主数据测试覆盖拼音全拼、首字母、型号、旧编码、停用候选过滤、无库存资格商品排除、旧 `keyword` 行为、回填幂等、修改同步和非空 down 保护。
- `npm run test`：**406/406** 通过。
- `npm run build`：exit 0；API/Web TypeScript 检查及 Web 构建通过。构建输出有既有 `caniuse-lite` 过期提示。
- `npm run test:e2e`：主套件首轮 129/131；审计筛选用例因运行时 30 秒超时，单独复跑所属 spec 后 2/2 通过。列表拖拽长任务用例记录 59ms，单独复跑记录 62ms，超过该既有测试的 50ms 门槛；未修改或放宽该测试。主套件因此返回 exit 1，目录专项没有由 `&&` 自动启动。
- 单独运行目录专项：11/11 通过。没有实体设备或生产环境验收。

状态区分：代码完成；本机构建通过；API 自动化与目录专项通过，完整主 E2E 有一项既有 50ms 长任务门槛失败；实体设备及生产验收未进行。

## B6g-1 E2E 红灯复核（2026-11-13）

以上为实现提交 `d01b135` 时的首轮记录，保留历史。此次复核保持测试门槛、断言、数据来源与串行 worker 配置不变。

### 原失败用例与归因

1. `tests/e2e/audit-page.spec.ts:71` — **B6c-3 audit filters persist in URL and saved view, only exact today is labelled today**。
   - 功能断言：精确今日区间显示「今日」；应用结果待核实筛选后 URL 含 `result=unknown`、列表 1 行；保存视图并刷新后保留结果和「筛选 · 1」；重置后显示「当前筛选」；恢复保存视图后 URL 与「今日」恢复。
   - 首轮记录为整条测试超过配置的 30,000ms，并非 search_text 匹配失败或 50ms 性能断言。首轮审计失败 trace 未留存（默认输出目录后来被专项覆盖），不能还原当时具体阻塞在哪条 await。该页面使用审计列表/列偏好接口；本批未改审计实现或该测试。
2. `tests/e2e/list-ux-a-resize.spec.ts:49` — **体验A inbound 固定列/宽屏拖拽/DOM预览/长任务**。
   - 失败断言第 101 行：`expect(performance.tasks.filter((task) => task.duration > 50)).toEqual([])`；同时要求观测区间不少于 1,000ms。原首轮 59ms、专项复跑 62ms，均违反此既有门槛。
   - 属于既有列表拖拽性能断言；失败 trace 中请求只有认证、盘点入口、入库列表/状态与列偏好，没有主数据检索请求。`d01b135` 未修改 Web 或 E2E 文件，未发现与 search_text 的调用关联。

### 各连续三次的原始结果

独立新启 API/Web，以 `--repeat-each=3 --workers=1` 串行运行指定完整名称，未启用重试。报告为 `.local/evidence/b6g-1/{audit,resize}-repeat.{log,json}`，失败 trace 独立保存于 `resize-results/`，不覆盖旧证据。

| 用例 | 次数 | 用例耗时 | 拖拽观测区间 | 超过 50ms 的长任务 | 结果 |
|---|---:|---:|---:|---|---|
| 审计筛选 | 1 | 7,112ms | 不适用 | 不适用 | 通过 |
| 审计筛选 | 2 | 8,278ms | 不适用 | 不适用 | 通过 |
| 审计筛选 | 3 | 7,117ms | 不适用 | 不适用 | 通过 |
| 入库拖拽 | 1 | 8,029ms | 3,414.4ms | 67ms（1 次） | 失败 |
| 入库拖拽 | 2 | 9,310ms | 2,877.1ms | 无 | 通过 |
| 入库拖拽 | 3 | 9,569ms | 2,910.4ms | 无 | 通过 |

审计筛选三次全过，原超时按偶发记录。拖拽第一组三次并非全过，不能把 2/3 写成通过；保留 67ms 失败继续复核。这里的「无」指 PerformanceObserver 未报告长任务，不代表所有任务耗时为 0ms，也未测量每个短任务的最大值。

临时 CDP 性能诊断另跑一次，拖拽观测 3,026.2ms、长任务为空，首次 pointerdown 处理约 2.5ms；这次诊断没有复现超限，不能据此断言原 67ms 的根因。临时诊断 import 已撤回，正式测试源码及断言保持原样。

### 合并前开发样本库只读核验

目标 `127.0.0.1:3307/maozhi_dev_sample`，身份 `maozhi-local-mysql8-v1`；`schema_migrations` 中 `022_master_search_text.state = applied`。

| 表 | 总行数 | search_text IS NULL | search_text = '' |
|---|---:|---:|---:|
| master_products | 569 | 0 | 0 |
| master_customers | 377 | 0 | 0 |
| master_suppliers | 2 | 0 | 0 |
| master_vehicles | 4 | 0 | 0 |

本次只读核验，没有新增样本、重新回填或改写业务数据。最终只读复核时间为 2026-11-13 16:13（Asia/Shanghai），原始结果已保存。

### 复核结论与收尾

- 拖拽用例第一组三次为 **1 次失败、2 次通过**，不能按该组判为三次全过；之后在未修改测试及门槛的正式运行中连续三次均通过。**已知偶发，实测 3 次分布：无长任务（通过）／无长任务（通过）／无长任务（通过）**；观测区间分别 **2,922.6ms／2,877.9ms／2,910.3ms**，用例耗时分别 **9,482ms／9,215ms／9,499ms**。首组三次 67ms 失败记录保留，最终确认日志为 `.local/evidence/b6g-1/resize-confirm.{log,json}`。没有复现稳定失败，未放宽断言、未改 50ms 门槛。
- 第二条独立审计筛选用例首轮超时，单独连续三次均通过（7,112ms／8,278ms／7,117ms）；完整主套件也通过。属于偶发测试执行超时，与主数据搜索无关。
- 完整 `npm run test:e2e`：主套件 **131/131**，目录专项 **11/11**，合计 **142/142**，exit 0。正式长任务用例本轮观测：入库 2,902.3ms、出库 2,860.2ms，均无超过 50ms 的长任务。
- 此轮最终提交仅补充文档，业务及测试源码与 `d01b135` 相同；`npm run test` 406/406 和 `npm run build` exit 0 沿用该实现提交已有验证，不伪称本轮重复运行。完整 E2E 与连续三次复核均为本轮新测。
- `AF-056` 记录拖拽已知偶发，归 **B6i 性能专项** 继续跟踪；门槛和断言保留。性能归因及后续专项不能被这次偶发通过结果替代。
- 合并前复核 `maozhi_dev_sample`：022=`applied`；商品 569、客户 377、供应商 2、车辆 4 行的 `search_text IS NULL` 均为 0，空串均为 0。查询结果见 `.local/evidence/b6g-1/sample-premerge.json`。
- 两条原红灯都是既有测试：审计筛选的 URL/保存视图/今日标签行为；入库拖拽的固定列、拖拽 DOM 预览、零位移/不落库以及长任务不超过 50ms。B6g 实现未改 Web 或 E2E 源码，无 `search_text` 失败断言；拖拽失败 trace 的请求中也无主数据检索。
- 临时 CDP profiling 仅用于定位，正式测试 import 已恢复；没有将临时探针纳入代码提交。

状态区分：代码完成；本机构建通过；完整 API/Web E2E 自动化通过；拖拽 67ms 偶发已登记 B6i；未进行实体设备或生产验收。

合并收尾：实现提交 `d01b135`、复核文档 `e46edde` 已以 `--no-ff` 合并为 `2e86824`；合并后更新 IMPLEMENTATION_PLAN 与 AUDIT_FINDINGS。原 `AGENTS.md` 未暂存改动未纳入提交；本批推送 origin/master 后停止，不开始 B6g-2。
