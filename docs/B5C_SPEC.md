# 出库分批发货规范（B5C_SPEC）

> 本文档中的状态、类型等库值仅作实现标识；界面显示必须按 docs/UX_STANDARDS.md 映射为中文。
> 依赖：docs/OUTBOUND_FACT_SPEC.md（实发量由人工录入，扫码只预填）。

## 1. 现场事实

| 情况 | 占比 | 含义 |
|---|---|---|
| 一车多单 | 多数 | 同一车牌装多张单，各单各确认、各打印 |
| 一单多车 | 少数 | 一张单分几次拉走，需分批发货 |
| 一车一单 | 约三成 | 最简单的情况 |

结论：**发货记录按单计，不按车计；一车多单不合并单据，各打各的送货单。**

## 2. 状态

```
计划中 ──首次确认──▶ 部分发货 ──完成发货──▶ 已出库
   │                     │
   │                     └──短关────────▶ 已短关
   └──作废
```

补充（2026-11-12 裁定）：任何一次发货后，若所有行包数与克数的待发均为 0，直接进入「已出库」；首次也可直接发满结单。图中的「完成发货」仅保留用于计划修改后待发归零的显式确认。

| 状态 | 含义 | 库存 |
|---|---|---|
| 计划中 | 未确认任何数量 | 0 |
| 部分发货 | 已确认部分，仍有待发 | 按已确认扣 |
| 已出库 | 实发已满足全部待发，或待发为零后显式完成 | 按已确认扣 |
| 已短关 | 主动结单，剩余不发 | 按已确认扣 |
| 已作废 | 未确认前作废 | 0 |

规则：
- 每次人工确认实发后按行分别计算包数与克数待发：全部为 0 自动转「已出库」，否则「部分发货」；「已短关」仍须填写原因并明确触发。禁止新产生已出库但仍有待发的单据；
- 已出库 / 已短关不可再确认、不可改计划、不可重开；
- 撤销沿用整单撤销：反向所有发货记录，写库存流水。

### 2.1 扫码状态与单据状态分离

`frozen` 不再作为单据状态，改为「结束扫码」标记：

| 概念 | 取值 | 作用 |
|---|---|---|
| 单据状态 | open / partially_shipped / confirmed / short_closed / voided | 决定业务与库存 |
| 扫码状态 | scanning / closed（`scan_closed_at`） | 只决定还能不能继续扫 |

规则：
1. **结束扫码不阻断确认**：可以从 open 直接填实发并确认，确认时自动写入 `scan_closed_at`；
2. 「重新扫码」：未结单前可清空 `scan_closed_at` 继续扫；
3. 已生成的发货记录不可改；计划中与部分发货时仍可改计划，按 §7 重算待发。业务日期锁定另按 DOMAIN_RULES §2.2，与扫码状态无关；
4. 历史 `frozen` 单据迁移为 `open + scan_closed_at`，不再产生新 frozen；
5. 状态枚举保留 frozen 以兼容历史数据，代码不再写入。

## 3. 发货记录

每次确认生成一条发货记录：

| 字段 | 说明 |
|---|---|
| order_id | 所属单据 |
| seq | 第几次发货（1、2、3…） |
| vehicle_no | 本次车牌（快照） |
| shipped_at | 确认时间 |
| business_date | 本次入账的业务日期，默认确认当天，可回填不晚于今天 |
| operator | 操作人 |
| lines | 本次各行实发包数与吨数 |

明细（shipment_lines）：line_id、packages、weight_grams、overage_reason。

规则：
- 记录一旦生成不可修改；
- 累计实发 = 该单全部发货记录之和；
- 同一车号可对应多张单的多条记录，互不影响；
- 月报与对账按**发货记录的入账日（确认当天，上海时区）**归月；business_date 仅作业务说明，回填不改报表月份，避免追溯改动历史月份。

### 3.1 与 B4d 的衔接

实施边界（2026-11-11，收尾补修裁定）：B4d 包含首次发货、人工实发、扫码快照与 scan_closed_at。结束扫码不改状态；仅 open 且无发货记录可重新扫码。多次发货、短关与部分发货状态流仍留 B5c。历史时间回填与保护详见 OUTBOUND_FACT_SPEC §12，取代先前“状态拆分留后续”的边界。

B4d（手工实发）实现时，确认动作**直接按“创建第 1 条发货记录”落地**：

- B4d 的确认接口 = 生成一条 shipment，本次数量 = 全部待发（用户可改）；
- B5c 只是允许再点第二次、第 N 次，新增 UI 与校验，不改数据结构；
- 因此 B4d 的 `outbound_lines.actual_*` 不再是独立事实，而是由发货记录汇总维护的读模型（或视图），避免双写不一致。

## 4. 分批发货流程

```
① 打开出库详情 → 点「本次发货」
② 明细表出现「本次实发包数 / 吨数」，预填 = 累计扫码 − 已确认实发
③ 人工修改本次数量（可只发部分行）
④ 确认本次发货 → 生成发货记录 → 扣库存 → 仍有待发为「部分发货」，发满自动「已出库」
⑤ 重复 ①–④ 直到发满自动结单；改计划后待发为零可显式点「完成发货」
   或 点「短关」→ 已短关
```

### 预填规则

- 本次预填 = 该行累计扫码包数 − 该行已确认实发包数，最小为 0；
- 吨数按扫码重量同比例折算；
- 同商品多行时，先扣已确认，再按行顺序分配剩余；
- 没有扫码时留空，提示手填。

### 校验

| 项 | 规则 |
|---|---|
| 本次实发 | 空白按 0 提交，允许 0（该行本次不发）；页面空白仍显示「—」 |
| 全部为 0 | 不允许确认，提示「本次没有发货数量」 |
| 完成发货 | 所有行包数、克数待发均为 0 时可用；存在待发时禁用，提示「还有待发，请继续发货或短关」 |
| 超过待发 | 允许（溢发），行级原因必填 |
| 库存不足 | 409，提示可用量 |
| 计划已改 | 已发货记录不受影响 |

## 5. 短关

- 入口：「短关」，需填原因（客户取消 / 货未到 / 其他）；
- 效果：状态转「已短关」，剩余待发清零，**不动库存、不写库存流水**；
- 短关后不可重开、不可再确认；
- 短关原因写入单据与审计。

## 6. 溢发

- 某行本次实发 > 该行待发时，视为溢发；
- 溢发行必须填原因（多装 / 客户追加 / 其他）；
- 溢发按实发扣库存，库存不足则拒绝；
- 溢发不改变计划数量，只体现在实发合计与差异列。

## 7. 计划修改

| 状态 | 能否改计划 |
|---|---|
| 计划中 | ✅ |
| 部分发货 | ✅（只改未发部分，已发数量不变） |
| 已出库 / 已短关 / 已作废 | ❌ |

改计划写审计，记录每行改前/改后的计划包数与吨数。2026-11-12 收尾裁定：计划包数、克数分别不得小于该行已发量，否则 422 并指出对应行；终态编辑同样返回 422。商品、客户、仓库不可修改；发货记录、已发量与库存不变。改计划使待发归零时仍保持部分发货，须显式「完成发货」。

## 8. 界面

### 出库详情

```
计划合计 100 包 / 30.0000 吨 ｜ 已发 70 包 / 21.0000 吨 ｜ 待发 30 包 / 9.0000 吨

商品 | 计划包/吨 | 已发包/吨 | 待发包/吨 | 本次实发包/吨 | 差异包/吨
003  | 40 / 12  | 40 / 12   | 0 / 0     | [空白]        | —
007  | 30 / 9   | 20 / 6    | 10 / 3    | [9 / 2.7]     | −1 / −0.3000
009  | 30 / 9   | 10 / 3    | 20 / 6    | [22 / 6.6]    | +2 / +0.6000
```

2026-11-12 B5c-3 用户裁定：差异 = 本次实发 − 该行待发，包数与克数分别显示；正数为溢发，负数为欠发，本次输入为空时对应差异显示「—」。待发、有效已发及其合计一律取后端响应，前端不重复计算；前端差异只用于展示，不作为提交资格判断。每条本次发货商品行在确认弹窗提供原因输入，溢发行原因必填，由现有发货接口最终校验并定位对应行。

视觉补修：计划、已发、待发三列加宽，表头与数量不换行，数字右对齐，1280 下允许表格横向滚动。差异在详情与确认弹窗统一显示为 `−60 包 / −18.0000 吨（欠发）` 或 `+1 包 / +0.3000 吨（溢发）`，同方向只标一次状态；包吨方向相反时同一括号分别注明，例如 `（包欠发、吨溢发）`，仅用于展示。商品名单独一行，原因表单标签仅为「溢发原因」。输入框单位与宽度 AF-053 留 B6j。

AF-054 列宽补修取代上一轮宽度配置：商品最小宽 200 并吸收宽屏剩余空间，计划/已发/待发各固定 130，本次实发列固定 160，差异列固定 200，总宽至少 950；使用固定表格布局及 `scroll.x`，超出容器只在表格内部横向滚动，页面不得横向溢出。数量列包数、吨数分两行，每个数字与单位不换行并右对齐。商品首行仅商品名，单行省略 + Tooltip；第二行只组合有值的合同号、行备注，同样省略 + Tooltip，均为空时不显示此行及「历史未记录」。差异列内边距及文字大小使用主题 token，确保 200 宽度内完整显示。输入控件本身宽度、单位样式仍留 AF-053/B6j。

操作：
- 「本次发货」：进入分批录入；
- 「完成发货」：待发全为 0 时可用；存在待发时禁用并提示「还有待发，请继续发货或短关」，成功后转已出库；
- 「短关」：填原因，转已短关；
- 「打印送货单」「导出扫码清单」按单。

### 确认弹窗

```
确认本次发货
车牌 苏F80807
本次：2 行，共 31 包 / 9.3000 吨
逐行原因：009（本次 22 包 / 6.6000 吨，溢发 +2 包 / +0.6000 吨）[客户追加]
确认后将扣减库存并生成第 3 次发货记录。
[取消] [确认]
```

## 9. 打印与导出

| 内容 | 时机 | 范围 |
|---|---|---|
| 送货单 | 每次发货后 | 本单本次数量，参数为单号 + 第几次发货 |
| 扫码清单 | 任意时点 | 本单全部扫码记录 |
| 出库明细导出 | 任意时点 | 按筛选 |

一车多单时：**每张单各打各的**，不合并。

## 9.1 更正与撤销

| 操作 | 规则 |
|---|---|
| 更正 | 作用于**发货记录行**，引用原发货记录并保留原值；整单累计差额只做展示 |
| 整单撤销 | 反向所有发货记录与库存，状态转已撤销；已短关也允许撤销 |
| 单批撤销 | 不做，需要时另开批次 |

更正的技术衔接（重要）：
- B5a 的 `document_correction_lines` 已按订单行记录；B5c 增加可空的 `shipment_line_id`；
- 有 `shipment_line_id` 时，差额只作用于该发货行；为空时沿用订单行口径（兼容 B5a 历史数据）；
- 有效已发量 = 各发货记录原量 + 未抵消更正净额；
- 防环、版本链、历史单拒绝规则不变。

B5c-2 接口与迁移边界（2026-11-12）：
- `shipmentLineId` 使用十进制字符串传输，避免 BIGINT 在浏览器中丢失精度；只接受原始发货行，必须同时属于原单和指定订单行。
- 单次发货可省略该值，服务端自动归属；两次及以上发货必须指定，422 返回该订单行的可选发货行及发货序号。没有发货行可对应的 B5a 旧单保留订单行更正兼容。
- 请求中的包数、克数是所选发货行的更正后有效数量，前值取该发货行原量加前序未抵消更正。旧 NULL 引用继续按订单行计算，不猜分配到某批发货。
- 020 增加可空 `shipment_line_id`、索引和 RESTRICT 外键；只有一条发货记录且订单行唯一匹配时回填，其他情况保留 NULL。任何非空引用都在 down 的首条 DDL 与迁移状态变更前阻止回退。
- 发货记录的原量不改写。详情保留原量和更正链，发货列表返回原量、有效量及更正差额；待发、计划修改下限和 Web 列表/差异展示取有效量。撤销保留原发货与更正证据，抵消后的更正不再计入有效量。
- 016 前本地确认若没有发货行，读取已入账原流水保留原量，NULL 更正不改绑到后来的补发；不重建历史发货记录。补发后原流水与新发货原量分别累计；若成功审计已记录过发货引用却缺发货记录，继续按证据损坏拒绝，不能冒充旧单兼容。
- 整单撤销按库存流水顺序核对本单的全部发货与更正，允许本单两类事件交错；仍拒绝夹有其他库存动作或存在后续依赖的自动撤销。
- 020 实现验收阶段只在随机隔离测试库验证；用户验收后已授权并完成开发样本库应用，收尾证据见 §16.3。非空回退被拒时保留数据与结构，采用前向修复。

本轮补充裁定统一定义：
1. **状态与待发**：部分发货、已出库及已短关单均可更正；已撤销/已作废与历史导入单仍拒绝。已出库更正后任一行包或克有待发，转部分发货并同事务审计前后状态、原因“更正”；补满后按 §2 自动结单。部分发货更正后按待发重算状态，全部归零则结单。已短关更正后保持短关，只重算四列中的剩余包/克并写审计；原短关原因、短关时间、原完成时间保留，不重新开放发货。增发更正仍受非负库存约束。020 不增加状态相关列。
2. **更正粒度**：一张更正单的每条订单行只允许引用一个发货行，保留现有主键。同一请求重复订单行返回 `CORRECTION_ORDER_LINE_DUPLICATE`（422）与“该订单行在本单已更正，请为另一批发货另开更正单”；分两张更正单按版本链提交可分别成功。现有更正抽屉仅增加发货批次选择，切换时显示该批原量与有效量；更正详情显示对应发货序号、车号、日期。分批发货输入界面仍留 B5c-3。待观察：半年内若拆成两张更正单的操作频繁，再评估主键扩展。
3. **报表**：入库与出库更正均计入各自有效收发量，不再计入调整；归期、抵消与对账唯一算法见 REPORT_SPEC §10。


## 9.2 盘点锁仓

盘点进行中，禁止「确认发货」，与入库确认、库存调整、整单撤销同属被锁操作。

## 9.3 待发与报表口径

- 待发 = max(计划 − 累计实发, 0)；
- 短关后待发为 0，短关数量单独记录，不计出库量；
- 报表出库量与更正归期遵循 REPORT_SPEC §10；business_date 只作说明。

## 10. 报表口径

- 出库量按有效发货量统计，算法统一引用 REPORT_SPEC §10；
- 待发 = 计划 − 已发，已结单则为 0；
- 溢发计入实发；
- 短关的单据在报表中标注「已短关」，短关部分不计出库。

## 11. 接口

| 接口 | 说明 |
|---|---|
| GET /outbound/:id/shipments | 发货记录列表 |
| POST /outbound/:id/shipments | 确认本次发货（幂等键） |
| POST /outbound/:id/complete | 完成发货 |
| POST /outbound/:id/short-close | 短关（原因必填） |
| PATCH /outbound/:id/plan | 修改计划（状态校验） |
| GET /outbound/:id/shipments | 同一响应提供逐行待发、有效已发、本次预填与合计；不新增 shipment-prefill 接口 |

## 12. 边界

| 情况 | 处理 |
|---|---|
| 一车多单 | 各单独立确认，车牌相同互不影响 |
| 一单多车 | 同一单多条发货记录 |
| 本次全 0 | 拒绝 |
| 短关后到货 | 不允许重开，另开新单 |
| 溢发库存不足 | 409 |
| 并发两次确认 | 幂等键 + 行锁，只生效一次 |
| 计划在部分发货时被改小 | 新计划包数、克数分别不得小于该行已发量；低于则 422 指出行。等于时待发归零，但须显式完成发货 |

## 13. 不做

| 不做 | 原因 |
|---|---|
| 装车单 / 车次单据 | 现场按单打印，不需要 |
| 单批发货记录撤销 | 先只支持整单撤销；真有需要再加 |
| 有待发时自动结单 | 必须继续发货或填写原因短关；发满自动结单按 §2 |
| 计划预占库存 | 计划只是参考 |

## 14. 验收

1. 计划 100 包，三次确认 40/30/20，库存累计扣 90，状态依次为部分发货；
2. 第四次「短关」，状态已短关，库存不变，剩余 10 包清零；
3. 某行本次实发超过待发，未填原因 → 拒绝；填原因 → 通过，库存按实发扣；
4. 一车两单：分别确认，车牌相同，两张单各自生成发货记录与送货单；
5. 部分发货时改计划：已发不变，待发按新计划重算；
6. 并发两次确认同一单：只生成一条发货记录；
7. 整单撤销：所有发货记录反向，库存恢复，流水成对；
8. 短关后尝试确认 → 拒绝；
9. 报表出库量按 REPORT_SPEC §10 的有效量统计，短关部分不计；
10. 1440/1280 截图：详情分批输入、确认弹窗、短关弹窗。

## 15. 实施拆分与工作量

| 步骤 | 内容 | 验收重点 |
|---|---|---|
| B5c-1 | 发货模型：记录表、行表、确认、状态、短关、溢发 | 分批数字与库存一致 |
| B5c-2 | 更正迁移：`shipment_line_id`、有效量、防环 | B5a 旧数据仍可读、可撤 |
| B5c-3 | 出库详情分批发货界面、完成/短关、发货记录、打印按钮占位 | 后端数量展示、差异语义、空白按零、原因输入、1440/1280；真实打印留 B9，不改报表或更正界面 |

说明：
- 更正迁移单独一步，因为 B5a 的更正挂在订单行，改到发货行会影响既有测试与撤销链路；
- 总工作量按 **2–3 周** 估算，不是最初的两周；
- 原“B5c-2 未完成前不得合并 B5c”限制由 2026-11-12 用户收尾指令取代：本次批准 B5c-1 独立应用 019、合并并推送；B5c-2/3 仍未完成，不宣称整批 B5c 完成。

### 15.1 B5c-1 实施边界（2026-11-12）

- 复用 016 两张发货表；019 只新增开工要求的四个可空短关字段，不回填历史数据，不重建发货表。down 在任何 DDL 和迁移状态变更前检查四列，零值和空字符串也算已有证据。
- 新增 `POST /outbound/:id/shipments`、`complete`、`short-close`，以及 `PATCH /outbound/:id/plan`；写入均要求 Web 登录、允许的 Origin、UUID 幂等键、当前 revision/digest。发货沿用库存写锁、单据行锁和同事务库存/流水/成功审计；失败留证走现有独立事务。
- 发货请求的 `lines` 为本单全部明细，含本次不发的零值行。任一行包数或克数超过对应待发都须填写 `overageReason`。包、克分别比较，不通过件重换算。按用户后续裁定，发满自动结单；未发满保持部分发货。`/complete` 保留待发检查，已自动结单且待发为零时不重复写完成事件或库存。
- 计划接口的 `plan.lines` 在本步按行 ID 修改现有行的计划包数、克数、合同号、备注；未传行保持原值。表头可改车牌、柜号、类型、备注，客户/仓库/单号/业务日期不可借此修改。总纲中的明细增删属于完整 B5c 目标，本步没有开放删行或更换商品，页面及增删衔接在后续步骤落实。
- `GET /outbound/:id/shipments` 返回按 seq 排序的全部发货记录、剩余包/克、完成时间及短关证据；显式完成时间取 `outbound.complete` 成功审计时间，自动完成取最后一次发货时间，不额外扩列。短关只从部分发货进入，未发货单沿用作废流程。
- 按用户最后裁定，旧 `/confirm` 保留为 `/shipments` 的严格别名，共用请求校验、状态规则与幂等空间，同键跨入口重放不重复扣库。两者都使用请求中的人工本次实发：100 发满结单，40 只发 40 并保留 60；不能无条件 confirmed，也不把输入强行改成计划。网页调用地址与交互本步保持，分批输入界面留 B5c-3。
- 整单撤销先逐次核对 shipment → operation → 库存流水，再按商品汇总全部实际数量一次反向补偿；保留每条原发货记录。沿用原有“流水之间及之后存在其他库存动作则拒绝自动撤销”的保护。闭单表原操作引用锚定 seq=1，补偿范围为整单全部记录；存储状态沿用 `cancelled`，界面为「已撤销」。
- B5c-1 阶段曾限制多次发货单更正；该限制由 B5c-2 的 §9.1 发货行更正规则取代。没有增加分批页面、送货单打印、报表归期修改或生产连接。
- B4d 允许已发货单补传扫码的保护随新状态延伸至部分发货与短关；补传只追加原始扫码记录，不改变实发、首次扫码快照或库存。Web 清点修改仍按原有只读边界处理。

验证与回退：019 仅在随机隔离测试库进行 up/down/up 与非空拒绝测试；本步不应用开发样本库 3307。停止写入后，四列全 NULL 才可运行 019 down；已有短关证据时拒绝删列，保留结构与数据并前向修复。已有分批记录的环境不能直接退回不支持分批的应用版本。

### 15.2 B5c-1 本地自动化结果（2026-11-12）

以下为随机隔离 MySQL 测试库的结果，不代表开发样本库迁移、实体设备或生产验收。

| 验证 | 结果 | 日志 |
|---|---|---|
| 完整单测/API/小程序 | exit 0；295 通过、0 失败 | `.local/evidence/b5c-1-test.log` |
| 严格类型检查与 Web 构建 | exit 0 | `.local/evidence/b5c-1-build.log` |
| 完整 Chromium E2E | exit 0；121 通过、0 失败（主 112 + catalog 9） | `.local/evidence/b5c-1-e2e.log` |
| OpenAPI 生成 | exit 0 | `.local/evidence/b5c-1-openapi.log` |

关键原始输出（包数与克数分别核对）：

```text
B5C1_ALIAS entry=confirm actual=100 status=confirmed remaining=0 replay_via=shipments shipments=1
B5C1_ALIAS entry=confirm actual=40 status=partially_shipped remaining=60 then_shipments=60 confirmed=true
B5C1_ALIAS entry=shipments actual=100 status=confirmed remaining=0 replay_via=confirm shipments=1
B5C1_ALIAS entry=shipments actual=40 status=partially_shipped remaining=60 then_confirm=60 confirmed=true
B5C1_FLOW shipments=3 actual=90/27000000g stock=110/33000000g short_closed=10/3000000g short_close_journal_delta=0 reverse_stock=200/60000000g replay_compensations=1
B5C1_COMPLETE remaining=60 rejected=422 remaining=0 status=confirmed completed_at=recorded inventory_delta=0
B5C1_PLAN plan=100->50 shipped=40 unchanged remaining=60->10 shipment_snapshots_unchanged=true
B5C1_OVERAGE without_reason=422 with_reason=200 stock_shortage=409 rollback=true
B5C1_CONCURRENCY statuses=200/409 shipments=1 success_events=1 same_key_replay=original stock_deduction=40
B5C1_MIGRATION empty=up/down/up nullable_columns=4 identical_schema=true
B5C1_MIGRATION nonnull_fields=4 refused=4 ddl=0 schema_unchanged=true
B5C1_E2E shipments=40/30/20 actual=90 short_closed=10 complete_with_remaining=422 reversed=90 stock_restored=true
```

补充覆盖：包数已满但仍差 100 克时拒绝完成；计划改小使待发归零后可显式完成且不写库存流水；库存写入后注入失败时整笔业务回滚、失败尝试保留；盘点锁仓、匿名/非 Web、终态、旧版本、外单/重复明细均拒绝。已有单次更正及整单撤销的回归保留。

回归调整：017/018 迁移测试固定到各自目标版本，避免新增 019 后误把最新结构当旧版本结构；旧 016 兼容测试与 B4d/B4g 页面断言按本次裁定改为“未发满显示部分发货”。未通过删除用例或放宽库存断言规避失败。

### 15.3 B5c-1 收尾补修（2026-11-12）

按用户补充要求收紧计划下限：每行计划包数、克数不得低于已发量，422 带行与输入定位；终态计划编辑 422。已发量、发货记录和库存保持原值；编辑后待发归零保持部分发货，由显式完成结单。审计保留每行修改前后的计划值。此规则取代上一轮边界测试中“已发 40 可改计划为 20”的旧断言。

本轮相关 API 回归 23/23、exit 0，构建 exit 0；日志 `.local/evidence/b5c-1-plan-tests.log`、`b5c-1-plan-build.log`。§15.2 的完整 295/121/0 是此前已验收基线，本轮未把定向回归冒充完整复跑。

```text
B5C1_PLAN_MIN before=100 shipped=70 new=120 remaining=50 audit=true stock_unchanged=true
B5C1_PLAN_MIN before=100 shipped=70 new=80 remaining=10 audit=true stock_unchanged=true
B5C1_PLAN_MIN below=plannedPackages status=422 row_identified=true unchanged=true
B5C1_PLAN_MIN below=plannedWeightGrams status=422 row_identified=true unchanged=true
B5C1_PLAN_MIN confirmed_edit=422 unchanged=true
```

### 15.4 019 开发样本库应用与冒烟（2026-11-12）

用户授权后应用至 `127.0.0.1:3307/maozhi_dev_sample`，019 状态 `applied`，迁移与冒烟 exit 均为 0。应用前确认无样本库连接，核对本地实例目录、数据库身份与 018 已应用状态；完成备份后采集结构及原有列数据指纹。

- 备份：`.local/evidence/b5c-1-closeout/before-019-1794454370873.sql`，6,542,439 字节；SHA-256 `17b76418994d4a117bdb76b17dc57deeebd95bc8829a82406b51675011c534db`。
- 结构指纹前：`26b4e46d50c150ff930a6f2e5b5dc5c40bc47620e2477e2d2e3080792b06f244`。
- 结构指纹后：`aeecdbcb331165618657d6e81081710765938b76139addf6340985ece711c3f1`。
- 预期差异只有 `outbound_orders` 新增四个可空短关列，原单新列全部 NULL；其他结构、触发器不变。逐表原有列数据指纹相同（迁移登记表除外）。指纹变化符合新增列预期，不声称前后整体结构相同。

| 样本库单号 | 实测 | 结果 |
|---|---|---|
| CK-20261112-002 | 计划 3 包，先发 1、再发 2 | 首次部分发货、待发 2；第二次自动已出库、包/克待发均 0，共 2 条发货记录 |
| CK-20261112-003 | 计划 3 包，发 1 后短关 | 已短关；保存剩余 2 包/600000 克；待发归零；短关库存与流水均不变 |
| CK-20261112-004 | 已发 1 包，计划 3→4→2→1 | 待发 2→3→1→0；始终部分发货，显式完成后已出库；发货记录、已发量、库存不变 |

冒烟通过真实 Web 登录会话访问本地 API；三张新单及审计保留，实际发货合计 5 包/1500000 克，库存相应减少，未直接重写库存或删除历史单据。本轮未做浏览器版式、实体设备或生产验收。备份、指纹、单号及原始响应摘要在 `.local/evidence/b5c-1-closeout/`；短关证据已非空，019 down 现应拒绝，后续采用保留证据的前向修复。

## 16. B5c-2 本地实施与验收（2026-11-12）

本批实现 §9.1 发货行更正及用户合并裁定；统一算法在 REPORT_SPEC §10，状态与粒度只在 §9.1 定义。020 不改更正明细主键、不新增状态列。网页仅补更正批次选择与有效数量展示，未实施 B5c-3 的分批发货输入界面。

### 16.1 验证结果

| 验证 | 结果 | 证据 |
|---|---|---|
| API / 小程序完整测试 | exit 0；322 通过、0 失败、0 跳过 | `.local/evidence/b5c-2-test.log` |
| 严格类型检查与 Web 构建 | exit 0 | `.local/evidence/b5c-2-build.log` |
| 完整 Chromium E2E | exit 0；122 通过、0 失败（主 113 + catalog 9） | `.local/evidence/b5c-2-e2e.log` |
| OpenAPI 生成 | exit 0 | `.local/evidence/b5c-2-openapi.log` |

已完成的定向证据：020 迁移与旧单兼容 6/6，相关报表导出/016 回归 5/5，均 exit 0；构建 exit 0。所有写入位于随机隔离测试库或独立 E2E 合成库，020 **尚未应用到 3307 开发样本库**，未做设备或生产验收。

关键原始输出（包数与克数独立验证）：

```text
B5C2_TARGET missing_id=422 original=40/60 effective=40/50 remaining=10/3000000g snapshots_unchanged=true
B5C2_TARGET foreign_order=422 same_order_wrong_line=422 invalid_order_line=422 stock_unchanged=true
B5C2_REVERSE shipments=2 correction=-10 compensation=90 stock=200/60000000g replay=once
B5C2_STATE confirmed=100 correction=-20 partial_pending=20 replenished=20 confirmed=true interleaved_reverse_stock=200
B5C2_SHORT_CLOSE correction=-10 status=short_closed remaining=10->20 time_unchanged=true cannot_ship=409
B5C2_SHORTAGE correction=+10 stock=5 status=409 business_unchanged=true
B5C2_GRANULARITY same_request=422 separate_requests=200/200 effective=30/50 remaining=20
B5C2_CONCURRENCY requests=10 corrections=1 success_events=1 stale_shipment=409 stock=110
B5C2_REPORT outbound=-10 effective=90/27000000g detail=90/27000000g ledger=90/27000000g adjustment=0 documents=1
B5C2_REPORT outbound_cross_month original_month=100 correction_month=-10 adjustment=0
B5C2_REPORT inbound_correction=-5 original_month=11 correction_month=-5 adjustment=0
B5C2_MIGRATION empty=up/down/up structure_equal=true nullable_fk=true
B5C2_MIGRATION multiple=NULL unmatched=NULL legacy_effective=90 reverse_stock=200
B5C2_MIGRATION single_backfill=true effective_before_after={"packages":3,"weightGrams":600000} nonnull_down=refused ddl=0 structure_equal=true
B5C2_PRE016 shipment_reference=NULL pending_after_correction=1 replenished=false readable=true reverse_restored=true
B5C2_PRE016 shipment_reference=NULL pending_after_correction=1 replenished=true readable=true reverse_restored=true
```

并发输出中的 `success_events=1` 指 `stock.correct` 更正成功事件；更正引起状态变化时另存一条 `outbound.correction` 状态审计，同键重放不重复写任何一条。跨月测试使用 2026 年 9/10 月的隔离流水，未改开发样本数据。

020 索引实测：`EXPLAIN SELECT correction_id FROM document_correction_lines WHERE shipment_line_id=?` 使用 `idx_correction_shipment_line`，`type=ref`、`rows=1`、`Using where; Using index`。单批唯一匹配回填前后有效量相等；多批、无法匹配及旧确认另有后续补发时保留 NULL。非空回退拒绝前后 `SHOW CREATE TABLE` 相等、DDL 执行数为 0、020 状态仍为 `applied`。

报表 XLSX 三范围逐字段比对：明细 31 列，全部/本页/选中分别比较 1488/620/31 格；月报 46 列，分别比较 828/828/46 格，差异均 0。新增“其他库存变动”使对账表期末行下移，旧导出测试改按业务标签定位；016 往返测试固定目标 016，避免误把 020 结构与旧版比较，未删用例或降低数量/库存断言。完整 E2E 首轮也发现旧下载辅助函数固定只读 6 项对账，漏掉新增第 7 项；改按屏幕实际项数读取导出并逐项比较，仍验证全部数据。

1440 截图（本地 Chromium）：`.local/evidence/b5c-2-correction-drawer-1440.png`、`.local/evidence/b5c-2-correction-detail-1440.png`。更正抽屉显示第 2 次发货、原量 60 包/18 吨、改为 50 包/15 吨及差额 −10 包/−3 吨；详情显示有效 90 包/27 吨与部分发货。

### 16.2 回退与后续

停止相关写入后，只有 `shipment_line_id` 全 NULL 才能执行 020 down；任何非空归属都保留证据并采用前向修复。应用版本也不能直接退回不支持发货行更正及有效量的旧版。没有执行样本库迁移、合并或推送。

继续观察 §9.1 的同一订单行拆更正单频率；B5c-3 页面、B5d 重述、性能专项、实体设备与生产验收均未包含在本批结果中。外部 AGENTS.md 和 IMPLEMENTATION_PLAN.md 改动原样保留，不混入本批提交。

### 16.3 开发样本库应用与收尾（2026-11-12）

本节追加用户验收后的收尾结果，取代 §16.1–16.2 当时“未应用样本库、未合并”的执行状态；保留原验收历史。仅访问本机 `127.0.0.1:3307/maozhi_dev_sample`，未连接生产。应用前核对本地库身份、无既有样本库连接、001–019 全部 applied；先完整备份，再采集结构与业务数据指纹，应用 020 后再次比对。

| 项目 | 原始结果 |
|---|---|
| 备份 | `.local/evidence/b5c-2-closeout/before-020-1794464750200.sql`，6,627,204 字节，mysqldump exit 0 |
| 备份 SHA-256 | `ce0056b867c183862325e4b7ad65f509b750a0c182344112b0cd3f3745e45b56` |
| 应用前结构 SHA-256 | `61f1ff2e96347ef9f633b657f9e30ec799c12c5efaedd9753ed55f59e56e4a0d` |
| 应用后结构 SHA-256 | `43ae00a514216c3468eceb2aba798fb6bfdf4e4031a8f1b6d04ebd25470c6e41` |
| 结构差异 | 仅 `document_correction_lines`：可空 `shipment_line_id`、索引及外键；表集合、触发器不变 |
| 原有业务列指纹 | 全部一致；迁移状态表单独核对，不将新增列纳入旧列比较 |
| 迁移 | `020_correction_shipment_line=applied`，exit 0；原有更正行 0，回填 0 |

冒烟通过真实 Web 登录及 API 调用，独立启动当前版本本地 API，未直接修改库存。所有新建单据与业务证据留存，未改历史单据；本次是 API 冒烟，不声称新增浏览器、设备或生产验收。

```text
B5C2_SAMPLE_TARGET order=CK-20261112-005 shipments=40/60 missing_target=422 choices=2 selected_target=200 effective=40/40 originals_unchanged=true
B5C2_SAMPLE_STATE order=CK-20261112-005 correction=-20 confirmed->partially_shipped remaining=20/6000000g original_completed_at_preserved=true
B5C2_SAMPLE_SHORT order=CK-20261112-006 correction=-10 status=short_closed closed_remaining=10->20 closed_grams=6000000 pending=0 close_time_preserved=true
B5C2_SAMPLE_REPORT day=2026-11-12 product=012 warehouse=WH002 report=165/49500000g ledger=165/49500000g equal=true
B5C2_SAMPLE_STOCK new_orders=2 net_delta=-160/-48000000g retained=true exit=0
```

报表对账包含该日该商品/仓库全部出库流水（原有 5 包/1.5 吨 + 本次净实发 160 包/48 吨），不只比较本次新增单据。证据目录 `.local/evidence/b5c-2-closeout/` 包含 `backup.json`、`schema-before.json`、`schema-after.json`、`data-before.json`、`data-after-projection.json`、`migration-result.json`、`smoke.json` 和逐项冒烟输出。备份与原始数据不入 Git。

外部文档分别原样提交 `3a58644`（AGENTS）与 `55ddd02`（计划）。`--no-ff` 合并为 `1841d2d18baeaa49009d45920762c93dbeafd6e0`，推送 exit 0，该次远端 HEAD 与 merge 一致。完整验证沿用本批已验收的 322/122/0，本次未重复运行。收尾记录另提交同步后停止，B5c-3 留新会话；未执行开发样本库 down，现有非空更正归属须保留并前向修复。

## 17. B5c-3 页面实施边界（2026-11-12）

- 用户已批准本批范围及三提交：范围同步、界面实现、验证记录。只改出库详情分批交互，打印禁用占位；不做打印接入、PDA、报表口径、更正界面或计划明细增删，不新增迁移。
- 复用 `GET/POST /outbound/:id/shipments`、`POST /complete`、`POST /short-close`。GET 响应补充当前 revision/digest、有效已发合计、逐行有效已发/待发/本次预填；前端直接展示，不重新累计或推算。录入使用同一份完整 GET 快照的行、数量与版本；刷新发现版本变化时保留输入并提示重新核对，不混用新版本与旧输入提交。
- 预填由后端读取未撤销累计扫码记录，同商品先扣有效已发包数，再按行序与剩余计划分配；重量按累计扫码重量同比例折算到整数百克，最后一行吸收舍入差。无扫码返回空白；预填不改变原记录、首次扫码快照、已发或库存。
- 空白输入在发货请求中显式转为 0；全单全 0 在页面提示「本次没有发货数量」。差异只用于显示（§8），原因逐行录入；最终是否溢发、原因是否齐全、库存/锁仓/版本/状态均由现有发货命令检查，失败保留输入。
- 每次成功刷新详情、发货记录、库存与相关列表；失败重试沿用同一幂等键，不重复生成记录或扣库。部分发货保留下一次发货入口，已出库/已短关不再开放发货，短关后展示关闭原因及未发数量证据。
- 「完成发货」保留状态约束，只对可完成的未终结单开放；判断待发是否为零直接使用后端返回值。有待发禁用，提示「还有待发，请继续发货或短关」。短关仅部分发货单可用，原因必填、二次确认，不改库存。
- 验证使用现有单测/API、构建及完整 E2E；1440/1280 详情录入、确认弹窗、短关弹窗截图存 `.local/evidence/`，不入 Git，不写开发样本库。完成后停止，不合并、不 push；代码/构建/本地浏览器验证与用户/设备/生产验收分开记录。

### 17.1 实现核对

详情以原 `GET /shipments` 的同一读快照展示计划、有效已发、待发及逐行预填；原响应补齐这些字段和版本信息，没有新增路由或迁移。有效量复用更正投影，待发复用既有包/克独立算法。确认仍走现有发货事务；本批只将溢发错误的 `fields.path` 修为全站通用数组格式，使原因错误定位到对应行。

录入期间固定数量与版本快照，轮询不会覆盖输入。空白转零、全零拦截、差异展示、逐行原因、车牌确认、显式完成、短关及发货记录已接通。确认失败保留输入；返回核对再打开确认时仍保留原因与原幂等键。同步提交锁保护连续点击，提交结果明确成功后刷新相关查询。详情「计划中」按 UX_STANDARDS 显示；仅部分发货时将既有数量更正入口设为次操作，终态保留原入口样式，更正抽屉与业务未改。标题装饰图标不参与单号的无障碍名称。

### 17.2 本地验证记录（2026-11-12）

| 命令 | 结果 | 证据 |
|---|---|---|
| `npm run test` | 324/324，fail 0，exit 0 | `.local/evidence/b5c-3-test.log` |
| `npm run build` | 类型检查与 Web 构建通过，exit 0 | `.local/evidence/b5c-3-build.log` |
| `npm run test:e2e` | 127/127（主 118 + catalog 9），fail 0，exit 0 | `.local/evidence/b5c-3-e2e-final.log` |
| `npm run openapi` | exit 0，现有发货查询响应同步 | `docs/api/openapi.json` |
| `antd lint apps/web/src/features/outbound --format json` | 0 issues，exit 0 | `.local/evidence/b5c-3-antd-lint.json` |
| 改动源码 `prettier --check` | exit 0 | 所有改动 TS/TSX 文件通过 |

新增 API 用例验证更正后的有效量、短关后逐行待发归零，以及同商品多行预填先扣有效已发再分配、无扫码留空。新增浏览器用例覆盖 40/30/20 后短关、空白零值与溢发原因、计划改为已发数量后显式完成、40/60 发满自动结单，以及服务端已成功但响应丢失后的重试。重试场景额外连续运行三次通过：返回核对后原键和正文相同，连点仍只有一批发货；200 包/60 吨库存最终为 160 包/48 吨。

首轮完整主套件为 114 通过、4 失败（catalog 因主套件失败未启动），原日志 `b5c-3-e2e.log` 保留。已修复：终态原有更正主按钮被一并降级、旧扩展字段测试未适配带标签的明细展示、标题图标影响单号精确定位、新测试漏导入辅助函数。定向修复回归 7/8 后又发现重开弹窗时加载图标影响按钮无障碍名称；确认按钮已设置明确名称，原键重试与连点测试随后 3/3 通过。没有删除用例、放宽库存断言或改测试基础设施。

最终完整回归运行于实现提交 `9c3530a` 的代码，主套件 118 passed（14.7m）、catalog 9 passed（1.9m），没有失败。三项用户要求的命令均 exit 0。提交前按 WMS 审查核对全部改动，已处理接口字段路径、同键重试、主操作冲突与无障碍名称问题；`git diff --check` 通过。

截图使用现有隔离 E2E 数据，均为本地 Chromium；没有向开发样本库写数据。1440/1280 逐张复核：差异列与输入可见，弹窗无截断，提示消失及表单校验完成后采集。六张截图仅存 `.local/evidence/`，不入 Git：

| 场景 | 1440 | 1280 |
|---|---|---|
| 详情录入 | `b5c-3-entry-1440.png` | `b5c-3-entry-1280.png` |
| 确认弹窗 | `b5c-3-confirm-1440.png` | `b5c-3-confirm-1280.png` |
| 短关弹窗 | `b5c-3-short-close-1440.png` | `b5c-3-short-close-1280.png` |

上述是代码、构建与本地浏览器自动化记录，不代表用户、实体设备或生产验收。打印接入、PDA、报表口径、计划明细增删仍不在本批；未合并、未 push。

提交顺序：范围同步 `3c42bfa`；界面实现 `9c3530a`；本节随第三次「验证记录」提交。分支保持 `codex/b5c-3-shipment-ui`，等待用户验收。

### 17.3 功能验收后的视觉补修与收尾（2026-11-12）

用户已验收 B5c-3 功能，授权本批补修 AF-049～052；AF-053 留 B6j，不改输入框单位与宽度。修复、重截 1440/1280 详情与确认弹窗并完成 test/build/完整 E2E 后，执行 `git merge --no-ff codex/b5c-3-shipment-ui -m "merge: b5c-3 shipment ui"` 并推送，核对远端 HEAD。本节取代 §17 初始“不合并、不 push”的执行限制；不执行样本库写入、迁移或下一批开发。

修复验证：`npm run test` 324/324，`npm run build` exit 0，`npm run test:e2e` 主套件 118/118、catalog 9/9 exit 0。Ant Design lint 0 issues，Prettier 与 `git diff --check` 通过。全量执行期间改进了各宽度的右滚采集步骤并补充弹窗符号与原因标签断言，因此全量结束后另跑 shipment UI 定向用例；应用代码未再修改，不把补跑称为完整 E2E 复跑。

最终补跑 `npx playwright test tests/e2e/shipment-ui.spec.ts` 为 4/4、exit 0（38.1s）；1440/1280 的差异列右滚截图均完整可读。原始日志为 `b5c-3-visual-test.log`、`b5c-3-visual-build.log`、`b5c-3-visual-e2e.log`、`b5c-3-visual-final-ui.log`，均在 `.local/evidence/`。

截图存放于 `.local/evidence/` 且不入 Git：录入详情 `b5c-3-visual-entry-{1440,1280}.png`；横向滚动至差异列 `b5c-3-visual-entry-difference-{1440,1280}.png`；确认弹窗 `b5c-3-visual-confirm-{1440,1280}.png`；短关弹窗 `b5c-3-short-close-{1440,1280}.png`。截图为本地 Chromium 隔离 E2E 数据，不代表实体设备或生产验收。AF-049～052 已修；AF-053 留 B6j。合并与推送结果按用户要求在本次收尾回复中报告。

### 17.4 AF-054 商品列与横向滚动补修（2026-11-12）

起点为已推送合并 `621c3de`，补修分支 `codex/b5c-3-af054`。用户授权按 §8 明确列宽与商品信息两行布局，补拍 1440/1280，运行 test/build/完整 E2E 及界面用例，再次合并推送。仅调整明细展示；不改发货接口、库存、差异语义或 AF-053 输入控件样式。

新增界面回归验证商品最小宽、其余五列固定宽度、长名称与合同/备注的 Tooltip、空附加信息不占行、差异文本完整落在单元格内，以及 1280 下内部横向滚动但页面无溢出。复用既有隔离 E2E 单据，长文本仅在读取响应边界置入用于布局验证；不改测试基础设施、不写开发样本库。
