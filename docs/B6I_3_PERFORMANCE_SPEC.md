# B6i-3 BusinessList 虚拟滚动

起点：`ff0bd0c`，分支 `codex/b6i-3-virtual-compat`。前置 B6i-2b 评估完成；不涉及迁移。

状态（2026-11-16）：**虚拟滚动评估后放弃**。与列宽拖拽预览、排序回顶冲突，官方无现成兼容方案；用户确认不做虚拟滚动，接受当前绘制耗时。以下候选设计与验收要求仅作历史记录，不代表待实施计划。候选实现及 E2E 适配已归档并撤回，产品代码保持起点状态。

## 范围与不变量

- 只在 `apps/web/src/components/BusinessList/` 的表格层启用 antd 6 虚拟表格，不改业务页面、接口、数据模型或业务排序。
- 当前页数据行数大于 30 时启用 `ProTable virtual`；30 行及以下保持普通表格。
- 沿用现有数值型 `scroll.x`、`scroll.y`。antd/rc-virtual-list 测量实际行高，行内展开与表底合计继续使用现有组件；不手写虚拟列表，不固定展开内容高度。
- 排序仍由原 URL/API 查询状态驱动；分页、筛选、列宽、列显隐/顺序、固定列、行选择、全选、展开、summary 与导出语义均保持。
- 不组合列/数据记忆化、单元格 memo 或选择状态拆分。阈值为内部常量，不提供用户设置。

## 实施前证据

### 兼容性探针

初始 antd 6.7.0 测试页观测到固定列、行展开、`Table.Summary fixed="bottom"`、拖宽后对齐和行选择/全选，曾提前判为「五项均通过」。**该结论撤回**：只检查拖宽后的结果，漏掉了拖动中的表头/表体同步，不能替代现有 BusinessList 交互验证。

接入候选后，生产构建的库存 50 行实测：商品列拖动前表头/表体均 240px；拖动 40px 时表头为 280px、表体仍为 240px；松手后才都为 280px。现有 `resize-preview.ts` 仅遍历 table/colgroup/th/td，未更新虚拟 div 表体。另有排序回顶回归：从 scrollTop=300 点击排序后仍为 300，两个回顶入口只查 `.ant-table-body`，在虚拟表格中不存在。判定为现有拖宽方案接入不兼容，停止，不手写虚拟器，不继续优化或删除交互断言。

antd 6.7.0 的 `Table.virtual` 官方 API 为布尔属性，官方 `virtual-list` 示例要求 `scroll.x/y` 同时是数值；项目满足此要求。官方提供 `components`、`onHeaderCell`、列 `width` 等定制接口，以及 Table ref `scrollTo({ top: 0 })` / `scroll.scrollToFirstRowOnChange`。本次查阅的 v6 官方文档/示例没有现成的「本项目 DOM 拖宽预览 + virtual」替代实现；这些定制接口不是兼容性已通过的保证。保留普通表格是本次停止后的项目处理，不声称它是官方指定的方案。

改前生产构建基线（各 30 次）：10 行绘制/API p95 为 152.3/9.3ms；50 行为 406.1/9.9ms；200 行为 1007.0/19.3ms。有效证据为 `.local/evidence/b6i3/baseline/`；`preflight-driver-timing/` 为废弃驱动计时，不用于结论。

### React Profiler 与引用分配

改前库存排序在开发 Profiler 中提交 3 次全量当前页更新。`BusinessList` 外层、`BusinessListResults`、`ListResults`/`ListTable` 随父级更新；ProTable 内部表体提交 50 行，数据单元格更新发生在请求切换/响应阶段，选择列随后再提交。嵌套 Profiler 数值不能相加；单次 ProTable 边界 observed `actualDuration` 为约 68–306ms，包含不同请求/提交阶段。

选择状态变化会令列表表格全量更新：50 个数据行提交两次；第一次约 550 个数据单元格，第二次只更新 50 个选择单元格。非虚拟列表排序会更新全部当前页 DOM 行；没有“仅可见行”裁切。

`useColumnLayout` 每次 render 都 map `columns` 并创建列对象、`onHeaderCell` 回调及拖宽/排序回调，同时计算宽度。`ListTable` 每次 render 都 map `data.items` 生成选择行元数据；`dataSource` 本身直接引用 `data.items`，没有额外行对象映射。每次 render 还会新建 `onRow`、summary、rowSelection、toolBarRender 等函数/对象；列内容 render 主要来自上游列定义，不会因每次 `ListTable` render 全量重建。列宽和固定列位置主要由 antd/rc-table 布局在 render/commit 及 ResizeObserver 尺寸变化时计算，`useColumnLayout` 在 render 路径额外执行列宽求和；拖拽过程通过 DOM 预览，松手才保存宽度。

排序/选择 Profiler 探针属于开发构建诊断，不把开发耗时用作生产 p95。当时唯一优化选择为 D：用可视区行窗口减少大页渲染工作；该方案现已评估后放弃。

## 验收

- 使用生产 Web 构建、本地随机合成数据库、Chromium 1440×960、单用户并发 1。10/50/200 行各 30 次；nearest-rank p95 取第 29 个样本。
- `drawMs` 从排序表头 click 捕获开始，至列表请求结束、shell 退出 busy 并经过两次 `requestAnimationFrame`。API Resource Timing 单独记录，不从 draw 中扣除。数据 hash 与完整排序 ID 顺序分别核对改前基线。
- 生产排序绘制 p95 目标 `≤150ms`，不改阈值。任何规模超过目标即停止并报告瓶颈和已尝试的虚拟滚动实现，不连续迭代。
- 50、200 行确认 DOM 只挂载可视范围行；10 行确认保持完整小表。
- 分别运行展开、合计、拖宽、全选；验证翻页、筛选、排序及固定列行为。现有 E2E 交互断言必须保留；允许将“完整数据行均在 DOM”改为虚拟窗口语义断言。
- 复测周转冷首屏，沿用 B6i-2 的隔离合成数据和测量口径。若仍高于 800ms，记录为「目标未达，成本集中在框架初始化」，不因此追加本批优化。
- 代码和本地自动化验证不代表实体设备或生产验收。证据保存在 `.local/evidence/b6i3/`，不提交 Git。

## 提交边界

正常成功路径为三笔提交：测量基线/规格、表格实现/必要 E2E DOM 断言、验收记录/批次状态。因兼容性失败，本次仅以三笔文档提交记录规格/基线、兼容性停止报告、批次状态；没有正式实现提交。完成后停止，不合并推送。失败路径不再运行改后排序 p95、完整 E2E 或周转冷首屏；不得以历史周转数值充作本轮复测。

## 合并收尾

2026-11-16 用户确认D方案不可行，B6i-3「虚拟滚动评估后放弃」，不做虚拟滚动，接受当前绘制耗时。生产排序绘制p95仍为 **275–310ms，目标150ms未达**。该区间来自用户本次收尾确认，未提供对应样本口径，本次未重测；不覆盖或混同上文10/50/200行基线，不计算跨口径收益，不调整150ms目标。

原三笔文档 `aad9063`、`92df56d`、`f3b8b98` 已以--no-ff合并为 `3fb5e8fb1b196693437172d729209804db2b9e75`；本段取代前述不合并的阶段限制。收尾文档经codex分支提交后非快进合并到本地master，不推送。完成后停止，不开始B6i-3b。
