# B6d-2 目录只读查询验收

日期：2026-11-13

分支：`codex/b6d-2-catalog-query-trace`

起点：`abcdac2`

规格提交：`ff4ca81`

实现提交：`724423b`

## 范围与结果

- 当前已发布目录通过条码或规格搜索，支持精确/片段匹配、50/100/200 条分页，并返回版本上下文；不搜索商品名。
- 规格汇总按 `source_spec` 分组，返回条码数、总重量、最小重量、最大重量和平均重量。
- 条码轨迹展示已发布版本及已校验候选，并携带状态；首版与最近出现版本一并返回。
- 扫描测试只读查询当前已发布版本，返回存在性、规格和重量；不存在时明确返回 `found=false` 与空条目。
- 页面已接入目录搜索、规格汇总表、条码轨迹抽屉和扫描测试输入。
- 查询接口均为 GET，使用一致性只读快照；没有添加迁移，`apps/api/migrations` 最大编号仍为 022，006/007 未改。
- 上传、发布与交接实现未修改；原有发布与版本工作流回归通过。

## 数据与测试证据

API 专项使用隔离的 `maozhi_test_*` 合成库。测试覆盖条码精确匹配、片段匹配、规格匹配、分页、聚合五项指标与逐条重量求和一致、已发布及候选版本轨迹状态、找到/未找到的扫描结果。四个 GET 接口执行前后，目录、候选、交接、扫码、库存、流水、操作日志及幂等表的行数和逐行内容均一致。

| 验证 | 结果 |
|---|---|
| `npx tsx --test apps/api/tests/catalog-query.test.ts` | 1/1 通过 |
| `npm run test` | 407/407 通过 |
| `npm run build` | 通过；API/Web 严格类型检查及 Webpack 构建通过 |
| `npm run test:e2e` | 154/154 通过（主套件 142，目录套件 12） |
| `npm run openapi` | 通过；生成 API 清单与 OpenAPI 契约 |
| `npm run check:design-tokens` | 通过；288 个 Web 文件，既有 22 项、新增 0、待清理 0 |
| Ant Design lint | 目录功能组件 0 项问题 |
| `git diff --check` | 通过 |

构建有既有 `caniuse-lite` 过期提示。页面自动化在 Chromium 模拟器中运行；1440 与 1280 视口均通过无横向溢出断言。证据保存在 Git 外：

- [1440 页面截图](../.local/evidence/b1c1-b6d2-query-1440.png)
- [1280 页面截图](../.local/evidence/b1c1-b6d2-query-1280.png)

## 状态与边界

状态：代码完成；本机构建通过；API、Web 与目录自动化通过。没有进行实体设备或生产验收，也没有写入开发样本库或生产库；自动化测试仅使用隔离、可销毁的合成数据库。

## 合并收尾

用户验收通过后，功能分支以 `--no-ff` 合并至 `master`，合并提交为 `7e5ecffc8480fb065c111f13d856f21a150d2bcb`，消息为 `merge: b6d-2 catalog queries and trace`。`git checkout master`、`git merge --no-ff` 与首次 `git push origin master` 均 exit 0；首次推送后的 `origin/master` 为 `7e5ecffc8480fb065c111f13d856f21a150d2bcb`。

下一批 B6d-3 仍负责任意两版对比、XLSX 导出、上传错误 CSV、候选放弃（含迁移）及交接证据投影；本批不包含这些能力。
