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

待本批后续子项实施验证。上述定向结果不代替完整 test/build/E2E，也不代表 Firefox/WebKit、实体设备或生产验收。
