# 基础资料规范（MASTER_DATA_SPEC）

> 本文档中的状态、类型、结果等库值仅作实现标识；界面显示必须按 docs/UX_STANDARDS.md 映射为中文。

## 0. 前提

- 本系统替代老系统，是主数据唯一来源；老系统仅作一次性历史导入。
- 本文件取代 B4a 的「商品只读」结论：商品由本系统维护。
- 界面来源：本地新建 / 历史导入。新增 `origin_kind=local|legacy|unknown` 与 `inventory_eligible`，不覆盖原 `source_kind/source_id/source_row_json`；sku-spec 仍仅属条码目录，不在库存商品选择器中。
- 与 B4a 的衔接：B4a 曾以 `PRODUCT_MASTER_READ_ONLY` 关闭商品写入；本规范放开商品维护，
  完成下述资格迁移、快照和统一守卫后，移除 `PRODUCT_MASTER_READ_ONLY` 前置校验，保留审计与停用校验，并验收「新建商品可立即用于入库」。只删403不算完成。

来源/库存资格迁移：已核验 `erp-product` 映射为 legacy + eligible；新建入口显式写 local + eligible；sku-spec 永不具备资格；已有 app/未知来源保持 unknown + 非资格并输出诊断，不批量转正。库存与历史报表可读范围按资格及来源证据确定，停用不隐藏已有库存；新建单/新增引用另要求 active。商品选择、入出库确认、调整、盘点、库存与报表同步使用统一资格规则，迁移前后逐来源/仓品包吨对账，不采用 `source_kind != sku-spec`。来源显示不能替代库存资格校验。契约新增scope=inventory表示资格集合；保留旧source=erp-product为历史ERP子集，两者互斥，旧调用不静默扩大来源。新Web切换到scope契约，导出/报表同scope；存量app/未知仍排除。

## 1. 页面结构

基础资料 Tabs：商品 | 分类 | 仓库 | 客户 | 供应商 | 车辆。
每个 Tab：列表 + 新增/编辑抽屉 + 启停。列表沿用 WEB_UX_SPEC 的工具栏、查询抽屉与列设置。

## 2. 商品

字段：code（手工、唯一、1–64、字母数字-_）、name、model、category_code、package_type、package_color、strap_color、min_alert_tonnes、max_alert_tonnes、status、memo。

规则：
1. 编码手工填写，不自动生成；
2. 不可物理删除，只能停用；停用后新单据选不到，历史单据仍显示名称快照；
3. 编辑不回写历史单据；
4. 停用前校验：无进行中单据引用。

## 3. 商品分类

单层，不建树：code、name、status。一个商品最多一个分类；删除前必须无引用。

## 4. 仓库

code、name、address、status、memo。停用前要求库存为 0 且无进行中单据。

## 5. 客户

字段：code、name、default_contact、default_phone、default_address、status、memo。

收货档案（party_contacts，party_type=customer）：name、phone、address、status；is_default由默认关联表投影，客户default_contact/default_phone/default_address同样为投影，不维护两套可变默认值。
- 表字段：id、party_type、customer_code / supplier_code（恰有一个非空，分别为真实外键）、name、phone、address、status、created_at/updated_at；按归属检查类型一致。默认项由新增 `party_contact_defaults` 保存（客户/供应商互斥外键 + contact_id），每类往来单位唯一；设默认锁往来单位并校验同归属与启用，替换默认同事务审计，不能仅靠前端取消其他默认。
- 每客户最多一条默认；
- 设默认自动取消其他默认；
- 被单据引用过则只能停用，不能删除；
- 修改档案不影响历史单据。

## 6. 供应商

字段与客户对称；送货联系人共用 party_contacts（party_type=supplier）。

## 7. 车辆

字段：`master_vehicles` 的 id、plate_original、plate_normalized（去空格转大写，唯一，1–100 字符兼容现有契约）、driver、phone、status、source（manual/auto）、use_count、last_used_at、memo、merged_into_id。新输入5–10字符为常见格式提示，不截断/拒绝已有100字符合法历史值；全空白拒绝。`vehicle_aliases` 保存规范化旧车号唯一键和目标车辆外键，保留合并证据。

规则：
- 唯一允许隐式建档的对象：首次新建出库单或允许状态下改选车牌时，按规范化唯一键查找/创建（source=auto），与单据快照、审计同一事务；原样保存不重复计数。新增 `vehicle_document_uses`，(vehicle_id, document_id) 唯一，首次关联才增加 use_count；last_used_at 为最近首次关联时间，幂等重放不再增加/刷新。
- 已停用车牌被输入时提示启用，不静默接受；
- 车辆页可编辑、停用、合并重复车牌。
- 合并锁双方并防环，旧车辆停用并保留别名、历史关联与车号快照，使用次数按去重单据重算，不物理删除或改历史单号/事实。

## 8. 交互

### 8.1 不允许隐式建档

商品、客户、供应商、仓库、分类只能显式新增。表单里提供「+ 新建」入口，抽屉保存后回填，不丢失当前表单内容。

### 8.2 收货/送货档案抽屉（淘宝式）

入口：出库单「收货人」右侧「管理」、入库单「送货人」右侧「管理」。

- 列表：姓名、电话、地址，左侧单选圈表示默认；
- 点圈立即设为默认，无保存按钮；
- 每行 [编辑] [停用/删除]；
- 底部 [+ 新增] 与 [完成]；
- 完成后回填当前单据。

默认值顺序：客户默认档案 → 最近使用 → 留空。

### 8.3 单据快照

出库单保存 ship_to_name / ship_to_phone / ship_to_address；入库单保存 delivery_name / delivery_phone。
档案变更不影响历史单据；详情提供「存为收货档案」。

新增头表快照：warehouse_name_snapshot、customer_name_snapshot / supplier_name_snapshot、contact_id、vehicle_id、vehicle_no_snapshot；行表：product_code（原键）、product_name_snapshot、product_model_snapshot、package_type_snapshot。出库已有客户/商品快照字段复用；入库改读快照，禁止详情继续 JOIN 当前名称当历史名称。快照另记 snapshot_origin（created/source/migration/unknown）及 captured_at；有可靠原资料才回填 source，否则标「迁移时资料快照/历史未记录」。改名只影响后续新单；单据允许编辑时明确重选才更新未入账快照，历史/legacy-open 不可修改。商品有进行中引用禁止停用，仓库还须包吨均为零；联系人默认项停用须同事务清除默认，引用记录只可停用。

## 9. 出入库字段追加

出库单主表：bill_type（默认销售出库）、container_no（柜号）、ship_to_name、ship_to_phone、ship_to_address；business_date 复用011。
出库明细：product_model、contract_no、memo。
入库单主表：bill_type（默认采购入库）、delivery_name、delivery_phone；business_date 复用011。
入库明细：product_model、memo。

本阶段单据类型：入库 采购入库/其他；出库 销售出库/样品出库/其他。样品出库是整包/整批实际离仓，按出库确认扣库存并计出库量；取样是独立sample_marks标记、不扣库，不能通过bill_type混入。退货/RMA后置，不能用「其他」绕过；移库用纠错转移单；编号统一 RK/CK。

011 已有业务日期列，禁止重复 ADD COLUMN。默认上海当天、不得未来、超过3个日历月需确认并留审计；未入账修改复用专用 PATCH，限本地待确认入库/open出库，frozen已锁定，历史NULL保留。入账后日期更正另属B5d的追加式日期历史；数量更正不带日期、不改原日期。

## 10. 接口

沿用 /api/v1/master-data/{products,warehouses,customers,suppliers}；扩展 categories、vehicles、contacts（静态路由先于 :catalog）。
GET/POST /api/v1/master-data/contacts?partyType=&partyCode=
PATCH/DELETE /api/v1/master-data/contacts/:id（删除仅未引用且非默认）
PUT /api/v1/master-data/contacts/:id/default
POST /api/v1/master-data/vehicles/:id/merge（目标ID、版本、原因、幂等键）
写接口使用严格字段白名单；分页与筛选参数遵循 WEB_UX_SPEC。

上述扩展**需要新增服务能力**，当前通用主数据只有code/name等基础字段，不宣称已有联系人/车辆接口。`M-MASTER` 增加资格/分类/联系人/默认/车辆/别名/使用关联，`M-DOCUMENT-SNAPSHOTS` 增加头行快照与联系字段；对应B6a，真实迁移号实施时从012顺排。up保留原列与来源指纹，down在新增字段或表已有业务值时拒绝；不覆盖001–011。

## 11. 边界

| 情况 | 处理 |
|---|---|
| 编码重复 | 422 MASTER_CODE_EXISTS |
| 停用被引用 | 422，返回引用单号 |
| 商品停用后历史单 | 显示名称快照 |
| 车牌格式非法 | 422 |
| 并发新增同一车辆 | 唯一索引，冲突复用 |
| 编辑 legacy 数据 | 允许，审计标记「修改历史导入资料」 |

## 12. 验收

1. 新增商品后立刻可选；
2. 停用商品后选不到，历史单据仍显示；
3. 同一客户 3 个收货人：设默认、切换、停用各一次，出库单默认带出正确；
4. 保存后改默认，历史单据字段不变；
5. 输入新车牌保存出库单，车辆表自动新增 source=auto；
6. 再次输入可模糊匹配；
7. 停用车牌出现启用提示；
8. 三类错误均 422 且库不变；
9. 1440/1280 截图（列表、编辑抽屉、收货档案抽屉）。

修订记录：C01 补来源与库存资格映射、统一守卫及移除PRODUCT_MASTER_READ_ONLY前置条件。
修订记录：C03 补联系人真实外键/默认唯一、车辆规范键/别名/使用关联和事务幂等。
修订记录：C04 复用011，区分冻结日期锁定与入账后日期更正。
修订记录：C05 补头行名称/联系/车辆快照及停用守卫；样品出库与取样分开，退货后置。
修订记录：C16 沿用master-data路由及公共查询契约，新增迁移与接口标为待实现。
