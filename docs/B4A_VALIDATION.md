# B4a 边界修补验收

日期：2026-11-08；范围仅 R1/R2/R3/R5/R6；代码、构建及本地自动化验证完成，待用户验收。以下为本机实际执行结果；开发库和随机隔离测试库分开记录。尚无实体 PDA 或生产验收，本轮没有修改 Android 代码或测试，没有提交。

## 010 开发库迁移

- 实例：`127.0.0.1:3307`，当前开发库：`maozhi_dev_sample`；迁移前确认 4310 写服务停止。
- 先完整备份并恢复至随机隔离库，全部表数据指纹相等，再对实际开发库执行 010。
- [SQL 备份](../.local/backups/b4a-before-010-1794149745233.sql)；SHA-256：`f111a33171f69c2bddddbb94c8665945008e9a561d01b9fb597fcd399581f73a`。
- [逐表迁移前后指纹](../.local/evidence/b4a-migration-1794149745233.json) 包含列清单、行数、SHA-256。新增 nullable memo 使 `outbound_orders` 完整行指纹变化，`schema_migrations` 新增 010；按原列投影比较，**35 张业务表原有数据全部不变**，新 memo 非空数为 0。
- [开发库只读冒烟](../.local/evidence/b4a-development-smoke.json)：010 readiness 通过；414 张出库单的首批 50 张读取正常、memo 可读；全部表仍与迁移后指纹一致。
- 隔离测试验证：NULL memo 可 down/up，任何非 NULL memo 拒绝 down 且无 DDL；未应用 010 拒绝启动 API。开发库未执行 down。

## R1：保留行与离线事实

真实浏览器编辑 + PDA 协议离线队列模拟：下载 → 序列化原始事实但不上传 → Web 仅提交车号/备注 → 原 JSON 补传 → 原 JSON 重传，均返回 200。数据库整行比较确认明细未重建；补传事实的 UUID、正文及 payload_hash 与离线原文一致；重传未增加事实。

原始序列与 ID：[R1 浏览器证据](../.local/evidence/b4a-r1-e2e.json)；界面：[截图](../.local/evidence/b4a-r1-offline.png)。API 还验证了同键编辑重放、过期版本 `409 STALE_PLAN`、已扫后只改表头，以及拒绝改/删明细时所有表指纹不变。

明细变更的实际错误：HTTP 409，`PLAN_LINES_IMMUTABLE`，文案：

> 计划已下发或已有扫码事实，明细不可修改，只能改车号/备注；如需改明细请作废后重建。作废仍须满足原有条件，已下发或已有事实的计划当前不能直接作废。

补充句保留 B2a 作废限制，避免暗示已下发计划可以直接作废。未放宽冻结/终态/历史源单编辑规则。

## R2：ERP 商品只读与原始拒绝响应

商品页显示“商品由 ERP 维护，此处只读”，无新增、编辑、启停按钮；直接调用商品新增、改名、启用、停用均为 HTTP 403 / `PRODUCT_MASTER_READ_ONLY`。仓库、客户、供应商保持维护功能。

在随机测试库分别构造 `source_kind=app` 的 `LOCAL-APP` 和 `source_kind=sku-spec` 的 `SPEC-ONLY`，再发送有效入/出库建单请求。四次原始 HTTP 409 响应如下（保留实际 traceId）：

```json
{"product":"LOCAL-APP","path":"/api/v1/inbound","response":{"code":"PRODUCT_NOT_INVENTORY","message":"只有 ERP 商品可以写入库存；条码目录不参与入账","data":null,"traceId":"ec7d3763-1fc5-454d-b8f5-f84dd1351e68"}}
{"product":"LOCAL-APP","path":"/api/v1/outbound","response":{"code":"PRODUCT_NOT_INVENTORY","message":"只有 ERP 商品可以写入库存；条码目录不参与入账","data":null,"traceId":"c10b9aa2-c431-4763-966b-84fa6842f706"}}
{"product":"SPEC-ONLY","path":"/api/v1/inbound","response":{"code":"PRODUCT_NOT_INVENTORY","message":"只有 ERP 商品可以写入库存；条码目录不参与入账","data":null,"traceId":"c4c1c123-5c69-44ec-8f2a-3e2404327b06"}}
{"product":"SPEC-ONLY","path":"/api/v1/outbound","response":{"code":"PRODUCT_NOT_INVENTORY","message":"只有 ERP 商品可以写入库存；条码目录不参与入账","data":null,"traceId":"20799304-36d7-4433-8f95-47698adcee42"}}
```

所有拒绝操作前后业务表指纹一致，没有留下单据、占用编号、库存写入或成功审计；商品列表不返回这两个来源，按编码读取也返回 404。原有本地/SPEC 资料没有迁移或清理。

## R3：超过 600 条的资料

- API：商品、仓库、客户、供应商各插入 605 条，200 条/页依次返回 `200 / 200 / 200 / 5`，无重漏，末条 `B4A-0605` 可达；编码/名称搜索各返回 1 条。
- 精确编码回查返回末条完整名称；停用后仍可回显，但 active 列表只剩 604 条。带点号/斜杠的编码也可精确读取，分页大小 501 返回 422，搜索特殊字符不被当作 SQL 或 LIKE 通配符。
- 浏览器：四类各 605 条，20 条/页，第 2 页和第 31 页可达；名称搜索命中末条；单据下拉第 1/2 页可切换，编码搜索选择第 605 条后触发精确编码读取，切换搜索仍保留已选名称。[回显截图](../.local/evidence/b4a-r3-selected.png)。
- R1/R3 本轮浏览器实际输出：[JSON 记录](../.local/evidence/b4a-browser-results.json)。
- 不再 `LIMIT 500` 截断；列表每页最大 200，选择器每页 20，不一次拉取全部资料。

## R5：每行计划重量上限

输入从吨换算为整数克后实际调用创建 API，再读取返回明细并用共享契约解析：

| 输入（吨） | 请求整数克 | HTTP / code | 创建与读取实际返回克 |
| --- | ---: | --- | ---: |
| 999.9999 | 999999900 | 200 / OK | 999999900 |
| 1000 | 1000000000 | 200 / OK | 1000000000 |
| 1000.0001 | 1000000100 | 422 / VALIDATION_ERROR | 无单据 |

数据库仅留下前两张有效单据；前后端每行上限一致，整单总量仍为各行之和。

## R6：特殊类型实际报表返回

分别把合成盘点流水类型设置为 `constructor`、`__proto__` 后请求明细与月报，均为 HTTP 200。月报实际相关字段：

```json
{"type":"constructor","period":"2026-02","unknownPackages":2,"unknownGrams":610000,"checkState":"不可验证","reasons":["未分类流水类型：constructor"],"differencePackages":0,"differenceGrams":0}
{"type":"__proto__","period":"2026-02","unknownPackages":2,"unknownGrams":610000,"checkState":"不可验证","reasons":["未分类流水类型：__proto__"],"differencePackages":0,"differenceGrams":0}
```

明细保留“仅出入库事件”的既有范围，未分类数量进入月报/对账，明细对账状态也为不可验证；未把未知类型错误算成收发或丢弃。完整返回对象见 [API 实际输出 JSON](../.local/evidence/b4a-api-results.json)。本项按中低风险修补，没有进行 R4 性能重构。

## OpenAPI 生成物核对

以 `HEAD:docs/api/openapi.json` 为生成前版本，比较本地重新生成文件：

| 指标 | 生成前 | 生成后 |
| --- | ---: | ---: |
| 路径数 | 23 | 69 |
| HTTP 操作数 | 27 | 75 |
| `components.schemas` | 0 | 0 |
| `$ref` 字段 | 0 | 0 |
| `info.version` | 0.1.0 | 0.1.0 |
| UTF-8 文件字节 | 372,722 | 1,268,236 |
| 行数 | 11,141 | 37,943 |

差异是 48 个已注册操作补入之前未同步的生成物：报表 2、盘点 9、单据生命周期 6、Web 列表 6、导出 5、目录 9、交接 8、入库确认和库存调整各 1；这些 47 个接口的路由与声明均已存在于 B4a 之前的代码。只有 `GET /master-data/{catalog}/{code}` 是 B4a 新增的运行时路由，用于单据选择器按编码回显。未发现本批之外新增运行时接口。

文件增长 895,514 字节不是 `$ref` 展开：前后均没有 component schemas 或 `$ref`。生成器把每个操作的请求/响应 Zod schema 内联输出，完整补回此前缺失的操作后产生较大的生成物。保留完整契约，并按独立生成物提交隔离，不将生成物大小变化混入 B4a 业务提交。

## 回归结果

- `npm run test`：**134 passed / 0 failed**，含既有 API/小程序及 B4a 新回归；[最终日志](../.local/evidence/b4a-test-final.log)。
- `npm run build`：严格类型检查和 Web 构建通过；[构建日志](../.local/evidence/b4a-build.log)。新增精确编码读取约束修订后，类型检查再次通过。
- Ant Design 检查：主数据、入库、出库、盘点四个目录均 0 issues；OpenAPI 生成通过。
- 验证过程修正了两处 Web 测试定位：Select 按当前 AntD DOM 验证已选值；撤销重试按钮忽略退出动画图标造成的无障碍名称前缀，同时显式断言按钮已启用且退出 loading，保留原键/回滚/并发断言。未修改撤销业务行为。历史迁移测试按目标版本建库，当前读模型测试使用最新 schema；没有修改 PDA/R9 测试。
- `npm run test:e2e` 最终退出码 0：主套件 **48 passed（4.5m）**，独立目录套件 **9 passed（1.4m）**，合计 **57 passed / 0 failed**；[完整最终日志](../.local/evidence/b4a-e2e-final.log)。包含既有用例，无跳过。
- 开发库只升级 010；测试全部使用随机隔离 MySQL 库。无生产连接、无 Android 修改/构建/设备验收、无提交。
