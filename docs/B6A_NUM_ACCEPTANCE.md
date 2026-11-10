# B6a-num：系统生成编码与三位单据号

本批分支 `codex/b6a-system-numbering`，基于 B6b 收尾后的 `1a49fc5`。用户确认：新号固定 3 位，编号规则页只读。此前三份编号规格文档已单独提交 `1a49fc5b2502036ce73a87dc2fa1452e882284c1`。

## 1. 范围与环境

- 客户 C+5 位、供应商 S+4 位、仓库 W+2 位；商品和分类手工编码不变。名称优先，编码灰色小字且可复制；编辑显示只读编码，原编码可查。
- RK/CK 新号使用新建时的业务日期；GZ 无业务日期，按上海创建日。三类固定 3 位、最多 999/日。旧号（包括 4 位、软删、导入原号）不改，既有序号继续递增。PD 按日序号统一和历史主数据重编留 B10。
- 014 新建计数器、三表增加 legacy_code 并回填原 code；原 code 不变。已有 C/S/W 规范码以最大已发序号初始化，下次加一。现存单据规则位宽转 3，版本递增，不重置日计数。
- 功能提交阶段的数据库验证在 `127.0.0.1:3307` 随机 `maozhi_test_<24 hex>` 一次性合成库完成，运行后销毁。收尾阶段已按用户授权对 `maozhi_dev_sample` 备份、应用 014 并冒烟，详见 §5；没有生产连接或切换重编。新服务启动要求 014 已完成。
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

功能实现提交为 `183aab6`，已通过用户验收；本记录区分功能阶段 208/86/0 与后续开发样本库迁移。没有更改 B6c 审计暴露范围，不声明实体设备或生产验收。外部 UX 规范/列表审查文档在收尾阶段按用户要求原样单独提交，不计作体验修复已实现。

## 5. 014 开发样本库收尾（2026-11-10）

目标严格限定 `127.0.0.1:3307/maozhi_dev_sample`，核验 MySQL 8、仓库内 `.local/mysql/data/` 与身份 `maozhi-local-mysql8-v1`。先停止本项目开发服务，基线仅有校验脚本的一条连接；未执行 seed、重编或非空 down。代码已验收的完整 test 208/208、E2E 86/0、build exit 0 本轮未重复执行；本轮新增迁移、真实浏览器冒烟与四位号定向复核。

### 5.1 备份与迁移

- 备份：`.local/backups/maozhi-1794322613897.sql`，6,460,074 字节，mysqldump exit 0，末尾完成标记存在。
- 备份 SHA-256：`5A220326BD16ADDD4810E5F83E5EFE33EA7AC09A265AB0B6D8F99D01B1C6292F`。本轮未做备份恢复演练。
- 迁移：`014_master_code_counters`，`applied`；UTC `2026-11-10 14:57:04.976` / 上海 `2026-11-10 22:57:04.976`。
- 014 SQL 校验值：`68b665d7ee7b2a8729f2255a6e677f836445e0de92b18dba08a476f48844846f`；应用与最终核验 exit 均为 0。

结构指纹采用按表/视图名排序的实际 `SHOW CREATE TABLE/VIEW` 定义与触发器定义计算 SHA-256；前后在同一算法下比较：

| 阶段 | SHA-256 |
|---|---|
| 应用前 | `ea5e120eb80306245b29ad3f626fc5041787e704aec71c11deedc92df4684a3c` |
| 应用后、冒烟前 | `e62e13b5526c247c66a2dccaa79afb8b1f13fd120b8cd558c94310985b08b280` |

**整体结构指纹不相同，差异完全符合 014**：新增 master_code_counters；客户/供应商/仓库增加 legacy_code；document_number_rules.sequence_width 从无默认值改为默认 3。其余 42 个原结构对象及触发器一致，旧 13 条迁移记录一致。43 张表按迁移前列投影的数据指纹一致；三类 legacy_code 全部等于原 code，原 code 不改。样本库迁移前规则表为空、无规范 C/S/W 码，迁移后规则仍空、计数器仍空；由冒烟首次发号创建记录。

迁移前曾发现 013 校验不符：Git 检出的 CRLF 字节哈希为 `385d881f85921b6a510dcef8a1a77f79d6e5cd42fffae0fdbeb524730ab9e3c0`，只转换 LF 后即等于已应用记录 `1bcde33ca43237b45f1d8a116661334c807851f4a645ccefa808e1f3b3de35f8`。核验 SQL 内容相同后临时恢复原 LF 执行，随后恢复工作区原文件；未改旧迁移内容、数据库校验值或迁移引擎。当前校验仍对换行敏感，后续迁移需注意，不应直接覆盖库内校验值。首次后置结构核验脚本误以为旧规则列有 DEFAULT 4，已按实际无默认值修正断言再核验通过；未重复执行 014。

证据目录 `.local/evidence/b6a-num-closeout/`：`backup.json`、`schema-before.json`、`schema-after.json`、`data-before.json`、`data-after-projection.json`、`data-after.json`、`migrations-before.json`、`migration-result.json`、`migration-byte-check.json`。备份/证据不进入 Git。

### 5.2 开发样本库浏览器冒烟

真实 Chromium 1440×960，通过登录页验证身份，再从 Web 新建；未传入 code/receiptNo。最终脚本 exit 0：

```text
target=127.0.0.1:3307/maozhi_dev_sample login=200
customer=C00001 warehouse=W01
inbound=RK-20261110-001 state=pending packages=1 tonnes=0.2500
legacy=IN20261107001 listOpened=true detailOpened=true detailStatus=200
sampleFourDigitNumbers=0
inventoryUnchanged=true originalMasterAndDocumentRowsUnchanged=true
```

新增客户“编号迁移014冒烟客户”、仓库“编号迁移014冒烟仓库”及带冒烟备注的待确认入库单均保留。客户 376→377、仓库 3→4、入库主单 115→116、明细 182→183；排除这四条新记录后，旧记录指纹一致。库存、库存流水、库存操作、出库与其余未授权变更表均不变；写入仅为新资料/待确认单据及其计数器、规则、幂等结果、登录会话和审计。

首次冒烟在选择商品 002 时误定位隐藏的供应商 SUPP000002 下拉选项；修正为可见选项后按检查点续跑，没有重复创建客户/仓库。定向 E2E 与开发 Web 共享 `.umi` 生成目录曾干扰开发服务，结束定向用例后重启开发服务，再完成样本冒烟。两次脚本中断原日志保留 `smoke-initial.log`、`smoke-restart-needed.log`，最终结果 `smoke.log`、`smoke-result.json`、`data-after-smoke.json`；最终样本冒烟和独立定向复核均 exit 0，完整测试基线没有改写。

截图：`customers-1440.png`、`warehouses-1440.png`、`inbound-new-1440.png`、`inbound-legacy-1440.png`，均在上述证据目录。开发服务已恢复为 API 4310 / Web 5173。

### 5.3 旧四位号的数据来源与限制

样本库查询未找到 `^RK-[0-9]{8}-[0-9]{4}$` 或 `^CK-[0-9]{8}-[0-9]{4}$` 的有效存量单，不能声称在该库验证了“已有四位号”。样本原号 `IN20261107001` 已从列表查询并打开详情。另用既有定向 E2E 在独立随机合成库构造旧号，复核兼容路径；不向样本库伪造四位存量，不计作真实历史数据验收：

```text
npx playwright test tests/e2e/master-numbering.spec.ts --grep '历史四位单号从列表可打开'
B6A_NUM_OLD_NUMBER_UI {"number":"RK-20260101-0088","detailOpened":true}
1 passed (15.9s)
exit=0
```

日志 `four-digit-e2e.log`；该 1 项属于原完整 86 项中的复核，不把总数写成 87。Firefox/WebKit、实体设备、生产仍未覆盖。

### 5.4 外部规范提交与停止边界

`docs/README.md`、`docs/UX_STANDARDS.md`、`docs/WEB_UX_SPEC.md`、`docs/LIST_UX_AUDIT.md` 原样提交为 `b450ebfd5a2a553055aa339e3b223caa0e0ab8ab`（`docs(ux): error taxonomy, user-facing copy and list UX audit`）。四份文件提交前后原始 SHA-256 一致，提交 blob 与预先记录一致；记录见 `external-documents-before.json`。本轮按用户收尾指令更新进度、合并并推送后停止；未开始规范中的体验修复批、B6c 或 B10。
