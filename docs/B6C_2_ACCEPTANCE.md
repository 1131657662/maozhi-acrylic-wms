# B6c-2 安全查询与时间线验收

## 范围与环境

基线为 B6c-1 合并提交 `c9311d8455214ebb188dfe30e5926073be9319a8`，当前分支 `codex/b6c-2-audit-projections`。仅实现用户批准的 B6c-2：安全查询、结构化详情、raw/trace 诊断与对象时间线，不开展统计条等 B6c-3 工作。没有新增迁移、索引或依赖；015 在开发样本库的应用记录见 [B6C_1_ACCEPTANCE.md](B6C_1_ACCEPTANCE.md)。

API 测试、EXPLAIN 与 E2E 使用本机 3307 随机 `maozhi_test_*` 独立合成库。开发样本库只复核已获授权的 015 冒烟证据；本批页面复核不重复创建或确认业务单据。仅验证 Chromium，不代表 Firefox/WebKit、实体设备或生产验收。

## 实现与约束

- 两表的记录分别使用 `event:ID` / `attempt:UUID`，同时返回来源与来源主键；这些是协议定位信息，界面不显示内部标识。列表 SQL 只选择安全列，不读取 trace、before/after JSON、input_summary 或原始错误码；旧 `/api/v1/audit` 同样使用该投影。
- 详情在服务端按共享动作注册表生成 `{field,label,before,after,unit}`，前端只显示中文标签、业务值和单位。同次请求摘要默认折叠，不传追踪号。共享注册表覆盖对象类型、动作中文、危险标记和展示字段；未知值为「未识别」，历史缺失值为「未记录」。成功记录的新写入保存名称/单号及安全摘要，历史没有这些证据时不靠内部 ID 拼造显示值。
- raw 只有展开详情中的「原始数据」后才请求；两套路由别名均要求登录 Web 会话，不信任客户端自报渠道。响应 `private, no-store`，查询缓存关闭即回收。嵌套对象、数组、多层 JSON 字符串、凭证/密码/Cookie/令牌及秘密文本均递归遮蔽。
- `raw?traceId=` 必须精确匹配当前记录的 trace；不能用任意 trace 搜索其他记录。按时间与带来源主键的复合游标继续分页。同 trace 的诊断导出在同一只读快照中完整生成 Buffer 后才发送，不创建可下载临时文件；中断和取消均不发布半份附件，每次下载重新鉴权。
- 常量：预览 262,144 字节、诊断 104,857,600 字节、100,000 条。待读取原文 JSON 和最终脱敏序列化结果均检查大小；超限返回 422，不截断、不跳页。100 MiB/100,000 条拒绝分支使用数据库边界替身验证；真实超大预览夹具同时验证完整诊断值保留，未将其描述为 100 MiB 性能测试。
- 默认近 7 个上海自然日，列表默认 50。时间线先分页最近 20 个对象，再单次批量取这批对象的事件；每个对象先显示 50 条，可继续分页。对象身份是类型 + 主键，重名单号不会合并。删除后保留当时保存的名称/单号，缺失显示「未记录」，不显示内部对象 ID 或失效链接。入库、出库、盘点详情均接入该事件来源并含失败尝试。
- 普通 XLSX/CSV 沿用公共异步任务和 10 万条上限；仅输出业务投影。诊断 JSON 由受保护的专用 GET 入口生成下载，不经过普通导出的列选择。

## 原始验证输出

全量测试日志 `.local/evidence/b6c-2-test.log`；最后的映射/脱敏边界复核 `.local/evidence/b6c-2-security-final.log`（11/11，exit 0）。

```text
B6C2_SAFE list=3 legacy=safe forbidden_sql_columns=0 source_collision=0
B6C2_RAW anonymous=401 mobile=403 nested_token=hidden encoded_cookie=hidden no_store=true
B6C2_TRACE database=56 pages=3 unique=56 diagnostic_field_comparison=all_equal
B6C2_OBJECTS groups=22 page1=20 page2=2 same_id_different_kind=isolated
B6C2_EXPORT rows=3 fields=7 compared_cells=21 failures=1 mismatches=0
B6C2_PREVIEW status=422 limit=262144 truncated=false diagnostic_value=complete
B6C2_LIMITS bytes=104857600 records=100000 excess=422 raw_reads=0 partial_download=false
B6C2_ATOMIC generation_failure=500 cancelled=AbortError completed_file=0 attachment=absent
B6C2_UI raw_before_expand=0 raw_after_expand=1 download=complete object_failure=visible
```

测试源：`apps/api/tests/audit-query*.ts`、`audit-timeline.test.ts`、`audit-limits.test.ts`、`audit-export.test.ts` 和 `tests/e2e/audit-projections.spec.ts`。包含旧接口收紧、未知值映射、历史 JSON 脱敏、主键来源区分、不同对象类型同 ID 隔离、删除对象、游标事件 50+6、对象分页 20+2，以及明确日期可以查到默认 7 天之外的事件。

首轮定向测试 20/21，失败为对象分页夹具把额外的登录对象也计入结果；将该测试查询限定到「确认」动作后通过。没有为通过测试放宽服务端对象数量或减少事件。

首轮完整 E2E 主套件 104 通过 / 1 失败，目录套件未启动。旧“下游依赖可见且零写入”用例的文字定位同时命中依赖提示和新增的失败时间线摘要，出现严格定位冲突；断言已限定到“本单暂不能撤销或作废”的提示区，保留零写入、不可撤销及后续作废检查。首次日志保留为 `.local/evidence/b6c-2-e2e-first.log`，最终结果见下表。

第二轮主套件 104 通过 / 1 失败，失败为既有出库拖拽测试记录一次 61ms 长任务（门槛 50ms）；原定位冲突未再出现。未修改拖拽实现、阈值或性能断言，单独复核入库/出库两项均通过，测量期间长任务均为空，日志 `.local/evidence/b6c-2-resize-recheck.log`。第二轮失败保留 `.local/evidence/b6c-2-e2e-second.log`，不能据定向通过抹去该波动。第三轮在源码固定且无并行重任务条件下完整通过 114/114，入库/出库长任务均为空；主套件 12.9 分钟、目录套件 1.7 分钟。

## 查询计划

`npx tsx scripts/verify-audit-projections.ts`，exit 0；10 万成功事件 + 1,000 条失败尝试、10,000 个对象。原始 EXPLAIN/EXPLAIN ANALYZE：`.local/evidence/b6c-2-explain.log`。下面是一次 SQL 实测，**不是 p95 或完整 HTTP 耗时**。

| 查询 | 输出行 | SQL 时间 | 访问路径 |
|---|---:|---:|---|
| 近 7 天列表 | 50 | 299 ms | 本夹具全在窗口内，两表扫描、UNION 物化后排序 |
| 关键字查询 | 50 | 61.7 ms | 包含匹配扫描安全文本列，不解析原始 JSON |
| 精确 trace | 5 | 0.0866 ms | audit_trace / attempt_trace，ref |
| 对象数 | 1（总数 10000） | 336 ms | 安全投影分组 |
| 最近对象页 | 20 | 333 ms | 安全投影分组排序 |
| 当页对象事件 | 220 | 2.38 ms | operation_target / attempt_object，range |

宽窗口内的列表及对象聚合仍可能全量扫描，不能用 B6c-1 单表索引测试声称 UNION 没有成本。本轮保留既有索引，未据此增加迁移。历史事件缺少业务名称/单号投影时显示「未记录」，没有读取 raw 来补普通列表。

## 开发样本库与截图

`.local/evidence/b6c-2-sample-smoke.json`：`015 applied`，失败页面行数 1，确认重放请求 2，成功事件 1，重复业务写入 0。截图：

- `.local/evidence/b6c-2-sample-failure-1440.png`
- `.local/evidence/b6c-2-sample-success-1440.png`
- `.local/evidence/b6c-2-list-1440.png`、`b6c-2-list-1280.png`
- `.local/evidence/b6c-2-timeline-1440.png`、`b6c-2-timeline-1280.png`

## 完整验证

| 命令 | exit code | 结果 | 原始日志 |
|---|---|---|---|
| npm run test | 0 | 238 通过 / 0 失败 | .local/evidence/b6c-2-test.log |
| 最终审计边界补测 | 0 | 11 通过 / 0 失败；含未知状态及原型属性名映射保护 | .local/evidence/b6c-2-security-final.log |
| npm run build | 0 | 严格类型检查与 Web 构建通过 | .local/evidence/b6c-2-build.log |
| npm run test:e2e | 0 | 114 通过 / 0 失败（主 105 + catalog 9） | .local/evidence/b6c-2-e2e.log |
| npm run openapi | 0 | 生成契约与接口清单同步 | .local/evidence/b6c-2-openapi.log |

015 已有不可删除的审计证据，不执行 down；B6c-2 本身没有结构变更。任何代码回退都需保留普通读取的安全投影，不能恢复旧接口的 raw/trace 旁路。当前分支不合并、不推送，等待本批确认后再进入 B6c-3。
