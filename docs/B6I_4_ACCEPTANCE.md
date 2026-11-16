# B6i-4 列宽松手与保存渲染验收

2026-11-16。起点 `master@153040d`；工作分支 `codex/b6i-4-resize-commit`。规格见 [B6I_4_PERFORMANCE_SPEC.md](B6I_4_PERFORMANCE_SPEC.md)，决定见 DECISION_LOG 的 B6i-4 节。仅实施用户确认的 A：松手以 DOM 提交最终列宽，异步保存偏好，保存状态不驱动表格渲染。

## 只读基线与根因

同机 Windows、Node24.14.1/npm11.11.0、本地 Chromium headless、Umi dev:e2e、1280×960、50 行、既有随机可销毁合成库。连续交替 +100/-100px，各40步/25ms，10次完整手势。未写开发样本库或生产库。

| 基线                         | 超限手势 | >50ms任务数 | 松手主任务 |
| ---------------------------- | -------: | ----------: | ---------: |
| 入库，启用 Performance trace |    10/10 |          40 |  254–297ms |
| 入库，无 Performance trace   |    10/10 |          40 |  196–232ms |
| 出库，无 Performance trace   |    10/10 |          40 |  209–238ms |

每次松手有一个主任务、一个随后 React 任务、两个保存链路任务；前次保存进入随后9次拖动。应用原本已一次发布整份偏好，没有证实逐列独立提交，不能把根因写成逐列 setState。未发现移动帧布局读写交替的证据，单项 Layout 最大3.14ms；没有字体加载，长任务内 GC 合计最大5.91ms，不是主体。

代表片段 `EventDispatch(pointerup) 293.47ms`，包含 `performSyncWorkOnRoot → renderRootSync`；后续栈包含 `Cell → createElement`、`trigger → unstable_batchedUpdates`。基线完整数据/逐次表、trace片段、全部40个任务栈分别位于 `.local/evidence/b6i4-diagnosis/diagnosis.md`、`first-release-snippet.json`、`task-stacks.md`，原始完整trace为 `performance-trace.json`。早期summary阶段分类已更正，以diagnosis/trace-analysis为准。

## 实现与回归边界

- 指针移动仍用原 requestAnimationFrame DOM 预览；松手 flush 最后位置，保留表头、colgroup、表格总宽及固定列偏移，释放滚动/文本选择锁。取消恢复本次拖动前宽度；当前 DOM aria 宽度作为下一次手势起点。
- 宽度立即进入本地待同步缓存，沿用500ms防抖及串行保存；不发布 React 更新。Query MutationCache执行原保存请求，表格不再订阅 pending/success；响应只更新缓存/修订号，语义比较排除字段键顺序差异。
- DOM接管期间暂停测量行，下一次正常布局从store读取最新宽度后恢复。显式重置、视图或列设置更新先恢复React原样式，再由正常渲染接管；具名视图读取最新宽度。保留列minWidth、全局max及键盘步长。
- 保留身份/列表隔离、离线缓存、重进续传和迟到GET/PUT保护。无迁移、接口契约、依赖、库存或业务规则变更；026仍未使用。不做虚拟滚动、排序记忆化、选择重构或B的测试等待修复。

## 性能验证口径

最终环境沿用dev，未启用用户许可的生产build+serve测量切换。原 `list-ux-a-resize.spec.ts` 的观察在松手前结束，完整保留；新增独立用例从第1次拖动前连续观测至第10次PUT完成后两帧，不截断松手或保存阶段。间隔不等待保存，前次保存仍可落在下一次拖动。每次核对预览宽度、最终宽度、表头表体对齐及其他列宽；末尾确认10次保存完成。

两个性能断言保持原文字：

```ts
expect(performance.duration).toBeGreaterThanOrEqual(1000);
expect(performance.tasks.filter((task) => task.duration > 50)).toEqual([]);
```

原spec、两个Playwright配置、package.json及package-lock.json与起点的Git对象哈希完全一致，见 `.local/evidence/b6i4/protected-files.json`。没有改50ms门槛、删断言、跳过用例或剔除慢样本。

定向最终代码测量（`targeted2.log`）：入库/出库各10次，完整窗口30219.9/30323.1ms，两个列表均 `tasks: []`，10次保存完成；每次实际宽度为320/220px交替，全部与松手位置一致。原始记录另存 `targeted2-inbound-continuous-resize.json` / `targeted2-outbound-continuous-resize.json`。完整E2E的最终采样另记下表，不能将定向测试失败总结果写成全量通过。

| 完整E2E采样，dev | 连续拖拽 | 松手>50ms手势 | 整个观察窗口>50ms任务 | 完成保存 |  观察时长 |
| ---------------- | -------: | ------------: | --------------------: | -------: | --------: |
| 入库             |       10 |          0/10 |                     0 |       10 | 30247.8ms |
| 出库             |       10 |          0/10 |                     0 |       10 | 30135.9ms |

逐次结果两个列表相同：

| 第几次 | 预期/实际宽度 px | 入库松手超限任务 | 出库松手超限任务 |
| ------ | ---------------: | ---------------: | ---------------: |
| 1      |          320/320 |                0 |                0 |
| 2      |          220/220 |                0 |                0 |
| 3      |          320/320 |                0 |                0 |
| 4      |          220/220 |                0 |                0 |
| 5      |          320/320 |                0 |                0 |
| 6      |          220/220 |                0 |                0 |
| 7      |          320/320 |                0 |                0 |
| 8      |          220/220 |                0 |                0 |
| 9      |          320/320 |                0 |                0 |
| 10     |          220/220 |                0 |                0 |

最终原始手势标记、宽度、保存次数及任务数组为 `.local/evidence/b6i4/inbound-continuous-resize.json` / `outbound-continuous-resize.json`，同时写入 `full-e2e.log`。两个列表的拖动期与松手后保存阶段也均未观测超限任务。测量时没有并行运行构建或其他测试任务。

PerformanceObserver未观测到>50ms任务不等于任务耗时0ms；手势标记up/end包含Playwright往返，不将其差值当pointerup处理时长。自动化覆盖原预览、固定列、横滚和无长任务指标；不声称执行了人工实体设备手感或生产现场验收。

## 失败与修正记录

1. 首轮定向7项为3通过/4失败：既有偏好持久化3项通过；新生命周期用例重复选择当前视图，未触发应用事件，得到默认220而非330。两个新性能用例的松手任务已消失，但每个列表仍有10个保存确认长任务。原因是JSON序列化比较把响应schema规范化后的字段键顺序当成偏好变化。
2. 改为保存确认静默缓存及字段语义比较，并增加真实schema解析的单测；第二轮4项为2通过/2失败：连续10次性能两项均通过，生命周期仅因新增清除按钮定位使用英文`clear`而实际名称是`清除`失败。修正该新测试定位并补充原列minWidth回归后，生命周期2/2通过。
3. 上述原始失败日志和trace保留在 `.local/evidence/b6i4/targeted.log`、`targeted-results/`、`targeted2.log`、`targeted2-results/`。最终生命周期日志为 `lifecycle.log`，exit0。未更改原测试文本或阈值来处理这些失败。
4. 首轮完整E2E主套件194/195：库存合计行调宽后，独立fixed summary表未跟随表头/表体DOM提交；连续观察首轮和专项复跑均在 `stock-aging-summary.spec.ts:131` 的原合计列对齐断言失败。补充 `.ant-table-summary > table` 的DOM宽度更新和summary横滚锁定；完整库存合计专项4/4及同轮拖拽性能2/2通过，断言未改。首轮完整日志及trace保留于 `full-e2e.log`、`full-e2e-first-results/`；修正专项日志为 `summary-fix.log`，exit0。

## 最终验证与提交状态

修正后的最终代码完整验证一次全绿：

| 命令               | 最终结果                                                  | 证据                                                       |
| ------------------ | --------------------------------------------------------- | ---------------------------------------------------------- |
| `npm run test`     | 533/533通过，失败/取消/跳过=0/0/0，exit0                  | `.local/evidence/b6i4/final-test.log`、`final-test.exit`   |
| `npm run build`    | exit0，含 API/Web/token TypeScript检查与Web生产构建       | `.local/evidence/b6i4/final-build.log`、`final-build.exit` |
| `npm run test:e2e` | 主套件195/195、目录专项18/18，失败/跳过/重试=0/0/0，exit0 | `.local/evidence/b6i4/final-e2e.log`、`final-e2e.exit`     |

最后一轮全量E2E包含相同的连续性能测量，并记录每次手势/保存与任务数组。前面194/195的首轮及第131项库存合计表失败完整保留；summary修复后重新执行了完整test、build、主E2E及目录E2E。性能spec、原测试断言、50ms门槛和包脚本未改；没有删除测试或启用环境切换。性能测量期间未并行运行构建/其他测试。

专项与视觉证据：库存合计行1440/1280截图 `.local/evidence/b6f-2b-stock-summary-1440.png`、`.local/evidence/b6f-2b-stock-summary-1280.png`；出入库列宽截图 `.local/evidence/list-ux-a/inbound-resized-batch-1440.png`、`inbound-resized-batch-1280.png`、`outbound-resized-batch-1440.png`、`outbound-resized-batch-1280.png`。这些文件都在`.local/evidence/`，不进Git。Playwright/截图为本地Chromium自动化；40步/25ms指针序列中最终宽度与预览匹配，松手与保存后的任务观察没有>50ms长任务。这是自动化无卡顿的证据，不等同人工实体设备手感或生产现场验收。

代码审查覆盖完整实现、单测和E2E差异；首轮发现的固定合计表遗漏已经修正，重跑后无已知阻断问题。审查记录 `.local/evidence/b6i4/code-review.md`。TypeScript/Playwright通过Prettier，`git diff --check`通过，Ant Design lint 0项。

三笔功能提交：第1笔规格/基线/范围与决策 `b3e7db8`；第2笔DOM提交、静默保存、布局接管、合计行兼容修复及回归 `6e92e31`；第3笔本验收、IMPLEMENTATION_PLAN和AF-056状态 `66f6665`。用户随后验收通过，功能以非快进合并提交 `8943ab3` 合入master并推送；merge/push exit均0，推送后远端HEAD为 `8943ab30c591f17a470104a46928c6da69bd78e7`。合并后的批次状态收尾由独立 `codex/*` 分支提交并按项目规则非快进合并。代码与本地自动化验证完成；这不代表实体设备或生产验收，B7b未启动。
