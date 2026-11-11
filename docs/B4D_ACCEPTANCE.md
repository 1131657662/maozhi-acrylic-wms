# B4d 人工实发与发货 #1 验收（2026-11-11）

## 环境与范围

分支 `codex/b4d-manual-outbound`；从已合并推送的 B6c `2f3f3136b5f8a259868a2f11737d001dcd40b7fd` 继续。
仅随机 `maozhi_test_*` 本地 MySQL 合成库与 Chromium。未对开发样本库应用 016，未连接生产，未做实体 PDA/小程序设备验收。

实现：人工实发确认、第 1 条发货、确认时扫码快照、同商品多行按顺序预填、差异确认、扫码清单 XLSX；更正明细按原单行唯一（已获用户确认）。
本批保留 frozen 兼容；扫码状态拆分、scan_closed_at、多批发货/短关、强制溢发原因、更正发货行关联、Web 清点工作台留后续。外部排期增量不代表已实现。

## 验证

最终完整验证：`npm run test` exit 0（252/252）；`npm run build` exit 0；`npm run test:e2e` exit 0（主 108/108 + catalog 9/9）。构建日志含 dist 生成提示，无错误；Ant Design lint issues 0。
初查失败记录保留：旧测试使用扫码作为实发、PDA响应新增展示值、005历史库没有发货表；修正测试适配并保留原安全断言。额外发现更正明细原主键不能容纳同商品多行，经用户确认调整并补测。

原始证据均在 `.local/evidence/`：`b4d-test.log`、`b4d-build.log`、`b4d-e2e.log`、`b4d-openapi.log`、`b4d-antd-lint.json`、`b4d-explain.log`。

## 原始结果

```text
B4D_MANUAL scan=1/302500g actual=1/200000g stock=5/1600000g shipment=1 late_scans=2 unchanged=true replay=1
B4D_CONCURRENCY requests=10 shipments=1 journals=1 success_events=1 no_scan=true changed_body=409
B4D_VALIDATION status=422 field=["lines",0,"actualWeightGrams"] shipments=0
B4D_ALLOCATION scan=50 plan=40/30 prefill=40/10 grams=12100000/3025000 posted=1/0 journal_rows=1 reversal_allowed=true
B4D_XLSX rows=2 packages=2 kg=600 tonnes=0.6000 fields_equal=true
B4D_ROLLBACK shipment=0 snapshot=null stock_unchanged=true journal=0 success_event=0
B4D_CORRECTION lines=2 confirm=2/400000g corrected=4/600000g reversed_net=0 shipment_immutable=true
B4D_LEGACY shipments=0 detail=2/600000g list=2/600000g
B4D_E2E prefill=2/0.6000 actual=1/0.2000 stock=5/1.6000 exported=2/0.6000 scrollWidth=1280 clientWidth=1280
```

单元测试的人工值与 E2E 都使用自建合成夹具，不与开发样本库商品 130 数据混用。单行零实发允许；全零、空实发、重复行、跨单行拒绝。预填 50 包由 50 条真实扫码写入后 GET 验证，包含重量合计；另有舍入差与尾部零行验证。

## 迁移与回退

016 新增 outbound_shipments / outbound_shipment_lines、outbound_lines.scan_packages / scan_weight_grams / line_position。
同时把 document_correction_lines 主键改为 (correction_id, original_line_id)，原有行由 inbound_line_id/outbound_line_id 回填，并约束两者一致。旧证据值不改；更正关联发货行仍留 B5c。

- 空库 up→down→up：发货表与更正行表结构相同。
- 发货、扫码快照或新行序非空：down 拒绝，DDL 0，结构与数据指纹不变。
- 只有既有更正明细时：升级回填保留原值；down 拒绝，结构与数据不变。
- 未产生新数据时可停写后回退 016；非空时禁止删证据回退，须保留库并修复前进。升级前备份和开发样本库迁移应另行执行。

锁顺序保持库存写锁→单据锁；发货、库存、流水、状态、成功审计、幂等响应在同一事务。库存按商品汇总人工实发，包数与重量独立校验，不读扫码决定扣减。

## 页面与导出

1440/1280 截图：`.local/evidence/b4d-actual-{width}.png`、`b4d-confirm-{width}.png`、`b4d-confirmed-{width}.png`；已查看实发表格和确认弹窗。1440/1280 两种宽度均通过 scrollWidth ≤ innerWidth 断言；日志原始数值在 1280 为 scrollWidth=1280、clientWidth=1280。窄屏仅表格内部横向滚动，页面无横向溢出。
扫码下载：`.local/evidence/b4d-scan-list.xlsx`，条码/商品/包数/重量/时间/合计；登录 Web 专用、10 万上限、完整生成后响应。历史目录缺失按规格标注并计零；正常记录取不可变扫码重量，上海时区时间与屏幕一致。

## 查询计划与已知边界

独立小样本 EXPLAIN：按原单行取量使用 shipment_line_order，按订单汇总使用 shipment_order_seq + shipment_line_once；实际聚合分别约 0.029ms / 0.024ms。仅证明索引路径，不代表万单或十万行性能验收；大规模性能专项仍单独开展。

旧已确认/已撤销而无发货记录的单据保留原扫码数量读法，不补造历史发货；确认后补传只开放本批已有发货记录的 confirmed 单，不改变旧单数量。

提交后停止，B4d 不合并、不推送。
