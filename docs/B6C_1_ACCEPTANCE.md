# B6c-1 留证基础验收

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

## 后续记录

失败留证与全量验证结果将在本批完成后追加；目前不宣称已通过。
