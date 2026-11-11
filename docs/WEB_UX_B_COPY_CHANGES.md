# B 批文案替换记录

统计范围：apps/web/src 下手写 TS/TSX，排除 .umi / .umi-production。按词的出现次数统计（非文件数）。本轮 49 → 0。菜单配置与报表共享文案另列，不计入这两个数字。

状态与类型使用中文映射，未知值“未识别”，空值“—”；名称为主、编码小字可复制。审计列表不再显示追踪号，原始数据只在已登录详情折叠区查看；未改审计接口或数据结构。

| 文件与原行 | 原文 | 替换后 |
|---|---|---|
| apps/web/src/features/catalog/candidate.tsx:15 | content: 发布后当前目录为 ${version.entryCount} 条。消失条码不需失效确认；已有事实仍保留原版本和重量。${version.entryCount === 0 ? '本次为零条快照，请确认没有遗漏文件内容。' : ''}, | content: 发布后当前目录为 ${version.entryCount} 条。消失条码不需失效确认；已有事实仍保留原版本和重量。${version.entryCount === 0 ? '本次为空条码目录，请确认没有遗漏文件内容。' : ''}, |
| apps/web/src/features/catalog/overview.tsx:14 | description="每次上传当前有效条码的全量快照。新文件中消失的条码不再供新版扫码使用；已扫事实、原重量和原版本永远保留。" | description="每次上传全部有效条码。新文件中消失的条码不再供新版扫码使用；已扫事实、原重量和原版本永远保留。" |
| apps/web/src/features/catalog/page.tsx:49 | <Card title={candidate?.version ? '更换 / 上传下一份全量快照' : '上传全量快照'}> | <Card title={candidate?.version ? '更换或上传全部条码' : '上传全部条码'}> |
| apps/web/src/features/catalog/upload.tsx:41 | description="文件未丢失。核对编码或更换文件后可再次校验。" | description="文件未丢失。核对编码或更换文件后可再次检查。" |
| apps/web/src/features/catalog/upload.tsx:53 | {isPending ? '校验中，当前版本仍可用' : '上传并校验'} | {isPending ? '检查中，当前版本仍可用' : '上传并检查'} |
| apps/web/src/features/catalog/upload.tsx:74 | extra="每行：规格描述、条码、重量 kg；支持 UTF-8 / GB18030，最大 5 MiB。空文件代表零条快照，发布前需确认。" | extra="每行：规格描述、条码、重量 kg；支持 UTF-8 / GB18030，最大 5 MiB。空文件代表空条码目录，发布前需确认。" |
| apps/web/src/features/catalog/version-history.tsx:84 | { title: '校验时间', dataIndex: 'createdAt' }, | { title: '检查时间', dataIndex: 'createdAt' }, |
| apps/web/src/features/corrections/detail-actions.tsx:30 | <Tooltip title="待接入积木报表"> | <Tooltip title="打印暂不可用"> |
| apps/web/src/features/master-data/catalog-table.tsx:88 | aria-label="搜索主数据" | aria-label="搜索基础资料" |
| apps/web/src/features/master-data/catalog-table.tsx:113 | title: '主数据目录', | title: '基础资料目录', |
| apps/web/src/features/master-data/catalog-table.tsx:116 | locale={{ emptyText: '暂无主数据' }} | locale={{ emptyText: '暂无基础资料' }} |
| apps/web/src/features/master-data/copy.ts:2 | title: '主数据', | title: '基础资料', |
| apps/web/src/features/master-data/copy.ts:4 | newItem: '新增主数据', | newItem: '新增基础资料', |
| apps/web/src/features/outbound/editor.tsx:75 | : '计划不会预占库存；库存仅由 Web 出库确认事务扣减。'} | : '计划不会占用库存；核对实物并确认出库后才扣减库存。'} |
| apps/web/src/features/outbound/stock.tsx:29 | extra: <Tag data-testid="stock-source-label">库存口径：库存商品</Tag>, | extra: <Tag data-testid="stock-source-label">统计范围：库存商品</Tag>, |
| apps/web/src/features/reports/pages.tsx:32 | 同口径月度汇总 | 查看对应月度汇总 |
| apps/web/src/features/reports/pages.tsx:56 | 同口径出入库明细 | 查看对应出入库明细 |
| apps/web/src/features/reports/reconciliation.tsx:65 | <Tag>库存商品 · 唯一库存口径</Tag> | <Tag>仅统计库存商品</Tag> |
| apps/web/src/features/stock/adjustment-fields.tsx:44 | description={${afterPackages} 包 / ${tonnes(afterWeight)} 吨；实际结果以事务提交为准。} | description={${afterPackages} 包 / ${tonnes(afterWeight)} 吨；保存成功后生效。} |
| apps/web/src/features/stock/journal-detail.tsx:19 | ? '本系统事务记录' | ? '本系统入账记录' |
| apps/web/src/features/stock/journal-detail.tsx:21 | ? 'ERP 历史快照 · 保留原值，ID 为原流水定位' | ? '历史库存记录 · 保留当时的数量' |
| apps/web/src/features/stock/source-panel.tsx:19 | stockError instanceof ZodError ? '返回数据未通过来源校验，请重试；未展示任何小计。' : stockError.message | stockError instanceof ZodError ? '库存数据异常，请重试；暂不显示小计。' : stockError.message |
| apps/web/src/features/stock/source-table.tsx:12 | { title: '商品名称', dataIndex: 'productName', renderText: (name) => name ?? '未关联主数据' }, | { title: '商品名称', dataIndex: 'productName', renderText: (name) => name ?? '未关联基础资料' }, |
| apps/web/src/features/stocktake/create.tsx:28 | content="生成快照即开始盘点；范围此后不可修改。" | content="保存开始时库存并开始盘点；范围此后不可修改。" |
| apps/web/src/features/stocktake/create.tsx:39 | description="暂停入库确认、出库确认、库存调整与误确认撤销；其他仓库、PDA 扫码和补传不受影响。请确认现场可以按快照时点实盘。" | description="暂停入库确认、出库确认、库存调整与误确认撤销；其他仓库、PDA 扫码和补传不受影响。请确认现场可以按盘点开始时实盘。" |
| apps/web/src/features/stocktake/create.tsx:46 | submitter={{ resetButtonProps: false, searchConfig: { submitText: '生成快照并开始盘点' } }} | submitter={{ resetButtonProps: false, searchConfig: { submitText: '开始盘点' } }} |
| apps/web/src/features/stocktake/create.tsx:66 | extra="不选时盘点该仓全部 商品库存。指定商品即使当前无库存，也生成零库存快照；最多指定 100 个商品。" | extra="不选时盘点该仓全部 商品库存。指定商品即使当前无库存，也生成零库存记录；最多指定 100 个商品。" |
| apps/web/src/features/stocktake/detail.tsx:33 | <Tag>库存口径：库存商品</Tag> | <Tag>统计范围：库存商品</Tag> |
| apps/web/src/features/stocktake/detail.tsx:45 | title="盘点快照" | title="盘点开始时库存" |
| apps/web/src/features/stocktake/detail.tsx:49 | { title: '快照时间', render: () => listTime(take.snapshotAt) }, | { title: '盘点开始时间', render: () => listTime(take.snapshotAt) }, |
| apps/web/src/features/stocktake/detail.tsx:51 | { title: '快照包数', dataIndex: 'snapshotPackages' }, | { title: '开始时包数', dataIndex: 'snapshotPackages' }, |
| apps/web/src/features/stocktake/detail.tsx:52 | { title: '快照总吨数', render: () => tonnes(take.snapshotWeightGrams) }, | { title: '开始时总吨数', render: () => tonnes(take.snapshotWeightGrams) }, |
| apps/web/src/features/stocktake/lines.tsx:25 | title: '快照（包 / 吨）', | title: '开始时库存（包 / 吨）', |
| apps/web/src/features/stocktake/lines.tsx:55 | headerTitle="实盘明细 · 差异 = 实盘 − 固定快照" | headerTitle="实盘明细 · 差异 = 实盘 − 盘点开始时库存" |
| apps/web/src/features/stocktake/list.tsx:35 | { title: '快照时间', width: 180, render: (_, r) => listTime(r.snapshotAt) }, | { title: '盘点开始时间', width: 180, render: (_, r) => listTime(r.snapshotAt) }, |
| apps/web/src/features/stocktake/list.tsx:50 | content="仅盘点 库存商品；快照固定，实盘包数与吨数独立记录。" | content="仅盘点 库存商品；开始时库存固定，实盘包数与吨数独立记录。" |
| apps/web/src/features/stocktake/post-drawer.tsx:51 | description={已录 ${take.recordedCount}/${take.lineCount} 行。差异始终按固定快照计算；包数与吨数分别核对。零差异也需人工完成，不写零变化流水。} | description={已录 ${take.recordedCount}/${take.lineCount} 行。差异始终按盘点开始时库存计算；包数与吨数分别核对。零差异也需人工完成，不写零变化流水。} |
| apps/web/src/features/stocktake/post-drawer.tsx:62 | description="入库显示登记量，出库分别显示计划量与已扫量。先核对并处理这些单据；暂停期间不能直接确认入账。如按快照时点实盘，请确认实盘数已排除快照之后的收发影响。该选择连同清单留审计，不修改这些单据。" | description="入库显示登记量，出库分别显示计划量与已扫量。先核对并处理这些单据；暂停期间不能直接确认入账。如按盘点开始时实盘，请确认实盘数已排除盘点开始之后的收发影响。该选择连同清单留审计，不修改这些单据。" |
| apps/web/src/features/stocktake/post-drawer.tsx:71 | 按快照时点口径回写（已核对上述未入账收发货） | 按盘点开始时的数量回写（已核对上述未入账收发货） |
| apps/web/src/features/stocktake/reading-drawer.tsx:52 | 固定快照：{line.snapshot.packages} 包 / {tonnes(line.snapshot.weightGrams)} 吨 | 盘点开始时库存：{line.snapshot.packages} 包 / {tonnes(line.snapshot.weightGrams)} 吨 |
| apps/web/src/features/stocktake/unposted-table.tsx:8 | headerTitle={快照后未入账收发货 · ${rows.length} 张} | headerTitle={盘点开始后未入账收发货 · ${rows.length} 张} |
| apps/web/src/features/stocktake/unposted-table.tsx:15 | locale={{ emptyText: '未发现快照后发生的未入账收发货' }} | locale={{ emptyText: '未发现盘点开始后发生的未入账收发货' }} |
| apps/web/src/features/stocktake/unposted-table.tsx:23 | { title: '口径', width: 120, render: (_, r) => (r.kind === 'inbound' ? '入库登记量' : '出库计划量') }, | { title: '统计方式', width: 120, render: (_, r) => (r.kind === 'inbound' ? '入库登记量' : '出库计划量') }, |
| apps/web/src/features/stocktake/void-drawer.tsx:31 | description="原快照和实盘记录保留。作废后不能重开，需要时新建盘点；该仓恢复确认。" | description="开始时库存和实盘记录保留。作废后不能重开，需要时新建盘点；该仓恢复确认。" |
| apps/web/src/features/web-exports/panel.tsx:158 | <p data-testid="export-fields">字段顺序：{fields.map((field) => field.label).join('、')}</p> | <p data-testid="export-fields">导出列顺序：{fields.map((field) => field.label).join('、')}</p> |
| apps/web/config/routes.ts:73 | name: '主数据', | name: '基础资料', |
| packages/contracts/src/report-fields.ts:30 | text('formula', '公式与口径', 56), | text('formula', '公式与统计方式', 56), |
| packages/contracts/src/report-fields.ts:32 | text('timeStatus', '时间口径', 28), | text('timeStatus', '时间统计方式', 28), |
| packages/contracts/src/report-fields.ts:52 | text('timeStatus', '时间口径', 28), | text('timeStatus', '时间统计方式', 28), |
| packages/contracts/src/report-fields.ts:82 | text('timeStatus', '时间口径'), | text('timeStatus', '时间统计方式'), |
| packages/contracts/src/report-fields.ts:112 | text('timeStatus', '时间口径'), | text('timeStatus', '时间统计方式'), |
| apps/api/src/features/reports/anchors.ts:19 | for (const item of cell.periods.values()) mark(item, '仅有库存快照，未记录可定位的切账时间/流水；不可验证'); | for (const item of cell.periods.values()) mark(item, '仅有库存余额，缺少对应的入账时间和变动记录，暂无法核对'); |
| apps/api/src/features/reports/anchors.ts:26 | reason: '末笔流水与独立库存快照不一致', | reason: '末笔库存变动后的余额与当前库存不一致', |
| apps/api/src/features/reports/anchors.ts:73 | if (!seen.has(key)) for (const row of cell.periods.values()) mark(row, '缺少独立期末库存快照，未按零处理'); | if (!seen.has(key)) for (const row of cell.periods.values()) mark(row, '缺少独立的期末库存记录，未按零处理'); |
| apps/api/src/features/reports/normalize.ts:82 | nameBasis: ${source.product_name ? '商品：原流水快照' : '商品：当前主数据'}；${source.warehouse_name ? '仓库：原流水快照' : '仓库：当前主数据'}, | nameBasis: ${source.product_name ? '商品：当时名称' : '商品：当前名称'}；${source.warehouse_name ? '仓库：当时名称' : '仓库：当前名称'}, |
| apps/api/src/features/reports/projection.ts:98 | reconciliation.reasons.push('存在无法判定库存来源的流水，未混入有库存资格商品的发生额；需核实主数据'); | reconciliation.reasons.push('存在无法判定库存来源的流水，未混入有库存资格商品的发生额；需核实基础资料'); |

最终固定文案集中在 apps/web/src/business-copy.ts、各功能 copy.ts 与 packages/contracts/src/business-labels.ts；记录中的行号为替换前位置。

## 完整回归补充

| 位置 | 原展示 | 最终展示 |
|---|---|---|
| reports/accumulate.ts、copy.ts | 内部流水编号、delta、英文未知类型、流水链断点 | 库存变动前后数量缺失/不一致、未分类库存变动、相邻记录数量不衔接 |
| reports/anchors.ts | 库存锚点、机械替换的“开始时库存” | 导入时库存、当前库存、期末库存记录 |
| reports/normalize.ts | 未分类后附原始类型；原流水快照 | 未分类库存变动；商品/仓库当时名称 |
| report-fields.ts、reconciliation.tsx、report-sheet.ts | 流水/操作 ID、原始类型、水位 | 页面与导出不展示内部标识；保留业务单号和操作中文 |
| list-display.ts | 报表来源/未知单据类型原值 | 库存商品/未识别 |
| web-exports/report-sheet.ts | 公式与口径 | 公式与统计方式 |

上述补充只改变展示文案与可导出列，不改变报表算术、记录定位 ID、导出一致性令牌或审计原始数据。

计数说明：相对 A 合并点 `0d8d293`，手写 Web 源码共 50 → 0；本表文案子项的直接前置提交已在错误提示改造中去掉 1 处，因此该子项原记录为 49 → 0。全批机器结果见 `.local/evidence/web-ux-b/copy-final-count.json`。
