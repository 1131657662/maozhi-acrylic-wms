# PDA 参考

## 1. 已确认

```text
现有 V10 界面/交互可以保留
只做出库扫码
PDA 不直接修改库存
PDA 冻结/提交不等于出库
保持 Kotlin + Room + 离线队列 + 分批补传形式
```

## 2. 界面截图

```text
docs/handoff/pda/screens/
```

优先看：

```text
v10-accept-home.png          首页/当前作业
v10-accept-plans.png         扫码计划
v10-accept-claim.png         领取计划
v10-accept-scan.png          连续扫码
v10-accept-records.png       扫码记录
v10-accept-diff.png          差异核对
v10-accept-complete.png      完成页
v10-offline-plan.png         离线计划
v10-offline-scan-success.png 离线扫码成功
v10-offline-sync-fail.png    同步失败
v10-offline-sync-retry.png   重试
v10-offline-sync-success.png 同步成功
v10-offline-sku-page.png     SKU 管理
v10-offline-sku-guard.png    SKU 拦截
v10-operator-home.png        操作员首页
v10-readonly-home.png        只读首页
```

## 3. 源码参考

```text
D:\wms-new\wms-pda\app\src\main\java\com\jinglun\wmspda\ui
D:\wms-new\wms-pda\app\src\main\java\com\jinglun\wmspda\scan
D:\wms-new\wms-pda\docs\V10_HANDOFF_20261105.md
D:\wms-new\wms-pda\docs\2B-2-WEIGHT-RUNNING-EVIDENCE.md
```

关键类：

```text
V10MainActivity
V10ScanActivity
V10RecordsActivity
V10DiffActivity
V10CompleteActivity
V10OfflineActivity
V10OfflineCreateActivity
V10OfflineScanActivity
V10SyncResultActivity
V10SkuActivity
V10SettingsActivity
ScanRepository
OfflineFactStore
SubmissionRepository
```

## 4. 页面形式

```text
作业首页：当前作业/扫码计划/离线计划/待同步
扫码计划：未领取/进行中/待补扫/已完成
连续扫码：大按钮/条码/重量/进度
记录：选择/导出/删除确认
差异：短装/超发/确认
完成：只读
离线：本机计划/逐单扫码/同步结果
SKU：本地版本/USB 导入/云端更新
设置：账号/服务器/版本/退出
```

## 5. 目标接口

```text
wms-backend /api/scan
  /plans
  /plans/:id
  /plans/:id/tasks
  /plans/:id/facts
  /plans/:id/submit
  /plans/:id/release
  /plans/:id/cancel
  /catalog
```

当前生产缺口：

```text
wms 库没有 scan_plan/scan_fact/scan_submission
PDA 现在只连 /api/slice
```

## 6. 库存边界

```text
允许：
  scan_fact
  plan 汇总
  frozen

禁止：
  /api/stock/*
  /api/outbound/order/:id/audit
  任何直接扣库存
```

Web 审核/确认后才扣库存并写 `stock_journal`。

## 7. 新项目重写要求

```text
新 Android 工程
不复制旧 Activity/Repository
保留已确认 UI/交互
Kotlin + Room
离线优先
幂等/版本/冻结摘要
设备/操作人/条码/重量/时间审计
```

## 8. 不要做

```text
不要重做 UI 风格
不要加入入库/盘点/移库/拣货
不要让 PDA 扣库存
不要接 warehouse-server
不要直接复制旧代码
```
