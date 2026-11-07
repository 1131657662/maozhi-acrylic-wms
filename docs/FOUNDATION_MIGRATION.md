# 基础迁移执行记录

2026-11-07：暂停新增业务页面，先迁移官方 Pro 工程及 MySQL 8。

用户已确认使用可核实的官方 Ant Design Pro **v6.0.3**，取代最初指定但官方仓库未发布的 v6.0.6。
官方来源：`ant-design/ant-design-pro`，标签 `v6.0.3`，提交 `adfd44085738ca953573a13322c1ba84aca8b9e3`。

## 执行顺序

1. 保留第一阶段只读参考资产；新开发库使用隔离 MySQL 8，不导入旧数据库文件。
2. 按官方 config/src/pages/src/services/src/components 结构迁入 Umi Max，使用内置 ProLayout。
3. 登录使用 ProForm；保留 ProTable、ProDescriptions 和既有出库业务行为。
4. 独立本机 MySQL 8 实例；开发与测试库隔离；迁移脚本 up/down。
5. 数据库重量使用 DECIMAL(12,4) 吨，外部接口继续整数克，转换不经过浮点舍入。
6. 在真实 MySQL 上验证事务回滚、重复/并发提交、审计、decimal 边界和迁移回退。
7. 构建、浏览器与客户端契约回归后交付验证记录，再继续第二阶段。

不连接现有 3306 服务，不接触生产。新的开发库固定使用本地 3307 隔离 MySQL 8 实例和明确合成数据；不自动导入旧库，也不删除历史数据。
