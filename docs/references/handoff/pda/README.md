# WMS PDA 试点

这是独立于旧 B Android 客户端的 PDA vertical slice。当前 2B-2 合成链路包含：

- 账号密码登录，并用 Android Keystore 加密保存 access token；
- 从 `/api/slice/pda/catalog` 分页下载条码目录到本地 Room；
- 选择已关联车辆的正式出库单，离线扫码入队，保存条码、商品、目录版本、逐件实重；
- 仅目录缺实重时允许现场称重手输，补传携带 onsite_weighing 并由服务端记录认证操作者；有目录重量时禁止 manual 覆盖。零/负/非法目录重量须更正，不能当缺重；不使用计划/标准重量。目录克重按 100g 精度无损转吨，不能表示的重量明确拒绝；
- 固定 submission/batch/fact ID 分批补传；冻结使用服务端 scan-status 的 version/facts_digest；释放保留旧事实并允许重扫，已出库条码由服务端拒绝；
- 本客户端不扣库存、不创建临时订单，也不连接生产。物理扫码头及 K1/K2 仍未验证。

## V10 首切片

启动入口已切换为 `V10MainActivity`：

- 腈纶品牌登录页；
- 作业优先首页：当前作业、扫码计划、离线计划、待同步；
- 作业 / 记录 / 工具三 Tab；
- 扫码计划使用 V10 列表，按状态显示未领取/进行中/待补扫/已完成；
- 点击计划进入 V10 连续扫码页，复用现有扫码事实、离线队列和提交逻辑；
- V10 扫码记录页支持选择任意记录、导出和删除确认；
- V10 差异核对页展示短装/超发，确认后提交并进入只读完成页；
- V10 领取中/计划占用有独立状态，409 时不开放扫码；
- V10 离线计划页列出本机计划，可逐单扫码/同步；新建使用 V10 离线创建页；
- V10 同步结果页展示成功/失败条数，失败计划保留本机；
- 离线计划支持原始顺序/按规格导出；
- V10 记录 Tab 按计划列出有效记录，并进入逐条记录页；
- V10 SKU 管理页支持本地版本、USB 文本导入和云端更新；
- 启动时调用 `/api/session/refresh` 滑动续期；JWT 过期返回登录页；
- 首页显示真实在线/离线状态和本机待同步数量；
- 首页缓存最后一次进行中的计划，断网时显示“离线缓存”；
- V10 设置页显示账号、服务器、版本、SKU 版本和退出登录；
- 旧 `MainActivity` 保留为 `exported=false`，不再作为启动入口，WMS 出库工作台未暴露。

这一步覆盖外壳、首页、计划列表、连续扫码、记录、差异、完成、离线和 SKU 主页面。

## 本地运行

先启动后端合成试点服务：

```powershell
cd D:\wms-new\wms-backend
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-slice.ps1
```

在 PDA 工程执行单元测试和 debug 构建：

```powershell
cd D:\wms-new\wms-pda
.\gradlew.bat testDebugUnitTest assembleDebug assembleDebugAndroidTest lintDebug
```

默认 debug API 地址是 `http://127.0.0.1:3101/api/slice/`。Android 模拟器访问宿主机时使用：

```powershell
.\gradlew.bat assembleDebug -PpdaApiBaseUrl=http://10.0.2.2:3101/api/slice/
```

debug 构建允许本地 HTTP；正式构建默认禁止明文流量。当前服务只使用本机合成测试库，G0 真实快照仍未验证。

真机连接本机服务：`adb -s <设备序列号> reverse tcp:3101 tcp:3101`。APK 使用 `install -r` 升级；不要卸载/清除数据。Room v1→v2 保留旧队列为 UNASSIGNED，不猜订单或重量。

后端验收：`node scripts/smoke-slice-weight-2b.js`，强制只连 127.0.0.1:3101 / 13306 并核验测试库身份；会保留本次合成单据/条码作为证据。G0 仍阻塞；这不是正式业务验收。详见 [2B-2 运行记录](docs/2B-2-WEIGHT-RUNNING-EVIDENCE.md)。

B 当前目录的已确认来源仅为 ACTIVE v4 的 9,018 个不同 bale；历史独有/跨版本冲突不能作为当前可扫目录。本机仍只用合成数据，未导入 B 实物数据。2B-2 合成验收通过，2B 暂不关闭。
