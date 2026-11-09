# Web 参考

## 1. 当前新 Web

```text
D:\JingLunWMS\apps\wms-web-next
```

技术：

```text
React 19
Umi Max 4
Ant Design 6.6.x
ProComponents 3.x
TypeScript
```

已有页面/能力：

```text
登录
入库列表/新建/详情
出库列表/新建/详情
手工实际出库
CSV 模板下载/上传
车辆确认
标签/打印
部分库存/报表/主数据
```

已有测试：

```text
单元测试：CSV 解析/校验
Playwright：CSV 上传、标签
```

用途：

```text
参考已确认字段和交互
参考 AntD 6 / ProComponents 用法
参考 CSV 实际出库流程
参考测试用例
```

## 2. 旧 Vue

```text
D:\wms-new\wms-frontend-pure
```

用途：

```text
旧路由/页面/字段对照
旧权限/菜单对照
旧 API 调用方式参考
```

不要复制：

```text
Vue 页面
Element Plus 组件
pure-admin 布局
旧样式
```

## 3. Web 设计依据

```text
旧 Web 设计导出已废弃，不得引用或作为视觉、布局依据。新 UI 以旧系统信息架构和 Ant Design Pro 设计语言为准。
```

## 4. 目标结构

```text
apps/web
  src/
    pages/
    components/
    services/
    hooks/
    stores/
    layouts/
    styles/
    types/
```

## 5. 保留的业务交互

```text
入库：包数 + 吨数，不扫码
出库：计划 + 审核 + 库存扣减
手工实际出库：行级 actual_qty / actual_weight
CSV：模板/上传/校验/回填
车辆确认
标签/打印
```

## 6. 需要升级

```text
ProTable 统一列表
ProForm 统一表单
ProDescriptions 统一详情
TanStack Query 缓存
Zod 响应校验
统一权限/错误
异步导出
列配置持久化
1280/1440
```

## 7. 不要做

```text
不要复制旧 Vue
不要把 apps/wms-web-next 整体搬过去
不要保留前端全量分页
不要页面内直接 fetch
不要多套状态副本
```
