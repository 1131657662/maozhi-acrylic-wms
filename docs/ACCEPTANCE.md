# 第一里程碑验收记录

## 真实样本导入验收

来源：`erp.nbsmzwl.cn` 的 `wms` 数据库只读事务与本地 `C:\Users\qq113\Desktop\sku.txt`。生产连接先执行 `SET SESSION TRANSACTION READ ONLY`，导出在 `START TRANSACTION READ ONLY ... COMMIT` 中完成；原始 CSV 只存于被 Git 忽略的 `.local/prod-sample/`。

| 数据集 | 导出总行 | 导入总行 | 有效行 | 软删行 |
| --- | ---: | ---: | ---: | ---: |
| product（ERP历史商品） | 428 | 428 | 428 | 0 |
| inbound_order | 115 | 115 | 114 | 1 |
| inbound_order_detail | 182 | 182 | 166 | 16 |
| outbound_order | 415 | 415 | 414 | 1 |
| outbound_order_detail | 544 | 544 | 531 | 13 |
| stock | 122 | 122 | 121 | 1 |
| stock_journal | 828 | 828 | 804 | 24 |
| supplier | 2 | 2 | 1 | 1 |
| customer | 376 | 376 | 376 | 0 |
| warehouse | 3 | 3 | 2 | 1 |
| sku.txt 包级条码 | 9018 | scan_catalog 9018 | 9018 | 0 |

库存流水采用双口径：总行 828、有效行 804，差异为 24 条 `del_flag=1` 软删历史；软删行保留原状态、流水类型和来源 JSON，不参与当前统计。

| 聚合 | 生产只读副本 | 本地导入 | 结果 |
| --- | ---: | ---: | --- |
| 有效库存包数 / 吨 | 4688 / 1408.5930 | 4688 / 1408.5930 | 一致 |
| 有效入库包数 / 吨 | 12639 / 3806.4760 | 12639 / 3806.4760 | 一致 |
| 有效出库包数 / 吨 | 12527 / 3775.7690 | 12527 / 3775.7690 | 一致 |

条码全量校验：9018/9018 命中，重量 9018/9018 一致，未从条码推算；抽样 10 条逐条比较通过。可复现命令：`npm exec tsx scripts/verify-sample-seed.ts`。

`sku.txt` 的 141 种规格独立生成 `SPEC-001` 至 `SPEC-141` 条码目录商品；ERP 428 个历史商品保留原 code。两套商品不建立映射，原因是缺少可靠映射键。`manifest.json` 中行数为本轮验收口径，交接参考数字已过期。

日期：2026-11-07。范围：新项目本地合成数据；没有连接生产数据库/服务器，没有复制旧项目源码。

## 已验证

| 检查                | 结果              | 验证边界                                                                           |
| ------------------- | ----------------- | ---------------------------------------------------------------------------------- |
| TypeScript 严格检查 | 通过              | API、Web、共享契约                                                                 |
| 后端/小程序测试     | 18 项通过         | 每轮独立临时 MySQL 8 库；含小程序真实请求模块与 HTTP 后端对接                      |
| 浏览器 E2E          | 2 项通过          | 登录→详情→Web 确认→库存→日志；1280 空态与退出；1440 布局                           |
| Android Debug 构建  | 通过              | 全新包名 cn.maozhi.wms.pda.debug                                                   |
| Android JVM 单测    | 3 项通过          | 两个实重不相等、缺重拦截、100g 精度拦截                                            |
| Android lint        | 0 errors          | 保留依赖更新/target SDK/中文资源化等警告，不用忽略规则掩盖错误                     |
| Android 仪器测试    | 3 项通过          | Room 关闭重开后事实不变；实际 API 补传/冻结；键盘输入落库与界面截图                |
| 小程序资源检查      | 通过              | Vant 资源、全局组件入口和页面文件完整                                              |
| 小程序 API 对接检查 | 通过              | channel=miniapp；page/pageSize/keyword；items/total；lines/重量字段对齐；401重登录 |
| 小程序 UI 静态检查  | 通过              | 原生+Vant、空态/错误/重试/加载/分页、安全区、长文本省略、按钮防重                  |
| 备份/恢复           | 通过              | MySQL `mysqldump` 单事务备份、库身份检查，恢复到白名单新库，恢复库会话失效         |
| npm 官方安全审计    | 0 vulnerabilities | 执行时已安装 Node 依赖树；不等同生产安全验收                                       |
| AntD CLI 检查       | 0 issues          | 当前 Web 源码                                                                      |

## 第二阶段增量验收

| 检查                    | 结果      | 验证边界                                                                    |
| ----------------------- | --------- | --------------------------------------------------------------------------- |
| 严格类型检查与 Web 构建 | 通过      | Umi Max / Ant Design Pro 工程                                               |
| API 与小程序测试        | 26 项通过 | 临时 MySQL 8 库；含 Web 同源写入及 PDA/小程序权限边界                       |
| 浏览器 E2E              | 4 项通过  | 入库详情、主数据新增、出库计划新建/编辑；另含既有出库确认流程和 1280 宽布局 |
| OpenAPI 文档            | 已更新    | 覆盖主数据、入库、出库计划创建和编辑                                        |

上述结果分别表示代码完成、构建通过和浏览器模拟验收，不代表微信开发者工具、实体 PDA 或生产环境验收完成。

## 核心业务证据

- `302500g + 297500g = 600000g = 0.6000 吨`；未使用统一件重推算。
- PDA 接收事实、重复补传、冻结期间库存和库存流水均不改变。
- Web 确认后由 6 包 / 1.8000 吨变为 4 包 / 1.2000 吨。
- 重复确认同幂等键返回原结果，不重复扣库存；新键携旧修订号被拒绝。
- 不同正文复用事实 ID、同条码重复、跨计划重复、目录重量不符均被拒绝。
- 缺包/计划实重不符/摘要或修订变化不允许冻结。
- 一个单据后续商品库存不足，会回滚此前商品的扣减与流水，单据仍冻结待确认。
- PDA 与小程序会话都不能调用库存确认；Web 会话不能写扫码事实。
- 本机条码队列保存固定 UUID 和原始正文；回传成功与缓存计划更新在 Room 事务中提交。

## 本地证据位置

- `.local/evidence/web-list-1440.png`
- `.local/evidence/web-list-1280.png`
- `.local/evidence/web-detail-1440.png`
- `.local/evidence/inbound-detail-1440.png`
- `.local/evidence/master-data-1440.png`
- `.local/evidence/outbound-plan-1440.png`
- `.local/evidence/pda-scan.png`
- `apps/pda/app/build/reports/tests/testDebugUnitTest/`
- `apps/pda/app/build/reports/lint-results-debug.html`
- `.local/backups/*.sql` 与恢复脚本输出的 `maozhi_restore_*` 新库

## Android 仪器测试复现

使用新建的隔离模拟器或只读 AVD，勿针对承载实际作业队列的设备清数据。
启动独立测试 API：PowerShell 设置 `$env:TEST_PORT='4312'` 后执行 `npx tsx scripts/e2e-api.ts`。
将指定测试模拟器的 `tcp:4310` reverse 到本机 `tcp:4312`；安装本项目 Debug APK 和 AndroidTest APK。
运行 `adb -s <测试模拟器> shell am instrument -w cn.maozhi.wms.pda.debug.test/androidx.test.runner.AndroidJUnitRunner`。
三项测试分别使用独立 Room 数据文件或本项目隔离测试应用，合成计划 002/003；每轮从新测试 API/隔离模拟器开始。
本轮使用 `emulator-5580`，只读 Pixel_6 AVD，没有在连接的实体 PDA 上安装/改数据。

## 不宣称完成的验收

1. 微信开发者工具/微信真机渲染及发布：当前环境没有可用的开发工具 CLI，未用静态检查冒充真机验收。
2. 实体扫码枪厂商广播、功能键、连续 100 包、跨天弱网和设备时钟偏差。
3. 真实条码目录、现场称量、短装/超发放行、作废重扫、计划变更、生产 MySQL 兼容。
4. 生产迁移、备份留存/异地恢复、HTTPS 部署、release 签名和覆盖升级。
5. 第一阶段库存来自合成期初数；第二阶段入库和主数据功能已代码实现并通过浏览器模拟验收，但入库撤销/更正仍未开放；CSV/打印等业务尚未实现。

## 已知技术取舍

- 本地 MySQL 8 仅用于合成数据开发和测试，不把它当成生产部署、生产迁移或现场验收完成。
- ProComponents 3 为固定预发布版本；已跑浏览器测试，仍需随正式版本评估升级。
- Web 采用路由懒加载；ProComponents/AntD 共享包仍较大，生产性能预算尚待后续优化。
- 本阶段列表用有上限的服务端 OFFSET 分页，面向单用户少量单据；大规模导出/游标分页不在第一闭环内。
- 首轮浏览器失败由按钮中文空格、searchbox 语义和重复空态文案匹配引起，已修正选择器及可访问名称；最终两项均通过。
