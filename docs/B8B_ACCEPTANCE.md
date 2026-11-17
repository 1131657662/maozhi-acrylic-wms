# B8b 身份与个人中心验收（2026-11-17）

状态：已完成，用户验收通过；028已应用开发样本库并完成冒烟，功能已合并推送。完整自动化629/234/0。仅本地合成数据与 Chromium / Android 模拟器验证，不等于实体设备或生产验收。

## 范围与实现

起点 `63b5ec8d9eb053869c0a959bde0687656eb1d683`，分支 `codex/b8b-identity`。028 扩展 owner / sessions，保留旧会话并回填编号、创建时间和版本；非空扩展数据在任何 DDL 前拒绝 down。功能阶段只做隔离验证，用户验收后明确授权应用开发样本库，收尾结果见下节。

个人中心提供本人资料、有效会话列表与撤销、改密、退出。新增接口只接受已登录 Web Cookie，写操作校验 Origin 白名单，拒绝 Authorization 头；请求体不能指定账号。显示名保存刷新账号入口，渠道使用中文映射，内部会话 UUID 不展示。密码字段不使用草稿和 React Query mutation 变量缓存，请求结束或离开时清空。

新密码按 UTF-8 12–72 字节、英文字母和数字校验，超过 72 字节明确拒绝。旧超长 bcrypt 密码继续可登录，Web 进入个人中心提醒、PDA 显示提醒、小程序确认提醒后继续查询。修改哈希、时间、auth_epoch、撤销所有渠道会话与成功审计在一个事务；失败独立留安全摘要。

登录失败持久化为账户计数；第五次锁 15 分钟，锁中正确/错误均 429 并返回剩余秒数，不比较密码、不续锁。成功清零，到期下次失败重新从一次计数。HTTP IP 限流独立保留。登录在 bcrypt 比较后、签发前锁 owner 并复核 epoch / 哈希；改密和撤销在 owner 行锁后复验会话。

PDA 仅收到受保护请求 401 才清认证凭据并提示重登；后台到前台使用持久认证标志。并发旧请求的 401 不会清掉新会话，失败登录也不会误清新凭据。扫码队列、UUID、正文、关联信息、目录、计划和交接信息保留，原上传链路继续处理。没有新增业务表、库存写入或权限管理。

## 安全与专项证据

所有日志、截图放在 `.local/evidence/b8b/`，不进 Git。

- 028 迁移 7/7：旧 token 哈希保持、创建时间回填、空扩展 down/up、五个 owner 新字段非默认拒绝回退；`migration-test.log`。
- API / 兼容专项 16/16：三端旧会话全部 401、新密码登录、并发两次改密只一次成功、旧密码已比较的登录不能在改密后签发、审计失败整笔回滚、跨服务锁定、到期恢复、字节边界、渠道/Origin/伪造账号和他人会话拒绝、审计无密码/密码哈希/token；`auth-verified.log`。
- Web 错误提示只放行精确已知文案与合法剩余秒数，未知正文使用安全回退；`web-errors.log`。小程序提醒单测 4/4：正常登录不弹窗、旧超长先提醒、不输出 token；`miniapp-auth.log`。
- 个人中心 E2E 3/3、exit 0：真实三端会话、资料与账号入口同步、取消/确认撤销、当前撤销回登录、错误旧密码、超长密码、成功改密强制回登录、旧 token 逐一 401、浏览器存储无密码、旧超长和锁定倒计时提示；`identity-e2e-release.log`。
- PDA `assembleDebug testDebugUnitTest lintDebug assembleDebugAndroidTest` exit 0，JVM 单测 3/3；`android-build.log`。Pixel_6 模拟器两项 instrumentation 测试 2/2：401 后 Room 重新打开与重新登录保留原 UUID / 正文 / 关联信息；迟到 401 和失败登录不清新凭据；`pda-session-expiry.log`。测试使用独立随机 SharedPreferences / Room 数据库和 HTTP 拦截器，无实体设备操作，无真实服务器扫码写入。模拟器已关闭。

## 完整验证

首轮完整 test 625/629，4 项失败均为旧迁移测试的登录会话保护或固定回退编号错位。测试改为正常退出、回退 028→027→026 后继续原迁移断言，需要后续 HTTP 操作时重新登录。没有绕过 028 保护、没有修改库存断言。修正专项 5/5 + 3/3，通过；`full-test.log`、`migration-compat.log`、`legacy-migration-compat.log` 保留。

第二轮完整 test 628/629，既有 `analysis-duration` 排除计数用例失败，原样专项复跑 4/4。单据创建取 Node 时钟、关闭取 MySQL 时钟，诊断中两者仅间隔 28–48 ms；当时失败未能重现，不能据此断言已证明时钟偏差。该用例只检查排除计数，现显式设置合成单据创建时间早于关闭时间，解除对两处实时钟近邻顺序的隐含依赖，保留全部计数、原因、缺失证据与区间断言。未改统计或库存业务实现；修正专项 4/4。证据：`full-test-final.log`、`analysis-duration-recheck.log`、`analysis-clock-diagnostic.log`、`analysis-duration-stable.log`。

最终完整 `npm run test -- --test-concurrency=4`：629/629，fail / skipped / cancelled 均为 0，exit 0，1141.4 秒；`full-test-release.log`。完整 `npm run build`（严格类型检查与 Web 生产构建）exit 0，`build-final.log`。最终完整 `npm run test:e2e`：234/234（主套件 216，25.2 分钟；目录套件 18，3.7 分钟），exit 0；`full-e2e-release.log`。此前失败的统计、迁移和登录准备场景均在对应完整套件中通过。

首轮完整 E2E 主套件 208/216，新增个人中心 3/3 通过。8 项失败中，7 项 trace 显示登录请求为 429：新认证场景增加 HTTP 登录次数，触及既有每 IP 15 分钟 20 次限流。库存测试的准备函数改为沿既有列表 fixture 方式调用真实登录 service 签发 Cookie，只连接随机隔离测试库，进入页面必须精确匹配“工作台”标题；登录页与 HTTP 限流保留专门覆盖，不调整生产阈值。另 1 项路由测试只填密码，表单明确提示缺用户名，现补齐用户名输入。修正后的个人中心、出库、原键重试、库存调整/流水、登录回跳组合 13/13，exit 0；`e2e-login-compat.log`。`full-e2e.log` 与 `full-e2e-first-traces/` 保留原始失败证据。

AntD lint 9 文件问题 0；设计 token 检查新增 0、既有 22，不扩大本批清理范围。OpenAPI 已生成 `/me` 六个接口及登录兼容提示字段。

## 页面与复核

最终截图 `personal-center-1440.png` 与 `personal-center-1280.png` 由完整 E2E 重跑生成并逐张复核，无横向溢出，资料/密码双栏、会话表和独立退出区完整可达；唯一页面主操作为修改密码。长显示名在账号入口省略，环境标识独占一行。

专项 E2E 初轮问题均保留：资料表与会话表的文字定位冲突；开发服务器尚未代理时预建登录拿到 HTML 200（改为独立 API 且校验 JSON 契约和非空 token）；AntD 双中文按钮的可访问名称含空格（定位兼容空格）。不以 HTTP 200 代替真实成功，不降低断言。

安全/WMS复核覆盖服务端身份来源、参数化 SQL、锁顺序、事务回滚、审计输入白名单、日志仅请求元数据、错误安全文案、密码无持久草稿。小程序 API 对齐：POST `/auth/login` 请求 username/password/channel，响应 data.token 与可选 boolean passwordChangeRecommended；保留 loading、防连点、catch/finally 与 401 重认证。登录页沿原 Vant 组件及全局样式，未增加颜色、尺寸或页面布局。

## 交付边界

功能五笔提交已完成；用户验收后授权以下收尾。不进入 B8c。用户原有 DECISION_LOG / IMPLEMENTATION_PLAN 未提交修改保留，不纳入本批。本批没有生产连接、历史单据迁移、真实作业队列清理、RBAC、多用户管理、找回密码或 OAuth。

## 用户验收后收尾（2026-11-17）

- 连接严格限定 `127.0.0.1:3307/maozhi_dev_sample`，校验 MySQL 实例目录和 app_meta 身份后备份。备份 `.local/evidence/b8b-closeout/before-028.sql`，7,116,790 字节，SHA-256 `aae907d621e33578c0f288425f930c87af4be809b87622674831bc825d55b4b5`，含核验基线；不进入 Git。
- 指纹后执行028，状态 `applied`，exit 0。55张原表投影到原有列后的行数/指纹全部一致（仅schema_migrations新增登记）；7条既有会话全部补齐唯一id与created_at，epoch均0。
- 真实Web个人中心冒烟exit 0：显示名修改为“仓库管理员”，刷新后保留；会话列表可见且仅一条标记当前，会话到期时间与本人资料一致。
- 同账号连续5次错误登录返回 `[401,401,401,401,429]`，最后 `retryAfterSeconds=900`、`Retry-After=900`；锁中正确密码也429。随后按用户要求SQL清除failed_attempts/locked_until，原密码恢复登录200，计数0、锁期限NULL。未调用改密接口；密码哈希保持一致，auth_epoch仍0、password_changed_at仍NULL。52张无关表在冒烟前后指纹一致。
- 备份/指纹/迁移/冒烟/截图/命令退出码保留在 `.local/evidence/b8b-closeout/`。不以开发库改密做验证，改密、并发及全端失效由已通过的自动化覆盖。
- 按用户命令执行 `git checkout master`、`git merge --no-ff codex/b8b-identity -m "merge: b8b identity"`、`git push origin master`，exit均0。功能merge为 `d1226525e26ecac31d8551cd1736581b7c795abc`，首次推送后远端master一致，核对exit 0。收尾文档单独在codex分支提交并非快进合并推送，最终远端结果见本地 `git-results.json`；停止，不开始B8c。
