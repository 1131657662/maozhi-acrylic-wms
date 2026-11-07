# 新项目启动说明（给 Codex）

> 本文件是**新项目目录**的入口。旧项目目录不会被继续开发。  
> 旧项目里的所有代码、设计、文档、服务器资产，只作为**参考**，不是复制源。

---

## 1. 任务性质

```text
新项目 = 全栈重写
不是迁移旧代码
不是复制旧页面
不是把旧仓库搬进新仓库
```

四个端全部重新实现：

```text
Web 前端
后端 API
微信小程序
Android PDA
```

要求：

```text
保留业务方向、数据含义、关键流程、已确认交互
重写实现
主动升级架构、性能、可维护性、可观测性、安全性、体验
不要照搬旧实现
不要因为旧代码这样写就继续这样写
```

---

## 2. 新项目建议结构

```text
<NEW_PROJECT_DIR>/
  apps/
    web/                 Ant Design Pro V6.0.6
    api/                 Node.js 新后端
    miniapp/             微信小程序（重写）
    pda/                 Android Kotlin（重写）
  packages/
    shared/              共享类型/常量/字典
    api-contract/        OpenAPI/Zod schema
  docs/
    references/          从旧项目复制过来的参考文档/截图（只读）
  infra/
    nginx/
    migrations/
  README.md
```

参考资产放在：

```text
docs/references/
```

只复制：

```text
设计 PNG
PDA 截图
接口/表结构文档
业务规则
旧项目路径清单
```

不要复制：

```text
旧 Vue src
旧 React src
旧后端 src
旧小程序源码
旧 PDA 源码
```

---

## 3. 先读什么

```text
1. 本文件
2. docs/references/handoff/README.md
3. docs/references/handoff/ASSET_MANIFEST.md
4. docs/references/handoff/UPGRADE_DIRECTIONS.md
5. 旧项目绝对路径下的源码/设计（只读）
```

旧项目路径：

```text
D:\JingLunWMS\docs\handoff
D:\JingLunWMS\docs\TARGET_SYSTEM_DESIGN.md
D:\JingLunWMS\apps\wms-web-next
D:\wms-new\wms-backend
D:\wms-new\wms-frontend-pure
D:\wms-new\wms-miniapp
D:\wms-new\wms-pda
```

> 新项目可以读取这些绝对路径；不要把旧项目整体复制进新仓库。

---

## 4. 必须保留的业务

```text
入库不扫码，只录包数 + 总吨数
每包重量可以不同，禁止统一件重反算总吨数
出库有计划/审核/库存扣减
PDA 只做出库扫码事实，不直接改库存
PDA 冻结/提交不等于出库
Web 审核确认才产生库存流水
旧 Vue 只作为回滚，不是新功能主线
warehouse-pc/server 不在范围
```

---

## 5. 必须升级的方向

### Web

```text
Ant Design Pro V6.0.6
React 19 + AntD 6 + ProComponents
TanStack Query + Zod
统一 ProTable/ProForm/ProDescriptions
服务端分页/筛选/排序
统一权限/错误/审计
异步导出/打印
1280/1440 适配
```

### 后端

```text
新代码库，不复制旧控制器
Node.js 22 + Express 5（或等价现代框架）
模块化/服务层/Repository
Zod 校验
OpenAPI 3.1
统一错误码/traceId
事务/幂等/乐观锁
审计日志
查询优化/索引
PDA scan 域与库存域隔离
```

### PDA

```text
新 Android 工程，不复制旧代码
保留已确认 V10 界面/交互
Kotlin + Room
离线优先
扫码事实只写 scan 域
不扣库存
设备/操作人/条码/重量/时间可追溯
```

### 小程序

```text
重写，不复制旧页面
保持微信原生 + Vant Weapp
查询/待办/扫码状态/消息/打印/分享
统一单位/错误/空态/权限
不做 PDA 作业，不写库存
```

---

## 6. Codex 的工作方式

```text
1. 先输出《现状理解 + 新项目架构提案 + 升级点》
2. 再输出《数据/API 兼容方案》
3. 再开始搭骨架
4. 每个端先做可运行最小闭环
5. 不一次性重写全部
6. 每个阶段有测试/验收
7. 遇到底层冲突才提问；不要问已拍板事项
```

需要主动提出替代方案，但必须说明：

```text
为什么旧实现不够好
新方案解决什么问题
迁移/兼容成本
回滚方式
```

---

## 7. 不要做

```text
不要复制旧项目源码
不要把旧 Vue 当新前端基础
不要把旧后端控制器搬过来
不要照搬旧小程序页面
不要照搬旧 PDA 代码
不要改 warehouse-*
不要 PDA 扣库存
不要入库扫码
不要静默假设
```
