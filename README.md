# 茂智云仓 · 腈纶仓储管理系统

简称：**茂智腈纶仓**。英文：**Maozhi Acrylic Fiber WMS**。

四端全新实现的第一里程碑：**本地合成出库闭环**。不包含生产连接，不导入旧源码，不修改 warehouse 系统。

## 快速运行

环境：Node.js 24.14+（24.x）、npm；Android 构建另需 JDK 17/21 和 SDK 36。

```powershell
npm ci
npm run setup:demo  # 仅首次；已存在时拒绝覆盖
npm run dev
```

Web：`http://127.0.0.1:5173`；API：`http://127.0.0.1:4310/api/v1`。
用户名与随机密码写在 `.local/demo-access.txt`；仅本机使用，该文件已被 Git 忽略。
本轮已经初始化过，直接 `npm run dev` 即可。所有演示单据、库存、条码明确标识为合成数据。

## 目录

```text
apps/web          React 19 / Ant Design Pro v6.0.3 / Umi Max 工作台
apps/api          Express 模块化后端，MySQL 8 本地隔离开发库
apps/miniapp      原生微信小程序，只读出库查询
apps/pda          Kotlin / Room / WorkManager 出库扫码
packages/contracts  Zod 请求/响应契约、单位与类型
scripts           初始化、测试服务、备份/恢复、API 文档生成
tests/e2e         浏览器验收
docs/references   已有只读参考资产
docs/api          生成的 OpenAPI 3.1 与接口目录
```

## 第一条业务闭环

1. Web 登录查看三张合成出库单。
2. PDA 下载计划和实重目录，选择 `DEMO-001`。
3. 扫 `DEMO-032-11`（302.5 kg）和 `DEMO-032-12`（297.5 kg）。两包不同实重合计 0.6000 吨。
4. 本机保存后可断网；恢复连接补传原 UUID 和原正文，不重新生成事实。
5. PDA 核对并冻结。此时库存仍为 6 包 / 1.8000 吨。
6. Web 详情“核对并确认出库”。库存变为 4 包 / 1.2000 吨，只产生一笔对应商品流水。
7. 小程序查询显示“已出库”。

第二、三张单分别使用 `DEMO-032-21/22`、`DEMO-032-31/32`，每单两包 0.6000 吨。
条码只作为目录键，不从字符串猜重量。入库功能尚未铺开；演示期库存来自明确的合成期初余额，没有入库扫码。

## Android PDA

```powershell
cd apps/pda
# 在 local.properties 中填写自己的 sdk.dir，或由 Android Studio 配置
.\gradlew.bat assembleDebug testDebugUnitTest lintDebug
```

APK：`apps/pda/app/build/outputs/apk/debug/app-debug.apk`。
新包名 `cn.maozhi.wms.pda.debug`，不会覆盖旧 PDA 包。
真机本地测试先执行 `adb -s <设备号> reverse tcp:4310 tcp:4310`，再安装新 APK。
模拟器可填写 `http://10.0.2.2:4310`。本阶段地址白名单仅允许本机；release 不允许明文连接。
支持扫码枪键盘输入 + Enter，以及手输**条码**验证；尚未实现/验收具体厂商广播、物理功能键或 100 包连续硬件扫码。
必须先下载计划与目录才可离线作业。七天以内事实可补传；服务端会话八小时过期，可重新登录，队列保留。
冲突记录保留，不会自动改重量、删记录或冒充成功；当前版本不开放作废重扫和差异放行。

## 微信小程序

```powershell
npm run miniapp:prepare
```

该命令安装依赖并准备 Vant 官方发行资源，验证页面及组件入口。微信开发者工具导入 `apps/miniapp`，使用测试 AppID（当前为 touristappid），启动本地 API即可预览。无需再手动构建 npm。
开发环境已关闭域名校验，以便访问本机；正式发布必须换自有 AppID、HTTPS 合法域名并开启域名校验。
查询页有登录、分页/前缀查询、详情、刷新、错误/空态与会话失效处理；没有库存写入按钮或 PDA 作业能力。

## 验证

```powershell
npm run test
npm run build
npx playwright install chromium
npm run test:e2e
npm run openapi
```

E2E 使用独立临时 MySQL 库和 4311/5174 端口，运行结束后自动删除临时库，不更改开发库。
Android 仪器测试使用单独测试库。`ScanIntegrationTest` 需要启动 `scripts/e2e-api.ts` 的独立测试 API，详见验收文档。

## 备份与恢复

```powershell
npm run backup
npm run restore -- D:\maozhi-acrylic-wms\.local\backups\<文件名>.sql
```

备份使用 MySQL 8 `mysqldump` 的单事务导出。恢复创建白名单内的新库，导入后校验项目身份并清理恢复库会话；**不会覆盖现有开发库**。
需要切换时先停止 API，确认恢复库可用后再显式修改本地开发配置；不提供删除历史数据的自动重置命令。

## 状态与取舍

这是可运行的本地里程碑，**不是生产版，也不是四端全部业务已完成**。
开发库使用隔离的 MySQL 8 实例；业务 SQL、迁移和测试按 MySQL 行为实现，未连接生产数据库，也未导入旧库。
Web 使用可核实的官方 Ant Design Pro v6.0.3 工程结构、Umi Max、ProLayout、ProForm、ProTable 和 ProDescriptions；AntD 6 对应的 ProComponents 3 当前使用固定预发布版本 `3.1.15-9`，已纳入构建和浏览器验收，不自动追新。
生产条码目录、差异容差、库存维度映射、手工称重、CSV、入库和计划编辑在后续里程碑实施。
架构、兼容策略、未定规则见 `docs/IMPLEMENTATION_PLAN.md`；验收证据与局限见 `docs/ACCEPTANCE.md`。
