# 资产清单（只读参考）

> 所有条目的源码都是**参考**，不是复制源。  
> 新项目只复制文档与核准的运行验收截图到 `docs/references/`；源码用绝对路径读取。旧 Web 设计导出已废弃，不得作为视觉或布局依据。

---

## 1. 设计资产

| 资产 | 路径 | 数量 | 用途 |
|---|---|---:|---|
| PDA 截图 | `D:\JingLunWMS\docs\handoff\pda\screens` | 40 | V10 界面/离线/差异/完成 |
| PDA 交接 | `D:\JingLunWMS\docs\handoff\pda\V10_HANDOFF_20261105.md` | 1 | V10 结构说明 |

## 2. 当前开发资产

### 新 Web（React，当前已开发）

```text
D:\JingLunWMS\apps\wms-web-next
```

包含：

```text
登录/会话
入库
出库
手工实际出库
CSV 模板/上传/解析
车辆确认
标签/打印
部分主数据/报表/库存
Playwright E2E
```

用途：参考已确认字段/交互；**不复制**到新项目。

### 旧 Vue（生产 ERP 前端）

```text
D:\wms-new\wms-frontend-pure
```

当前工作分支：

```text
rebuild/vertical-slice-2026-11-01  4795e07
```

生产分支：

```text
origin/master  878bbc6
```

用途：旧页面/路由/字段/权限参考；不作为新 UI 基础。

### 后端

```text
D:\wms-new\wms-backend
```

当前工作分支：

```text
rebuild/vertical-slice-2026-11-01  abf7fba
```

生产分支：

```text
origin/master  982dd75
```

用途：API/业务/表结构参考；**不复制**控制器/服务代码。

### 小程序

```text
D:\wms-new\wms-miniapp
```

当前工作分支：

```text
rebuild/miniapp-synthetic-query-2026-11-03  5fb9c0c
```

生产分支：

```text
origin/main  a82b00e
```

用途：当前页面/API/交互参考；新项目重写。

### PDA

```text
D:\wms-new\wms-pda
```

当前分支：

```text
rebuild/vertical-slice-2026-11-01  9ae1099
```

用途：V10 页面/离线队列/扫码事实参考；新项目重写，保留 UI/交互方向。

## 3. 生产事实资产

```text
docs/PROJECT_REFACTOR_SPEC.md
docs/production-scan/API_WMS.md        173 条
docs/production-scan/API_SCAN.md       13 条
docs/production-scan/SCHEMA_WMS.md     33 张表全字段
docs/production-scan/SCHEMA_WAREHOUSE.md 仅参考，不纳入
```

生产数据摘要：

```text
wms.inbound_order        114
wms.outbound_order       414
wms.stock                121
wms.stock_journal        825
wms.sys_operation_log    74,494
wms.sys_user             12
wms.sys_role             4
```

## 4. 服务器资产

详见 `SERVER_REFERENCE.md`。只记录路径/架构/接口，不记录密码。

```text
ERP 入口：https://erp.nbsmzwl.cn
旧前端：/var/www/html
后端：/home/wms-backend :3000
数据库：wms
PM2 + Nginx + MySQL + JimuReport
```

## 5. 新项目复制规则

复制到新项目：

```text
docs/handoff/*.md
docs/handoff/pda/screens/*.png
docs/production-scan/API_WMS.md
docs/production-scan/API_SCAN.md
docs/production-scan/SCHEMA_WMS.md
docs/TARGET_SYSTEM_DESIGN.md
```

不要复制：

```text
旧 Vue src/
旧 React src/
旧后端 src/
旧小程序源码
旧 PDA 源码
旧构建产物
```

## 6. 版本纪律

```text
生产契约以 origin/master 为准
当前开发 UI 以本地工作分支为准
两者冲突时先记录差异，不直接以本地为准
PDA 没有生产版本，只有本地试点
```
