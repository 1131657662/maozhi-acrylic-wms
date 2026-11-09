# Codex 交接包索引

> 这是给 Codex 的“先读这里”。
>
> **新项目是独立目录，四个端全部重写；旧项目只作为只读参考，不复制源码。**
> 目标不是从零问需求，而是基于现有资产理解业务后，重新设计并升级实现。

## 0. 新项目原则

```text
新目录：<NEW_PROJECT_DIR>
Web、后端、小程序、PDA 全部重新开发
旧代码只用来理解业务/交互/字段，不作为复制源
可以参考旧实现，但必须提出并实现升级
不照搬旧 Vue/旧后端/旧小程序/旧 PDA 代码
```

先读：

```text
docs/handoff/NEW_PROJECT_BRIEF.md
docs/handoff/UPGRADE_DIRECTIONS.md
```

## 1. 阅读顺序

```text
1. docs/handoff/NEW_PROJECT_BRIEF.md      新项目方式与边界
2. docs/handoff/UPGRADE_DIRECTIONS.md     四个端的升级方向
3. docs/handoff/README.md                 本文件：资产索引
4. docs/handoff/ASSET_MANIFEST.md         资产清单和版本
5. docs/TARGET_SYSTEM_DESIGN.md           新系统总体设计
6. docs/handoff/WEB_REFERENCE.md          当前 Web 参考
7. docs/handoff/PDA_REFERENCE.md          PDA 界面/代码/边界
8. docs/handoff/MINIAPP_REFERENCE.md      小程序现状与升级
9. docs/handoff/SERVER_REFERENCE.md       服务器/API/数据库
10. docs/handoff/pda/screens/             PDA 截图
11. docs/CODEX_GREENFIELD_PROMPT.md       主执行提示词
```

## 2. 已拍板，不要再问

```text
新项目独立目录，四个端全部重写
新前端：Ant Design Pro V6.0.6 + React + AntD 6 + ProComponents
新后端：沿用当前技术方向（Node/Express/Sequelize/MySQL），但代码重写，不复制
数据库：生产数据/表结构保留，新增 PDA scan 表
PDA：保留已确认 V10 界面/交互，代码重写，只做出库，不直接改库存
小程序：微信原生 + Vant Weapp 重写/升级，不换框架
旧项目：只读参考，不复制源码，不作为新功能主线
warehouse-pc / warehouse-server / warehouse 库：不在范围，禁止合并
```

业务规则：

```text
入库不扫码，只录包数 + 总吨数
每包重量可以不同，禁止统一件重反算总吨数
PDA 只产生扫码事实，不扣库存
库存只由 Web 出库审核/确认扣减
PDA 冻结/提交不等于出库
```

## 3. 资产位置

| 资产 | 位置 | 用途 |
|---|---|---|
| 当前新 Web（React） | `D:\JingLunWMS\apps\wms-web-next` | 当前已开发页面、交互、API 适配参考 |
| 旧 Vue 前端 | `D:\wms-new\wms-frontend-pure` | 旧页面/字段/权限参考；不作为新 UI |
| 后端 | `D:\wms-new\wms-backend` | 生产接口/业务逻辑参考 |
| 小程序 | `D:\wms-new\wms-miniapp` | 当前小程序源码 |
| PDA | `D:\wms-new\wms-pda` | 当前 Kotlin/Room/V10 界面 |
| PDA 截图 | `docs/handoff/pda/screens` | 40 张实机/验收截图 |
| PDA 交接说明 | `docs/handoff/pda/` | V10 交接、README |
| 服务器事实 | `docs/handoff/SERVER_REFERENCE.md` | 部署、API、DB，不含密码 |
| 全量 API | `docs/production-scan/API_WMS.md` | 173 条 |
| PDA API | `docs/production-scan/API_SCAN.md` | 13 条 |
| 全量字段 | `docs/production-scan/SCHEMA_WMS.md` | 33 张表 |

## 4. 版本说明

```text
后端本地工作分支  rebuild/vertical-slice-2026-11-01  abf7fba
后端生产 master   origin/master                       982dd75
前端本地工作分支  rebuild/vertical-slice-2026-11-01  4795e07
前端生产 master   origin/master                       878bbc6
小程序本地分支    rebuild/miniapp-synthetic-query...  5fb9c0c
小程序生产 main   origin/main                         a82b00e
PDA 本地分支      rebuild/vertical-slice-2026-11-01  9ae1099
```

**规则：**

- 查生产接口/字段，用 `origin/master` 或本文件中的生产审计结果。
- 查当前开发中的新 Web/PDA，用本地工作分支和 `apps/wms-web-next`。
- 不要把本地 `rebuild/*` 的差异当成生产事实。
- 不要修改生产代码来“对齐”本地。

## 5. 当前新 Web 资产

`apps/wms-web-next` 已有：

```text
登录/会话
入库列表/表单/详情
出库列表/表单/详情
手工实际出库
CSV 模板下载/上传/校验
车辆确认
标签/打印相关
部分主数据/报表/库存页面
Playwright E2E
```

它的价值：

```text
保留已确认的字段和交互
保留 CSV 实际出库流程
保留 AntD 6 / ProComponents 使用方式
保留测试用例
```

新项目目标：

```text
apps/wms-web-pro
Ant Design Pro V6.0.6 官方脚手架
不直接复制旧 Vue
可参考 apps/wms-web-next 的页面与测试
```

## 6. PDA 资产

现有 UI 已确认可保留。先看：

```text
docs/handoff/pda/screens/v10-accept-home.png
docs/handoff/pda/screens/v10-accept-plans.png
docs/handoff/pda/screens/v10-accept-scan.png
docs/handoff/pda/screens/v10-accept-diff.png
docs/handoff/pda/screens/v10-accept-complete.png
docs/handoff/pda/screens/v10-offline-*.png
```

源码：

```text
D:\wms-new\wms-pda\app\src\main\java\com\jinglun\wmspda\ui
D:\wms-new\wms-pda\app\src\main\java\com\jinglun\wmspda\scan
```

约束：

```text
只做出库
保持现有页面/队列/补传形式
只接 wms-backend /api/scan
不接 warehouse-server
不写库存
```

## 7. Web 设计依据

```text
旧 Web 设计导出已废弃，不得引用或作为视觉、布局依据。新 UI 以旧系统信息架构和 Ant Design Pro 设计语言为准。
```

## 8. 只在这些情况下提问

```text
1. 两份资产冲突（例如设计稿字段与生产 API 不一致）
2. 生产数据缺失导致无法判断
3. 需求涉及库存扣减/PDA 边界
4. 需要改 warehouse-*（默认拒绝）
5. 需要生产写操作/迁移窗口
```

不要问：

```text
“用什么前端框架”
“PDA 是否扫码”
“入库是否扫码”
“要不要合并 warehouse”
“PDA 是否扣库存”
“小程序是否换框架”
```

这些已经在本文件第 2 节确定。

## 9. 交付目标

```text
apps/wms-web-pro       新 AntD Pro V6 前端
wms-backend            现有后端 + /api/scan 补口
wms-pda                现有形式 + 只出库
wms-miniapp            现有框架上升级
docs/handoff           资产索引/设计参考
```

主执行提示词：

[`docs/CODEX_GREENFIELD_PROMPT.md`](../CODEX_GREENFIELD_PROMPT.md)
