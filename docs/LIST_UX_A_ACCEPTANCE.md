# 体验修复 A：列表手感

基线 master `e8d8d48`，分支 `codex/list-ux-repair-a`。范围仅行选择、固定列/列宽拖动、排序反馈；不改 API/迁移/库存，不展开体验修复其余项目或 B6c。证据目录 `.local/evidence/list-ux-a/`；测试使用独立随机 MySQL 合成库与 Chromium，开发样本库不作测试重置。

## 1. 行点击选择

- 250ms 延迟单击切换；双击取消待处理单击并打开详情。焦点行空格选择、Enter 打开。链接/按钮/输入控件/复选框与非空文字选择被排除；复选框阻止点击冒泡。查询切换、离开组件清理计时器；函数式选择更新支持快速点不同行。可选 Shift 范围选择未实现。
- `npm run typecheck` exit 0；定向 E2E `list-ux-a-selection.spec.ts` + 原 `b6b-step3.spec.ts`：exit 0，5/5（新增入/出库四项 + 既有详情/批量回归一项）。AntD lint 0 问题。
- 入/出库勾选前后表格 x/y/width/height 均相同，位移 0px；1280 页面 scrollWidth/clientWidth=1280/1280。双击期间 aria-selected 变化记录为空；真实鼠标拖选文字不切换，链接新标签打开不改变来源页选择。
- 截图：`inbound-selection-batch-{1440,1280}.png`、`outbound-selection-batch-{1440,1280}.png`。原始日志 `step1-e2e.log`、`step1-typecheck.log`。

## 2. 固定列与列宽

- 入/出库单号左固定、操作右固定，状态不固定；旧服务端偏好中的状态右固定也忽略。容器可见即可拖，3000px 宽屏未溢出仍可拖；移除 table 的最小 100% 拉伸，保持数值列宽。
- pointermove 只通过 rAF 预览 col/th/table 与 sticky 偏移；暂停 rc-table 隐藏测量行，避免其 ResizeObserver 触发逐帧 React 更新；松手一次提交，取消/卸载恢复 DOM 与滚动锁。500ms 保存防抖沿用既有服务。
- 类型检查 exit 0。既有列宽/偏好定向 E2E 7/7；新增固定列/宽屏/性能 E2E 2/2，exit 0；AntD lint 0 问题。第一轮新增用例因测试写请求缺 Origin 失败，补齐后通过。
- 入/出库单号均 220→320px，其他列不变，总宽 +100px；1280 视口表格 scrollWidth/clientWidth 分别 1868/848、1928/848（仅单号 +100 后）。既有四组勾选位移均 0px，页面宽度分别 1280/1280、1440/1440。
- 连续 pointerdown→pointermove 采样入库 2921.3ms、出库 2910.1ms，PerformanceObserver >50ms 长任务均 0；采样截至 pointerup 前，松手后一次 React 提交不属于此指标。初次包含松手提交的采样检测到入库 236/65ms、出库 250/56ms 长任务，不能把“拖动期无长任务”解释为整个手势零长任务。
- 拖动中 aria-valuenow 仍为原宽、保存请求为 0；松手后新宽生效、保存请求为 1；固定列间有正间距，头/体偏差 0。宽屏再拖 +100px，其他列仍不变。
- 截图：`{inbound,outbound}-resized-batch-{1440,1280}.png`。原始数据 `{inbound,outbound}-resize.json`；日志 `step2-e2e.log`（7 通过、2 夹具失败）、`step2-resize-e2e.log`（修正后 2 通过）。

## 3. 排序反馈及完整验证

- 所有 BusinessList 查询使用 `placeholderData: keepPreviousData`；首次加载为小 Spin，排序/翻页保留旧行，固定工具栏槽显示小 Spin，不显示骨架或整表遮罩。占位期间不选择旧行、不提交批量撤销、不生成导出（含已打开的导出面板），错误/403 仍退出旧数据展示。
- React `useOptimistic` + transition 先反馈表头箭头，再更新 URL 与列表；连续点击按乐观状态升→降→取消，避免旧 AntD 闭包重复升序。页码立即更新；关闭 AntD 默认滚动动画，排序/翻页直接回顶。未变化单元格跳过重复渲染，命中展开列继续响应展开状态。
- 定向排序 E2E exit 0，7/7；涵盖延迟响应期间旧 50 行保持、箭头先变化、scrollTop=0、导出暂不可提交、翻页与快速三次取消排序。初期测试面板关闭方式及滚动动画冲突已修正；旧加载态 E2E 改为检查小 Spin，保留错误、403 和错源校验。

### 3.1 最终完整验证（2026-11-11）

| 命令 | exit code | 通过 / 失败 | 日志 |
|---|---|---|---|
| npm run test | 0 | 208 / 0 | `final-test.log` |
| npm run build | 0 | 类型检查与 Web 构建通过 | `final-build.log` |
| npm run test:e2e | 0 | 96 / 0（主 87 + catalog 9） | `final-e2e.log` |

最后 E2E 独立运行，未并行运行单元测试或构建。全量包含既有批量撤销 2 成功/1 失败、重放不重复补偿、导出字段一致、列设置服务端恢复、隐藏/重排/刷新/重置、商品命中展开等回归。无 API、迁移、依赖变化。

### 3.2 最终排序 p95

环境：本地独立合成库，入/出库各 240 张主单（每张 2 有效明细 + 1 软删明细），keyword 限定 WL-RK-/WL-CK-；Chromium、1440px、默认每页 50；并发 1，单号列连续升/降/取消共 30 次，首次打开列表不计入。开发构建，未测 Firefox/WebKit。接口耗时取浏览器 Resource Timing；箭头为 click→aria-sort 提交；绘制为 click→查询完成且等待两次 rAF。

| 列表 | 样本数 | 箭头 p95 | 接口 p95 | 结果绘制 p95 |
|---|---|---|---|---|
| 入库 | 30 | 2.7ms | 10.6ms | 579.2ms |
| 出库 | 30 | 3.0ms | 10.6ms | 659.2ms |

接口 p95 低于审计文档本地 300ms 目标；绘制指标包含 React 开发构建开销，不等同接口耗时，也不代替 B6b-perf 万单/十万明细基准。延迟响应测试有意阻塞请求，其数据不纳入 p95。原始 30 个样本：`inbound-sort-p95.json`、`outbound-sort-p95.json`；延迟证据 `*-sort-delayed.json`。

### 3.3 最终位移、列宽与截图

- 入/出库勾选及批量栏出现：x/y/width/height 差值全为 0px。
- 单号列 220→320px，其他列不变，总宽 +100px；固定列头/体对齐差值 0px，拖动时无重叠、横向滚动位置保持。
- 最后连续拖动窗口入库 2882.4ms、出库 2855.7ms，>50ms 长任务均 0。窗口包含 pointerdown 与连续 pointermove，截止 pointerup 前；松手一次提交的单独开销见第 2 节，不声称完整手势零长任务。
- 下表为截图时的最终宽度（单号 +100px、操作 -40px）。页面没有横向溢出，横向滚动限定在表格容器内。

| 列表 | 视口 | 表格 scrollWidth / clientWidth | 页面 scrollWidth / clientWidth |
|---|---|---|---|
| 入库 | 1280 | 1828 / 848 | 1280 / 1280 |
| 入库 | 1440 | 1828 / 1008 | 1440 / 1440 |
| 出库 | 1280 | 1888 / 848 | 1280 / 1280 |
| 出库 | 1440 | 1888 / 1008 | 1440 / 1440 |

截图位于 `.local/evidence/list-ux-a/`，均由最终完整 E2E 重采集：

| 列表 | 选择与批量栏 | 拖拽后与批量栏 |
|---|---|---|
| 入库 | `inbound-selection-batch-1440.png`、`inbound-selection-batch-1280.png` | `inbound-resized-batch-1440.png`、`inbound-resized-batch-1280.png` |
| 出库 | `outbound-selection-batch-1440.png`、`outbound-selection-batch-1280.png` | `outbound-resized-batch-1440.png`、`outbound-resized-batch-1280.png` |

### 3.4 边界与后续

- 本批代码、构建及 Chromium 本地合成数据 E2E 已验证，不代表 Firefox/WebKit、实体设备或生产验收。未执行迁移，不改开发样本数据，不合并、不推送。
- 250ms 单击延迟是明确的双击判定要求；审计文档“单击到高亮 <50ms”若含该延迟，与本批规格不一致，本批以 WEB_UX_SPEC §4 的 250ms 为准。
- 既有截图中未知状态仍显示 `状态待识别：legacy-code`，及行内详情文案属于后续文案/页面修复，本批未改该映射。松手后的单次 React 渲染仍需与拖动中长任务分开评估。
- 不开展 Shift 范围选中（可选）、错误分类/文案批次、B6c 或 B6b-perf。
