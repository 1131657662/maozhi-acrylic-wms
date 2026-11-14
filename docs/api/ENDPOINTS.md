# API 清单（由后端共享校验契约生成）

执行 `npm run openapi` 重新生成；完整输入/输出 schema 见 openapi.json。

| 方法 | 路径 | 客户端 | 说明 |
|---|---|---|---|
| GET | /api/v1/outbound/{id}/shipments | web | 本单全部发货记录、待发与结单信息 |
| POST | /api/v1/outbound/{id}/shipments | web | 确认本次实发；发满自动结单，否则部分发货；库存、发货记录和审计同事务 |
| POST | /api/v1/outbound/{id}/complete | web | 所有明细待发为零时完成发货 |
| POST | /api/v1/outbound/{id}/short-close | web | 记录剩余数量与原因并短关；不变库存 |
| PATCH | /api/v1/outbound/{id}/plan | web | 计划中或部分发货时修改现有计划行；已发记录不变 |
| GET | /api/v1/outbound/{id}/scan-candidates | web | 本单商品候选，片段至少四位；无可靠映射需人工确认归属 |
| GET | /api/v1/outbound/{id}/scan-summary | web | 未撤销清点记录的计划、已录、差额及商品汇总 |
| POST | /api/v1/outbound/{id}/scan-records | web | 按本单商品计入清点记录，不扣库存 |
| POST | /api/v1/outbound/{id}/scan-records/batch | web | 逐条独立提交，允许同批多商品与部分成功 |
| DELETE | /api/v1/outbound/{id}/scan-records/{recordId} | web | 仅未确认时撤销；保留原始证据 |
| POST | /api/v1/outbound/{id}/scan-reopen | web | 重新扫码：仅未发货的计划中单据 |
| GET | /api/v1/outbound/{id}/prefill | web | 按商品汇总扫码并按计划行序分配；仅预填不扣库存 |
| GET | /api/v1/outbound/{id}/scan-records.xlsx | web | 完整生成本单扫码清单；含合计，上限十万条 |
| GET | /api/v1/audit/timeline | web | 最近 20 个业务对象及批量事件安全投影 |
| GET | /api/v1/audit/objects/{kind}/{targetId} | web | 按对象类型与主键继续加载记录（含失败尝试） |
| GET | /api/v1/audit/{id}/events | web | 对象事件游标分页 |
| GET | /api/v1/audit/{id}/related | web | 同次请求的安全摘要；不返回追踪号 |
| GET | /api/v1/audit/{id}/raw | web | 仅登录网页端读取脱敏原始数据；no-store；256 KiB/10 万条硬上限 |
| GET | /api/v1/audit/{id}/trace.json | web | 完整生成脱敏诊断 JSON 后下载；重新鉴权；100 MiB/10 万条硬上限 |
| GET | /api/v1/web/lists/audit/timeline | web | 最近 20 个业务对象及批量事件安全投影 |
| GET | /api/v1/web/lists/audit/objects/{kind}/{targetId} | web | 按对象类型与主键继续加载记录（含失败尝试） |
| GET | /api/v1/web/lists/audit/{id}/events | web | 对象事件游标分页 |
| GET | /api/v1/web/lists/audit/{id}/related | web | 同次请求的安全摘要；不返回追踪号 |
| GET | /api/v1/web/lists/audit/{id}/raw | web | 仅登录网页端读取脱敏原始数据；no-store；256 KiB/10 万条硬上限 |
| GET | /api/v1/web/lists/audit/{id}/trace.json | web | 完整生成脱敏诊断 JSON 后下载；重新鉴权；100 MiB/10 万条硬上限 |
| GET | /api/v1/audit/{id} | web | 结构化变化与关联摘要；无原始数据 |
| GET | /api/v1/me/list-preferences/{kind} | web | 当前登录身份的列偏好；未保存时返回空值 |
| PUT | /api/v1/me/list-preferences/{kind} | web | 保存当前登录身份的列偏好；空 columns 重置；旧版本按列键保留 |
| GET | /api/v1/master/{catalog} | web | 分页搜索资料；q优先、keyword兼容；商品/客户/供应商支持持久化拼音检索；scope=inventory仅库存资格商品 |
| GET | /api/v1/master/{catalog}/{code} | web | 按编码读取资料，含停用项 |
| POST | /api/v1/master/products | web | 新建资料；客户/供应商/仓库禁止传编码，由系统生成；商品/分类手工编码。可选幂等键重放返回原资料 |
| POST | /api/v1/master/categories | web | 新建资料；客户/供应商/仓库禁止传编码，由系统生成；商品/分类手工编码。可选幂等键重放返回原资料 |
| POST | /api/v1/master/warehouses | web | 新建资料；客户/供应商/仓库禁止传编码，由系统生成；商品/分类手工编码。可选幂等键重放返回原资料 |
| POST | /api/v1/master/customers | web | 新建资料；客户/供应商/仓库禁止传编码，由系统生成；商品/分类手工编码。可选幂等键重放返回原资料 |
| POST | /api/v1/master/suppliers | web | 新建资料；客户/供应商/仓库禁止传编码，由系统生成；商品/分类手工编码。可选幂等键重放返回原资料 |
| PATCH | /api/v1/master/{catalog}/{code} | web | 更新资料；停用检查四类进行中引用，422 data.references返回单号 |
| GET | /api/v1/master/contacts | web | 客户/供应商收送货档案与默认建议 |
| POST | /api/v1/master/contacts | web | 新增指定往来单位档案；可选 Idempotency-Key，同键同内容返回首次结果，不重复建档 |
| PATCH | /api/v1/master/contacts/{id} | web | 修改档案；停用同时清除默认，不改历史快照 |
| DELETE | /api/v1/master/contacts/{id} | web | 仅删除非默认且从未被引用的档案 |
| PUT | /api/v1/master/contacts/{id}/default | web | 同归属启用档案设默认，事务中替换唯一默认 |
| GET | /api/v1/master/vehicles | web | 按归一化车牌分页查询车辆 |
| GET | /api/v1/master/vehicles/{id} | web | 读取车辆档案 |
| POST | /api/v1/master/vehicles | web | 手工建档；归一化车牌唯一；可选 Idempotency-Key，同键同内容返回首次结果 |
| PATCH | /api/v1/master/vehicles/{id} | web | 修改司机、电话、备注及启停；不改历史单据车牌 |
| GET | /api/v1/master-data/{catalog} | web | 分页搜索资料；q优先、keyword兼容；商品/客户/供应商支持持久化拼音检索；scope=inventory仅库存资格商品 |
| GET | /api/v1/master-data/{catalog}/{code} | web | 按编码读取资料，含停用项 |
| POST | /api/v1/master-data/products | web | 新建资料；客户/供应商/仓库禁止传编码，由系统生成；商品/分类手工编码。可选幂等键重放返回原资料 |
| POST | /api/v1/master-data/categories | web | 新建资料；客户/供应商/仓库禁止传编码，由系统生成；商品/分类手工编码。可选幂等键重放返回原资料 |
| POST | /api/v1/master-data/warehouses | web | 新建资料；客户/供应商/仓库禁止传编码，由系统生成；商品/分类手工编码。可选幂等键重放返回原资料 |
| POST | /api/v1/master-data/customers | web | 新建资料；客户/供应商/仓库禁止传编码，由系统生成；商品/分类手工编码。可选幂等键重放返回原资料 |
| POST | /api/v1/master-data/suppliers | web | 新建资料；客户/供应商/仓库禁止传编码，由系统生成；商品/分类手工编码。可选幂等键重放返回原资料 |
| PATCH | /api/v1/master-data/{catalog}/{code} | web | 更新资料；停用检查四类进行中引用，422 data.references返回单号 |
| GET | /api/v1/master-data/contacts | web | 客户/供应商收送货档案与默认建议 |
| POST | /api/v1/master-data/contacts | web | 新增指定往来单位档案；可选 Idempotency-Key，同键同内容返回首次结果，不重复建档 |
| PATCH | /api/v1/master-data/contacts/{id} | web | 修改档案；停用同时清除默认，不改历史快照 |
| DELETE | /api/v1/master-data/contacts/{id} | web | 仅删除非默认且从未被引用的档案 |
| PUT | /api/v1/master-data/contacts/{id}/default | web | 同归属启用档案设默认，事务中替换唯一默认 |
| GET | /api/v1/master-data/vehicles | web | 按归一化车牌分页查询车辆 |
| GET | /api/v1/master-data/vehicles/{id} | web | 读取车辆档案 |
| POST | /api/v1/master-data/vehicles | web | 手工建档；归一化车牌唯一；可选 Idempotency-Key，同键同内容返回首次结果 |
| PATCH | /api/v1/master-data/vehicles/{id} | web | 修改司机、电话、备注及启停；不改历史单据车牌 |
| GET | /api/v1/corrections/{id} | web | 查询更正单与原单引用 |
| POST | /api/v1/inbound/{id}/corrections | web | 只更正包数/吨数；原单版本互斥，历史/成环/盘点/负库存拒绝；原子写流水审计幂等 |
| GET | /api/v1/inbound/{id}/corrections | web | 查询原单更正链及抵消标记 |
| PATCH | /api/v1/inbound/{id}/business-date | web | 仅未锁定原单修改业务日期；未来/超期未确认/入账后修改422 |
| POST | /api/v1/outbound/{id}/corrections | web | 只更正包数/吨数；原单版本互斥，历史/成环/盘点/负库存拒绝；原子写流水审计幂等 |
| GET | /api/v1/outbound/{id}/corrections | web | 查询原单更正链及抵消标记 |
| PATCH | /api/v1/outbound/{id}/business-date | web | 仅未锁定原单修改业务日期；未来/超期未确认/入账后修改422 |
| POST | /api/v1/inbound/{id}/date-corrections | web | 追加已入账业务日期更正；独立版本互斥与幂等，不改原日期或库存 |
| GET | /api/v1/inbound/{id}/date-corrections | web | 查询全部日期更正记录、独立版本与当前有效业务日期 |
| POST | /api/v1/outbound/{id}/date-corrections | web | 追加已入账业务日期更正；独立版本互斥与幂等，不改原日期或库存 |
| GET | /api/v1/outbound/{id}/date-corrections | web | 查询全部日期更正记录、独立版本与当前有效业务日期 |
| GET | /api/v1/web/reports/details | web | 出入库事件明细，默认入账口径；支持重述、截止时间与双水位、未归期及分类桥接，实际余额独立保留 |
| GET | /api/v1/web/reports/monthly | web | 仓库商品月报，支持入账/重述及守恒桥接；实际余额不切换，无锚点的重述余额为 null |
| GET | /api/v1/web/reports/turnover | web | 吨数净出库除以完整日逐日日终平均库存，含调整盘点说明和对账诊断 |
| GET | /api/v1/web/reports/aging | web | 截止水位吨数 FIFO 库龄五档，未知余额独立显示并提供对账诊断 |
| GET | /api/v1/stocktakes | web | 盘点分页查询；status=counting 为暂停窗口常驻入口 |
| POST | /api/v1/stocktakes | web | 生成固定ERP库存快照并持久暂停同仓确认、调整、撤销 |
| GET | /api/v1/stocktakes/options/products | web | 按编码或名称查询ERP盘点商品，最多100条 |
| GET | /api/v1/stocktakes/{id} | web | 盘点头及固定快照/实盘摘要 |
| GET | /api/v1/stocktakes/{id}/lines | web | 盘点行服务端分页，最大200行 |
| PUT | /api/v1/stocktakes/{id}/lines/{product} | web | 按行实盘，版本校验及幂等，不改库存 |
| GET | /api/v1/stocktakes/{id}/preview | web | 差异与快照后未入账收发货，token绑定完整清单 |
| POST | /api/v1/stocktakes/{id}/post | web | 人工确认盘点回写，原因必填；未入账默认阻断，显式口径确认留审计；全事务释放窗口 |
| POST | /api/v1/stocktakes/{id}/void | web | 作废进行中盘点并释放窗口；不改库存不写流水 |
| POST | /api/v1/web/lifecycle/batch-reverse | web | 逐单事务撤销已确认单据；允许部分成功并返回每单原因 |
| GET | /api/v1/inbound/{id}/lifecycle | web | 误确认撤销/未入账作废预览；列出下游阻断证据 |
| POST | /api/v1/inbound/{id}/reverse | web | 原流水反向补偿；保留原单与事实，不涉及实物退货 |
| POST | /api/v1/inbound/{id}/void | web | 仅可证未入账且无现场下发风险单据作废；原号不复用 |
| GET | /api/v1/outbound/{id}/lifecycle | web | 误确认撤销/未入账作废预览；列出下游阻断证据 |
| POST | /api/v1/outbound/{id}/reverse | web | 原流水反向补偿；保留原单与事实，不涉及实物退货 |
| POST | /api/v1/outbound/{id}/void | web | 仅可证未入账且无现场下发风险单据作废；原号不复用 |
| GET | /api/v1/web/lists/inbound | web | Web 入库分页；登记时间、原始状态与入账状态独立筛选 |
| GET | /api/v1/web/lists/outbound | web | Web 出库分页；计划与扫码实绩分别汇总 |
| GET | /api/v1/web/lists/stock | web | Web 库存分页、全筛选在库小计与本页待发/可发/FIFO 库龄；统一读取快照 |
| GET | /api/v1/web/lists/audit | web | 近 7 天统一安全记录分页；不读取原始 JSON |
| GET | /api/v1/web/lists/audit/{id} | web | 服务端结构化变化与关联摘要；原始数据需专用入口 |
| GET | /api/v1/web/lists/{kind}/statuses | web | 入库/出库原始状态选项，保留未知值和空值 |
| POST | /api/v1/web/exports | web | 固定筛选、列与视图摘要，异步生成 XLSX 或 CSV；第二任务返回 EXPORT_BUSY |
| GET | /api/v1/web/exports/active | web | 当前生成任务；没有任务返回 null |
| GET | /api/v1/web/exports/{id} | web | 导出进度、预览与本次范围合计；有效期24小时 |
| POST | /api/v1/web/exports/{id}/cancel | web | 取消生成；不提供部分文件 |
| GET | /api/v1/web/exports/{id}/download | web | 下载校验完成的 XLSX 或 CSV；只读 Cookie 会话下载 |
| GET | /api/v1/catalog/versions/{id} | web | 目录版本最新状态和整版放弃证据；只读 |
| GET | /api/v1/catalog/versions/{id}/handoffs | web | 候选基准版本的已登记交接摘要；分页只读，不代表实时设备状态 |
| POST | /api/v1/catalog/versions/{id}/abandon | web | 整版放弃；原因必填、追加证据与审计同事务；同键重放成功，新键重复422 |
| POST | /api/v1/catalog/versions/{id}/rebuild | web | 从上传原文显式重建新候选，使用当前基准，不恢复旧版本 |
| GET | /api/v1/catalog/export | web | 当前搜索全部命中结果 XLSX，固定屏幕版本，不持久化；超过十万行422 |
| GET | /api/v1/catalog | web | 当前目录与可执行发布门禁；仅扫码取重，不参与库存 |
| GET | /api/v1/catalog/search | web | 当前已发布目录条码/规格分页搜索；只读 |
| GET | /api/v1/catalog/spec-summary | web | 当前已发布目录按规格汇总重量；只读 |
| GET | /api/v1/catalog/barcode-trace | web | 查询条码在已发布版本和待发布候选中的出现轨迹；只读 |
| GET | /api/v1/catalog/lookup | web | 当前目录只读扫描测试；无匹配时返回 found=false |
| POST | /api/v1/catalog/uploads | web | 整版校验 txt；422最多返回500条行错误，不持久化；相同内容默认不建版 |
| GET | /api/v1/catalog/uploads/{id} | web | 按原上传 UUID 核验结果，支持响应丢失恢复 |
| GET | /api/v1/catalog/versions | web | 不可变版本历史（包括完整未发布候选） |
| GET | /api/v1/catalog/versions/{versionId}/diff | web | 任意两版游标分页；against缺省沿用基线；不存在404、未校验422 |
| POST | /api/v1/catalog/versions/{versionId}/publish | web | 门禁通过后原子发布；指针、审计、幂等结果同事务 |
| GET | /api/v1/scan/catalog/manifest | web-pda | 当前已发布目录清单；不要求 PDA 在线扫码 |
| GET | /api/v1/scan/catalog/versions/{versionId}/entries | web-pda | 固定历史版分页；同期发布不会混页 |
| GET | /api/v1/scan/plans/{id}/fact-contexts | web-pda | 事实当时版本、ERP作业行、规格及当前版本差异；不改变事实或摘要 |
| POST | /api/v1/scan/handoffs | pda | 上报不可变队列清单；X-Device-Id 必须匹配 deviceId |
| POST | /api/v1/scan/handoffs/{id}/records | pda | 分块登记原 UUID/原正文/原 SHA；X-Device-Id 必须匹配交接设备 |
| GET | /api/v1/scan/handoffs/{id} | pda | 设备分页拉取不可变上下文；须 X-Device-Id |
| GET | /api/v1/catalog/handoffs | web | 设备、未收妥记录数、未核验旧协议活动 |
| GET | /api/v1/catalog/handoffs/{id} | web | 分页核对原单、条码、版本、重量与收妥情况 |
| POST | /api/v1/catalog/handoffs/{id}/bind | web | 按原单批量补齐 ERP 作业上下文；不改原事实 |
| POST | /api/v1/catalog/handoffs/{id}/clients | web | 实物清点后审计关联旧会话/设备；不清零计数 |
| POST | /api/v1/catalog/handoffs/{id}/confirm | web | 原正文全部收妥、清单完整且旧协议水位未变才确认交接 |
| POST | /api/v1/inbound/{id}/confirm | web | 明确确认待确认入库单；库存、流水、审计和幂等结果同事务 |
| POST | /api/v1/stock/adjustments | web | 有资格商品库存调整；原因必填，校验当前值，原子记账 |
| GET | /api/v1/stock/by-source | web | 单一商品来源库存与小计；source或scope=inventory二选一，无跨源合计；未归属不小计 |
| GET | /api/v1/stock/by-source/journal | web | 单一商品来源最近流水；source或scope=inventory二选一，不提供合计 |
| GET | /api/v1/document-numbering | web | RK/CK 编号规则与非占号预览（北京时间） |
| PUT | /api/v1/document-numbering/{kind} | web | 已停用的写入口：固定 3 位，只读；任何修改返回 422 NUMBERING_READ_ONLY |
| GET | /api/v1/stock/journal | web | 最近库存流水；保留原始类型，排除软删 |
| GET | /api/v1/health | 公开 | 本地合成环境健康检查 |
| POST | /api/v1/auth/login | 公开 | 单用户登录；web 使用 HttpOnly Cookie，其他端返回 Bearer |
| GET | /api/v1/auth/me | any | 当前会话 |
| POST | /api/v1/auth/logout | any | 撤销当前会话 |
| GET | /api/v1/outbound | any | 出库列表；单号前缀筛选、服务端分页 |
| POST | /api/v1/outbound | web | 创建待扫码出库计划；不预占库存 |
| PATCH | /api/v1/outbound/{id} | web | 本地 open 计划仅修改车号/备注；保留明细行 ID，已下发或已扫码同样禁止改明细 |
| GET | /api/v1/outbound/{id} | any | 出库详情与逐包实重 |
| POST | /api/v1/outbound/{id}/confirm | web | shipments 的兼容别名；本次实发扣库，发满自动结单，未发满为部分发货 |
| GET | /api/v1/inbound | web | 入库记录分页查询 |
| GET | /api/v1/inbound/{id} | web | 入库单详情及商品总重量 |
| POST | /api/v1/inbound | web | 创建待确认入库单；包数、总吨数独立记录，不增加库存 |
| GET | /api/v1/scan/plans | any | PDA 计划列表 |
| GET | /api/v1/scan/plans/{id} | any | 扫码计划及事实摘要 |
| GET | /api/v1/scan/catalog | any | 只读 v1 兼容目录；PDA 旧协议访问计入发布门禁 |
| POST | /api/v1/scan/plans/{id}/facts | pda | 记录不可变扫码事实；同 UUID 同正文重试幂等 |
| POST | /api/v1/scan/plans/{id}/submit | pda | 结束扫码；校验 revision/digest；不比较计划、不改单据状态、不扣库存 |
| GET | /api/v1/stock | any | 只读库存（包数、整数克） |
| GET | /api/v1/audit | web | 近 7 天最近 100 条安全操作记录（含失败尝试） |

统一响应 `{ code, message, data, traceId }`；重量整数克，吨数展示除以 1,000,000，保留四位小数。
Web 确认要求 Cookie + 允许的 Origin，PDA 与小程序 Bearer 会话不能确认库存。
列表常规参数 page/pageSize/status/keyword；主数据列表额外接受 q 并优先于 keyword；结果 data.items/total/page/pageSize。详情含 lines/facts/digest。