# B6c-3 操作记录页面与导出验收

## 范围与环境

基线为已通过用户验收的 B6c-2 `6558c46e8709a531b4737f37dd5f4ec5b6bf2bbf`，继续使用 `codex/b6c-2-audit-projections`。仅完成操作记录页面、筛选统计、导出与回归；不新增迁移、索引或依赖，不合并、不推送。

本轮使用本机 3307 随机 `maozhi_test_*` 独立合成库，未写开发样本库、生产或历史业务数据。浏览器为 Chromium；Firefox/WebKit、实体设备和生产均不属于本次验证。

## 实现与证据对应

| 验收项 | 实现 / 验证 |
|---|---|
| 页头与统计 | 页头「操作记录」及唯一导出入口；记录数、失败数、不同类型+主键的对象数、危险操作数与列表在同一事务中读取。只有完整上海今天的范围标「今日」，其他标「当前筛选」。`audit/statistics.ts`、`audit-page.test.ts` |
| 列表与中文 | 时间、类型图标、可跳转对象、安全摘要、渠道、结果、操作；操作人默认隐藏，可由列设置开启并导出。危险操作橙色，包含目录发布；失败红色、已取消灰色；未知值不附库值 |
| 筛选与保存视图 | 默认近 7 个上海自然日；时间/类型/关键字快捷查询，渠道/结果/危险操作在抽屉；条件进 URL、保存视图可恢复。未知参数与非法枚举 422。关键字查安全文本及业务明细商品编码/名称，使用 EXISTS 避免一事件被多行放大，不读 raw |
| 详情与原始数据 | 结构化变化由服务端提供；关联事件摘要折叠。原始数据展开前无请求，展开后 1 次；关闭释放查询缓存，同次展开不因窗口切换重复读取；嵌套令牌遮蔽。列表、时间线、普通详情和 XLSX 不显示原始值、trace 或内部 ID |
| 时间线 | 沿用 B6c-2 对象分页 20 个、对象事件游标分页；包含失败尝试；删除对象使用保存的业务名/单号，不给失效链接。筛选选中对象后展示该对象历史，不将事件条数冒充对象数 |
| 导出 | 复用异步任务，全部筛选/本页/选中，XLSX 字段及顺序跟随可见列；从时间线点击导出先切回列表，分页范围按记录计。10 万条通过、100001 条 422；过期视图 409；失败/取消无可下载半文件 |
| 空态和加载 | 「该时间范围内没有操作记录」和「调整筛选」入口；首次与换筛选加载只替换结果区为骨架，保留页头和筛选；排序翻页保留旧数据。错误复用统一中文分类 |

## 本轮原始输出

```text
B6C3_STATS records=4 failures=1 objects=2 dangerous=1 filtered=consistent today=exact four_results=Chinese invalid=422
B6C3_KEYWORD product_code=matched product_name=matched duplicate_events=0
B6C3_PAGE outcomes=4 dangerous_catalog=orange raw_before=0 raw_after=1 deleted_links=0 screenshots=10 xlsx_cells=30 mismatch=0
B6C3_FILTERS url=preserved saved_view=restored today=exact
```

页面夹具为 4 条合成成功表事件与 1 条合成失败尝试、4 个对象，共同 trace，包含历史 cancelled/unknown/NULL 结果。它们是专用验收夹具，不声称真实业务已经取消或执行成功。

同一页面的 5 行 × 6 个可见字段逐单元格核对：时间、类型、对象、变更摘要、渠道、结果，30 个值、差异 0。旧完整 E2E 中的审计三范围测试继续核对全部 240 条、本页 40 条、跨页选中 2 条；完整 E2E 原始输出如下：

```text
all: rows=240 fields=6 comparedCells=1440 differences=0
page: rows=40 fields=6 comparedCells=240 differences=0
selected: rows=2 fields=6 comparedCells=12 differences=0
```

普通 XLSX 真实容量测试：`npx tsx scripts/verify-audit-page-export.ts`，exit 0。

```json
{"rows":100000,"durationMs":45584,"last":"容量-000008","lastMatches":true,"duplicates":0,"excess":{"actual":100001,"status":422},"stale":409,"failures":[{"mode":"failure","status":"failed","download":409,"partialFile":false},{"mode":"cancel","status":"cancelled","download":409,"partialFile":false}]}
```

原始证据：`.local/evidence/b6c-3-capacity.log`、`.local/evidence/b6c-3-export-capacity/result.json`。100000 数据行，另有表头与合计行，共 100002 行；按时间+记录主键倒序，末条与列表最后一页逐值核对一致，不按合成编号猜测末条。耗时包含预检与文件生成，是本机一次耗时，不能当作 p95。写入中断/取消分别在真实写入批次后注入，任务目录均无 `.xlsx` / `.part` 文件，下载拒绝 409。

## 安全与诊断回归

B6c-2 的安全 API 测试全部纳入本轮 `npm run test`，包含匿名 401、PDA/小程序 403、旧接口安全投影、历史 JSON 递归脱敏、同 trace 56 条/3 页/无重漏、诊断 JSON 与数据库逐条一致、对象 20+2 分页、同 ID 不同对象类型隔离、失败时间线及删除对象。

诊断预览 256 KiB、文件 100 MiB、10 万条上限保持集中常量。诊断 JSON 的字节/条数拒绝分支沿用 B6c-2 数据库边界替身测试；普通 XLSX 的 100000/100001 则为本轮实际插入和生成，不混写两类证据。诊断中断返回 500 且无附件，取消不发布文件；原始值仅受保护折叠区可见。

## 截图

每种状态均有 1440/1280 两档，截图过程中断言页面无横向溢出；表格仍允许按固定列宽内部横向滚动。

| 状态 | 1440 | 1280 |
|---|---|---|
| 列表 | [截图](../.local/evidence/b6c-3-list-1440.png) | [截图](../.local/evidence/b6c-3-list-1280.png) |
| 时间线 | [截图](../.local/evidence/b6c-3-timeline-1440.png) | [截图](../.local/evidence/b6c-3-timeline-1280.png) |
| 详情 | [截图](../.local/evidence/b6c-3-detail-1440.png) | [截图](../.local/evidence/b6c-3-detail-1280.png) |
| 失败筛选 | [截图](../.local/evidence/b6c-3-failed-1440.png) | [截图](../.local/evidence/b6c-3-failed-1280.png) |
| 原始数据展开 | [截图](../.local/evidence/b6c-3-raw-1440.png) | [截图](../.local/evidence/b6c-3-raw-1280.png) |

## 完整验证

| 命令 | exit code | 结果 | 日志 |
|---|---:|---|---|
| npm run test | 0 | 240 通过 / 0 失败 | .local/evidence/b6c-3-test.log |
| npm run build | 0 | 严格类型检查与 Web 构建通过 | .local/evidence/b6c-3-build.log |
| npm run test:e2e | 0 | 116 通过 / 0 失败（主 107 + catalog 9） | .local/evidence/b6c-3-e2e.log |
| npm run openapi | 0 | 生成契约同步 | .local/evidence/b6c-3-openapi.log |
| 实际导出容量验证 | 0 | 100000 通过；100001 拒绝；失败/取消无半文件 | .local/evidence/b6c-3-capacity.log |

完整 E2E 主套件 13.0 分钟、目录套件 1.8 分钟；本轮完整运行一次通过。截图定位调整后的最终页面补验 **2/2，exit 0**，见 `.local/evidence/b6c-3-screenshot-final.log`；只调整夹具摘要和截图滚动定位，未修改业务代码。10 档状态实测页面 scrollWidth/clientWidth 分别为 **1440/1440**、**1280/1280**。

## 修正与限制

- 最初定向 API 的商品关键字 SQL 使用了不存在的出库商品名称列，已改为实际的 `outbound_lines.product_name`；保留原失败日志 `.local/evidence/b6c-3-api-focused.log`，修正后页面 API 用例通过。
- 最初几轮页面定向 E2E 的问题为定位冲突（渠道/结果均叫「未记录」、图标进入按钮名称、Tag 内层文本、多个相同业务编号）及关闭按钮使用了英文定位；均改为指定结果列/控件的中文可访问名称，未降低业务断言。原日志 `b6c-3-e2e-focused*.log` 保留。
- 1280 截图发现日期范围偏窄，快捷筛选改为两列，保持完整日期可读；完整回归已重新生成截图；最终页面补验还在每档宽度稳定后重定位滚动，直接展示失败结果列和脱敏字段。
- 宽窗口 UNION 查询与对象聚合仍有扫描成本；本轮不优化、不加索引。B6b-perf 和排序渲染性能遗留保持原状态。
- 工作区外部规范修改独立保留，不夹带本批提交；决策台账仅提交本批两条规则，既有外部台账内容仍保留于工作区。

本批没有数据库变更，回退可撤销本次提交并保留 B6c-2 的鉴权、安全投影和脱敏。不得退回旧的 raw/trace 普通列表旁路；不执行 015 down、不删除审计证据。
