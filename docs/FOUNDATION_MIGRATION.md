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


## 005_inventory_posting（B1a 第 3 提交，2026-11-08）

- up 新增 `inventory_operations`（UUID、类型、目标、原因、操作人、时间），入库 `posting_state`/确认操作 ID，流水 operation_id 和包数/吨数前后值；外键防误删操作，CHECK 校验新流水完整性及 delta。
- 历史入库只在新列默认 `legacy`，不改原 status；历史出库 status 不变；旧流水前后值从保留的原快照读取，不生成虚构操作 UUID。库存不重新计算、不重放历史单据。
- 本机 3307 样本库执行前备份保存在 `.local/backups/maozhi-1794105428856.sql`，文件大小/SHA-256 记于 `.local/evidence/b1a3-local-migration.log`。随后 up 已完成，原状态/库存/原流水/审计/幂等数据指纹未变。本轮没有在主开发库造测试单据。
- 可复跑：`npx tsx scripts/mysql/migrate.ts up`（只读本机隔离配置），`npx tsx --test apps/api/tests/inventory-migration.test.ts`（独立临时库测试 down/up），`npx tsx scripts/verify-posting-compatibility.ts`（在临时库导入本地只读样本验证历史，不连接生产）。
- 空表 down 删除本迁移新增结构后可重新 up；非空 `inventory_operations`、`inbound_receipts` 或 `stock_journal` 任一项阻止 down，迁移状态和数据完整保留。拒绝输出见 `.local/evidence/b1a3-test.log`。
- MySQL DDL 非事务：迁移中断保留 applying 状态并拒绝盲重试，先对照实际表结构检查，不能直接删除迁移记录。发布前停止本地写服务，备份并校验，再 up、启动新代码；不得旧新写服务混跑。
- 回滚：没有业务数据的新库可以停止服务、down 后回退代码。有历史/新写入的库不得执行破坏性 down，也不能直接退回“创建即入账”的旧写服务。应停止写入，保留现库与备份，优先前向修复；必要时将迁移前备份恢复到独立库核对，再安排切换。若已有新操作，先保全增量，不能丢弃新操作来换回旧版本；本批不实施撤销/作废/业务补偿。
- 本轮实际完成：本机迁移、临时库历史兼容与回滚防护演练；没有生产迁移、实体设备或生产验收。备份文件产物及 SHA 已检查，本轮未宣称完成完整恢复演练（备份可验证性升级仍按原排期）。
