# B5a 更正与业务日期

日期：2026-11-09。领域规则以 `DOMAIN_RULES.md` 为准。本批只涉及本地合成数据，不升级已有开发库，不连接生产或 warehouse 系统。

## 实现与边界

- 独立 `document_corrections` 单头和 `document_correction_lines` 明细，不复用入/出库单表追加 type。更正头通过互斥的入库/出库外键引用原单；记录前序更正、版本、原因、操作人、时间、操作 ID、抵消操作 ID。更正单没有 business_date。
- 原行外键和商品关联固定；明细保存包数/吨数的前值、后值、差额，数据库 CHECK 校验差额等式与非负单据数量。重量用 DECIMAL(12,4)，接口使用整数克，Web 独立输入吨数。
- 有效数量 = 原数量 + Σ(后值−前值)；入库库存差额同向，出库反向。包数与吨数独立，允许任一项差额为零。原单、业务日期和扫码事实不改写。
- GZ-上海日期-序号复用现有编号规则和计数器。幂等重放返回同一更正 ID/编号；失败不占用业务序号。
- 已更正原单撤销：验证原确认和更正流水，按有效数量反向；原确认、全部已抵消更正、撤销流水合计为零。设置 offset_operation_id 后原单终结，不可再更正。既有下游依赖、流水不连续和负库存阻断仍生效。
- 详情返回原量、有效量、累计包数/吨数差额、最新更正号/时间及时间线。更正入口仅在底部操作条和行内“更多 ▾”；抽屉展示原值、前值、后值、差额、必填原因和二次确认。打印 disabled，提示“待接入积木报表”。
- 新建日期默认上海当天；超 3 个日历月（月底截断）需要显式确认且审计留痕；未来/未确认超期回填/入账后直接修改均 422。旧行未知日期保留 NULL。独立“日期更正”流程不属于本批。
- 未实现 UI-2、B5b–B5d、重述视图、报表页面分列或打印功能。未执行 Android/小程序模拟器、实体设备或生产验收。

## 接口与事务顺序

统一前缀 `/api/v1`。更正及日期写接口仅允许已认证的 Web 通道，并校验 Origin 和 UUID Idempotency-Key。

| 接口 | 用途 |
|---|---|
| POST `/{inbound\|outbound}/:id/corrections` | expectedCorrectionRevision、previousCorrectionId、reason、lines[{originalLineId,packages,weightGrams}]；严格拒绝额外字段 |
| GET `/{inbound\|outbound}/:id/corrections` | 原单的完整有序更正链 |
| GET `/corrections/:id` | 单张更正及原单引用 |
| GET `/inbound/:id`、`/outbound/:id` | corrections.original/effective/delta/latest/records/lines/allowed/offset |
| PATCH `/{inbound\|outbound}/:id/business-date` | 仅未锁定原单修改日期；出库已冻结也拒绝 |

1. 严格校验请求字段和数值，禁改字段/空原因直接 422。
2. 事务取得库存写锁；同键同正文重放，异正文同键 409。
3. 锁定原单；历史 source_id 非空、未入账/终结原单拒绝。读取并验证完整更正链，检测自环/间接环、跨原单前序、版本与数量证据。
4. 核验原确认和历次更正的操作及流水；检查 expectedCorrectionRevision 和 previousCorrectionId。同原单同版本并发，第二个请求 409，不自动基于新值重算。
5. 按明细计算差额；先检查仓库盘点暂停窗口，再锁定库存行，独立检查包数和重量余额、精度上限。所有行完成预校验前不分配编号、不写业务行；任一负余额 409、整库业务行不变。
6. 同一事务写 GZ 编号、更正头/行、stock.correct 操作、库存、带 correction_id 的流水、原单更正版本、审计和幂等结果。任一阶段失败整体回滚。

## 迁移和报表字段

迁移为 `011_corrections_business_date.up.sql` / `.down.sql`。001–010 不修改。原单新增可空 business_date 和 correction_revision；流水新增 correction_id，操作类型新增 stock.correct。旧数据不推测回填。服务启动要求 011 已 applied。

只通过 `migrateDown` 入口在写服务停止的维护窗口回退。回退预检发生在修改迁移状态/执行 DDL **之前**：更正头/行、非空业务日期、非零更正版本、相关流水/操作/审计/幂等/编号数据任一存在均拒绝。不得直接执行 down SQL 绕过预检，也不得删除业务数据来通过回退。

更正流水 `operation_type=stock.correct`，`correction_id` 引用更正头，不冒用原入/出库流水引用。撤销仍保存实际有效数量的反向流水；通过 offset_operation_id 聚合已抵消更正部分，作为 `correctionOffsetPackages/Grams` 元数据从普通收发量中剥离。月报数据增加 `correctionPackages/Grams`，计入库存调整等式，不计普通收发量。页面专列留 B5d。报表仍按入账时间归期，原业务日期单独保留。

## 验收记录

原始日志保留在 `.local/evidence/`，不提交数据库、截图或构建生成物。以下 `B5A_*` 行从最终完整测试日志逐行原样摘录；API 重量字段单位为克，数据库 `weight_tonnes/tonnes_*` 单位为吨。每个 `databaseUnchanged` 来自失败前后所有相关业务表快照比较，不只是库存表。

- 完整 API/小程序命令：`npm run test`，日志 `.local/evidence/b5a-test-final.log`。
- 构建命令：`npm run build`，日志 `.local/evidence/b5a-build.log`。
- 独立迁移命令：`npx tsx --test apps/api/tests/correction-migration.test.ts`，日志 `.local/evidence/b5a-migrations.log`；完整回归再次运行同组测试。
- 数据库均为随机 `maozhi_test_*` 本地合成库；没有升级已有开发库。迁移旧数据保留测试使用独立夹具。

### 正常更正、只改包数、详情有效数量/累计差额/最近单号

```text
B5A_SUCCESS {"kind":"inbound","before":{"warehouse_code":"DEMO-WH","product_code":"ACR-032","packages":7,"weight_tonnes":"2.1025","source_id":null,"source_del_flag":0,"source_row_json":null},"after":{"warehouse_code":"DEMO-WH","product_code":"ACR-032","packages":8,"weight_tonnes":"2.1025","source_id":null,"source_del_flag":0,"source_row_json":null},"journal":{"id":2,"order_id":null,"warehouse_code":"DEMO-WH","product_code":"ACR-032","packages_delta":1,"tonnes_delta":"0.0000","created_at":"2026-11-09 10:38:28.827","inbound_receipt_id":null,"source_id":null,"source_order_no":null,"source_business_type":null,"source_del_flag":0,"source_row_json":null,"operation_id":"3cc301c2-a396-4662-b0aa-6d7f08dc2f53","packages_before":7,"packages_after":8,"tonnes_before":"2.1025","tonnes_after":"2.1025","correction_id":"d0dd4c09-e95f-41ca-b293-8a164fe7dcd8"},"effective":{"packages":2,"weightGrams":302500},"cumulativeDelta":{"packages":1,"weightGrams":0},"latest":{"id":"d0dd4c09-e95f-41ca-b293-8a164fe7dcd8","number":"GZ-20261109-0001","createdAt":"2026-11-09T10:38:28.824Z"},"originalUnchanged":true}
B5A_SUCCESS {"kind":"outbound","before":{"warehouse_code":"DEMO-WH","product_code":"ACR-032","packages":4,"weight_tonnes":"1.2000","source_id":null,"source_del_flag":0,"source_row_json":null},"after":{"warehouse_code":"DEMO-WH","product_code":"ACR-032","packages":3,"weight_tonnes":"1.2000","source_id":null,"source_del_flag":0,"source_row_json":null},"journal":{"id":2,"order_id":null,"warehouse_code":"DEMO-WH","product_code":"ACR-032","packages_delta":-1,"tonnes_delta":"0.0000","created_at":"2026-11-09 10:38:38.776","inbound_receipt_id":null,"source_id":null,"source_order_no":null,"source_business_type":null,"source_del_flag":0,"source_row_json":null,"operation_id":"0b154faf-452d-47ed-a3ac-a2ec02501319","packages_before":4,"packages_after":3,"tonnes_before":"1.2000","tonnes_after":"1.2000","correction_id":"7df7df8b-bcf6-4fb0-8d5c-f8b8d59496aa"},"effective":{"packages":3,"weightGrams":600000},"cumulativeDelta":{"packages":1,"weightGrams":0},"latest":{"id":"7df7df8b-bcf6-4fb0-8d5c-f8b8d59496aa","number":"GZ-20261109-0001","createdAt":"2026-11-09T10:38:38.773Z"},"originalUnchanged":true}
```

### 入库→连续更正→撤销：净零、流水配对、原值保留和链抵消

```text
B5A_REVERSE_SQL [{"closure_id":"adc620fd-887f-4c03-8f87-2aea04304f82","operation_type":"inbound.confirm","warehouse_code":"DEMO-WH","product_code":"ACR-032","packages_net":"0","tonnes_net":"0.0000","operation_count":"4","balanced":"1"}]
B5A_REVERSE_SQL [{"mismatches":"0"}]
B5A_REVERSE_SQL [{"mismatches":"0"}]
B5A_REVERSE_SQL [{"mismatches":"0"}]
B5A_REVERSE_SQL [{"mismatches":"0"}]
B5A_REVERSE {"stock":{"packages":6,"weight_tonnes":"1.8000"},"journal":[{"operation_id":"3cf10e16-2ecf-4920-a908-642a7d0b610d","correction_id":null,"packages_delta":1,"tonnes_delta":"0.3025","packages_before":6,"packages_after":7},{"operation_id":"a65c775a-5db5-4e86-b205-d2e401cb810b","correction_id":"2986da5c-bea0-4fac-81e1-ed0e950cec4f","packages_delta":1,"tonnes_delta":"0.0000","packages_before":7,"packages_after":8},{"operation_id":"9991dc6f-7b4b-4340-9858-24a95165d8b2","correction_id":"9d572cd0-7daa-43e4-b3f6-e65a81f6bb5a","packages_delta":1,"tonnes_delta":"0.0000","packages_before":8,"packages_after":9},{"operation_id":"80e1279d-a34a-4b1b-91f7-b262c50c5574","correction_id":null,"packages_delta":-3,"tonnes_delta":"-0.3025","packages_before":9,"packages_after":6}],"packagesNet":0,"tonnesNet":0,"originalUnchanged":true,"offsetOperationId":"80e1279d-a34a-4b1b-91f7-b262c50c5574","reopenStatus":409}
```

### 负库存、历史单、成环、盘点暂停和禁改字段

```text
B5A_NEGATIVE {"delta":{"packages":100,"weightGrams":0},"status":409,"code":"INSUFFICIENT_STOCK","databaseUnchanged":true}
B5A_NEGATIVE {"delta":{"packages":0,"weightGrams":9000000},"status":409,"code":"INSUFFICIENT_STOCK","databaseUnchanged":true}
B5A_HISTORY {"status":409,"code":"LEGACY_CORRECTION_FORBIDDEN","databaseUnchanged":true}
B5A_WINDOW {"status":409,"code":"WAREHOUSE_STOCKTAKE_PAUSED","databaseUnchanged":true}
B5A_CYCLE {"self":true,"status":409,"code":"CORRECTION_CYCLE","databaseUnchanged":true}
B5A_CYCLE {"self":false,"status":409,"code":"CORRECTION_CYCLE","databaseUnchanged":true}
B5A_FORBIDDEN_FIELD {"field":"productCode","header":{"status":422,"code":"VALIDATION_ERROR","databaseUnchanged":true},"line":{"status":422,"code":"VALIDATION_ERROR","databaseUnchanged":true}}
B5A_FORBIDDEN_FIELD {"field":"warehouseCode","header":{"status":422,"code":"VALIDATION_ERROR","databaseUnchanged":true},"line":{"status":422,"code":"VALIDATION_ERROR","databaseUnchanged":true}}
B5A_FORBIDDEN_FIELD {"field":"supplierCode","header":{"status":422,"code":"VALIDATION_ERROR","databaseUnchanged":true},"line":{"status":422,"code":"VALIDATION_ERROR","databaseUnchanged":true}}
B5A_FORBIDDEN_FIELD {"field":"customerCode","header":{"status":422,"code":"VALIDATION_ERROR","databaseUnchanged":true},"line":{"status":422,"code":"VALIDATION_ERROR","databaseUnchanged":true}}
B5A_FORBIDDEN_FIELD {"field":"receiptNo","header":{"status":422,"code":"VALIDATION_ERROR","databaseUnchanged":true},"line":{"status":422,"code":"VALIDATION_ERROR","databaseUnchanged":true}}
B5A_FORBIDDEN_FIELD {"field":"orderNo","header":{"status":422,"code":"VALIDATION_ERROR","databaseUnchanged":true},"line":{"status":422,"code":"VALIDATION_ERROR","databaseUnchanged":true}}
B5A_FORBIDDEN_FIELD {"field":"businessDate","header":{"status":422,"code":"VALIDATION_ERROR","databaseUnchanged":true},"line":{"status":422,"code":"VALIDATION_ERROR","databaseUnchanged":true}}
B5A_FORBIDDEN_FIELD {"field":"business_date","header":{"status":422,"code":"VALIDATION_ERROR","databaseUnchanged":true},"line":{"status":422,"code":"VALIDATION_ERROR","databaseUnchanged":true}}
```

### 同键只执行一次、同版本两个更正并发一胜一拒绝

本用例先完成一次更正并同键重放，再发送两个同版本、不同键的并发请求，因此最终累计两张更正单；并发这一组只有一个请求成功。

```text
B5A_IDEMPOTENCY_CONCURRENCY {"replaySameId":true,"concurrentStatuses":[200,409],"counts":{"corrections":"2","operations":"2","audits":"2","commands":"2"}}
```

### 业务日期：上海默认、过去、未来、超三个月确认审计、入账锁定

```text
B5A_DATE {"kind":"inbound","today":"2026-11-09","input":{},"status":200,"businessDate":"2026-11-09","code":"OK","audit":null,"databaseUnchanged":false}
B5A_DATE {"kind":"inbound","today":"2026-11-09","input":{"businessDate":"2026-11-08"},"status":200,"businessDate":"2026-11-08","code":"OK","audit":null,"databaseUnchanged":false}
B5A_DATE {"kind":"inbound","today":"2026-11-09","input":{"businessDate":"2026-11-10"},"status":422,"code":"BUSINESS_DATE_FUTURE","audit":null,"databaseUnchanged":true}
B5A_DATE {"kind":"inbound","today":"2026-11-09","input":{"businessDate":"2026-08-08"},"status":422,"code":"BUSINESS_DATE_CONFIRMATION_REQUIRED","audit":null,"databaseUnchanged":true}
B5A_DATE {"kind":"inbound","today":"2026-11-09","input":{"businessDate":"2026-08-08","backdateConfirmed":true},"status":200,"businessDate":"2026-08-08","code":"OK","audit":{"after_json":"{\"id\":\"9fc64255-617e-4879-9fde-8c2566d3ab9a\",\"receiptNo\":\"RK-20261109-0003\",\"status\":\"pending\",\"postingState\":\"pending\",\"confirmationOperationId\":null,\"supplierCode\":\"DEMO-SUPPLIER\",\"supplierName\":\"合成供应商\",\"warehouseCode\":\"DEMO-WH\",\"warehouseName\":\"合成仓库\",\"memo\":null,\"createdBy\":\"owner\",\"createdAt\":\"2026-11-09T10:38:00.640Z\",\"businessDate\":\"2026-08-08\",\"corrections\":{\"revision\":0,\"allowed\":false,\"offset\":false,\"original\":{\"packages\":1,\"weightGrams\":302500},\"effective\":{\"packages\":1,\"weightGrams\":302500},\"delta\":{\"packages\":0,\"weightGrams\":0},\"latest\":null,\"lines\":[{\"originalLineId\":\"43ade221-fe7a-4e0e-8b0c-fe2ecd938a0e\",\"productCode\":\"ACR-032\",\"productName\":\"腈纶原料 · 合成样本\",\"original\":{\"packages\":1,\"weightGrams\":302500},\"effective\":{\"packages\":1,\"weightGrams\":302500},\"delta\":{\"packages\":0,\"weightGrams\":0}}],\"records\":[]},\"packages\":1,\"weightGrams\":302500,\"lines\":[{\"productCode\":\"ACR-032\",\"packages\":1,\"weightGrams\":302500,\"id\":\"43ade221-fe7a-4e0e-8b0c-fe2ecd938a0e\",\"productName\":\"腈纶原料 · 合成样本\"}],\"businessDateConfirmation\":{\"businessDate\":\"2026-08-08\",\"backdateConfirmed\":true,\"checkedOn\":\"2026-11-09\"}}"},"databaseUnchanged":false}
B5A_DATE {"kind":"inbound","today":"2026-11-09","input":{"businessDate":"2026-08-09"},"status":200,"businessDate":"2026-08-09","code":"OK","audit":null,"databaseUnchanged":false}
B5A_DATE {"kind":"outbound","today":"2026-11-09","input":{},"status":200,"businessDate":"2026-11-09","code":"OK","audit":null,"databaseUnchanged":false}
B5A_DATE {"kind":"outbound","today":"2026-11-09","input":{"businessDate":"2026-11-08"},"status":200,"businessDate":"2026-11-08","code":"OK","audit":null,"databaseUnchanged":false}
B5A_DATE {"kind":"outbound","today":"2026-11-09","input":{"businessDate":"2026-11-10"},"status":422,"code":"BUSINESS_DATE_FUTURE","audit":null,"databaseUnchanged":true}
B5A_DATE {"kind":"outbound","today":"2026-11-09","input":{"businessDate":"2026-08-08"},"status":422,"code":"BUSINESS_DATE_CONFIRMATION_REQUIRED","audit":null,"databaseUnchanged":true}
B5A_DATE {"kind":"outbound","today":"2026-11-09","input":{"businessDate":"2026-08-08","backdateConfirmed":true},"status":200,"businessDate":"2026-08-08","code":"OK","audit":{"after_json":"{\"id\":\"934fe811-e674-4c0e-9938-9dc141883905\",\"orderNo\":\"CK-20261109-0003\",\"customerName\":\"合成客户 1\",\"customerCode\":\"DEMO-CUST-1\",\"warehouseCode\":\"DEMO-WH\",\"vehicleNo\":\"NUMBER-TEST\",\"memo\":null,\"status\":\"open\",\"revision\":0,\"planVersion\":1,\"createdAt\":\"2026-11-09T10:38:09.974Z\",\"businessDate\":\"2026-08-08\",\"plannedPackages\":1,\"plannedWeightGrams\":302500,\"actualPackages\":0,\"actualWeightGrams\":0,\"corrections\":{\"revision\":0,\"allowed\":false,\"offset\":false,\"original\":{\"packages\":0,\"weightGrams\":0},\"effective\":{\"packages\":0,\"weightGrams\":0},\"delta\":{\"packages\":0,\"weightGrams\":0},\"latest\":null,\"lines\":[{\"originalLineId\":\"95b12263-2a64-4876-9e7a-45b3f0baba02\",\"productCode\":\"ACR-032\",\"productName\":\"腈纶原料 · 合成样本\",\"original\":{\"packages\":0,\"weightGrams\":0},\"effective\":{\"packages\":0,\"weightGrams\":0},\"delta\":{\"packages\":0,\"weightGrams\":0}}],\"records\":[]},\"lines\":[{\"id\":\"95b12263-2a64-4876-9e7a-45b3f0baba02\",\"productCode\":\"ACR-032\",\"productName\":\"腈纶原料 · 合成样本\",\"plannedPackages\":1,\"plannedWeightGrams\":302500,\"actualPackages\":0,\"actualWeightGrams\":0}],\"facts\":[],\"digest\":\"4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945\",\"businessDateConfirmation\":{\"businessDate\":\"2026-08-08\",\"backdateConfirmed\":true,\"checkedOn\":\"2026-11-09\"}}"},"databaseUnchanged":false}
B5A_DATE {"kind":"outbound","today":"2026-11-09","input":{"businessDate":"2026-08-09"},"status":200,"businessDate":"2026-08-09","code":"OK","audit":null,"databaseUnchanged":false}
B5A_DATE_LOCKED {"kind":"inbound","status":422,"code":"BUSINESS_DATE_LOCKED","databaseUnchanged":true}
B5A_DATE_LOCKED {"kind":"outbound","status":422,"code":"BUSINESS_DATE_LOCKED","databaseUnchanged":true}
B5A_DATE_BOUNDARY month_end=2026-02-28 leap=2024-02-29 Shanghai_midnight=2026-11-09
```

### 迁移 011：up、空库 down/up、旧数据保留、非空拒绝 down

```text
B5A_MIGRATION_UP {"id":"011_corrections_business_date","state":"applied"}
B5A_MIGRATION_DOWN {"migrations":[],"tables":[]}
B5A_MIGRATION 011 up=success empty_down=success re_up=success old_schema_start=refused
B5A_MIGRATION_DATE_GUARD {"output":"Error: 拒绝回退：outbound_orders 含有 B5a 数据，禁止删除历史数据","databaseUnchanged":true}
B5A_MIGRATION 011 existing_rows=unchanged business_date=NULL correction_revision=0
B5A_MIGRATION {"nonemptyDown":"Error: 拒绝回退：document_corrections 含有 B5a 数据，禁止删除历史数据","databaseUnchanged":true,"noDDL":true}
```

### 事务末段回滚、明细整体预校验和证据完整性

```text
B5A_ROLLBACK {"table":"stock_journal","failedStatus":500,"databaseUnchanged":true,"sameKeyRetry":200}
B5A_ROLLBACK {"table":"operation_log","failedStatus":500,"databaseUnchanged":true,"sameKeyRetry":200}
B5A_ROLLBACK {"table":"idempotent_commands","failedStatus":500,"databaseUnchanged":true,"sameKeyRetry":200}
B5A_INTEGRITY {"cases":["empty_reason","no_change","foreign_previous","foreign_line"],"results":[{"status":422,"code":"VALIDATION_ERROR","databaseUnchanged":true},{"status":422,"code":"CORRECTION_NO_CHANGE","databaseUnchanged":true},{"status":409,"code":"STALE_CORRECTION","databaseUnchanged":true},{"status":422,"code":"CORRECTION_LINE_INVALID","databaseUnchanged":true}]}
B5A_EVIDENCE_GUARD {"prior":false,"status":409,"code":"ORIGINAL_EVIDENCE_MISSING","databaseUnchanged":true}
B5A_EVIDENCE_GUARD {"prior":true,"status":409,"code":"CORRECTION_EVIDENCE_INVALID","databaseUnchanged":true}
B5A_MULTILINE {"status":409,"code":"INSUFFICIENT_STOCK","databaseUnchanged":true}
```

### 报表归类：更正及其抵消不混入普通收发量

```text
B5A_REPORT_REVERSE {"kind":"inbound","correctionBeforeReverse":{"packages":1,"grams":50000},"movementBeforeReverse":{"packages":1,"grams":302500},"movementAfterReverse":{"packages":0,"grams":0},"correctionAfterReverse":{"packages":0,"grams":0},"net":{"packages":"0","tonnes":"0.0000"},"originalUnchanged":true}
B5A_REPORT_REVERSE {"kind":"outbound","correctionBeforeReverse":{"packages":-1,"grams":-50000},"movementBeforeReverse":{"packages":2,"grams":600000},"movementAfterReverse":{"packages":0,"grams":0},"correctionAfterReverse":{"packages":0,"grams":0},"net":{"packages":"0","tonnes":"0.0000"},"originalUnchanged":true}
```

### 完整 API/小程序与构建原始结尾

```text
✔ 吨数展示来自独立克重并保留四位小数 (0.4477ms)
ℹ tests 168
ℹ suites 0
ℹ pass 168
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 200251.744
EXIT_CODE=0

> maozhi-acrylic-wms@0.1.0 build
> npm run typecheck && npm run build -w @wms/web
> maozhi-acrylic-wms@0.1.0 typecheck
> tsc --noEmit -p apps/api && tsc --noEmit -p apps/web
> @wms/web@0.2.0 build
> max build
√ Webpack: Compiled successfully in 40.17s
event - Build index.html
EXIT_CODE=0
```

### 浏览器交互原始输出

命令 `npm run test:e2e`（主套件与目录专项顺序执行）。最终日志 `.local/evidence/b5a-e2e-final.log`。以下为本批二次确认、同键重试、数量摘要、按钮主位、打印占位和表格零位移的原始输出。

```text
B5A_UI_DATE {"defaultShanghai":"2026-11-09","backdate":"2026-08-08","beforeConfirmationRequests":0,"submitted":{"businessDate":"2026-08-08","backdateConfirmed":true,"supplierCode":"DEMO-SUPPLIER","warehouseCode":"DEMO-WH","lines":[{"productCode":"ACR-032","packages":1,"weightGrams":302500}]},"status":200}
B5A_UI_CORRECTION {"kind":"inbound","before":{"packages":7,"weight_tonnes":"2.1025"},"after":{"packages":8,"weight_tonnes":"2.1025"},"sameKeyBodyRetry":true,"confirmationCancelledWrites":0,"effective":{"packages":2,"weightGrams":302500},"cumulativeDelta":{"packages":1,"weightGrams":0},"latest":{"id":"726a6bd5-fba0-4977-a45a-4c4f7b03c660","number":"GZ-20261109-0001","createdAt":"2026-11-09T10:43:04.013Z"},"originalUnchanged":true,"primaryButtons":1,"printDisabled":true,"pageErrors":[]}
B5A_UI_CORRECTION {"kind":"outbound","before":{"packages":5,"weight_tonnes":"1.4975"},"after":{"packages":4,"weight_tonnes":"1.4975"},"sameKeyBodyRetry":true,"confirmationCancelledWrites":0,"effective":{"packages":2,"weightGrams":302500},"cumulativeDelta":{"packages":1,"weightGrams":0},"latest":{"id":"71b64ce0-f766-4905-b9cc-1067b9fd7ad2","number":"GZ-20261109-0002","createdAt":"2026-11-09T10:43:08.784Z"},"originalUnchanged":true,"primaryButtons":1,"printDisabled":true,"pageErrors":[]}
B5A_UI_POSITION {"kind":"inbound","width":1440,"before":{"x":344,"y":402,"width":1008},"selected":{"x":344,"y":402,"width":1008},"opened":{"x":344,"y":402,"width":1008},"displacement":{"x":0,"y":0},"rowEntry":"更多 ▾","primaryButtons":1}
B5A_UI_POSITION {"kind":"inbound","width":1280,"before":{"x":344,"y":402,"width":848},"selected":{"x":344,"y":402,"width":848},"opened":{"x":344,"y":402,"width":848},"displacement":{"x":0,"y":0},"rowEntry":"更多 ▾","primaryButtons":1}
B5A_UI_POSITION {"kind":"outbound","width":1440,"before":{"x":344,"y":402,"width":1008},"selected":{"x":344,"y":402,"width":1008},"opened":{"x":344,"y":402,"width":1008},"displacement":{"x":0,"y":0},"rowEntry":"更多 ▾","primaryButtons":1}
B5A_UI_POSITION {"kind":"outbound","width":1280,"before":{"x":344,"y":402,"width":848},"selected":{"x":344,"y":402,"width":848},"opened":{"x":344,"y":402,"width":848},"displacement":{"x":0,"y":0},"rowEntry":"更多 ▾","primaryButtons":1}
```

截图在 `.local/evidence/b5a-{inbound|outbound}-{drawer|detail|more}-{1440|1280}.png`，业务日期截图为 `b5a-business-date-{1440|1280}.png`。已查看本轮入库抽屉和出库详情 1280 截图；表格位置同时由浏览器读取边界坐标断言，未使用人工估计。

首次完整 E2E 输出 `54 passed / 1 failed`，原日志保留为 `.local/evidence/b5a-e2e.log`：旧库存调整测试直接打开未筛选列表，测试商品不在第一页，导致定位超时。本次只把同文件两处导航限定为该用例创建的商品 `?product=...`，未减少断言、扩大超时或修改业务行为。其重跑原始输出：

```text
B1A3_E2E empty_reason=422 insufficient=409 all_tables_unchanged=true input_preserved=true
  ok 42 tests\e2e\inventory-posting.spec.ts:39:1 › B1a3 调整空原因 422、库存不足 409；错误保留输入且数据库不变 (4.2s)
```

### 完整浏览器回归原始结尾

```text
  55 passed (5.8m)
  9 passed (1.6m)
EXIT_CODE=0
```

## 提交前审查与验收层级

- 按 WMS 代码审查规范核对认证/通道与 Origin、严格字段白名单、参数化 SQL、事务原子性、原单和扫码事实不可变、负库存/盘点/历史/环路阻断、重试幂等、报表归类、迁移非空回退拒绝。未发现未解决的阻断项。
- 代码实现、168 项 API/小程序测试、严格类型检查与 Web 构建、55+9 项真实浏览器测试均有上述原始结果；14 张 B5a 截图保留在忽略目录。小程序仅运行既有测试，未更改其实现；未进行模拟器、Android、实体设备或生产验收。
- 001–010 迁移、PDA/小程序代码、`docs/references`、依赖清单未修改。测试生成的 `.umi`/`.umi-production` 恢复到基线，不提交截图、临时数据库或构建产物。
- 现有开发库未执行 011；启动新代码前须通过项目迁移入口完成 011，未完成时服务会拒绝启动。生产和 warehouse 系统未连接；UI-2 与 B5b–B5d 未启动。
