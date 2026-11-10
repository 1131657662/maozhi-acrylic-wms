# 茂智腈纶仓 P/U/N 对齐矩阵

状态只按当前代码与可定位证据填写；新现状无证据时按未完成处理。U 统一写作“旧痛点 → 新改法 → 量化收益”；无法说明收益的改动降为 P。P 覆盖率按非 N/A 的 P 行统计，权限按单用户边界明确记为 N/A，不纳入分母。P0 收敛为 8 项：仅纳入库存正确性、单据可追溯性、旧 ERP 高频路径或多个后续模块共同依赖的能力；其余功能按依赖和风险进入 P1–P3。

2026-11-10状态同步：B1a/B1b/B1c/B2a/B3a/B3b/B4a保留原批次证据；B3c代码已完成但周转冷首屏未达性能目标；B5a与B6a已有代码及本地验收，011/012已应用3307。**B6b 已完成并通过用户验收：test 200/200、E2E 84/0、build exit 0；013 已应用3307开发样本库，备份/指纹/持久化冒烟通过。** B6b-perf及Firefox/WebKit覆盖后续处理；B5b–d、B6c及其余页面增强待实施，打印仍未实现。批次完成不代表实体/生产验收。
| 模块 | 旧系统功能点（手册章节） | 新现状 | P 差距 | U 升级（旧痛点 → 新改法 → 量化收益） | U 指标 | N 候选 | 优先级 | Batch | UI 参考 | 证据指针 | 备选/风险 |
|---|---|---|---|---|---|---|---|---|---|---|---|

用途隔离现状：B6a库存与单据使用显式库存资格；历史erp-product固定有资格，本地新建可参与；旧app逐条核查库存行与四类进行中引用，有引用则待确认，未知资料不自动转正；`sku-spec` 仅属于 B1c 条码目录用途；B1c-1 Web/服务端已验证；B1c-2 本地与 M71 隔离包已验证，现场实际队列仍待验收。目录是用户按需上传的有效条码全量快照，不参与库存/单据/报表聚合；扫码时的版本/实重另存不可变事实。未归属数据只写诊断日志，不设库存入口。B1c 设计见 U-06/DD-15，计划用例不得算作已通过证据。

## 登录首页

| 模块 | 旧系统功能点（手册章节） | 新现状 | P 差距 | U 升级（旧痛点 → 新改法 → 量化收益） | U 指标 | N 候选 | 优先级 | Batch | UI 参考 | 证据指针 | 备选/风险 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 登录首页 | 登录、会话、首页工作台（1） | 登录/ProLayout已有；当前首页是出库列表，未有dashboard/analysis聚合 | P：工作台/看板和可信指标未做，见正式页面行 | 入口分散、需逐个打开列表 → 首页按“待处理/最近操作”汇总并直达 → 同一任务目标从 3 次导航降至 1 次；待实测 | E2E 记录任务点击数；首页关键内容可见时间待实测 | 待办/消息聚合 | P1 | B7b / UI-3 | 登录页、Workplace | E2E: [tests/e2e/outbound.spec.ts:44](../tests/e2e/outbound.spec.ts#L44) | 首页聚合可能与列表筛选口径不一致，复用同一查询条件 |

## 基础资料

| 模块 | 旧系统功能点（手册章节） | 新现状 | P 差距 | U 升级（旧痛点 → 新改法 → 量化收益） | U 指标 | N 候选 | 优先级 | Batch | UI 参考 | 证据指针 | 备选/风险 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 基础资料 | 商品新增、编辑、启停（2.1） | B6a已开放新增/编辑/启停、分类、来源/资格与保存快照 | B6a批准范围已补齐；B6b公共交互已完成，主数据专页扩展仍后置 | 本地商品不可入库 → 统一资格并保留来源 → 新建后可选/可入账，待验 | 新增可选/可入账；四类引用422和建单/停用竞态验证 | 无 | P1 | B6a | Product、ProductCategory | [B6A_ACCEPTANCE](B6A_ACCEPTANCE.md)；master-b6a/master-guards/master-snapshots测试 | 历史来源与原值保留；新快照缺失统一“历史未记录”；本地验证不代表生产验收 |
| 基础资料 | 仓库新增、编辑、启停（2.2） | B6a已补联系人/电话/地址/memo；停用检查库存包吨均零及进行中引用 | 本轮批准范围已补齐 | 同一资料结构在多页重复学习 → 复用编码/名称/状态布局 → 目标从每类学习 3 种布局降为 1 种 | 结构与事务守卫见master-data/references.ts；本地回归见B6A_ACCEPTANCE | 无 | P1 | B6a | Warehouse | [B6A_ACCEPTANCE](B6A_ACCEPTANCE.md)；master-b6a/master-guards/master-snapshots测试 | 历史来源与原值保留；新快照缺失统一“历史未记录”；本地验证不代表生产验收 |
| 基础资料 | 供应商新增、编辑、启停（2.3） | B6a送货档案、默认唯一、供应商/联系人保存快照及停用保护 | B6a批准范围已补齐；B6b公共交互已完成，供应商专页扩展后置 | 列表与编辑上下文分离 → 行内显示状态、抽屉保存后回原筛选 → 目标启停 2 步完成 | 入库名称改动后快照不变；缺失三处一致 | 导入校验报告 | P1 | B6a | Supplier | [B6A_ACCEPTANCE](B6A_ACCEPTANCE.md)；master-b6a/master-guards/master-snapshots测试 | 历史来源与原值保留；新快照缺失统一“历史未记录”；本地验证不代表生产验收 |
| 基础资料 | 客户新增、编辑、分级（2.4） | B6a收货档案、默认唯一、客户联系快照与车辆隐式建档 | 分级不属单用户当前批准范围；B6b公共交互已完成，客户专页扩展后置 | 重复录入地址/联系人 → 选择客户时带出历史资料、单据保留快照 → 单据录入少填 3 个联系字段 | 三联系人默认切换/停用、客户改名不回写；并发车牌一条 | 经营数据看板 | P1 | B6a | Customer | [B6A_ACCEPTANCE](B6A_ACCEPTANCE.md)；master-b6a/master-guards/master-snapshots测试 | 历史来源与原值保留；新快照缺失统一“历史未记录”；本地验证不代表生产验收 |
| 基础资料 | **[红色风险] ERP 库存商品与 SPEC 扫码目录用途隔离** | 库存使用显式资格；141规格/9018条码只用于扫码目录；不推全局关联键 | P：B1c-1 目录/事实上下文已验证；B1c-2 已验收；缺关联键不得自动匹配 ERP 商品 | 把扫码目录当库存 → 库存与单据只认显式资格，sku-spec只属于B1c目录页 → 无资格商品混入0次 | E2E 检查唯一 ERP 视图；9018 条目录沿用 DATA 基线 | 全局商品关系维护（后置，不属 B1c） | P0 | B1a / B1c | Product、InventorySettlement | E2E: [tests/e2e/stock-source.spec.ts](../tests/e2e/stock-source.spec.ts)；DATA: [scripts/verify-sample-seed.ts](../scripts/verify-sample-seed.ts) | 不按名称/前缀猜测；B1c 由原单 ERP 作业行保存事实归属，不建立全局映射；缺归属旧事实须先核对，不能因上传丢失 |

## 入库

| 模块 | 旧系统功能点（手册章节） | 新现状 | P 差距 | U 升级（旧痛点 → 新改法 → 量化收益） | U 指标 | N 候选 | 优先级 | Batch | UI 参考 | 证据指针 | 备选/风险 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 入库 | 新建：仓库/供应商/日期/车辆/明细（3.1） | RK自动号/待确认创建与确认已有；B5a新增business_date及数量更正 | P：B5b短溢装/追加入库/纠错转移、联系/快照字段已由B6a补齐 | 手填单号且明细逐项录入 → 服务端 RK 自动号、包数与总吨数独立录入 → 少填 1 个字段；新建目标 ≤2 屏 | 50 并发入库 0 重复；录入时长待实测 | N-02 粘贴多行录入（B3 候选）；仅用于目录/事实辅助，不改变入库不扫码的业务边界 | P0 | B1a / B5a / B5b / B6a | InboundOrderForm、InboundEntry | E2E: [tests/e2e/outbound.spec.ts:77](../tests/e2e/outbound.spec.ts#L77) | 旧请求可保留原单号；旧缓存前端须刷新以获得确认入口；不能把创建成功当库存入账 |
| 入库 | 列表搜索、筛选、排序、导出（3.2） | B6b 已完成：默认50/URL筛选/任一或全部商品反查/三入口/逐单批量撤销/两种schema三范围XLSX与CSV/三态排序/列宽及服务端偏好 | 本批批准范围已补齐；详情单张导出待B5d、打印待B9，反查性能另列B6b-perf | 历史单误禁选、列设置清缓存即丢 → 选择与撤销资格分离、偏好服务端保存 → 选3导出3，撤销1/排除2；刷新及清缓存恢复，勾选位移0px | test 200/200、E2E 84/0、build exit 0；1440/1280页面无横滚；单号220→320px、其他列不变；并发1/5 p95原值见验收 | 无（保存视图与批量撤销已实现） | P0 | B6b 已完成 / B5d待实施 | InboundOrderList、InboundDataTables | [B6B_ACCEPTANCE](B6B_ACCEPTANCE.md) §8–13；tests/e2e/b6b-selection-sort.spec.ts、b6b-resizable-columns.spec.ts、b6b-preferences.spec.ts | 历史单可选导出但不可撤；批量仅reverse、逐单事务与幂等；失败/取消无部分文件；013已应用开发库；非生产验收 |
| 入库 | 详情审核、撤销审核、库存联动（3.3） | B2a撤销/作废已有；B5a更正保留原量，详情返有效量/累计差额/最近更正，撤销按有效量抵消链 | P：数量更正已实现；入账后日期更正及快照扩展未做；普通历史单只读，legacy-open承接另待B10 | 错误入账缺自助恢复 → 原详情核对补偿并填写原因，事务终结 → 原+补偿delta为0，重复补偿0笔 | 两类各20首次并发仅1补偿；7阶段故障无部分写入；UI失败保留原因/原键；耗时待实测 | 审计差异对比 | P0 | B2a / B5a / B5d / B10 | InboundOrderDetail | [B5A_ACCEPTANCE](B5A_ACCEPTANCE.md)；[document-lifecycle.spec.ts](../tests/e2e/document-lifecycle.spec.ts) | 非实物退货；同仓商品后续有效流水、余额不符或原证据不足则阻断；原流水/原号保留，不重开 |

## 出库

| 模块 | 旧系统功能点（手册章节） | 新现状 | P 差距 | U 升级（旧痛点 → 新改法 → 量化收益） | U 指标 | N 候选 | 优先级 | Batch | UI 参考 | 证据指针 | 备选/风险 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 出库 | 新建：仓库/客户/日期/车辆/明细、库存校验（4.1） | CK自动号、本地open仅车号/备注可编辑；B5a业务日期及数量更正已有 | P：联系人/车辆隐式建档/快照B6a已补齐；分批/短溢发/短关B5c待实施；不把状态标签当完整能力 | 编辑重建行破坏离线归属 → 表头独立更新且明细409 → 下载后离线事实补传200，行ID/UUID/正文变化0 | 999.9999与1000吨200，1000.0001吨422；时序见B4A_VALIDATION | Web 摄像头扫码 | P1 | B4a / B5a / B5c / B6a | OutboundOrderForm、OutboundPlanEntry | E2E: [boundary.spec.ts](../tests/e2e/boundary.spec.ts)；TEST: boundary-http.test.ts | 号码/客户/仓库/明细创建后不可改；只允许有库存资格的商品；B2a作废保护保留 |
| 出库 | 列表搜索、筛选、排序、导出（4.2） | B6b 已完成：默认50/URL筛选/任一或全部商品反查/三入口/逐单批量撤销/两种schema三范围XLSX与CSV/三态排序/列宽及服务端偏好 | 本批批准范围已补齐；详情单张导出待B5d、打印待B9，反查性能另列B6b-perf | 历史单误禁选、列设置清缓存即丢 → 选择与撤销资格分离、偏好服务端保存 → 选3导出3，撤销1/排除2；刷新及清缓存恢复，勾选位移0px | test 200/200、E2E 84/0、build exit 0；1440/1280页面无横滚；单号220→320px、其他列不变；并发1/5 p95原值见验收 | 无（保存视图与批量撤销已实现） | P1 | B6b 已完成 / B5d待实施 | OutboundOrderList | [B6B_ACCEPTANCE](B6B_ACCEPTANCE.md) §8–13；tests/e2e/b6b-selection-sort.spec.ts、b6b-resizable-columns.spec.ts、b6b-preferences.spec.ts | 历史单可选导出但不可撤；批量仅reverse、逐单事务与幂等；失败/取消无部分文件；013已应用开发库；非生产验收 |
| 出库 | 详情审核、撤销审核、库存联动（4.3） | B2a限定撤销/作废已有，B5a更正/有效量/抵消链已有，原事实不变 | P：已扫/下发作废仍守卫；B5c批次/剩余量/短关/取样未做；B10承接专用确认/作废未做 | 误确认无法安全回退 → 详情核对补偿/下游证据并终结 → 原+补偿delta为0，事实正文变化0 | 20首次并发仅1补偿；7阶段故障全回滚；PDA读取/作废10轮竞争不同时成功；原事实幂等重放可用 | 差异放行/短装超发（本轮不做） | P0 | B2a / B5a / B5c / B10 | OutboundOrderDetail、OutboundVehicleConfirmation | [B5A_ACCEPTANCE](B5A_ACCEPTANCE.md)；[document-lifecycle.spec.ts](../tests/e2e/document-lifecycle.spec.ts) | 只纠正误确认，不代表实物回库；已入账禁止作废；原号不复用；PDA/小程序无补偿权限；旧计划下发状态未知时保守阻断 |
| 出库 | 未知状态/流水类型显示 | B6b公共交互已完成；未知原值回退与审计展示边界未纳入本批实现，仍待专项收敛 | P：未知中文、按对象映射cancelled、审计原值折叠区例外待B6c；不得随B6b交互验收标成完成 | 内部值暴露 → 中文解释+受控诊断 → 列表原始技术值0处，待验 | E2E 真 MySQL 未知值逐页断言；1440/1280 截图 | 无 | P0 | B6c 待实施 | OutboundOrderDetail、StockJournal | packages/contracts/src/list-display.ts statusText；[B6B_ACCEPTANCE](B6B_ACCEPTANCE.md)；AUDIT_PAGE_SPEC | 旧原文截图仅历史证据，不作为新页面验收标准 |

## 打印（已延后）

| 模块 | 旧系统功能点（手册章节） | 新现状 | P 差距 | U 升级（旧痛点 → 新改法 → 量化收益） | U 指标 | N 候选 | 优先级 | Batch | UI 参考 | 证据指针 | 备选/风险 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 打印 | 入库单/出库单/出库套打及模板配置（3.3/4.3/9） | 已延后，依赖积木报表配置；未实现 | P：配置/密钥引用、生成请求去重、代理PDF、新单数据契约、三模板实际打印均未做 | —（先保证旧版式对齐，不虚造效率提升） | 旧ERP同单号/同参数PDF叠图一致；待提供配置及旧打印件实测 | 无 | P1 | B9 | 旧单据打印按钮、打印配置 | E2E: 待补；IMG: 待提供旧打印件 | 只接三种PDF；真实地址/密钥不下发、不入审计；前端节流不能代替服务端去重 |

## 现场端（PDA / 小程序）

| 模块 | 旧系统功能点（手册章节） | 新现状 | P 差距 | U 升级（旧痛点 → 新改法 → 量化收益） | U 指标 | N 候选 | 优先级 | Batch | UI 参考 | 证据指针 | 备选/风险 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| PDA 现场扫码 | 出库扫码事实、冻结与补传（4.3/现场作业） | B1c-2 本地版本/逐条同步状态与差异提示已验；记录页显示待传/失败/冲突；主屏高频扫码体验留原 U 批次 | U：真实扫码枪焦点/反馈与操作耗时仍待测，不能以仓储层 100 条自动录入代替 | 扫码后离开主屏查队列 → 主屏连续扫码并显式分列补传/失败/冲突 → 100 包离线连续输入焦点保持目标 100%，冲突可见率 100% | Android 仪器测试断网新扫/回传和真正冲突；实体扫码枪待实测 | 无 | P1 | B2 | ScanScreen、扫码记录 | E2E: [Android ScanIntegrationTest.kt](../apps/pda/app/src/androidTest/java/cn/maozhi/wms/pda/ScanIntegrationTest.kt) | 沿用 B1c 本地同步版本 + 服务端接受历史版本事实；不得冻结即出库或由 PDA 扣库存 |
| PDA SKU / 条码目录管理 | 本地版本、文件导入、云端更新（旧 PDA 补充能力；关联手册 4.3，手册未单列 SKU 章节） | B1c-1 Web 已验；B1c-2 本地目录原子刷新/离线混版/旧队列交接与可见门禁已验（M71 隔离合成数据） | P：B1c技术链路已有；UI-6查询/轨迹/候选放弃/差异导出待做，设备实时队列/同步覆盖率不支持；实际现场队列仍待验 | 缺码后无法续扫且换目录影响旧记录 → 全量快照整版生效、本地同步版本离线扫码、服务端接受历史版本事实 → 原单重建 0 次、历史事实变化 0、版本/实重追溯 100% | M71 断网 100 条重开 100/100，刷新失败后第 101 条成功；原单 60*v1+1*v2，旧正文变化 0；58 条一次批量核验；真实枪耗时待测 | 无 | P1 | B1c-1 / B1c-2 / B6d | 旧 PDA SKU 管理 / V10SkuActivity | E2E: [tests/e2e/catalog-versioning.spec.ts](../tests/e2e/catalog-versioning.spec.ts)；E2E: [tests/e2e/catalog-upload-errors.spec.ts](../tests/e2e/catalog-upload-errors.spec.ts)；DATA: [scripts/pda/verify-device-queue.py](../scripts/pda/verify-device-queue.py)；E2E: [tests/e2e/catalog-handoff.spec.ts](../tests/e2e/catalog-handoff.spec.ts)；IMG: .local/evidence/b1c2-version-notice-pda.png | 推荐不可变整版快照，备选区间历史；移除不审批、不扣库；同单混版；新版改重/删码只提示，版本不存在/被撤销等异常进可见冲突；v1 队列/摘要先兼容 |
| 小程序只读查询 | 单据/库存只读查询（现场辅助） | 出库列表和详情查询已有 | U：详情返回后列表回到第一页且需重新定位 | 返回详情重载第一页 → 保留筛选、页码、列表和滚动锚点并刷新 → 返回目标位置 1 次系统返回动作，恢复率 100% | 微信开发者工具第 3 页往返测试；当前位置恢复基线待实测 | 无 | P2 | B2 | 出库查询、单据详情 | E2E: 待补 | 只读；小程序不扫码、不录入事实、不写库存 |

## 库存

| 模块 | 旧系统功能点（手册章节） | 新现状 | P 差距 | U 升级（旧痛点 → 新改法 → 量化收益） | U 指标 | N 候选 | 优先级 | Batch | UI 参考 | 证据指针 | 备选/风险 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 库存 | 查询、预警、流水（5.1） | B1b-1：ERP商品/仓库筛选、分页、同筛选小计、列设置已验；原调整和最近20条流水保留；B1b-2 XLSX三范围与屏幕逐格核对已验 | P：待发/可发/计划缺口/五档库龄投影与全量流水筛选导出未做；原在库查询/XLSX已有 | 全量库存渲染 → 分页上限200行+筛选全量ERP小计 → 10k夹具单页200行、1280/1440页面横滚0 | SQL核对10000行/20000包/6000.0000吨；四态错源不残留数字；浏览器p95见ACCEPTANCE | 库存预警看板 | P1 | B6f / UI-4 | StockList、StockJournal | E2E: [tests/e2e/stock-source.spec.ts](../tests/e2e/stock-source.spec.ts)；IMG: .local/evidence/b1b1-stock-1440.png；DATA: [scripts/verify-list-performance.ts](../scripts/verify-list-performance.ts)；E2E: [tests/e2e/web-exports.spec.ts](../tests/e2e/web-exports.spec.ts)；DATA: [scripts/verify-export-performance.ts](../scripts/verify-export-performance.ts) | 小计含全部匹配分页而非当前页；SPEC不计库存；增加汇总查询成本，不宣称SQL比旧全量读取更快；快照内分批、不混源，失败/取消不提供部分文件 |
| 库存 | 手工库存调整、原因、流水（5.2） | ERP 行内调整抽屉：独立包数/吨数、原因、前后预览；流水/审计/幂等同事务 | P：调整/B2a撤销/B3a盘点已有；B5a数量更正已有，页面增强另批 | 直接改值难复核 → 调整抽屉展示调整前后值且原因必填 → 调整可追溯率 100% | 同键 20 并发只调整 1 次；空原因 422、不足 409 均无写入；5 阶段故障回滚；SQL chain_breaks=0 | 无 | P0 | B1a / B5a | StockList | E2E: [tests/e2e/inventory-posting.spec.ts](../tests/e2e/inventory-posting.spec.ts)；DATA: [scripts/sql/verify-inventory-posting.sql](../scripts/sql/verify-inventory-posting.sql)；IMG: .local/evidence/b1a3-stock-adjustment-1440.png | 当前值过期返回 STALE_STOCK，保留输入、明确刷新；不同单据共享库存格，调整不篡改单据 |
| 库存 | 库存与扫码目录用途隔离 | B6a统一库存商品汇总/明细/流水；未授资格仅诊断，无库存入口 | P：四报表已改显式资格；旧source=erp-product接口保留精确来源子集；B6f投影增强待实施，条码目录继续排除 | 多个库存入口误导用户 → 删除 SPEC/未归属页签与占位，固定 ERP → 库存入口 3→1，非 ERP 请求/占位 0 | E2E 检查固定 ERP 请求、无页签、错源拒绝、四态；API 检查日志与原守卫 | 经营看板 | P1 | B6a / B6f | InventorySettlement | E2E: [tests/e2e/stock-source.spec.ts](../tests/e2e/stock-source.spec.ts)；IMG: .local/evidence/erp-inventory-only-1440.png | sku-spec 只属于 B1c 目录页；保留 all/多来源/总计拒绝与旧 stock 契约；不改数据 |

## 盘点

| 模块 | 旧系统功能点（手册章节） | 新现状 | P 差距 | U 升级（旧痛点 → 新改法 → 量化收益） | U 指标 | N 候选 | 优先级 | Batch | UI 参考 | 证据指针 | 备选/风险 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 盘点 | 新建、加载库存、填实盘、算差异（6.1） | B3a：ERP仓库/可选商品范围、固定快照、逐行包数/吨数实盘与revision校验已实测 | P：B3a基础已有；明盲盘/默认可覆盖折吨/独立盘盈行/跨页草稿/导出需B6e；200非容量 | 人工找系统数并手算 → 同页并列固定快照/实盘/差异、行抽屉保存 → 离开详情0次，10000行SQL差异错误0 | 万行脚本逐行SQL；未录为NULL；正负零差异/API故障验证；人工录入耗时待实测 | PDA盘点（未批准） | P2 | B3a / B6e | StockCheckOrderForm | E2E: [tests/e2e/stocktake.spec.ts](../tests/e2e/stocktake.spec.ts)；DATA: [scripts/verify-stocktake-volume.ts](../scripts/verify-stocktake-volume.ts)；IMG: .local/evidence/b3a-reading-1280.png | 包吨独立；盘点均重默认允许且可覆盖，半包手填；入库仍不推重量；万行能力保留 |
| 盘点 | 列表、搜索、状态（6.2） | B3a：单号/状态筛选、分页、详情；菜单常驻进行中数量，单张直达 | P：本轮列表/状态/遗忘窗口路径已实测 | 容易忘记结束 → 常驻入口与暂停原因 → 单张进行中定位1次点击，进行中页面级横滚0 | E2E遗忘窗口确认409、入口定位；1440/1280；浏览器万行p95见ACCEPTANCE | 无 | P2 | B3a | StockCheckOrderList | E2E: [tests/e2e/stocktake.spec.ts](../tests/e2e/stocktake.spec.ts)；IMG: .local/evidence/b3a-forgotten-window-1280.png | counting仅完成/作废释放；不设手动或超时解锁；无自动放行 |
| 盘点 | 详情、差异回写、作废（6.3） | B3a：人工原因、未入账清单、显式快照口径确认、原子回写/作废已实测 | P：基础回写已有；B6e扩逐行原因/盲盘令牌与批量保存，窗口/ACK/漂移/幂等不得简化 | 差异手算再改库存 → 固定预览token与事务流水/审计 → 20并发仅1次入账，7阶段失败残留0 | 同键/异键并发、全量SQL；作废库存/流水变化0；ACK审计保留 | 差异放行（本轮不做） | P2 | B3a / B6e | StockCheckOrderDetail | E2E: [tests/e2e/stocktake.spec.ts](../tests/e2e/stocktake.spec.ts)；DATA: [scripts/sql/verify-stocktake.sql](../scripts/sql/verify-stocktake.sql)；IMG: .local/evidence/b3a-unposted-preview-1440.png | 快照后未入账默认409；人工确认“按快照时点口径回写”才继续；清单变更须重核；其他仓不受业务暂停影响 |

## 统计报表

| 模块 | 旧系统功能点（手册章节） | 新现状 | P 差距 | U 升级（旧痛点 → 新改法 → 量化收益） | U 指标 | N 候选 | 优先级 | Batch | UI 参考 | 证据指针 | 备选/风险 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 报表 | 月度出入库汇总（7.1） | B3b：仓品月份、确认/撤销/调整分列、单数去重、对账/完整性和XLSX已本地验证 | P：B3b基础已有，B5a更正分类元数据已有；B5d更正明细/重述及UI-5图表未做；T0未核实 | 业务日/流水日混算且手工拼表 → 同一入账口径与常驻包吨对账 → 3个月逐仓品SQL/明细计算差异0，未知/断点不伪造0 | 3月样本脚本和合成18单元；延迟与不可验证单元见ACCEPTANCE，真人耗时待测 | 经营看板 | P2 | B3b / B5d / B7a | MonthlySummary | E2E: [tests/e2e/reports.spec.ts](../tests/e2e/reports.spec.ts)；DATA: [scripts/verify-report-samples.ts](../scripts/verify-report-samples.ts)；IMG: .local/evidence/b3b-monthly-1280.png | 只认ERP；撤销按发生月负量，check/import不挤入收发；历史时间未核实；余额/单数不跨月/商品相加 |
| 报表 | 商品周转率（7.2） | B3c代码/本地验证已有（84fb14d），周转冷首屏未达性能目标 | P：基础口径/导出已有；UI图表/联动和性能收敛未完成，不是未实现 | 需手算周转率 → 明示公式并可排序 → 计算复核目标从逐行计算降到抽查 10 行 | SQL 与脚本对同一时间段交叉核验；待实测 | 无 | P2 | B3c / B7a | Turnover | [IMPLEMENTATION_PLAN](IMPLEMENTATION_PLAN.md) B3c；[REPORT_SPEC](REPORT_SPEC.md) | 保留冷/热分测、未知日均/零分母；不能写全部验收通过 |
| 报表 | 入库/出库明细（7.3） | B3b：已入账流水含补偿、日期/仓库/商品、分页排序、原单下钻、三范围XLSX已本地验证 | P：基础含确认/撤销；尚缺更正/抵消明细与重述读模型、图表联动 | 旧导出1万行截断且字段来源不一 → 共用字段和固定快照流式导出 → 10万行全量唯一/末条命中，三范围逐字段差异0 | SQL、35字段API/XLSX和可见列浏览器比对；10万行耗时/内存见ACCEPTANCE | 无 | P2 | B3b / B5d / B7a | InboundDetail、OutboundDetail | E2E: [tests/e2e/reports.spec.ts](../tests/e2e/reports.spec.ts)；DATA: [scripts/verify-report-performance.ts](../scripts/verify-report-performance.ts)；IMG: .local/evidence/b3b-details-1440.png | 附页对账保留全部筛选区间；页面/选中仅主表缩小；失败/取消无部分文件；非单调时间大规模排序性能待测 |
| 报表 | 库龄分析（7.4） | B3c五档吨数FIFO/无法归龄与导出已有（84fb14d） | P：UI-5图表/下钻与库存联动待做；不再判未实现 | 靠记忆找久库存 → 固定截止日和分段，下钻原库存 → 过龄项目定位 ≤2 步 | 固定快照 SQL 对账；响应时延待实测 | 库龄看板 | P2 | B3c / B7a | StockAging | [IMPLEMENTATION_PLAN](IMPLEMENTATION_PLAN.md) B3c；[REPORT_SPEC](REPORT_SPEC.md) | 多层分桶、不可归龄不填0，不推包数库龄 |

## 权限

| 模块 | 旧系统功能点（手册章节） | 新现状 | P 差距 | U 升级（旧痛点 → 新改法 → 量化收益） | U 指标 | N 候选 | 优先级 | Batch | UI 参考 | 证据指针 | 备选/风险 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 权限 | 用户/角色/菜单/操作权限（8.1-8.2） | 单用户身份与 channel 校验 | N/A（单用户：不实现多用户、组织、复杂 RBAC、多级审批；不计 P 覆盖率） | N/A | N/A | 不建议做角色矩阵 | N/A | — | UserList、RoleList | E2E: [tests/e2e/outbound.spec.ts:44](../tests/e2e/outbound.spec.ts#L44) | 登录与接口身份校验保留 |
| 权限 | 单用户身份边界（AGENTS） | owner 单一身份 | N/A（不实现角色审批；保留登录、操作日志、校验、备份恢复） | N/A | N/A | 不建议做审批流 | N/A | — | AuthGate、PersonalCenter | E2E: [tests/e2e/outbound.spec.ts:44](../tests/e2e/outbound.spec.ts#L44) | 如未来出现第二使用者，需重新评估身份与授权模型 |

## 系统配置

| 模块 | 旧系统功能点（手册章节） | 新现状 | P 差距 | U 升级（旧痛点 → 新改法 → 量化收益） | U 指标 | N 候选 | 优先级 | Batch | UI 参考 | 证据指针 | 备选/风险 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 系统配置 | 数据字典（9.1） | 未实现 | P：字典项增删改、排序、启停缺失 | 下拉项难判断来源 → 同页展示字典类型和使用处 → 配置定位 ≤2 步 | E2E 查找停用项并验证表单同步；待实测 | 无 | P3 | B3 | SysDict | E2E: 待补 | 删除被引用项应停用而非物理删除 |
| 系统配置 | 系统参数（9.2） | 未实现 | P：参数表、格式校验、审计缺失 | 修改前无法看到影响 → 新旧值及影响范围预览 → 参数错误提交 0 次 | E2E 验证边界值和审计；待实测 | 无 | P3 | B3 | SysConfig | E2E: 待补 | 高风险参数保留原值和回退入口 |
| 系统配置 | 单据编号配置（9.3） | RK/CK取号及配置已有，B5a新增GZ；PD仍日期+UUID片段 | P：切点原号占用扫描/PD统一日序号验收待B10；不重置计数器 | 每次手填造成重复机会 → 服务端事务取号/宽度撞号拦截 → 每单少填 1 字段、两类各 50 并发 0 重复 | E2E 配置撞号 409 且保留输入；预览不消耗序号；最终号以创建响应为准 | 无 | P0 | B1a / B5a / B10 | BillConfig | E2E: [tests/e2e/numbering.spec.ts](../tests/e2e/numbering.spec.ts)；IMG: .local/evidence/b1a-numbering-collision-1440.png | 共享事务锁、历史号含软删精确查重、唯一约束兜底；不重置计数；迁移非空禁止 down |

## 系统监控

| 模块 | 旧系统功能点（手册章节） | 新现状 | P 差距 | U 升级（旧痛点 → 新改法 → 量化收益） | U 指标 | N 候选 | 优先级 | Batch | UI 参考 | 证据指针 | 备选/风险 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 系统监控 | 操作日志查询、导出（10.1） | B1b-1：时间/动作/对象/traceId查询、完整分页和前后值抽屉已验；B1b-2 XLSX三范围与屏幕逐格核对已验 | P：轻列表/原JSON详情已有；失败/渠道/结构化差异/真实时间线及受控raw未做 | 仅最近100条且携大JSON → 全历史轻量分页、按需详情 → 240条全量可达，第二页40条；10k查询p95 12.71ms | E2E分页/详情/Esc关闭；API前后JSON比对；真人定位耗时待实测 | 审计差异比较 | P1 | B6c / UI-7 | SysLog | E2E: [tests/e2e/web-lists.spec.ts](../tests/e2e/web-lists.spec.ts)；IMG: .local/evidence/b1b1-audit-1280.png；DATA: [scripts/verify-list-performance.ts](../scripts/verify-list-performance.ts)；E2E: [tests/e2e/web-exports.spec.ts](../tests/e2e/web-exports.spec.ts)；DATA: [scripts/verify-export-performance.ts](../scripts/verify-export-performance.ts) | 只读审计；列表不伪造日志结果，失败重试不留旧记录；在线会话不在本批；快照内分批、不混源，失败/取消不提供部分文件 |
| 系统监控 | 在线用户、强制下线（10.2） | 单用户会话存在，无页面 | P：会话查看与撤销缺失 | 无法确认会话是否有效 → 显示当前会话和过期时间 → 登录状态定位 1 屏 | E2E 断言撤销后旧 token 失效；待实测 | 无 | P3 | B3 | OnlineUser | E2E: 待补 | 单用户不做在线用户墙/活跃监控大屏 |
| 系统监控 | 备份、恢复与恢复验证（AGENTS） | 本地 SQL 备份和恢复到新库脚本已有 | P：CLI已有；任务调度/产物hash/隔离恢复指纹/失败证据/健康采集未产品化 | 备份完成不可证明可用 → SHA-256 manifest、隔离库恢复及行数/重量对账 → 每次演练校验项通过率目标 100%，恢复目标 <15 分钟 | 单字节篡改拒绝；新库身份/行数/聚合重量对账；当前恢复时长待实测 | 无 | P1 | B8a | BackupRestore | DATA: [scripts/backup.ts](../scripts/backup.ts)、[scripts/restore.ts](../scripts/restore.ts) | 仅本地隔离库演练；演练库不自动切换为当前库，失败不触碰原库 |

## 消息中心

| 模块 | 旧系统功能点（手册章节） | 新现状 | P 差距 | U 升级（旧痛点 → 新改法 → 量化收益） | U 指标 | N 候选 | 优先级 | Batch | UI 参考 | 证据指针 | 备选/风险 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 消息中心 | 通知、提醒、预警、公告、已读、跳转（11） | 未实现 | P：通知事件去重/恢复周期/已读/扫描水位/服务接口未做，不含公告聊天 | 消息和单据割裂 → 仅保留与单据/库存相关通知并直接跳转 → 到目标单据 ≤2 步 | E2E 点击路径；消息准确率需数据验收 | 待办通知 | P3 | B8c | MessageCenter | E2E: 待补 | 不建议做公告/聊天；没有运营价值且增加维护成本 |

## 个人中心

| 模块 | 旧系统功能点（手册章节） | 新现状 | P 差距 | U 升级（旧痛点 → 新改法 → 量化收益） | U 指标 | N 候选 | 优先级 | Batch | UI 参考 | 证据指针 | 备选/风险 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 个人中心 | 修改密码、必要个人信息（12） | 登录用户 owner；个人中心未实现 | P：改密/全渠道会话失效/锁定持久策略未做；PDA离线事实须保留 | 个人设置混入账号管理 → 只保留改密和显示名 → 页面字段从旧表单目标减少至少 2 项 | E2E 验证改密后旧会话失效；交互时长待实测 | 无 | P3 | B8b | PersonalCenter | E2E: [tests/e2e/outbound.spec.ts:44](../tests/e2e/outbound.spec.ts#L44) | 不建议做头像、社交资料和偏好中心，单用户收益低 |

## 规格定稿与状态更正（2026-11-09）

- 周转率（7.2）、库龄（7.4）：**B3c代码完成、本地验证已有**（84fb14d），周转冷首屏未达标；正文已改判，实体/生产另列。
- 月度汇总（7.1）、出入库明细（7.3）：**B3b 已完成**（提交 573317a）。
- 更正与业务日期：**B5a代码与本地验收完成**（61f4d82），011开发应用仍未执行；正文已改判。
- 全局 UI 约束新增：docs/UX_STANDARDS.md、docs/WEB_UX_SPEC.md，后续页面的 UI 参考列按此评估。

以下为页面编号索引，正式P/U/N行见下节；页面增强尚未实现，不能抹去已有基础能力：

| 页面 | 规格文档 | 计划批次 |
|---|---|---|
| 工作台 + 数据看板 | WORKBENCH_SPEC.md | UI-3 / B7b |
| 库存概览 + 流水 | STOCK_PAGE_SPEC.md | UI-4 / B6f |
| 报表四页 | REPORTS_PAGE_SPEC.md | UI-5 / B7a（前置B5d） |
| 条码目录 | CATALOG_PAGE_SPEC.md | UI-6 / B6d |
| 操作记录 | AUDIT_PAGE_SPEC.md | UI-7 / B6c |
| 消息中心 / 系统维护 / 个人中心 | OPS_PAGES_SPEC.md | UI-8 / B8a–c |
| 打印集成 | PRINT_SPEC.md | B9（等积木配置） |
| 新旧切换 | CUTOVER_PLAN.md | B10（上线前演练门禁） |

- 商品维护：B4a 曾以 PRODUCT_MASTER_READ_ONLY 关闭商品写入（当时的"只读"前提）；B6a已按MASTER_DATA_SPEC完成批准范围的商品新增/编辑/停用及资格快照；原403验收仅作历史记录。

C01–C18文档闭环见 [DOC_REVIEW.md](DOC_REVIEW.md) §9；本次已修订正文及正式页面行。B3c性能限制、011开发应用、实体设备/生产验收仍分别待办，规格修订不改变运行代码。

## 八份页面规格的正式P/U/N行（目标差距，不计作实现完成）

| 模块 | 旧系统功能点（手册章节） | 新现状 | P 差距 | U 升级（旧痛点 → 新改法 → 量化收益） | U 指标 | N 候选 | 优先级 | Batch | UI 参考 | 证据指针 | 备选/风险 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 工作台/看板 | 首页/统计（1/7） | 当前首页出库列表，无聚合服务 | P：两聚合API/可信KPI/图表/下钻 | 分散查数 → 服务端同水位聚合 → 待办1次直达，待验 | 单位对账、冷/热p95、零伪造值 | 无 | P1 | UI-3 / B7b | WORKBENCH_SPEC | DOC_REVIEW C11/C12；apps/web/config/routes.ts | 离场/实时离线队列不支持 |
| 库存概览/流水 | 库存（5.1） | 在库列表/最近流水已有 | P：待发/可发/库龄读模型及全量流水 | 多页找变化 → 同格下钻 → 定位≤2步，待验 | 全筛选/本页合计、五档吨数、计划缺口 | 无 | P1 | UI-4 / B6f | STOCK_PAGE_SPEC | DOC_REVIEW C01/C06；apps/api/src/features/web-lists/stock.ts | 依赖B5c余额，负可发不等于允许负库存 |
| 库存盘点 | 盘点（6） | B3a固定快照/窗口/ACK已有 | P：盲盘/默认折吨/盘盈/批量保存/导出 | 手算/跨页丢录 → 估算可覆盖+行草稿 → 万行无丢失，待验 | 200渲染上限、漂移/ACK/并发/重放 | 无 | P2 | B6e | STOCKTAKE_SPEC | DOC_REVIEW C08/C09；apps/api/src/features/stocktake/post.ts | 不改009快照，半包吨数手填 |
| 报表四页 | 报表（7） | B3b/B3c已有；冷首屏有差距 | P：更正明细/重述/图表/联动 | 手工解释差额 → 分类/桥接显式 → 重复计量0，待验 | 包吨恒等式、去重单数、重算比率 | 无 | P2 | UI-5 / B7a，前置B5d | REPORTS_PAGE_SPEC + REPORT_SPEC | DOC_REVIEW C07；apps/api/src/features/reports/accumulate.ts | 原始余额与重述发生额不得混算 |
| 条码目录 | 目录补充（4.3） | B1c上传/发布/事实版本已有 | P：轨迹/分组/候选放弃/对比导出 | 删码误认为出库 → 目录变化独立解释 → 历史证据丢失0，待验 | 版本/UUID指纹、掉响应重放 | 无 | P1 | UI-6 / B6d | CATALOG_PAGE_SPEC | DOC_REVIEW C10/C11；apps/api/src/features/catalog/publish.ts | 上传已分配版本，实时同步覆盖率不支持 |
| 基础资料 | 主数据（2） | B6a 已完成：资格/分类/联系人/车辆/快照 | B6b公共交互已完成；详情存为档案、单据类型及主数据专页扩展仍未实施 | 本地新建无法入库 → 统一资格+快照 → 可用且改名不改旧单，已验 | 569条逐项资格；默认切换/停用；车辆并发与重放验证；test 179/179、build exit 0、E2E 66/0 | 无 | P1 | B6a | MASTER_DATA_SPEC | [B6A_ACCEPTANCE](B6A_ACCEPTANCE.md)；master-b6a/master-guards/master-snapshots测试 | 历史来源与原值保留；新快照缺失统一“历史未记录”；本地验证不代表生产验收 |
| 操作记录 | 日志（10.1） | 轻列表/原JSON已有 | P：失败独立记录/差异/时间线/raw投影 | 读JSON排障 → 中文差异+受控原值 → 列表技术值0，待验 | 回滚失败记录、raw登录/脱敏、真实事件数 | 无 | P1 | UI-7 / B6c | AUDIT_PAGE_SPEC | DOC_REVIEW C13/C17；apps/api/src/shared/audit.ts | 不把失败尝试当成功业务审计 |
| 运维三页 | 消息/备份/个人（10–12） | CLI备份/基础身份已有，其余未做 | P：任务/产物/指纹、会话策略、通知 | 手工检查 → 可追溯任务/事件 → 对账项100%有结果，待验 | 恢复指纹/去重/会话失效/队列不丢 | 无 | P1 | UI-8 / B8a–c | OPS_PAGES_SPEC | DOC_REVIEW C15；scripts/backup.ts、scripts/restore.ts | 需新增服务，缺采集项不支持 |

切换专项P差距（B10）：stock_opening/T0与legacy-open头行、原号承接、仅确认/作废、旧队列门禁、编号占用及有新账回退尚未实现；依据CUTOVER_PLAN/C18，逐仓品包吨零差异及原事实不变为门禁，不纳入上述八页面已完成数量。

修订记录：C01 修正主数据/字段/快照与B5a现状，目标商品维护不再留旧ERP。
修订记录：C03 修正主数据/字段/快照与B5a现状，目标商品维护不再留旧ERP。
修订记录：C04 修正主数据/字段/快照与B5a现状，目标商品维护不再留旧ERP。
修订记录：C05 修正主数据/字段/快照与B5a现状，目标商品维护不再留旧ERP。
修订记录：C02 出库分批/余额/短关/取样为B5c差距，非现有状态能力。
修订记录：C06 改库存/四报表现状，保留B3c冷首屏未达标及更正/重述差距。
修订记录：C07 改库存/四报表现状，保留B3c冷首屏未达标及更正/重述差距。
修订记录：C08 保留B3a基础并单列盘点增强，200行不作为容量。
修订记录：C09 保留B3a基础并单列盘点增强，200行不作为容量。
修订记录：C10 补目录与工作台可信读模型、不可推断项不支持。
修订记录：C11 补目录与工作台可信读模型、不可推断项不支持。
修订记录：C12 补目录与工作台可信读模型、不可推断项不支持。
修订记录：C13 审计/打印/运维新增服务差距与实施批次明确。
修订记录：C14 审计/打印/运维新增服务差距与实施批次明确。
修订记录：C15 审计/打印/运维新增服务差距与实施批次明确。
修订记录：C16 修正查询导出及原文回退判断，补八份页面的正式矩阵行。
修订记录：C17 修正查询导出及原文回退判断，补八份页面的正式矩阵行。
修订记录：C18 增列切换专项门禁，与UI-3～UI-8实施编号同步。

修订记录：B6a 更新主数据与用途隔离现状；011/012应用、逐商品资格及快照/默认/车辆/锁序的本地证据见B6A_ACCEPTANCE，不将剩余页面规格视为已完成。

## 遗留与后续（B6b）

- B6b-perf：反查翻页约 850–900ms；库存10万行导出深分页约62s，SQL等待约93%。完整p95和分段原值见[B6B_ACCEPTANCE](B6B_ACCEPTANCE.md) §3/6，不阻塞本批，本轮不优化。
- 并发5为压力场景，单用户以并发1为准；跨浏览器仅验证Chromium独立会话，Firefox/WebKit未覆盖。
