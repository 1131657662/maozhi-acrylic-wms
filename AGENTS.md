# 项目工作约束

- 正式产品名：茂智云仓 · 腈纶仓储管理系统；简称：茂智腈纶仓；英文：Maozhi Acrylic Fiber WMS。业务品类为腈纶，中文不得误写为亚克力。
- 本项目四端全新实现。`docs/references` 与旧项目绝对路径均只读；不得复制旧业务源码。
- 单用户：保留身份验证、操作日志、数据校验、备份恢复；不建立多租户、组织权限、复杂 RBAC 或多级审批。
- 入库只录包数和总吨数，不扫码，不通过统一件重推算总重量。
- PDA 只写扫码事实；冻结不是出库。库存只能通过 Web 明确确认链路，在同一事务中写扣减、流水与审计。
- 每个扫码事实 UUID 和正文不可变；重试保留原 UUID/正文；不静默丢弃离线或冲突记录。
- 当前仅本地合成数据。不要配置生产连接、执行生产写入、删除历史数据或修改 warehouse 系统。
- 不明确的业务规则写入 `docs/IMPLEMENTATION_PLAN.md`；真实业务冲突或库存正确性风险才阻断相关工作。
- 常规技术决策直接实现、测试；不为常规实现反复请求批准。
- 文档必须区分代码完成、构建通过、模拟器验证与实体设备/生产验收。

## 开发命令

- `npm run dev`：Web 5173、API 4310，本地合成库。
- `npm run test`：API 与小程序测试。
- `npm run build`：严格类型检查与 Web 构建。
- `npm run test:e2e`：独立内存 API 4311 + Web 5174。
- `npm run miniapp:prepare`：准备小程序依赖发行资源。
- `npm run openapi`：更新生成契约文档。
- `apps/pda/gradlew.bat -p apps/pda assembleDebug testDebugUnitTest lintDebug`：Android 验证。
- 测试不得连接生产、清理真实作业队列或复用用户数据进行破坏性重置。
