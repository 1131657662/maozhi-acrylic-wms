# B1c-2 隔离验收复现

这些脚本只用于本项目的隔离合成验收，不是现场清队列或安装批处理。禁止对真实作业包执行清数据、卸载、重置或测试 seed。

## 证据与环境

- 本次实体 M71 / Android 9 / API 28；开始时未安装本项目应用，因此没有可读取的本项目现场队列，不能把其他应用的队列记为 0。75bdbbee 经用户排除。
- 旧合成队列：60 条（pending 55、failed 5）；服务器预先收到其中 2 条，模拟丢响应，2 是 60 的子集。原始 JSON 仅放 `.local/evidence/b1c2-legacy-records.json`，不提交。
- 成功升级/混版包 `cn.maozhi.wms.pda.b1c2test.debug`；迁移中断恢复包 `cn.maozhi.wms.pda.b1c2recovery.debug`；两者不覆盖正常包。
- 旧 APK 来自本仓库基线 `acc488d8cb47c9d718d4a0b5385938b6d83f3022`，仅改变隔离 applicationId 并加入 `legacy-fixture/LegacyFixtureTest.kt`；不是复制旧 ERP 业务代码。提取到 `.local/b1c2-baseline/source/` 和 `.local/b1c2-recovery/source/`，保留原 APK 与 SHA。

## 操作顺序

1. 只在明确隔离包的空库运行旧 APK 的 `LegacyFixtureTest#seed`；它会拒绝非空计划库。pull 其 `legacy-records.json` 到上述忽略路径。实际项目队列只盘点/备份，不能套用该 seed。
2. `npx tsx scripts/pda/evidence-api.ts` 创建 3307 随机测试库并启动 4313；服务初始化 2 条已收事实。中断重启只能加 `--resume`，它读取原测试库名且不重置数据；原始日志留 `.local/evidence/`。
3. 新 APK 用 `gradlew.bat -p apps/pda -PvalidationApplicationId=cn.maozhi.wms.pda.b1c2test assembleDebug assembleDebugAndroidTest`；`adb -s <指定设备> reverse tcp:4310 tcp:4313`，安装此独立包；按阶段运行 `B1c2DeviceTest#migrateAndHandoff`。
4. Web 核验/批量绑定原单行（Playwright `catalog-handoff.spec.ts`），或隔离辅助脚本 `npx tsx scripts/pda/evidence-stage.ts bind`；随后运行 `B1c2DeviceTest#uploadLegacyQueue`，60 条原文收妥后才能确认交接。
5. 移除该设备的 `reverse tcp:4310`，运行 `B1c2DeviceTest#offlineHundredAndReopen`；它先断言 API 不可达，100 条重开后仍在、刷新失败、第 101 条仍能保存。此阶段测试不可在同一已填充夹具上重跑。
6. `evidence-stage.ts publish` 确认收妥水位并发布 v2；恢复本地 reverse 后运行 `B1c2DeviceTest#refreshAndContinueOriginalOrder`：原单加新码、原 v1 保留、旧离线 101 条在 v2 发布后接收、原单冻结。`evidence-stage.ts confirm` 用 Web 服务语义确认出库，不让 PDA 扣库存。
7. `B1c2ConflictTest` 用独立本地 DB 证明不存在版本 409 入可见冲突、合法 v1 继续接收；`B1c2UiTest` 渲染原单和 300→302 提示。冲突测试会上传一个合法条码，重复跑须使用新的隔离服务器夹具，不能重置现场数据。
8. `verify-device-queue.py --serial <指定设备> --adb <adb.exe>` 只读下载上述验证包 DB（包括 WAL），比对原 60 条正文与同单版本分布；`npx tsx scripts/pda/verify-server-sql.ts` 执行 `scripts/sql/verify-pda-handoff.sql` 对账。

## 可重复的小型故障验证

- `OfflinePersistenceTest,CatalogSafetyTest` 每次使用随机、独立的本地测试 DB；需移除 reverse4310。分别验证 100+1 条持久事实、坏 SHA 不切换、head 写入失败整体回滚、20 并发仅一个清单、未完成清单不可重建。只清理测试自身 UUID 数据库。
- 迁移中断使用另一空隔离恢复包：旧 APK seed 后，新 APK 构建参数改为 `-PvalidationApplicationId=cn.maozhi.wms.pda.b1c2recovery`。执行 `python -X utf8 scripts/pda/verify-interruption.py --recovery --serial <设备> --adb <adb.exe>`。脚本先用 aapt 校验新/旧 APK 的隔离包名，错误包在任何安装前拒绝。
- 故障点在实际 Room 迁移写入后、commit 前；宿主 force-stop，再原位安装旧 APK（保留数据），检查原正文/冻结 key 并实际启动 UI、抓取 60/61 图片。这只证明未提交迁移可恢复，**不允许成功迁移后随意降级**。
- 测试套件必须指定上述 class/method；不要在承载队列的应用上运行全部历史 AndroidTest。实体扫码枪、厂商广播、真实作业队列/生产仍未验收。
