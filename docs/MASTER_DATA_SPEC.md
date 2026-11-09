# 基础资料规范（MASTER_DATA_SPEC）

> 本文档中的状态、类型、结果等库值仅作实现标识；界面显示必须按 docs/UX_STANDARDS.md 映射为中文。

## 0. 前提

- 本系统替代老系统，是主数据唯一来源；老系统仅作一次性历史导入。
- 本文件取代 B4a 的「商品只读」结论：商品由本系统维护。
- source_kind：local（本地新建）/ legacy（历史导入）/ sku-spec（条码目录，不在此页）。
- 与 B4a 的衔接：B4a 曾以 `PRODUCT_MASTER_READ_ONLY` 关闭商品写入；本规范放开商品维护，
  实现该批次时移除该限制、保留审计与停用校验，并在验收中确认「新建商品可立即用于入库」。

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

收货档案（party_contacts，party_type=customer）：name、phone、address、is_default、status。
- 每客户最多一条默认；
- 设默认自动取消其他默认；
- 被单据引用过则只能停用，不能删除；
- 修改档案不影响历史单据。

## 6. 供应商

字段与客户对称；送货联系人共用 party_contacts（party_type=supplier）。

## 7. 车辆

字段：plate（唯一、去空格转大写、5–10 字符）、driver、phone、status、source（manual/auto）、use_count、last_used_at、memo。

规则：
- 唯一允许隐式建档的对象：出库单保存时车牌不存在则自动创建（source=auto），写审计；
- 已停用车牌被输入时提示启用，不静默接受；
- 车辆页可编辑、停用、合并重复车牌。

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

## 9. 出入库字段追加

出库单主表：bill_type（默认销售出库）、business_date、container_no（柜号）、ship_to_name、ship_to_phone、ship_to_address。
出库明细：product_model、contract_no、memo。
入库单主表：bill_type（默认采购入库）、business_date、delivery_name、delivery_phone。
入库明细：product_model、memo。

单据类型取值：入库 采购入库/退货入库/其他；出库 销售出库/样品出库/退货出库/其他。
类型仅作分类，不驱动库存逻辑；移库用独立转移单；编号不按类型分前缀，统一 RK/CK。

## 10. 接口

/api/v1/master/{products,categories,warehouses,customers,suppliers,vehicles}
/api/v1/master/contacts?partyType=&partyCode=
PUT /api/v1/master/contacts/:id/default
写接口使用严格字段白名单；分页与筛选参数遵循 WEB_UX_SPEC。

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
