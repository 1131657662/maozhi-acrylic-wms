# 第一里程碑验收记录

## 用途隔离修正验收（2026-11-08）

当前业务口径：库存与单据只认 ERP 商品；sku.txt / sku-spec 是扫码目录，只属于 B1c 页面（未开发）。本次只纠正库存视图和相关证据，不改建单/确认写入行为、历史数据或 API 契约。

| P 覆盖项 | 本轮验证 |
| --- | --- |
| ERP 唯一库存视图 | E2E 检查无页签、无非 ERP 行/空表/占位，库存与流水请求固定 erp-product；包括出库确认后库存变化 |
| 防混源与兼容 | 保留拒绝 all/多来源/总计参数及严格契约；旧 stock 三渠道兼容继续回归 |
| 未归属诊断 | 只记结构化警告行数；不增加响应字段；连续同计数查询不重复警告 |
| 未知状态 | 原常驻说明保留；未知流水在 ERP 视图回归 |

| U 指标 | 证据 |
| --- | --- |
| 原 3 个库存入口→1 个 ERP 视图；非 ERP 请求/占位 0 | `tests/e2e/stock-source.spec.ts`；1440/1280 截图 |
| 错源响应显示 0、重试恢复 ERP | 同一 E2E 文件；加载/错误/空态/403 断言 |

| N 已批准清单 | 本轮处理 |
| --- | --- |
| 无 | 未实施新增能力，B1c 仅修正文档归属 |

实测结果：API/小程序测试 **40/40**、E2E **11/11**、严格类型检查与 Web 构建通过；AntD 检查 0 issues。原始输出：`.local/evidence/erp-inventory-test-output.txt`、`erp-inventory-e2e-output.txt`、`erp-inventory-build-output.txt`。新截图：`.local/evidence/erp-inventory-only-1440.png`、`erp-inventory-only-1280.png`、`erp-inventory-unknown-journal-1440.png`；均不进入 Git。截图是临时库合成夹具，不能代替实体设备或生产验收。

## B1a 第 2 提交验收：双来源不合计（2026-11-08）

> 以下保留原批次历史证据；其中 SPEC/未归属库存入口与相加数值验收已被上方用途隔离修正取代，不是当前验收口径。

仅本地 MySQL 8 / 浏览器验收。没有迁移、重跑样本 seed 或历史数据改写；未连接生产、3306 或 warehouse。本批源码与 OpenAPI 生成物分开提交。第 3 批事务调整、B1b 及四类报表仍未完成。

### P 覆盖率（本提交范围）

| 能力 | 结果 | 证据及边界 |
| --- | --- | --- |
| 库存来源隔离 | 已通过 API/E2E | source_kind 分组；无全部/总计入口；只挂载一个来源；未知/缺失主数据仅明细 |
| 来源内小计与流水 | 已通过 SQL/E2E | 来源必填、拒绝 all/多值/额外 total 参数；混源响应拒绝；软删事实排除；目录重量不入库存 |
| 旧调用兼容 | 已通过回归 | `/stock` 原数组不变；三渠道契约；实际小程序模块回归、PDA 扫码/冻结/确认链路继续通过 |
| 未知状态可理解性 | 已通过 E2E/截图 | 灰色“状态待识别：原文”及详情常驻解释/核对指引；出库确认禁用 |
| 报表 | 未实现 | 新单来源契约可复用；不能把契约验收计成四类报表完成 |

### U 指标达成

| 指标 | 实际结果 | 测量方法 |
| --- | --- | --- |
| 非零双源夹具跨源数字误显示 | 0 次 | ERP 18 包/5.4460 吨；SPEC 30 包/9.1440 吨；错误相加 48 包/14.5900 吨，在 SQL 候选值和真实 DOM 均 0 命中 |
| 来源切换时旧数字残留 | 0 | 延迟目标来源响应，断言旧数字已卸载；错源响应不显示；重试恢复本来源 |
| 无来源库存请求 | 0 | E2E 捕获本页所有库存/流水请求，均为 by-source 且 source 必填 |
| 四态与版面 | 通过 | 加载、空态、错误重试、403；1440/1280 截图检查，无页面横滚 |

### N 已批准清单

| 新增候选 | 本轮处理 |
| --- | --- |
| 无 | 无 N 能力实施 |

### 可执行 SQL、测试与截图

- [`scripts/sql/verify-stock-sources.sql`](../scripts/sql/verify-stock-sources.sql)：第一条按来源出小计；第二条仅用于验收，计算禁止展示的跨源值并与库存明细/小计/最近流水的包数、吨数逐项比对。业务查询不引用该验收总计。
- `npx tsx --test apps/api/tests/stock-source.test.ts`：在 3307 独立临时库建立两来源非零夹具，执行 SQL，打印 `B1A2_SQL`，结束后清理本次临时库。
- `npx tsx scripts/verify-stock-sources.ts`：固定读取本机样本库，使用 READ ONLY 事务；真实输出留 `.local/evidence/b1a2-sample-sql-output.txt`。
- **数学边界**：真实样本 SPEC 库存为零，因此 ERP+0 的数值必然等于 ERP 页面小计；真实 SQL 的 matches=1 是该巧合，不能宣称真实数据满足严格不等式。非零夹具 SQL 的两项 matches=0；来源参数、响应契约和实际 DOM 共同证明没有跨源计算路径。不把条码目录总重量伪装为 SPEC 库存。
- `npm run test`：39/39 通过，`.local/evidence/b1a2-test-output.txt`；包含既有幂等/事务/编号及实际小程序模块回归。
- `npm run test:e2e`：11/11 通过，`.local/evidence/b1a2-e2e-output.txt`；新的三个用例在 [`stock-source.spec.ts`](../tests/e2e/stock-source.spec.ts)，未知状态解释在 [`numbering.spec.ts`](../tests/e2e/numbering.spec.ts)。
- `npm run build`：类型检查与生产构建通过，`.local/evidence/b1a2-build-output.txt`；AntD 检查 0 issues，`.local/evidence/b1a2-antd-lint.json`。
- 首轮 E2E 发现旧 MFSU 缓存导致新增契约导出为 undefined；已排除工作区契约的依赖预编译，完整回归通过。失败日志保留 `.local/evidence/b1a2-e2e-before-cache-fix.txt`，不将首次失败隐去。
- 截图：`.local/evidence/b1a2-stock-erp-product-1440.png`、`b1a2-stock-sku-spec-1440.png`、`b1a2-stock-spec-1280.png`、`b1a2-unknown-status-1440.png`、`b1a2-unknown-status-1280.png`、`b1a2-unknown-inbound-1440.png`、`b1a2-unknown-journal-1440.png`；均不进 Git。

回滚：先回退独立 OpenAPI 生成物提交，再回退本批实现；无需 down，数据库事实完全保留。尚未验证实体 PDA/小程序真机和生产环境。

## B1a 第 1 提交验收（2026-11-08）

本轮仅 RK/CK 自动取号、编号配置预览、旧请求兼容与统一原文回退。以下为本地 MySQL 8 / 浏览器模拟验收，不代表实体 PDA、小程序真机或生产验收。测试只用 3307 上新建的 `maozhi_test_*` 库；未访问生产/3306/warehouse。

### P 覆盖率（本提交范围）

| 能力 | 本批结果 | 证据/未完成边界 |
| --- | --- | --- |
| RK/CK 自动号与配置预览 | 已通过 API 与浏览器验收 | `numbering.spec.ts`；两类各 50 并发；宽度 2..8；预览不占号 |
| 未知状态/流水类型回退 | 已通过现有 Web 列表/详情/流水验收 | `numbering.spec.ts`；灰色原文；未知状态不画本地步骤；原始 null 保留 |
| 旧请求兼容/幂等/保号 | 已通过 API 回归和丢响应专项验收 | `numbering-history.test.ts`、`retry-numbering.spec.ts`；显式旧号不被静默替换 |
| 双来源不合计 | 未执行 | 第 2 提交，等用户放行 |
| 入库审核/明确确认、出库确认、库存调整事务完善 | 未执行 | 第 3 提交，等用户放行；现有创建即入库行为未改变 |
| 撤销审核/作废/更正 | 未执行 | B2，补偿流水及下游依赖检查；B1b 不处理状态机 |
| 单用户权限体系 | N/A | 不实现多用户/RBAC，不计入 P 分母 |

此表不把两个完成子项折算为整张 12 章矩阵已完成；其他 P 保持原缺口。

### U 指标达成

| 指标 | 基线 → 本轮结果 | 测量方法 |
| --- | --- | --- |
| 人工输入单号 | 每种表单 1 个 → 0 个 | `outbound.spec.ts` 实际创建/编辑；界面显示自动号说明 |
| 并发唯一性 | 未验证 → 入库/出库分别 50/50 唯一 | 真 HTTP Promise.all 并发；再查 DB GROUP BY；全号列表在原始日志 |
| 宽度碰撞 | 无保护 → 409、0 新增、0 重复组、原宽度/计数器不变 | `numbering-history.test.ts`；页面保存失败保留宽度输入 |
| 未知值可见性 | 入库硬编码/仅出库局部映射 → 0 空白、0 页面异常 | 真实临时 MySQL 注入未知值；API 和 E2E 断言、截图人工检查 |
| 丢响应后重试 | 基线未验证 → 保留表单，原键/原正文返回原单据 | Playwright 先让服务端提交再丢响应，断言按钮可用且非加载，再点击重试 |
| 任务耗时、首屏性能 | 待实测 | 本提交不宣称 B1b 性能/查询壳达标 |

### N 已批准清单

| 本轮新增候选 | 批准/执行情况 |
| --- | --- |
| 无 | 未实施任何 N 功能；最近流水只作原文类型展示载体 |

### 测试与截图

- `npm run test`：35/35 通过；原始输出 `.local/evidence/b1a-test-output.txt`，包含全部并发单号、碰撞响应、down 拒绝输出。
- `npm run build`：严格类型检查与 Umi 构建通过；`.local/evidence/b1a-build-output.txt`。
- `npm run test:e2e`：8/8 通过（53.6s），最终全量结果 `.local/evidence/b1a-e2e-output.txt`；丢响应专项结果 `.local/evidence/b1a-retry-output.txt`。重试按钮同时断言可用且无 loading 状态，避免图标进入可访问名称使精确文字选择器误判。
- AntD CLI：0 issues；`.local/evidence/b1a-antd-lint.json`。未新增依赖、未修改 UI 栈、未修改 `.ant-*` 样式。
- 真实数据库未知状态/类型截图：`.local/evidence/b1a-unknown-status-1440.png`、`b1a-unknown-status-1280.png`、`b1a-unknown-inbound-1440.png`、`b1a-unknown-journal-1440.png`。
- 编号配置截图：`.local/evidence/b1a-numbering-1440.png`、`b1a-numbering-1280.png`、`b1a-numbering-collision-1440.png`。已检查原文可见、主操作可见、无页面横滚；不是截图像素回归。
- 编号配置四态采用模拟错误响应；未知状态/类型和宽度碰撞来自真实临时 MySQL fixture，不用 mock 成功响应充当业务验收。
- 修改文档中的 83 个文件链接已核查存在；带行号引用未越界，均可点开复核。截图/原始日志/生产样本均留 `.local`，不进 Git。

### SQL 对账与原始输出

并发场景仅使用合成测试数据，以下语句由测试在临时库执行：

```sql
SELECT receipt_no, COUNT(*) AS n FROM inbound_receipts GROUP BY receipt_no HAVING COUNT(*) > 1;
SELECT order_no, COUNT(*) AS n FROM outbound_orders GROUP BY order_no HAVING COUNT(*) > 1;
SELECT COUNT(*) AS n FROM inbound_receipts;
SELECT COUNT(*) AS n FROM outbound_orders;
SELECT SUM(packages) AS packages, SUM(weight_tonnes) AS tonnes FROM inbound_lines;
SELECT packages, weight_tonnes AS tonnes FROM stock
 WHERE warehouse_code='DEMO-WH' AND product_code='ACR-032' AND source_del_flag=0;
SELECT COUNT(*) AS n FROM stock_journal;
SELECT COUNT(*) AS n FROM operation_log WHERE action='inbound.confirm';
```

实际输出（完整请求顺序单号见原始日志）：

```text
B1A_CONCURRENCY {"kind":"inbound","requested":50,"succeeded":50,"unique":50,"duplicates":0,"replaySame":true,"counter":50}
B1A_CONCURRENCY {"kind":"outbound","requested":50,"succeeded":50,"unique":50,"duplicates":0,"replaySame":true,"counter":50}
B1A_RECONCILIATION {"inboundRows":50,"outboundRowsIncludingFixtures":53,"inbound":{"packages":"50","tonnes":"15.1250"},"stock":{"packages":56,"tonnes":"16.9250"},"journal":50,"audit":50,"duplicateGroups":0}
B1A_MIGRATION_DOWN {"nonempty":"rules","output":"拒绝回退：document_number_rules 含有数据，禁止删除历史数据","state":"applied","dataPreserved":true}
B1A_MIGRATION_DOWN {"nonempty":"counters","output":"拒绝回退：document_number_counters 含有数据，禁止删除历史数据","state":"applied","dataPreserved":true}
```

碰撞 HTTP 返回 `409 / NUMBERING_COLLISION`；数据库出库表 beforeRows=5、afterRows=5、newRows=0、duplicateGroups=0；width=4、counter=1 未变。该 5 行包含 3 条初始 fixture、1 条自动号、1 条软删历史碰撞号。

004 已仅应用到本地 `127.0.0.1:3307/maozhi_dev_sample`；规则/计数器各 0 行，历史入库 115、出库 415、流水 828 未新增/删改。迁移前后对入库及明细、出库及明细、库存、流水、商品、条码目录共 8 表执行 `CHECKSUM TABLE`，完全一致。证据：`.local/evidence/b1a-local-migration.json`。生产和 3306 未连接。

回滚：空 004 表经迁移器 down；非空则只成套回退 Web/API 并保留表及数据，禁止为了 down 清表。入库审核/撤销归属见矩阵与提案；不把本轮号码事务等同第 3 提交的业务事务完善。

## 真实样本导入验收

来源：`erp.nbsmzwl.cn` 的 `wms` 数据库只读事务与本地 `C:\Users\qq113\Desktop\sku.txt`。生产连接先执行 `SET SESSION TRANSACTION READ ONLY`，导出在 `START TRANSACTION READ ONLY ... COMMIT` 中完成；原始 CSV 只存于被 Git 忽略的 `.local/prod-sample/`。

| 数据集 | 导出总行 | 导入总行 | 有效行 | 软删行 |
| --- | ---: | ---: | ---: | ---: |
| product（ERP历史商品） | 428 | 428 | 428 | 0 |
| inbound_order | 115 | 115 | 114 | 1 |
| inbound_order_detail | 182 | 182 | 166 | 16 |
| outbound_order | 415 | 415 | 414 | 1 |
| outbound_order_detail | 544 | 544 | 531 | 13 |
| stock | 122 | 122 | 121 | 1 |
| stock_journal | 828 | 828 | 804 | 24 |
| supplier | 2 | 2 | 1 | 1 |
| customer | 376 | 376 | 376 | 0 |
| warehouse | 3 | 3 | 2 | 1 |
| sku.txt 包级条码 | 9018 | scan_catalog 9018 | 9018 | 0 |

库存流水采用双口径：总行 828、有效行 804，差异为 24 条 `del_flag=1` 软删历史；软删行保留原状态、流水类型和来源 JSON，不参与当前统计。

| 聚合 | 生产只读副本 | 本地导入 | 结果 |
| --- | ---: | ---: | --- |
| 有效库存包数 / 吨 | 4688 / 1408.5930 | 4688 / 1408.5930 | 一致 |
| 有效入库包数 / 吨 | 12639 / 3806.4760 | 12639 / 3806.4760 | 一致 |
| 有效出库包数 / 吨 | 12527 / 3775.7690 | 12527 / 3775.7690 | 一致 |

条码全量校验：9018/9018 命中，重量 9018/9018 一致，未从条码推算；抽样 10 条逐条比较通过。可复现命令：`npm exec tsx scripts/verify-sample-seed.ts`。

`sku.txt` 的 141 种规格独立生成 `SPEC-001` 至 `SPEC-141` 条码目录商品；ERP 428 个历史商品保留原 code。两套商品不建立映射，原因是缺少可靠映射键。`manifest.json` 中行数为本轮验收口径，交接参考数字已过期。

日期：2026-11-07。范围：新项目本地合成数据；没有连接生产数据库/服务器，没有复制旧项目源码。

## 已验证

| 检查                | 结果              | 验证边界                                                                           |
| ------------------- | ----------------- | ---------------------------------------------------------------------------------- |
| TypeScript 严格检查 | 通过              | API、Web、共享契约                                                                 |
| 后端/小程序测试     | 18 项通过         | 每轮独立临时 MySQL 8 库；含小程序真实请求模块与 HTTP 后端对接                      |
| 浏览器 E2E          | 2 项通过          | 登录→详情→Web 确认→库存→日志；1280 空态与退出；1440 布局                           |
| Android Debug 构建  | 通过              | 全新包名 cn.maozhi.wms.pda.debug                                                   |
| Android JVM 单测    | 3 项通过          | 两个实重不相等、缺重拦截、100g 精度拦截                                            |
| Android lint        | 0 errors          | 保留依赖更新/target SDK/中文资源化等警告，不用忽略规则掩盖错误                     |
| Android 仪器测试    | 3 项通过          | Room 关闭重开后事实不变；实际 API 补传/冻结；键盘输入落库与界面截图                |
| 小程序资源检查      | 通过              | Vant 资源、全局组件入口和页面文件完整                                              |
| 小程序 API 对接检查 | 通过              | channel=miniapp；page/pageSize/keyword；items/total；lines/重量字段对齐；401重登录 |
| 小程序 UI 静态检查  | 通过              | 原生+Vant、空态/错误/重试/加载/分页、安全区、长文本省略、按钮防重                  |
| 备份/恢复           | 通过              | MySQL `mysqldump` 单事务备份、库身份检查，恢复到白名单新库，恢复库会话失效         |
| npm 官方安全审计    | 0 vulnerabilities | 执行时已安装 Node 依赖树；不等同生产安全验收                                       |
| AntD CLI 检查       | 0 issues          | 当前 Web 源码                                                                      |

## 第二阶段增量验收

| 检查                    | 结果      | 验证边界                                                                    |
| ----------------------- | --------- | --------------------------------------------------------------------------- |
| 严格类型检查与 Web 构建 | 通过      | Umi Max / Ant Design Pro 工程                                               |
| API 与小程序测试        | 26 项通过 | 临时 MySQL 8 库；含 Web 同源写入及 PDA/小程序权限边界                       |
| 浏览器 E2E              | 4 项通过  | 入库详情、主数据新增、出库计划新建/编辑；另含既有出库确认流程和 1280 宽布局 |
| OpenAPI 文档            | 已更新    | 覆盖主数据、入库、出库计划创建和编辑                                        |

上述结果分别表示代码完成、构建通过和浏览器模拟验收，不代表微信开发者工具、实体 PDA 或生产环境验收完成。

## 核心业务证据

- `302500g + 297500g = 600000g = 0.6000 吨`；未使用统一件重推算。
- PDA 接收事实、重复补传、冻结期间库存和库存流水均不改变。
- Web 确认后由 6 包 / 1.8000 吨变为 4 包 / 1.2000 吨。
- 重复确认同幂等键返回原结果，不重复扣库存；新键携旧修订号被拒绝。
- 不同正文复用事实 ID、同条码重复、跨计划重复、目录重量不符均被拒绝。
- 缺包/计划实重不符/摘要或修订变化不允许冻结。
- 一个单据后续商品库存不足，会回滚此前商品的扣减与流水，单据仍冻结待确认。
- PDA 与小程序会话都不能调用库存确认；Web 会话不能写扫码事实。
- 本机条码队列保存固定 UUID 和原始正文；回传成功与缓存计划更新在 Room 事务中提交。

## 本地证据位置

- `.local/evidence/web-list-1440.png`
- `.local/evidence/web-list-1280.png`
- `.local/evidence/web-detail-1440.png`
- `.local/evidence/inbound-detail-1440.png`
- `.local/evidence/master-data-1440.png`
- `.local/evidence/outbound-plan-1440.png`
- `.local/evidence/pda-scan.png`
- `apps/pda/app/build/reports/tests/testDebugUnitTest/`
- `apps/pda/app/build/reports/lint-results-debug.html`
- `.local/backups/*.sql` 与恢复脚本输出的 `maozhi_restore_*` 新库

## Android 仪器测试复现

使用新建的隔离模拟器或只读 AVD，勿针对承载实际作业队列的设备清数据。
启动独立测试 API：PowerShell 设置 `$env:TEST_PORT='4312'` 后执行 `npx tsx scripts/e2e-api.ts`。
将指定测试模拟器的 `tcp:4310` reverse 到本机 `tcp:4312`；安装本项目 Debug APK 和 AndroidTest APK。
运行 `adb -s <测试模拟器> shell am instrument -w cn.maozhi.wms.pda.debug.test/androidx.test.runner.AndroidJUnitRunner`。
三项测试分别使用独立 Room 数据文件或本项目隔离测试应用，合成计划 002/003；每轮从新测试 API/隔离模拟器开始。
本轮使用 `emulator-5580`，只读 Pixel_6 AVD，没有在连接的实体 PDA 上安装/改数据。

## 不宣称完成的验收

1. 微信开发者工具/微信真机渲染及发布：当前环境没有可用的开发工具 CLI，未用静态检查冒充真机验收。
2. 实体扫码枪厂商广播、功能键、连续 100 包、跨天弱网和设备时钟偏差。
3. 真实条码目录、现场称量、短装/超发放行、作废重扫、计划变更、生产 MySQL 兼容。
4. 生产迁移、备份留存/异地恢复、HTTPS 部署、release 签名和覆盖升级。
5. 第一阶段库存来自合成期初数；第二阶段入库和主数据功能已代码实现并通过浏览器模拟验收，但入库撤销/更正仍未开放；CSV/打印等业务尚未实现。

## 已知技术取舍

- 本地 MySQL 8 仅用于合成数据开发和测试，不把它当成生产部署、生产迁移或现场验收完成。
- ProComponents 3 为固定预发布版本；已跑浏览器测试，仍需随正式版本评估升级。
- Web 采用路由懒加载；ProComponents/AntD 共享包仍较大，生产性能预算尚待后续优化。
- 本阶段列表用有上限的服务端 OFFSET 分页，面向单用户少量单据；大规模导出/游标分页不在第一闭环内。
- 首轮浏览器失败由按钮中文空格、searchbox 语义和重复空态文案匹配引起，已修正选择器及可访问名称；最终两项均通过。
