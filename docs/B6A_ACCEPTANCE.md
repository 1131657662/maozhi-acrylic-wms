# B6a 主数据与单据快照验收

本文件中的测试/构建/本地库结果为上一轮 Agent 采集，本轮接续后尚未复跑。

日期：2026-11-10。范围：主数据维护、库存资格、往来联系人、车辆归一化、单据快照及迁移 012。目标库为本机 `127.0.0.1:3307 / maozhi_dev_sample`，不是生产库。

## 迁移与存量资格

012 在开发样本库应用前建立备份 `maozhi-1794239124962.sql`，SHA256 为 `DB8673F2D202DD697655C547545E4F783BEB09961476843C033A77AF0ACC6282`。备份恢复到独立库 `maozhi_restore_e4b4ef8db10f22a8`，没有覆盖开发库；恢复比较显示 `otherTablesEqual=true`。开发库应用后，原 37 张表及 001–011 迁移记录保持不变，旧 `business_date` 与新增历史快照列仍为 NULL。

迁移测试原始结果：

```text
B6A_MIGRATION {"up":"success","down":"success","reUp":"success",...}
B6A_MIGRATION_NONEMPTY ... "down":"refused","databaseUnchanged":true
```

开发库应用记录：

```text
012_VERIFIED {"originalTablesUnchanged":37,"oldMigrationsUnchanged":11,"oldBusinessDatesNull":true,"oldNewSnapshotsNull":true,"reportMatches":true,"eligibility":[{"origin_kind":"legacy","inventory_eligible":1,"total":"428"},{"origin_kind":"unknown","inventory_eligible":0,"total":"141"}],"migration":{"id":"012_master_data_snapshots","checksum":"226b1117cfc85b9683ff5480ccc3fb2a67e9d94ceaf6895a9f111272dd6fcf09","state":"applied",...}}
```

存量资格报告共 569 个商品：428 eligible、141 not-eligible，待用户确认的 app 商品为 0。每个商品的来源、资格、原因及引用证据已逐项保存；不可入库存清单见 `.local/evidence/b6a/product-ineligible.md`，完整机器报告见 `.local/evidence/b6a/product-eligibility.json`。ERP 商品固定映射为 `legacy/eligible`；sku-spec 和未知来源不授予资格；app 商品仅在没有库存行且没有进行中引用时映射为 `local/eligible`。没有按数据猜测资格。

空库 `up → down → up`、非空拒绝回退、原数据不变与旧日期保留的完整测试输出见 `.local/evidence/b6a/migration-test-fixed.log`。开发库前后指纹、迁移校验和应用输出见 `.local/evidence/b6a/012-preflight-final.log`、`012-dev-up.log`、`012-postflight.log`、`012-before.json`、`012-after.json`、`012-schema-before.json`、`012-schema-after.json`、`012-eligibility-applied.json`。备份/恢复记录见 `012-backup.log`、`012-restore.log`、`012-clone.log`。

## 功能验收

- 新建本地商品后可用于入库与出库；存在进行中出库计划时停用返回 422，`data.references` 给出单号，数据库指纹不变。四类引用守卫分别覆盖入库、出库、盘点快照和未完成调整；测试输出含单号、引用总数及 `databaseUnchanged=true`。
- 停用与建单共用 `app_meta.identity FOR UPDATE` 锁序。8 组并发结果均保持一致：停用先提交时建单返回 409；建单先提交时停用返回 422，不出现停用商品的新引用。
- 收货档案支持同一客户多个联系人、切换默认和停用；停用当前默认后只从仍启用的档案中默认带出。客户、商品和联系人改名后，历史单据读取到的名称、型号与收货人快照保持原值。
- 车牌在出库保存时按去空格、转大写、去特殊符号归一化。两个并发写入返回 `[200,200]`，只建一条 `浙A12345`、`source=auto` 的车辆记录；幂等重放未增加使用次数。没有增加别名表。
- 历史单据缺失的快照在详情、列表和 XLSX 一致显示「历史未记录」。详情中的主数据改名不回写旧值。
- 本地 Web 烟测：health、入库、出库、库存、盘点、编号、主数据、联系人、库存来源与报表读取成功；历史入库的 `businessDate=null`、`supplierName=历史未记录`。登录产生的会话/审计行变化单独记录。

关键原始结果摘录：

```text
B6A_VEHICLE_CONCURRENCY {"statuses":[200,200],"vehicles":[{"plate_normalized":"浙A12345","source":"auto","use_count":2}],"replayUseCount":2}
B6A_DISABLE_CREATE_RACE [{"disable":200,"create":409,...},{"disable":422,"create":200,...},...]
B6A_INPUT_GUARDS {"forbiddenFields":422,"foreignContact":422,"disabledVehicle":422,"emptyNormalizedPlate":422,"databaseUnchanged":true}
```

相关完整输出见 `.local/evidence/b6a/test-final.log`、`dev-smoke.log` 与 `api-acceptance.log`。主数据列表、编辑抽屉和联系人页面的 1440/1280 截图分别为 `master-list-1440.png`、`master-list-1280.png`、`master-editor-1440.png`、`master-editor-1280.png`、`contacts-1440.png`、`contacts-1280.png`，均位于 `.local/evidence/b6a/`。

## 回归验证

```text
npm run test       tests 179, pass 179, fail 0, exit 0
npm run test:e2e   main 57 passed; catalog 9 passed; exit 0
npm run build      TypeScript strict check and Umi production build; exit 0
```

原始日志：`.local/evidence/b6a/test-final.log`、`e2e-final.log`、`build-final.log`。Ant Design 检查 `antd-final.json` 为 `issues=[]`、`total=0`。这些结果代表代码、自动化和本地数据库验收，不代表实体 PDA、微信真机或生产验收。
