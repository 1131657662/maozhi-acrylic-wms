# B6a-num：系统生成编码与三位单据号

本批分支 `codex/b6a-system-numbering`，基于 B6b 收尾后的 `1a49fc5`。用户确认：新号固定 3 位，编号规则页只读。此前三份编号规格文档已单独提交 `1a49fc5b2502036ce73a87dc2fa1452e882284c1`。

## 1. 范围与环境

- 客户 C+5 位、供应商 S+4 位、仓库 W+2 位；商品和分类手工编码不变。名称优先，编码灰色小字且可复制；编辑显示只读编码，原编码可查。
- RK/CK 新号使用新建时的业务日期；GZ 无业务日期，按上海创建日。三类固定 3 位、最多 999/日。旧号（包括 4 位、软删、导入原号）不改，既有序号继续递增。PD 按日序号统一和历史主数据重编留 B10。
- 014 新建计数器、三表增加 legacy_code 并回填原 code；原 code 不变。已有 C/S/W 规范码以最大已发序号初始化，下次加一。现存单据规则位宽转 3，版本递增，不重置日计数。
- 所有数据库验证在 `127.0.0.1:3307` 随机 `maozhi_test_<24 hex>` 一次性合成库完成；运行后销毁。本批没有向 `maozhi_dev_sample` 应用 014，没有生产连接或切换重编。新服务启动要求 014 已完成，开发样本库启动新版本前需另行备份、迁移与冒烟。
- 主数据创建沿用身份写锁，再锁该前缀计数器；唯一键冲突只取下一号。写资料、审计、幂等结果与取号同事务。删除/停用不回收计数器；审计失败回滚整次创建。
- Web 新建发送幂等键，同正文失败重试保留原键；API 兼容无幂等键的调用。生成型 POST 不接收 code；PATCH 不接收 code；只读编号写入口返回 422。

## 2. 验收原始输出

以下原样摘自本轮完整 `npm run test` 日志 `.local/evidence/b6a-num-test.log`（208/208），与开发样本库无关。删除动作只用于一次性测试夹具；没有新增物理删除接口。

```text
B6A_NUM_MIGRATION empty=up/down/up success readiness014=required
B6A_NUM_MIGRATION {"counters":[{"prefix":"C","last_value":42},{"prefix":"S","last_value":25},{"prefix":"W","last_value":8}],"legacyCodesPreserved":true,"documentCounter":88,"width":3,"nonemptyDown":"refused","ddl":0,"databaseUnchanged":true}
B6A_NUM_MASTER {"sequential":["C00001","C00002","C00003"],"deleted":"C00002","concurrent":["C00004","C00005","C00006","C00007","C00008"],"duplicates":0,"replayCode":"C00009","replayRequests":5,"rename":"改名成功","editCodeStatus":422,"createWithCodeStatus":422}
B6A_NUM_CAPACITY {"catalog":"customers","last":99999,"status":422,"message":"编号容量已用尽，需计划重编","databaseUnchanged":true}
B6A_NUM_CAPACITY {"catalog":"suppliers","last":9999,"status":422,"message":"编号容量已用尽，需计划重编","databaseUnchanged":true}
B6A_NUM_CAPACITY {"catalog":"warehouses","last":99,"status":422,"message":"编号容量已用尽，需计划重编","databaseUnchanged":true}
B6A_NUM_OTHER_CODES {"supplier":"S0001","warehouse":"W01","collisionNext":"C00002","product":"MANUAL-130"}
B6A_NUM_DOCUMENTS {"kind":"inbound","numbers":["RK-20260102-001","RK-20260102-002","RK-20260103-001"]}
B6A_NUM_DOCUMENTS {"kind":"outbound","numbers":["CK-20260102-001","CK-20260102-002","CK-20260103-001"]}
B6A_NUM_LEGACY {"number":"RK-20260104-0088","listCount":1,"detailStatus":200}
B6A_NUM_1000 {"kind":"inbound","status":422,"message":"编号容量已用尽，需计划重编","databaseUnchanged":true,"counter":999,"produced1000":false}
B6A_NUM_1000 {"kind":"outbound","status":422,"message":"编号容量已用尽，需计划重编","databaseUnchanged":true,"counter":999,"produced1000":false}
```

另外断言通过：发号后注入审计失败，整库指纹不变，重试仍为 C00001；五个受影响表逐表单独非空均拒绝 down（包括只剩计数器、资料已删除的情形）。历史软删 0088 继续占号，下一新号为 089；旧超大数字后缀按 bigint 解析并拒绝溢出。

## 3. 完整验证与浏览器

| 命令 | exit code | 结果 | 证据 |
|---|---:|---|---|
| `npm run test` | 0 | 208/208，失败 0 | `.local/evidence/b6a-num-test.log` |
| `npm run build` | 0 | 严格类型检查 + Web 构建通过 | `.local/evidence/b6a-num-build.log` |
| `npm run test:e2e` | 0 | 86/86（主 77 + catalog 9），失败 0 | `.local/evidence/b6a-num-e2e.log` |
| `npm run openapi` | 0 | 生成契约已同步，三类系统生成请求不含 code；商品请求必填 code | `.local/evidence/b6a-num-openapi.log` |

定向开发验证曾发现并修正 MySQL `last_value` 保留字转义、测试夹具外键依赖和 AntD 6 下拉选择器。首次完整 E2E 为主套件 75 通过、2 失败：旧 outbound.spec 仍填写客户编码，旧 stocktake.spec 仍按编码在前定位仓库；二者已按本批新界面调整断言，原失败日志保留 `.local/evidence/b6a-num-e2e-initial.log`。不以定向测试代替完整测试。

截图（本机 Chromium，人工检查名称/编码层次与只读规则）：
- `.local/evidence/b6a-num-customers-1440.png`
- `.local/evidence/b6a-num-suppliers-1440.png`
- `.local/evidence/b6a-num-warehouses-1440.png`
- `.local/evidence/b6a-num-numbering-1440.png`
- `.local/evidence/b6a-num-numbering-1280.png`

浏览器用例覆盖三类新建不传 code、编辑无编码输入、改名、列表复制与下拉复制不触发选中、名称优先选择、旧四位号列表进入详情、只读规则刷新失败保留预览及重试。Firefox/WebKit 未覆盖。截图与日志不进入 Git。

最终完整 E2E 原始输出：

```text
B6A_NUM_UI [{"catalog":"customers","code":"C00002","codeInput":false,"renamed":true,"copied":true,"dropdown":true},{"catalog":"suppliers","code":"S0001","codeInput":false,"renamed":true,"copied":true,"dropdown":true},{"catalog":"warehouses","code":"W01","codeInput":false,"renamed":true,"copied":true,"dropdown":true}]
B6A_NUM_OLD_NUMBER_UI {"number":"RK-20260101-0088","detailOpened":true}
  77 passed (11.1m)
  9 passed (1.8m)
```

提交前按 code-review-wms 核对了参数白名单、同源鉴权、SQL 参数化、事务与幂等、迁移回退及 UI 文案。审查记录在 `.local/evidence/b6a-num-review.md`；本轮复跑期间 44 个源码/测试/迁移文件指纹未变化。

## 4. 回退与边界

014 在任何 DDL 前检查 master_code_counters、master_customers、master_suppliers、master_warehouses、document_number_rules；任一非空就拒绝回退，数据/迁移状态/结构保持。空库可 up→down→up。已写数据不能删除计数器重发旧码；须停写并使用经核验的备份恢复方案，不直接执行破坏性 down。

本批只完成代码、严格类型构建、自动化 API/浏览器验证；不声明开发样本库迁移、实体设备或生产验收通过。没有更改 B6c 审计暴露范围，没有合并或 push。工作区并行新增的 UX 规范/列表审查文档由用户保留，不计入本批提交。
