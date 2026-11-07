# 小程序参考

## 1. 当前形态

```text
D:\wms-new\wms-miniapp
微信原生小程序
Vant Weapp
生产 API：https://erp.nbsmzwl.cn
```

页面：

```text
pages/stock/stock                库存查询
pages/inbound/inbound            入库单
pages/inbound/inbound-detail     入库详情
pages/outbound/outbound          出库单
pages/outbound/outbound-detail   出库详情
pages/stock/journal              库存流水
pages/mine/mine                  我的
pages/account/account            账户
pages/login/login                登录
```

## 2. 当前接口

```text
/api/wx-login
/api/login
/api/bind-openid
/api/user/profile
/api/user/change-password
/api/stock/list
/api/stock/warehouse-summary
/api/warehouse/list
/api/supplier/list
/api/customer/list
/api/inbound/order/list
/api/inbound/order/search
/api/inbound/order/:id
/api/outbound/order/list
/api/outbound/order/search
/api/outbound/order/:id
/api/dashboard/analysis
/api/print/template/by-page/:code
/api/print/:templateId/:businessId
```

## 3. 现有能力

```text
账号/微信登录
库存查询
入库单列表/详情
出库单列表/详情
库存流水
我的/账户
打印模板/打印
```

## 4. 重写/升级方向

### P0

```text
页面结构重写
单位：包/吨统一
空态/错误态/加载态
登录过期/重新登录
权限
详情字段与 PC 对齐
查询/分页一致
```

### P1

```text
待确认入库/出库
PDA 扫码状态
库存预警
消息中心
打印/分享
常用筛选/最近查询
```

### P2

```text
报表摘要
多仓库切换
只读离线缓存
```

## 5. 约束

```text
保持微信原生 + Vant Weapp
不换框架
不复制旧页面
不做 PDA 作业
不直接写库存
复用现有 API 契约
```

## 6. 不要做

```text
不要改成 uni-app/Taro
不要引入 PDA 扫码
不要另建业务数据
不要绕过后端直接操作数据库
```
