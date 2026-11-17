# B7d 导航与行点击交互修复

起点 `2f92d560c035e76aa42bf02d9ab3a6055fe260ba`，分支 `codex/b7d-navigation-row-click`。用户明确范围：**交互修复，不含视觉改版**；B7b之后、B8之前。最大迁移025，无新增迁移。两笔提交后停止，不合并。

## 实现与搜索核对

| 原入口 | 分类 | 处理 |
|---|---|---|
| BusinessList/table.tsx 的 window.open | 报表行下钻 | 同标签navigate，继续排除行内链接/按钮/复选框 |
| reports/columns.tsx 的Link target | 报表单元格页面链接 | Link默认同标签，原生Ctrl/Cmd新标签 |
| reports/chart-cards.tsx 的a target | 报表数字卡页面链接 | 改路由Link，保留条件 |
| reports/drilldown.ts 的window.open | 报表与看板图表下钻 | 同标签history.push；浏览器导航移到reports/navigation.ts，保持下钻参数计算可独立测试 |
| analysis/top-section.tsx 的Typography.Link target | 商品/客户Top页面链接 | 改路由Link，默认同标签，原生Ctrl/Cmd新标签 |
| web-exports/job-view.tsx 的Button target | 文件下载 | 保留_blank与原导出流程 |

全库搜索 `_blank` 与 `window.open`，上述入口已逐项分类；产品代码最终仅剩文件下载的 `_blank`，没有window.open。未修改内部链接的日期、basis、仓品等查询参数计算，浏览器返回原URL筛选；没有自行拦截Ctrl/Cmd修饰键。

列表单击立即切换选中，删除ROW_CLICK_DELAY_MS、setTimeout、定时器取消与清理effect。双击第二次click显式选中，dblclick再次确保选中后打开详情，避免反转；空格/Enter、控件点击隔离、拖选排除及查询占位行守卫保留。双击首次click仍遵循立即切换，最终状态统一选中。

## 验证

- 预先登记与规格提交 `590b8a9`；WEB_UX_SPEC、REPORTS_PAGE_SPEC、WORKBENCH_SPEC及DECISION_LOG同步更新，旧延迟与强制新标签决定保留废弃记录。
- 下钻参数回归2/2，exit0，日志 `.local/b7d-drilldown-unit.log`。
- `npm run build` exit0；严格类型检查与Web构建通过，日志 `.local/b7d-build.log`。
- 完整test所有既有glob、文件并发4：565/565，失败/跳过/取消均0，exit0，1039.14秒；日志 `.local/b7d-test-complete.log`。
- 完整 `npm run test:e2e` exit0：主套件204/204（23.4分钟）+目录18/18（3.6分钟）=222/222，失败/跳过/重试0；日志 `.local/b7d-e2e-complete.log`。入出库各10次拖拽的长任务列表均为空，原50ms断言和保存行为未改。
- Ant Design CLI检查本次表格、报表和Top改动，无发现项；token检查387文件，既有22、新增0、待清理0，日志 `.local/b7d-tokens.log`，未修改基线。
- 浏览器回归覆盖同标签链接/行/图表、路由跳转不重新加载文档、返回原筛选、Link原生Ctrl/Cmd新标签；下载增加保留_blank断言。冻结浏览器计时器验证单击立即勾选；双击分别覆盖原先选中与未选中，核对导航前最终选中；空格、Enter、拖选与控件隔离继续验证。

首轮18项中16项通过，双击2项的观察器只监听旧行节点，表格重建行后遗漏状态；改为按行键观察后，第二轮还发现连续测试保留文字选择及旧观察器。最终每轮断开旧观察器并清除文字选择，保留最终选中和第二次点击不反转的断言。失败日志 `.local/b7d-targeted-e2e.log`、`.local/b7d-selection-e2e.log`；首轮trace在 `.local/evidence/b7d/targeted-first-failure/`。未改产品拖选规则或测试超时门槛。

双击最终专项2/2通过，exit0，日志 `.local/b7d-double-click-e2e.log`；随后完整E2E同样通过。验证仅用本地随机可销毁测试库与Chromium；不代表实体设备或生产验收。原有B7c文档修改保留，排除于本批提交。

## 提交审查与交付

按code-review-wms复核全部改动：内部目标来自既有下钻函数；路由使用push保留历史；Link不自行拦截修饰键；导出原入口未动；双击以函数式更新确保选中且不丢其他选中行；复选框/交互控件隔离、键盘和拖选保护保留；没有API、库存写链、迁移、依赖或样式变更。未发现阻断项。

第1笔 `590b8a9` 为登记/规格/决策；第2笔为导航、行交互、测试与本验收记录。最终结果 `565/222/0`，代码与本地验证完成，等待用户验收；两笔后停止，未合并、未推送。
