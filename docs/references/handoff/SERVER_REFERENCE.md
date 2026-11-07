# 服务器与数据参考

> 只记录架构、路径、接口、表结构；不记录密码/JWT/微信 Secret/OCR 密钥。

## 1. 生产入口

```text
ERP：https://erp.nbsmzwl.cn
旧前端：/var/www/html
后端：/home/wms-backend
端口：3000
数据库：wms
进程：PM2
Web：Nginx
报表：JimuReport，127.0.0.1:8085
```

另一个站点：

```text
wms.nbsmzwl.cn -> /var/www/wms-pc + /opt/warehouse-server + warehouse
```

该站点**不在本次范围**，不要合并、不要改库。

## 2. 生产版本

```text
wms-backend        master  982dd75
wms-frontend-pure  master  878bbc6
wms-miniapp        main    a82b00e
```

本地开发分支：

```text
wms-backend        rebuild/vertical-slice-2026-11-01  abf7fba
wms-frontend-pure  rebuild/vertical-slice-2026-11-01  4795e07
wms-miniapp        rebuild/miniapp-synthetic-query...  5fb9c0c
wms-pda            rebuild/vertical-slice-2026-11-01  9ae1099
```

查生产契约用 `origin/master`；查当前开发 UI 用本地工作分支。

## 3. 数据库

```text
wms 33 张表
```

关键行数：

```text
inbound_order         114
outbound_order        414
stock                 121
stock_journal         825
inbound_order_detail  180
outbound_order_detail 543
sys_operation_log     74,494
sys_user              12
sys_role              4
sys_permission        42
```

完整字段：

```text
docs/production-scan/SCHEMA_WMS.md
```

## 4. 接口

```text
ERP：173 条
PDA /api/scan：13 条
```

详见：

```text
docs/production-scan/API_WMS.md
docs/production-scan/API_SCAN.md
```

## 5. 角色

```text
ADMIN     系统管理员
OPERATOR  操作员
AUDITOR   审核员
READONLY  只读
```

生产 12 用户、4 角色、42 权限、11 用户角色关系。

## 6. 生产缺口

```text
wms 库没有 scan_plan/scan_plan_version/scan_plan_line/scan_task/scan_fact/scan_submission
/api/scan 路由存在但表未建
PDA 当前只连 /api/slice
PDA 缺少 /api/scan/catalog
```

## 7. 数据异常

```text
wms.supplier 0 行，但入库单引用 supplier_code
stock_check_order 0，stock_check_detail 47
inbound_order_detail 存在同 uuid 一正一软删
sys_operation_log 74k 无归档
```

## 8. 不要

```text
不要在文档/代码写生产密码
不要直接连生产写
不要改 warehouse-*
不要把本地 rebuild 差异当生产
不要删除历史数据
```
