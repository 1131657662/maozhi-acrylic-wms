# 升级与优化方向

> 这些是建议方向，不是要求逐条照做。Codex 应先提出自己的架构方案，并说明取舍。  
> 旧实现只用于理解业务，不要因为旧代码这样写就继续这样写。

---

## 1. Web 前端

### 现状问题

```text
Vue + Element Plus 旧页面重业务、轻组件化
表格/筛选/表单/导出各页面重复实现
权限主要在菜单层
错误提示不统一
部分页面长表单、行级错误弱
大表格/大列表性能一般
```

### 新方案

```text
Ant Design Pro V6.0.6
React 19 + Ant Design 6 + ProComponents
TanStack Query
Zod
统一 request client
统一设计 token
```

### 具体优化

```text
1. 用 ProTable 统一列表：分页/筛选/列设置/批量/导出
2. 用 ProForm/DrawerForm/ModalForm 统一表单
3. 用 ProDescriptions 统一详情
4. 用 TanStack Query 管理缓存/失效/重试
5. 用 Zod 做响应校验，避免后端字段漂移
6. 统一 401/403/409/422/500 错误映射
7. 统一按钮级权限 + 路由级权限
8. 异步导出/打印，避免长请求
9. 表格列配置持久化
10. 关键页面 1280/1440 断点
11. 错误边界 + 空态/骨架屏
12. 统一日期/重量/包数格式
```

### 不要做

```text
不要复制旧 Vue 页面结构
不要用前端全量分页替代服务端分页
不要页面内直接 fetch
不要多套重复状态
```

---

## 2. 后端

### 现状问题

```text
Express 控制器较厚
手写校验多
接口无 OpenAPI
错误码不统一
部分查询 LIKE 全表
日志缺少 traceId
审计/权限分散
PDA scan 域和库存域边界未落地
```

### 新方案

```text
Node.js 22
Express 5 或等价现代框架
模块化 + service + repository
Zod
OpenAPI 3.1
统一错误码
traceId
事务/幂等/乐观锁
```

### 具体优化

```text
1. 按领域拆模块：auth/basic/inbound/outbound/stock/stock-check/report/scan/system
2. Controller 只做 HTTP，业务进 service
3. Repository 负责查询，复杂 SQL 可解释/可测
4. 所有写接口 Zod 校验
5. 统一响应 { code, message, data, traceId }
6. 统一 400/401/403/404/409/422/500
7. 关键写操作事务 + 幂等键
8. 单据审核/撤销用乐观锁
9. 审计日志记录 before/after
10. 列表查询走索引，避免 %keyword%
11. 慢查询日志 + 连接池上限
12. OpenAPI 自动生成前端类型
13. PDA scan 域只写 scan_*，不写 stock
14. 出库审核仍由 outbound 域扣库存
```

### 数据迁移

```text
新后端先兼容现有 wms 表
scan 表新增
新增字段可空/有默认值
迁移脚本 up/down
先只读比对，再切写
不删除历史数据
```

---

## 3. PDA

### 已确认

```text
现有 V10 界面/交互可保留
只做出库
不直接改库存
```

### 重写建议

```text
新 Android 工程
Kotlin
Room
Retrofit/OkHttp
WorkManager
```

### 具体优化

```text
1. 扫码事实与 UI 状态分离
2. 离线队列持久化 + 幂等键
3. 同步状态机 pending/syncing/synced/failed/conflict
4. 计划版本 + facts_digest 冻结
5. 设备号/操作人/时间/条码/重量审计
6. 扫码成功/失败/重复/超发/短装明确反馈
7. 大按钮/高对比/单手操作
8. 弱网/断网/重启恢复
9. 不在 PDA 暴露库存修改
10. 扫码事实只走 /api/scan，不调 /api/stock
```

### 不要做

```text
不要重做 UI 风格
不要把库存扣减塞进 PDA
不要复制旧 PDA 的 Activity/Repository
```

---

## 4. 微信小程序

### 现状

```text
查询为主
页面/错误/单位不统一
缺少待办/扫码状态
```

### 重写建议

```text
微信原生 + Vant Weapp
TypeScript/模块化（按团队能力）
统一 request / 错误 / 空态
```

### 功能升级

```text
P0：库存/入库/出库查询，单位统一，详情字段对齐
P1：待办、PDA 扫码状态、库存预警、消息、打印/分享
P2：报表摘要、常用筛选、只读离线缓存
```

### 不要做

```text
不换跨端框架
不做 PDA 扫码作业
不直接写库存
不复制旧页面结构
```

---

## 5. Codex 必须先输出的方案

```text
1. 新项目目录结构
2. 四个端的技术选型与理由
3. API/数据库兼容策略
4. PDA scan 与库存边界
5. 小程序升级范围
6. 分阶段计划
7. 验收标准
8. 风险与回滚
```

如果 Codex 有更好的方案，可以提出，但必须说明与旧实现的差异、迁移成本和回滚方式。
