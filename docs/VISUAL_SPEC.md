# 全局视觉与布局规范（VISUAL_SPEC）

> 页面规格定“有什么”，本文件定“长什么样、间距多少”。
> 所有页面共用本规范；与页面规格冲突时，以本文件为准（间距、字号、颜色）。

## 1. 页面骨架

```
┌ 侧栏 208px ┬ 内容区（padding 24） ─────────────┐
│            │ 页头：标题 20px + 主操作           │
│            │ 间距 16                          │
│            │ 筛选/工具条                       │
│            │ 间距 16                          │
│            │ 卡片 / 表格 / 图表                │
└────────────┴──────────────────────────────────┘
```

- 侧栏宽 208px，折叠后 64px；
- 内容区左右留白 24px，上下 24px；
- 多个卡片之间间距 16px；
- 页面不设最大宽度，宽屏自然铺满。

## 2. 间距刻度

只用四档：**4 / 8 / 16 / 24**。禁止 10、15、20 这类随手值。

| 场景 | 值 |
|---|---|
| 文字与图标 | 4 |
| 表格内元素 | 8 |
| 卡片内边距 | 16（小卡）/ 24（大卡） |
| 卡片之间、区块之间 | 16 |
| 页头与内容 | 16 |
| 内容与页脚/操作条 | 24 |

## 3. 字号与字重

| 用途 | 字号 / 行高 | 字重 |
|---|---|---|
| 页面标题 | 20 / 28 | 600 |
| 卡片标题 | 16 / 24 | 600 |
| 正文、表格 | 14 / 22 | 400 |
| 辅助说明、单位 | 12 / 20 | 400 |
| KPI 大数字（专用档，`fontSize.kpi`） | 28 / 36 | 600 |

规则：
- 数字用等宽（tabular-nums），右对齐；
- 中文不用斜体、不加字间距；
- 一行最多两级字号，不在一行里混 3 种字号。

## 4. 颜色

| 用途 | 来源 |
|---|---|
| 主色 | `token.colorPrimary` |
| 成功 | `token.colorSuccess` |
| 警告 | `token.colorWarning` |
| 错误 | `token.colorError` |
| 边框 | `token.colorBorderSecondary` |
| 次要文字 | `token.colorTextSecondary` |

规则：
- 页面里不出现裸色值；
- 状态色只用于标签、圆点、左侧色条，不整行染色；
- 表格行悬停浅灰，选中浅蓝，不用彩色底。

## 5. 卡片

- 圆角 12px；
- 阴影 `0 1px 2px rgba(0,0,0,.04)`，不用重阴影；
- 边框 1px `colorBorderSecondary`；
- 内边距 16；
- 卡片标题 16px，右侧可放一个次要操作。

## 6. 表格

| 项 | 标准 |
|---|---|
| 行高 | 标准 44px，紧凑 36px |
| 表头 | 12px 次要色，不换行 |
| 单元格 | 14px，超出省略 + tooltip |
| 数字列 | 右对齐、等宽 |
| 操作列 | 右固定，最多 3 个入口 |
| 空态 | 插画或图标 + 一句说明 + 一个动作 |
| 加载 | 表内骨架，不整页白屏 |

## 7. 表单

- 标签在上，控件在下，标签与控件间距 4；
- 控件高度 32（标准）/ 40（大）；
- 两列布局，列间距 16，行间距 16；
- 必填项在标签前加红色星号；
- 错误信息在控件下方，12px 红色；
- 一组字段不超过 8 个；超出分组（卡片或折叠）。

## 8. 按钮

| 类型 | 用在哪 |
|---|---|
| 主按钮（实心） | 每页最多 1 个 |
| 次按钮（描边） | 工具栏 |
| 文字按钮 | 行内操作 |
| 危险按钮 | 只在「更多」菜单里，红色文字 |

- 按钮高度 32；
- 两个按钮间距 8；
- 危险按钮不与主按钮并排。

## 9. 响应式

| 宽度 | 规则 |
|---|---|
| ≥1440 | 完整布局，侧栏展开 |
| 1280–1439 | 侧栏展开，卡片间距不变，表格横向滚动 |
| 1024–1279 | 侧栏可折叠，两列变一列 |
| <1024 | 只保证可操作，不追求美观 |

- 任何宽度下页面不出现整体横向滚动，只有表格内部滚动；
- 断点用 AntD 默认：`xl 1200`、`lg 992`。

## 10. 状态与反馈

| 状态 | 表现 |
|---|---|
| 加载 | 骨架或小 spin，保留页面结构 |
| 空 | 一句说明 + 一个动作 |
| 错误 | 中文原因 + 重试 |
| 禁用 | 降低透明度，鼠标禁止，附 tooltip 说明原因 |
| 成功 | 顶部轻提示，2 秒消失 |

## 11. 三个页面模板

### 列表页

```
页头（标题 + 主操作）
筛选行（快捷条件 + 筛选按钮）
工具栏（批量/导出/列设置）
表格
分页
```

### 详情页

```
页头（单号 + 状态标签 + 主操作）
摘要卡（关键信息 4–6 项）
明细表
时间线 / 审计
底部固定操作条
```

### 看板页

```
时间范围
KPI 卡 ×4
图表 ×2（一主一次）
排行榜 / 明细表
```

## 12. 验收

1. 截图对比：同类型页面（两个列表、两个详情）在 1440 下骨架一致；
2. 间距抽查：随机 5 处，值只能是 4/8/16/24；
3. 字号抽查：常规文字使用 20/16/14/12 四档，KPI 大数字另用专用 28px 档；
4. 颜色抽查：页面无裸色值；
5. 1280 与 1024 下无页面横向滚动；
6. 表格行高统一，密集模式可切换。

## 13. B6j-1：目标 token 与 Web 检查（2026-11-12）

### 13.1 范围与兼容

- 本步只交付 token 模块、CSS 变量输出、Web 裸值检查及逐项 allowlist；不交付共享组件或页面迁移，不改变任何页面视觉。
- `apps/web/src/app.tsx` 的全局主题继续使用 `borderRadius=8`，主色、背景、字体和其他有效主题值不变。不得提前将目标卡片圆角写入当前 ConfigProvider；AntD 会派生圆角并同时影响卡片、按钮等现有控件。
- B6j-2 迁移页面时再接入目标 token/CSS 变量并切换目标样式；输入框 AF-053 随后续页面迁移处理。本步不做配色改版、暗色模式、PDA、小程序、数据库迁移或样本库写入。

### 13.2 公共导出

`apps/web/src/theme/design-tokens.ts` 提供以下目标值，不自动修改主题或向 DOM 注入样式：

| 导出 | 值 / 来源 | CSS 变量 |
|---|---|---|
| `radius` | `{ card: 12, control: 8 }` | `--wms-radius-card`、`--wms-radius-control` |
| `spacing` | 4、8、16、24 | `--wms-space-4/8/16/24` |
| `fontSize` | `{ pageTitle: 20, cardTitle: 16, body: 14, auxiliary: 12, kpi: 28 }` | `--wms-font-size-page-title/card-title/body/auxiliary/kpi` |
| `color(token)` | 接收当前 AntD token；primary/success/warning/error/border/text/textSecondary/background/surface/textOnSolid 分别映射到相应 AntD 语义 token | `--wms-color-*`，使用同名语义的短横线形式 |

CSS 变量由同一模块输出变量对象及 `:root` CSS 文本，长度带 px；颜色从调用方传入的 AntD token 取值，不复制裸色、不读取另一套默认主题。B6j-1 不在页面导入或应用这些输出；B6j-2 接入时使用当时的有效主题。

### 13.3 检查与过渡

- 入口 `scripts/check-design-tokens.ts`（命令 `npm run check:design-tokens`）只递归扫描 `apps/web/src` 内 TS/TSX、JS/JSX 及 CSS/LESS/SCSS 源文件，包含未提交新文件，排除 Umi 生成目录与依赖；不扫 `apps/web/config`、小程序或 PDA。
- 检查裸 hex、rgb(a)/hsl(a) 和命名颜色（含 transparent）；AntD 的 success/warning/processing/default 等语义状态不是命名颜色。检查 CSS 与 JS 的 border-radius/borderRadius（含分角与逻辑角）及 padding（含方向、逻辑方向）数值。
- padding 中任何非零长度/数值均违规，包括 px、rem、视口单位、简写、calc 内裸长度以及 4/8/16/24；零（含 0px）、百分比、auto/inherit 等非长度关键字不违规。圆角任何数值均检查，含零、百分比及 4/6/8/12。
- token 引用与 CSS 变量引用放行；CSS 变量建议使用 `var(--wms-space-8)` 等公共命名。变量 fallback 中另写的裸颜色/长度仍检查；注释、URL 和普通 CSS 文本内容不得误报。检查针对静态字面量，不承诺跨文件追踪运行时计算值。
- 使用已有 TypeScript 解析器检查脚本语法，使用明确声明的 PostCSS 与值解析器检查 CSS；不新增测试框架。解析失败应使命令失败，不静默跳过。
- allowlist 每项必须记录 `file`、`kind`、`value`、`reason`、`batch`（计划批次）。路径必须为精确 Web 源文件，不接受目录、glob 或批量豁免；同一值每次出现消耗一个条目，复制出新的同值违规仍失败。
- 现有已登记项逐条报告且不失败；新增未登记项退出码非零。已消失的 allowlist 项提示清理，不自动扩充基线。旧全局主题中的裸值也逐项登记，不给整个主题文件免检。

### 13.4 验证与交付

- 检查脚本的检出、豁免、重复违规、精确 allowlist、Web 边界与错误退出需通过隔离临时文件测试；运行既有单测及严格类型检查/Web 构建。
- 通过 Git 差异确认当前主题与页面文件未改变；本步不改变版式、颜色或布局，不要求截图，不改变 E2E/设备冒烟的数据来源。
- 实现阶段三提交：规格与台账、token 与脚本、验证记录。原“完成后停止，不合并、不 push”由用户验收后的 §13.6 收尾授权取代；不将本地自动化通过写成设备或生产验收。

### 13.5 B6j-1 实现与本地验证（2026-11-12）

状态：**B6j-1 已完成，用户验收通过**。规格提交 `c88d2ff`，实现提交 `ef9d815`，验证记录提交 `512c61e`；实现分支 `codex/b6j-1-design-tokens`，验收后的合并推送授权见 §13.6。

- token 模块已导出 `radius`、`spacing`、`fontSize`、`color(token)`、`createDesignCssVariables(token)` 与 `createDesignCssText(token)`；KPI 为 28px。颜色使用传入的 AntD token，CSS 输出包含 `--wms-radius-card`、`--wms-space-8`、`--wms-font-size-kpi` 等，模块没有 DOM 或主题写入副作用。
- 检查采用 TypeScript AST 与 PostCSS，覆盖样式对象、JSX、条件表达式、模板片段、直接样式赋值与 setProperty。PostCSS 8.5.32、postcss-value-parser 4.2.0 从已有锁定版本声明为直接开发依赖；无新增 UI 库或字体。
- `npm run check:design-tokens`：扫描 **267** 个 Web 源文件，**现有 34、新增 0、待清理 0，exit 0**。现有项为颜色 21、圆角 4、padding 9；颜色含 1 项 transparent。allowlist 中 31 项计划 B6j-2、3 项目录标签颜色计划 B6d；当前主题也逐项登记。
- `npm run test`：**401/401、失败 0、跳过 0，exit 0**，含本批新增 52 个用例。隔离临时目录验证了 Web 范围、新文件检出、逐项匹配、重复同值违规、非法 allowlist/语法失败；子进程实测旧项 exit 0，追加相同裸值后 exit 1。未修改原有测试框架或冒烟数据来源。
- `npm run build`：**exit 0**，包含 API、Web 与新增检查脚本的严格类型检查及 Web 构建。`npm run test:design-tokens` 提供单独执行入口，完整 `npm run test` 已包含这些用例。
- 代码审查、Ant Design lint（0 issues）、Prettier 与 `git diff --check` 通过。与起点比较，当前 app.tsx、布局配置、现有页面/样式、PDA、小程序文件差异为空；新模块尚未接入页面，生效全局圆角仍为 8。
- 原始日志仅保存在 `.local/evidence/b6j-1-check.log`、`b6j-1-test.log`、`b6j-1-build.log`。本步无页面视觉变化，未运行浏览器截图、E2E、模拟器、实体设备或生产验收；未执行迁移或开发样本库写入。
- 静态检查不进行跨文件运行时数据流求值；声明文件与 Umi 生成目录不属于页面源码检查范围。新增未登记静态裸值仍须失败，不自动更新 allowlist。

### 13.6 B6j-1 验收收尾（2026-11-12）

用户验收通过，完成状态 **401/134/0**：本批单测 401/401、构建 exit 0；E2E 134/134 沿用前置 B5d-2 已验收基线，本批未重跑。`npm run check:design-tokens` 为本批新增开发命令，检查现有 34、新增 0、待清理 0，exit 0。

授权更新收尾文档后执行 `git checkout master`、`git merge --no-ff codex/b6j-1-design-tokens -m "merge: b6j-1 design tokens"`、`git push origin master`；最终回复核对 merge hash、远端 HEAD 与各命令 exit code。本次没有代码变化，沿用 §13.5 的测试与构建结果，不新增或应用迁移。收尾即停止，不开始 B6j-2。

## 14. B6j-2：共享 UI 与审计 pilot

- 只实现 PageShell、Card、SectionTitle、Toolbar、StatusTag、EmptyState、StatCard 七个展示壳；单个组件不超过 200 行，不导入 feature 目录、不持有业务判断。
- 组件只用 design tokens。扩展 token 模块提供 semibold 字重、既有文字档位行高与 120px 紧凑空态上限；CSS 变量由 PageShell 根节点以当前 AntD token 提供。StatusTag 只接展示状态和封闭语义类型；映射由页面现有映射模块负责。组件 API 不暴露任意颜色或圆角值。
- PageShell 使用页面标题 20/28、字重 600，右侧操作区，内容留白 24；Card 使用圆角 12、语义边框、16/24 两档内边距；SectionTitle 使用 16/24、字重 600；Toolbar 单行、间距 8；StatCard 数字 28/36、字重 600，标签 12/20；EmptyState 为图标、一句话、可选动作，最大高度 120。
- 只为操作记录列表提供显式 design shell，保留现有 BusinessList 表格引擎和所有查询、列、排序、分页、导出、选择及缓存行为。时间线分组和详情内容使用上述壳；共享给其他详情页的对象时间线仍保留旧外壳。全局 AntD 主题仍为 `borderRadius=8`；不调整表格行高、表格字重或内部样式。
- 同一隔离 E2E 数据库及同一记录、筛选、滚动位置形成改前/改后证据；列表、失败筛选、时间线、详情、raw 两个宽度均需对应。不要改测试框架、冒烟数据源或写入开发样本库。
- 验收：状态筛选、统计筛选、列表/时间线切换、详情及 raw 懒加载、导出保持原行为；`check:design-tokens` 无新项，移除本批真实迁移的审计 allowlist；test/build/完整 E2E 通过。与代码、构建、浏览器验证分别记录，不代表设备或生产验收。
- 原实现提交：`feat(web): shared ui components and audit pilot`。原停止及禁止合并要求已由 §14.2 的用户收尾授权取代；不开始其他迁移。

### 14.1 B6j-2 实现审查（2026-11-13）

- 原实现七个组件分别为 31/36/52/29/56/30/10 行（Card/EmptyState/PageShell/SectionTitle/StatCard/StatusTag/Toolbar），均小于 200 行；无 feature 导入、业务分支或任意 style/rawColor/rawRadius 覆盖参数。业务状态映射留在 `features/audit/labels.tsx`，全局主题 `borderRadius=8` 无变更。
- `BusinessList` 只增加可选外壳；表格、结果组件、表格 CSS、列定义、查询键、筛选、raw 面板、排序/分页/导出/偏好缓存实现和依赖清单均无修改。非审计页沿用原壳；对象时间线的其他调用方沿用原标签和空态。
- 按 WMS 提交前审查要求复核全部改动，未发现阻断问题；AntD 检查 0 问题。同数据截图与功能回归证据见 AUDIT_PAGE_SPEC §16.1。代码完成和本地浏览器验证不代表用户验收、实体设备或生产验收。
- 最终本地验证：单测 401/401、严格类型检查及 Web 构建通过、完整 E2E 136/136（127 + 9），各命令 exit 0。裸值检查 Web 文件 275、现有 34、新增 0、待清理 0，exit 0；审计专属 allowlist 为 0→0，共享/全局及其他页面的既有 34 项不在本批迁移。代码格式检查和 `git diff --check` 通过。

### 14.2 B6j-2 KPI 布局修订与收尾（2026-11-13）

- 用户验收通过，合并前修订四项审计 KPI：容器改为 `repeat(auto-fit, minmax(180px, 1fr))`，四项固定指标最多四列，间距使用 spacing[16]，等高网格行铺满可用内容区。180px 为本次明确指定的卡片最小列宽，不新增间距档位。
- StatCard 标签与数字统一右对齐，标签行高/高度使用既有辅助字号行高 token，数字继续 28/36、600；点击标签与普通标签保持相同位置和卡片高度。业务指标、筛选回调、配色、全局主题和表格均不变。
- 代码仅改 `features/audit/statistics.tsx` 和 `components/ui/StatCard.tsx` 布局。1440 四张卡铺满；1280 按可用宽度自然排布，空间不足自动换行，不人为强制两列。补两个宽度截图并重跑全部验证后，使用 `merge: b6j-2 ui components and audit pilot` 非快进合并当前分支到 master、推送 origin master，核对合并 hash 与远端 HEAD 后停止。
- 浏览器实测：1440 内容区 1056px，每卡 252×94px；1280 内容区 896px，每卡 212×94px。四卡等宽等高，标签行与数字行分别对齐，首尾卡边缘与内容区一致，页面无横向溢出。临时将 KPI 容器收窄为 700px，自动形成两行，仍等高且无溢出；此临时测量不修改源代码。
- 补充截图为 `.local/evidence/b6j-2-kpi-after-1440.png` 与 `b6j-2-kpi-after-1280.png`，几何测量记录为 `b6j-2-kpi-layout.json`。两张使用同一隔离数据、筛选与 (0,0) 滚动位置，属于本次布局补图；不替换 §14.1 的历史前后对照。无开发样本库/生产写入。
- 补修后实际重跑 test 401/401（失败 0、跳过 0）、build、完整 E2E 136/136（127 + 9，无跳过或重试通过），全部 exit 0；check:design-tokens 275 文件、现有 34、新增 0、待清理 0，exit 0。AntD 0 问题，Prettier 和差异检查通过；提交前审查确认源代码仅上述两文件布局差异，筛选回调、数字/语义色 token、其他组件和页面不变。日志为 `.local/evidence/b6j-2-kpi-{test,build,e2e,check}.log`。按用户授权合并推送后停止，不开始下一批。
