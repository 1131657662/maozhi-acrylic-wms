# B6c-1 留证基础验收

## 收尾补记（2026-11-11）

用户已验收本批。以下原批次章节保留当时状态；本次已应用 015 并合并推送，页面冒烟在 B6c-2 查询接续完成后补验通过。

- 目标仅 `127.0.0.1:3307/maozhi_dev_sample`。备份 `.local/evidence/b6c-1-closeout/before-015.sql`，6,471,725 字节，SHA-256 `dcbd133b7921096a564a6d01f8231d32d8f98ae47ffd85dce63616f6283bf6a1`。mysqldump exit 0 但提示缺少 tablespace 的 PROCESS 权限；已在独立 `maozhi_restore_*` 库恢复，46 张数据表指纹全部一致，随后只删除该验证副本。证据 `backup-verified.json`。
- 015 applied，时间 `2026-11-11 03:06:06.097 UTC`。结构前指纹 `8694f8e4acd58a331d5265d4a8d4e57162b23860b2861751ac7b165db632e1b1`，结构后 `a6c6ec4c9b095775ad76b75ccd80eceb7948e9e56d6a22924a5305936d27c032`；新增 `operation_attempts`，扩展 `operation_log`，其余 46 个结构对象不变，旧数据投影指纹一致。原始结构和数据文件位于同一 closeout 目录。
- 422 失败尝试 1 条；新增并确认 `RK-20261111-001`（1 包 / 0.2500 吨），同键确认请求 2 次、成功记录 1 条。该样本入账和失败证据保留，没有重置样本数据。B6c-1 页面当时不能查尝试表，因此页面验证明确延后；B6c-2 的 `.local/evidence/b6c-2-sample-smoke.json` 确认失败行 1、成功行 1，可见。
- 分支规范为 `codex/b6c-1-audit-attempts`；merge 与远端 master HEAD 均为 `c9311d8455214ebb188dfe30e5926073be9319a8`，push exit 0。

## 范围与环境

分支 codex/b6c-audit-attempts；本批只实现规格、015 迁移和写入留证，不实现 B6c-2 查询/页面/对象详情时间线。测试使用本机 3307 的随机 maozhi_test_* 合成库，运行后销毁；未应用到开发样本库，不代表生产验收。

## 015 索引依据

先运行 `npx tsx scripts/verify-audit-indexes.ts`，exit 0，原始 EXPLAIN / EXPLAIN ANALYZE：`.local/evidence/b6c-1-indexes.log`。独立合成表 100000 条，查询取最近 50 条；这是索引路径实测，不是整个页面或两表合并查询的 p95。

| 查询 | 加索引前 | 加索引后 | 实际耗时前 → 后 |
|---|---|---|---|
| 时间窗口 | ALL / filesort，扫描 100000 | time，range，实际读取 50 | 30.3 → 0.265 ms |
| 动作 + 时间 | ALL / filesort，扫描 100000 | action，range，实际读取 50 | 29.7 → 0.338 ms |
| 对象类型 + ID | ALL / filesort，扫描 100000 | object，ref，读取 10 | 31.2 → 0.0617 ms |
| trace | ALL / filesort，扫描 100000 | trace，ref，读取 3 | 29.8 → 0.0306 ms |

据此采用 `(time,id)`、`(action,time,id)`、`(target_kind,target_id,time,id)`、`(trace_id,time,id)` 四组复合索引，分别用于两种记录。暂不加渠道/结果低选择性索引。B6c-2 的 UNION、关键字和分页查询仍需以最终 SQL 复核，不能用本表宣称已完成。

## 迁移

定向测试 exit 0，7/7（015 四项 + 014 三项），原始输出 `.local/evidence/b6c-1-migration.log`。

- 空库 up → down → up，结构一致。
- operation_attempts / operation_log 各自非空独立拒绝 down；DDL 执行数 0，结构和内容指纹不变。保护旧事件同样拒绝，不仅保护新增列。
- 历史记录的 channel/result/attempt_id 保持 NULL，不根据表名或动作推断成功。
- 014 测试显式限定迁移到 014，避免新增迁移让旧测试错误回退最新一层。

## 失败留证

HTTP 请求在正文解析前建立服务端 trace/attempt 上下文，覆盖业务命令、鉴权、输入检查和限流失败。验证后的会话覆盖固定路由的渠道信息；共享登录路由在验证前渠道/操作人未知，不信任请求头或登录正文自报渠道。批量逐单使用独立上下文与事务。后台导出失败/取消写入尝试表，不再把失败任务新增到成功事件表；旧记录不重写。

成功事件沿现有调用位置与业务同事务，保存 attempt_id、channel、result、effect_state 及可证明的对象信息。失败在事务结束后使用根连接池开启独立事务；提交或回滚响应不确定标 unknown，丢弃不可确认的连接，防止带未结束事务的连接被复用。相同 attempt_id 不更新旧记录；另一次重试可有新尝试，成功重放不增加事件。

input_summary 仅保留明确允许的业务编码/数量/日期和集合条数；不包含任意嵌套体、自由文本原因/备注、上传内容、凭证和请求头。原始事件保存前递归遮蔽嵌套对象/数组及多重 JSON 字符串中的秘密，1000 行正常业务明细完整保留。历史 raw 的读取脱敏仍属于 B6c-2，不声称本批已关闭既有读取入口。

`auditEvidenceMetrics(db)` 提供当前进程的 saved/duplicate/writeFailures；保存失败同时输出结构化日志 `event=audit_attempt_write_failed`、`metric=audit_attempt_write_failures_total`、累积 value 和 `saved=false`，不输出 SQL 异常、正文或堆栈。计数重启清零，日志由现有日志采集保留；本批没有新增监控平台或公开诊断端点。

定向回归 exit 0，28/28，原始输出 `.local/evidence/b6c-1-focused.log`：

```text
B6C1_ROLLBACK businessUnchanged=true stockUnchanged=true journalUnchanged=true successAuditUnchanged=true attempts=1 result=failed effect=not_applied
B6C1_CONCURRENCY requests=10 businessResults=1 successEvents=1 failedAttempts=0
B6C1_UNCERTAIN result=unknown label=结果待核实 same_key_replay_operations=1 successEvents=1
B6C1_WRITE_FAILURE saved=0 duplicate=0 writeFailures=1 rows=0 log.saved=false
B6C1_CHANNEL trusted_token=pda forged_web_header_ignored=true input=allowlist_only
```

最终全量验收 `.local/evidence/b6c-1-test-final.log` 的 B6C1_BATCH 保存三条原始证据，重放不重复补偿：

```text
trace_id=9703d33f-ee29-4de9-87b6-9e37a18a580e
attempt_id=759fff58-2d8b-4918-9b2c-8551f3f15dfe result=success
attempt_id=5a7e2528-dd21-4a32-87ae-7b29c937a1ce result=success
attempt_id=7f88089e-df86-44e9-ac4c-73cb018358ad result=failed
```

## 回归适配与边界

首轮全量发现 29 个旧断言把失败尝试视作业务变化，另有 2 个历史迁移夹具误用了新版审计写入器。业务原子性指纹仅排除 operation_attempts，仍严格比较库存、流水、成功审计、幂等、计数器等全部原有表；失败证据由专项测试独立验证。迁移指纹仍包含全部表。005/007 夹具使用当时的真实 SQL 结构，未为旧测试放宽当前服务的 015 要求。

开发 API 增加 015 启动检查，迁移未应用则拒绝启动写服务；本轮未应用到开发样本库。对象详情的失败时间线、审计查询、raw 专用读取和展示由 B6c-2 接续，不能把本批的数据能力记为页面验收。

## 最终验证

| 命令 | exit code | 结果 | 原始日志 |
|---|---|---|---|
| npm run test | 0 | 227 通过 / 0 失败 | .local/evidence/b6c-1-test-final.log |
| npm run build | 0 | 严格类型检查与 Web 构建通过 | .local/evidence/b6c-1-build-final.log |
| npm run test:e2e | 0 | 113 通过 / 0 失败（主 104 + catalog 9） | .local/evidence/b6c-1-e2e-final.log |

首轮 E2E 在指纹辅助函数修复前启动，主套件 96 通过 / 8 失败：6 项仍使用旧的全库不变断言，1 项由失败盘点用例遗留状态连带触发；另有拖拽长任务 76ms。该轮与全量 test/build 并行，不能据此确认长任务根因。保留 `.local/evidence/b6c-1-e2e.log`；当前代码单独重跑完整套件后全部通过，未改前端或降低原有 50ms 阈值。

最终 E2E 原始汇总：主套件 `104 passed (13.0m)`，目录套件 `9 passed (1.9m)`。拖拽记录入库 `durationMs=2779.399999976158,longTasks=[]`，出库 `durationMs=2814.100000023842,longTasks=[]`；此前 76ms 未复现。批量回归仍为 2 成功 / 1 失败，重复补偿 false，勾选与批量栏位移均为 0px。上述是本机 Chromium 自动化结果，不是生产或跨浏览器验收。
