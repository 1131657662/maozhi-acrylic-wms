# API 清单（由后端共享校验契约生成）

执行 `npm run openapi` 重新生成；完整输入/输出 schema 见 openapi.json。

| 方法 | 路径 | 客户端 | 说明 |
|---|---|---|---|
| GET | /api/v1/document-numbering | web | RK/CK 编号规则与非占号预览（北京时间） |
| PUT | /api/v1/document-numbering/{kind} | web | 修改序号宽度；拒绝撞号/溢出/过期版本，不重置计数 |
| GET | /api/v1/stock/journal | web | 最近库存流水；保留原始类型，排除软删 |
| GET | /api/v1/health | 公开 | 本地合成环境健康检查 |
| POST | /api/v1/auth/login | 公开 | 单用户登录；web 使用 HttpOnly Cookie，其他端返回 Bearer |
| GET | /api/v1/auth/me | any | 当前会话 |
| POST | /api/v1/auth/logout | any | 撤销当前会话 |
| GET | /api/v1/outbound | any | 出库列表；单号前缀筛选、服务端分页 |
| POST | /api/v1/outbound | web | 创建待扫码出库计划；不预占库存 |
| PATCH | /api/v1/outbound/{id} | web | 修改尚无扫码事实的待扫码计划 |
| GET | /api/v1/outbound/{id} | any | 出库详情与逐包实重 |
| POST | /api/v1/outbound/{id}/confirm | web | Web 唯一库存扣减入口；单事务确认 |
| GET | /api/v1/inbound | web | 入库记录分页查询 |
| GET | /api/v1/inbound/{id} | web | 入库单详情及商品总重量 |
| POST | /api/v1/inbound | web | 确认入库；包数、总吨数独立记录并一次增加库存 |
| GET | /api/v1/master-data/{catalog} | web | 查询商品、仓库、客户或供应商目录 |
| POST | /api/v1/master-data/{catalog} | web | 新增主数据 |
| PATCH | /api/v1/master-data/{catalog}/{code} | web | 更新主数据名称或启停状态 |
| GET | /api/v1/scan/plans | any | PDA 计划列表 |
| GET | /api/v1/scan/plans/{id} | any | 扫码计划及事实摘要 |
| GET | /api/v1/scan/catalog | any | 本地合成条码实重目录 |
| POST | /api/v1/scan/plans/{id}/facts | pda | 记录不可变扫码事实；同 UUID 同正文重试幂等 |
| POST | /api/v1/scan/plans/{id}/submit | pda | 冻结事实；校验 revision/digest；不扣库存 |
| GET | /api/v1/stock | any | 只读库存（包数、整数克） |
| GET | /api/v1/audit | web | 最近 100 条操作日志 |

统一响应 `{ code, message, data, traceId }`；重量整数克，吨数展示除以 1,000,000，保留四位小数。
Web 确认要求 Cookie + 允许的 Origin，PDA 与小程序 Bearer 会话不能确认库存。
列表参数 page/pageSize/status/keyword；结果 data.items/total/page/pageSize。详情含 lines/facts/digest。