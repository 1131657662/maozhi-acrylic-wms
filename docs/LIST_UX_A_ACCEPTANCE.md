# 体验修复 A：列表手感

基线 master `e8d8d48`，分支 `codex/list-ux-repair-a`。范围仅行选择、固定列/列宽拖动、排序反馈；不改 API/迁移/库存，不展开体验修复其余项目或 B6c。证据目录 `.local/evidence/list-ux-a/`；测试使用独立随机 MySQL 合成库与 Chromium，开发样本库不作测试重置。

## 1. 行点击选择

- 250ms 延迟单击切换；双击取消待处理单击并打开详情。焦点行空格选择、Enter 打开。链接/按钮/输入控件/复选框与非空文字选择被排除；复选框阻止点击冒泡。查询切换、离开组件清理计时器；函数式选择更新支持快速点不同行。可选 Shift 范围选择未实现。
- `npm run typecheck` exit 0；定向 E2E `list-ux-a-selection.spec.ts` + 原 `b6b-step3.spec.ts`：exit 0，5/5（新增入/出库四项 + 既有详情/批量回归一项）。AntD lint 0 问题。
- 入/出库勾选前后表格 x/y/width/height 均相同，位移 0px；1280 页面 scrollWidth/clientWidth=1280/1280。双击期间 aria-selected 变化记录为空；真实鼠标拖选文字不切换，链接新标签打开不改变来源页选择。
- 截图：`inbound-selection-batch-{1440,1280}.png`、`outbound-selection-batch-{1440,1280}.png`。原始日志 `step1-e2e.log`、`step1-typecheck.log`。

## 2. 固定列与列宽

待本批后续子项实施验证。

## 3. 排序反馈及完整验证

待本批后续子项实施验证。上述定向结果不代替完整 test/build/E2E，也不代表 Firefox/WebKit、实体设备或生产验收。
